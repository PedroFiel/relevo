"""Intermediários do Raio-X [F1-T08 item 2, F5-T01]: máscaras, voxels de superfície, malha bruta."""

import io

import cv2
import numpy as np
import pytest
import trimesh
from relevo_pipeline import processar
from relevo_pipeline.exportar import intermediarios, voxels_de_superficie
from relevo_pipeline.sintetico import gerar_fotos


@pytest.fixture(scope="module")
def resultado():
    f = gerar_fotos()
    return processar(f["lateral"], f["topo"], f["frente"], resolucao=64, faces_alvo=3000)


def test_superficie_de_um_cubo_cheio_e_so_a_casca():
    cubo = np.ones((5, 5, 5), bool)
    casca = voxels_de_superficie(cubo)
    assert len(casca) == 5**3 - 3**3  # tudo menos o miolo 3×3×3
    assert ((casca == 0) | (casca == 4)).any(axis=1).all()


def test_guarda_a_malha_antes_da_decimacao(resultado):
    assert resultado.malha_bruta is not None
    assert len(resultado.malha_bruta.faces) == resultado.decimacao["faces_antes"]
    assert len(resultado.malha.faces) < len(resultado.malha_bruta.faces)
    assert resultado.malha_bruta.visual.kind != "vertex"  # a cor só vai na final


def test_intermediarios_abrem_e_ficam_no_lugar_da_malha(resultado):
    arquivos = intermediarios(resultado)
    mascaras = {f"mascara-{v}.png" for v in ("lateral", "topo", "frente")}
    assert set(arquivos) == mascaras | {"voxels.glb", "malha-bruta.glb"}

    m = cv2.imdecode(np.frombuffer(arquivos["mascara-topo.png"], np.uint8), cv2.IMREAD_GRAYSCALE)
    assert set(np.unique(m)) == {0, 255}

    pontos = trimesh.load(io.BytesIO(arquivos["voxels.glb"]), file_type="glb")
    pts = next(iter(pontos.geometry.values())).vertices
    assert len(pts) == len(voxels_de_superficie(resultado.voxels))
    # Os voxels (visual hull) envolvem a malha final: mesma caixa, a menos de ~1 voxel
    tv = resultado.metricas["tamanho_voxel_cm"]
    caixa_v = np.array([pts.min(0), pts.max(0)])
    caixa_m = resultado.malha.bounds
    np.testing.assert_allclose(caixa_v, caixa_m, atol=1.5 * tv)

    bruta = trimesh.load(io.BytesIO(arquivos["malha-bruta.glb"]), file_type="glb", force="mesh")
    assert len(bruta.faces) == resultado.decimacao["faces_antes"]
