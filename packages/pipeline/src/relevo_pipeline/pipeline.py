"""Orquestra as etapas do pipeline e guarda os resultados intermediários.

    [0] ajuste (recorte/rotação do usuário) -> [1] segmentação -> [1b] orientação automática
    -> [1c] contorno -> [2] alinhamento/registro -> [3] visual hull (SDF) + seção transversal
    -> [4] Marching Cubes -> consistência -> [7] cor

Os intermediários (máscaras, voxels, contornos) são devolvidos para o "Raio-X do pipeline" e
para o front desenhar o contorno sobre as fotos.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np
import trimesh

from relevo_pipeline.ajuste import AjusteFoto, aplicar_ajuste, aplicar_matriz
from relevo_pipeline.alinhamento import VistasAlinhadas, alinhar_vistas
from relevo_pipeline.contorno import medidas, rastrear_contorno, simplificar
from relevo_pipeline.cor import colorir_malha
from relevo_pipeline.malha import campo_para_malha
from relevo_pipeline.metricas import avisos_consistencia, consistencia
from relevo_pipeline.orientacao import Orientacao, orientar_lateral, orientar_topo
from relevo_pipeline.segmentacao import qualidade_mascara, segmentar
from relevo_pipeline.vistas import VISTAS, validar_nomes
from relevo_pipeline.voxel import campo_implicito, campo_secao, esculpir

# Quem tem orientação automática: a lateral (espelha) e as vistas de cima/de baixo (giram).
# outro_lado/frente/tras não têm pista confiável; o outro lado é resolvido pelo registro.
SENTIDO = {90: "90° no sentido horário", 180: "180°", 270: "90° no sentido anti-horário"}
# Largura/comprimento no topo: tênis reais ficam entre 0,35 e 0,42; acima disso há algo a mais
PROPORCAO_TOPO_MAXIMA = 0.55
ORIENTADORES = {"lateral": orientar_lateral, "topo": orientar_topo, "sola": orientar_topo}


@dataclass
class ResultadoPipeline:
    malha: trimesh.Trimesh
    mascaras: dict[str, np.ndarray]
    vistas: VistasAlinhadas
    voxels: np.ndarray
    tempos_s: dict[str, float] = field(default_factory=dict)
    orientacoes: dict[str, Orientacao] = field(default_factory=dict)
    consistencia: dict[str, float] = field(default_factory=dict)
    # Mensagens para o usuário (transparência): o que corrigimos e o que pode estar ruim
    avisos: list[str] = field(default_factory=list)
    # Contorno de cada foto na foto ORIGINAL (x, y em pixels) + perímetro/área
    contornos: dict[str, dict] = field(default_factory=dict)
    # Ajuste aplicado e matriz 3×3 "foto processada -> foto original" de cada vista
    ajustes: dict[str, dict] = field(default_factory=dict)
    secao: dict = field(default_factory=dict)

    @property
    def metricas(self) -> dict:
        return {
            "vistas": list(self.mascaras),
            "dims_voxels": list(self.vistas.dims),
            "voxels_ocupados": int(self.voxels.sum()),
            "vertices": int(len(self.malha.vertices)),
            "faces": int(len(self.malha.faces)),
            "fechada": bool(self.malha.is_watertight),
            "colorida": bool(self.malha.visual.kind == "vertex"),
            "dimensoes_cm": [round(float(v), 2) for v in self.malha.extents],
            "orientacao": {k: o.descrever() for k, o in self.orientacoes.items()},
            "registro": {"espelhamento_trocado": self.vistas.registradas},
            "secao": self.secao,
            "consistencia": self.consistencia,
            "avisos": self.avisos,
            "ajustes": self.ajustes,
            "contornos": self.contornos,
            "tempos_s": {k: round(v, 3) for k, v in self.tempos_s.items()},
        }


def processar(
    lateral_bgr: np.ndarray,
    topo_bgr: np.ndarray,
    frente_bgr: np.ndarray | None = None,
    comprimento_cm: float = 28.0,
    resolucao: int = 128,
    colorir: bool = True,
    *,
    extras: dict[str, np.ndarray] | None = None,
    ajustes: dict[str, AjusteFoto] | None = None,
    secao: bool = True,
) -> ResultadoPipeline:
    """Gera o modelo 3D.

    `extras`: fotos opcionais além das 3 principais — "outro_lado", "sola", "tras".
    `ajustes`: recorte/rotação escolhidos pelo usuário, por vista (ver ajuste.py).
    `secao`: aplica a hipótese de seção transversal comum (voxel.campo_secao).
    """
    tempos: dict[str, float] = {}
    avisos: list[str] = []
    fotos = {"lateral": lateral_bgr, "topo": topo_bgr}
    if frente_bgr is not None:
        fotos["frente"] = frente_bgr
    fotos.update(extras or {})
    ajustes = ajustes or {}
    validar_nomes(fotos)
    validar_nomes(ajustes)
    sem_foto = sorted(set(ajustes) - set(fotos))
    if sem_foto:
        raise ValueError(f"Há ajuste para vista sem foto: {', '.join(sem_foto)}.")

    # [0] Ajuste do usuário. `matrizes[v]` leva um ponto da foto processada à foto ORIGINAL.
    matrizes: dict[str, np.ndarray] = {}
    for vista in fotos:
        fotos[vista], matrizes[vista] = aplicar_ajuste(fotos[vista], ajustes.get(vista))

    t = time.perf_counter()
    mascaras = {}
    for vista, img in fotos.items():
        mascaras[vista], bruta = segmentar(img)
        avisos += qualidade_mascara(mascaras[vista], bruta, VISTAS[vista].rotulo)
    tempos["segmentacao"] = time.perf_counter() - t

    # [1b] Orientação automática — só onde o usuário não girou a foto à mão
    orientacoes = {}
    for vista, orientar in ORIENTADORES.items():
        if vista not in fotos or (vista in ajustes and ajustes[vista].rotacao_graus % 360):
            continue
        o = orientacoes[vista] = orientar(mascaras[vista])
        altura, largura = mascaras[vista].shape
        mascaras[vista] = o.aplicar(mascaras[vista])
        fotos[vista] = o.aplicar(fotos[vista])
        matrizes[vista] = matrizes[vista] @ o.matriz(largura, altura)
    avisos += _avisos_orientacao(orientacoes)

    # [1c] Contorno rastreado, levado de volta à foto original (para desenhar no front)
    contornos = {}
    for vista, m in mascaras.items():
        poligono = aplicar_matriz(matrizes[vista], simplificar(rastrear_contorno(m)))
        contornos[vista] = {"pontos": np.round(poligono, 1).tolist(), **medidas(poligono)}

    t = time.perf_counter()
    vistas = alinhar_vistas(
        mascaras["lateral"],
        mascaras["topo"],
        mascaras.get("frente"),
        resolucao=resolucao,
        extras={v: m for v, m in mascaras.items() if v not in ("lateral", "topo", "frente")},
    )
    tempos["alinhamento"] = time.perf_counter() - t
    L, _, W = vistas.dims
    if W / L > PROPORCAO_TOPO_MAXIMA:
        avisos.append(
            f"Na foto de cima o tênis saiu largo demais ({W / L:.0%} do comprimento; o normal é "
            "35–45 %). Parece haver mais de um tênis (o par?) ou algo encostado nele: use o "
            "recorte para deixar só um tênis na foto."
        )
    for vista in vistas.registradas:
        avisos.append(
            f"A foto {VISTAS[vista].rotulo} parece ser do outro pé do par (imagem espelhada): "
            "espelhamos para encaixar com as outras."
        )

    t = time.perf_counter()
    voxels = esculpir(vistas)  # versão binária: métricas e Raio-X
    campo = campo_implicito(vistas)  # versão contínua: gera a malha sem degraus
    info_secao = {"usada": False}
    if secao:
        campo_s, perfil = campo_secao(campo)
        final = np.maximum(campo, campo_s)
        removido = 1 - (final < 0).sum() / max(1, (campo < 0).sum())
        info_secao = {
            "usada": True,
            "volume_removido_pct": round(100 * float(removido), 1),
            "perfil_preenchido_pct": round(100 * float(perfil.mean()), 1),
        }
        campo = final
    tempos["visual_hull"] = time.perf_counter() - t

    t = time.perf_counter()
    malha = campo_para_malha(campo, comprimento_cm=comprimento_cm)
    tempos["marching_cubes"] = time.perf_counter() - t

    cons = consistencia(vistas, campo < 0)
    avisos += avisos_consistencia(cons)

    if colorir:
        t = time.perf_counter()
        colorir_malha(malha, vistas, mascaras, fotos)
        tempos["cor"] = time.perf_counter() - t

    return ResultadoPipeline(
        malha=malha,
        mascaras=mascaras,
        vistas=vistas,
        voxels=voxels,
        tempos_s=tempos,
        orientacoes=orientacoes,
        consistencia=cons,
        avisos=avisos,
        contornos=contornos,
        ajustes={
            v: {
                **(ajustes[v].para_dict() if v in ajustes else AjusteFoto().para_dict()),
                "matriz": np.round(matrizes[v], 4).tolist(),
            }
            for v in fotos
        },  # fmt: skip
        secao=info_secao,
    )


def _avisos_orientacao(orientacoes: dict[str, Orientacao]) -> list[str]:
    avisos = []
    for vista in ("topo", "sola"):
        o = orientacoes.get(vista)
        if o is None:
            continue
        nome = "de topo" if vista == "topo" else "da sola"
        if o.alterada:
            avisos.append(
                f"Giramos a foto {nome} {SENTIDO[o.graus_horario]} para deixar o calcanhar à "
                "esquerda e o bico à direita."
            )
        elif not o.confiante:
            avisos.append(
                f"Não deu para saber, pela foto {nome}, onde fica o bico. Confira se o calcanhar "
                "está à esquerda e o bico à direita."
            )
    lateral = orientacoes.get("lateral")
    if lateral is not None and lateral.espelhada:
        avisos.append(
            "Espelhamos a foto lateral para deixar o calcanhar à esquerda e o bico à direita."
        )
    elif lateral is not None and not lateral.confiante:
        avisos.append(
            "Não deu para saber, pela foto lateral, onde fica o calcanhar. Confira se ele está "
            "à esquerda e o bico à direita."
        )
    return avisos
