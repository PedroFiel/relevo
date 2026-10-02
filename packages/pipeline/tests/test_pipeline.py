import numpy as np
import pytest
from relevo_pipeline import processar
from relevo_pipeline.alinhamento import alinhar_vistas, recortar
from relevo_pipeline.segmentacao import gerar_mascara
from relevo_pipeline.sintetico import gerar_fotos, tenis_implicito
from relevo_pipeline.voxel import esculpir


@pytest.fixture(scope="module")
def fotos():
    return gerar_fotos()


# ---------- Segmentação ----------
def test_segmentacao_encontra_objeto_no_fundo_claro(fotos):
    m = gerar_mascara(fotos["lateral"])
    assert m.dtype == bool
    assert not m[0, 0], "canto da imagem deve ser fundo"
    assert 0.2 < m.mean() < 0.8


def test_segmentacao_funciona_com_fundo_escuro():
    img = np.full((200, 300, 3), 20, np.uint8)
    img[50:150, 80:220] = 220
    m = gerar_mascara(img)
    assert m[100, 150] and not m[10, 10]
    assert abs(m.sum() - 100 * 140) / (100 * 140) < 0.05


def test_segmentacao_preenche_buracos():
    img = np.full((200, 200, 3), 240, np.uint8)
    img[40:160, 40:160] = 30
    img[90:110, 90:110] = 240  # "buraco" claro dentro do objeto (ex.: logo branco)
    assert gerar_mascara(img)[100, 100]


# ---------- Alinhamento ----------
def test_recortar_vazio_gera_erro():
    with pytest.raises(ValueError):
        recortar(np.zeros((10, 10), bool))


def test_alinhamento_dimensoes_compativeis():
    lat = np.ones((50, 200), bool)  # proporção altura/comprimento = 0.25
    top = np.ones((40, 100), bool)  # proporção largura/comprimento = 0.4
    fre = np.ones((30, 30), bool)
    v = alinhar_vistas(lat, top, fre, resolucao=100)
    L, H, W = v.dims
    assert (L, H, W) == (100, 25, 40)
    assert v.lateral.shape == (H, L) and v.topo.shape == (W, L) and v.frente.shape == (H, W)


# ---------- Visual hull ----------
def test_visual_hull_de_caixa_e_caixa_cheia():
    v = alinhar_vistas(np.ones((10, 20), bool), np.ones((8, 20), bool), np.ones((10, 8), bool), 20)
    assert esculpir(v).all()


def test_visual_hull_contem_o_objeto_original():
    """Propriedade teórica: o visual hull SEMPRE contém o objeto real (nunca corta demais)."""
    occ = tenis_implicito(64)
    idx = [np.nonzero(occ.any(axis=tuple(a for a in range(3) if a != e)))[0] for e in range(3)]
    occ = occ[
        idx[0].min() : idx[0].max() + 1,
        idx[1].min() : idx[1].max() + 1,
        idx[2].min() : idx[2].max() + 1,
    ]  # recorta na bounding box 3D
    lateral = occ.any(axis=2).T[::-1, :]
    topo = occ.any(axis=1).T
    frente = occ.any(axis=0)[::-1, :]
    v = alinhar_vistas(lateral, topo, frente, resolucao=occ.shape[0])
    hull = esculpir(v)
    assert hull.shape == occ.shape
    assert (hull | ~occ).mean() > 0.99  # occ ⊆ hull (tolerância de reamostragem)
    assert hull.sum() >= occ.sum()


# ---------- Ponta a ponta ----------
def test_pipeline_ponta_a_ponta(fotos):
    r = processar(fotos["lateral"], fotos["topo"], fotos["frente"], comprimento_cm=28, resolucao=96)
    m = r.metricas
    assert m["fechada"], "a malha deve ser fechada (watertight) para impressão 3D"
    assert m["faces"] > 1000
    comprimento, altura, largura = r.malha.extents
    assert abs(comprimento - 28) < 1.0, "o modelo deve sair em escala real"
    assert 0 < altura < comprimento and 0 < largura < comprimento


# ---------- Segmentação: casos difíceis (tênis escuro com solado branco, fundo claro) ----------
def _foto_com_solado_branco():
    """Fundo cinza claro (236); corpo preto; solado BRANCO (255), mais claro que o fundo."""
    img = np.full((400, 600, 3), 236, np.uint8)
    img[100:260, 100:500] = 25  # corpo escuro
    img[260:320, 90:510] = 255  # solado branco: mais claro que o fundo
    return img


def test_segmentacao_inclui_solado_branco_em_fundo_claro():
    """Regressão: o Otsu por brilho jogava o solado branco no fundo (tênis ficava sem sola)."""
    m = gerar_mascara(_foto_com_solado_branco())
    assert m[290, 300], "o solado branco deve fazer parte do objeto"
    assert m[180, 300] and not m[10, 10] and not m[380, 300]
    esperado = 160 * 400 + 60 * 420
    assert abs(m.sum() - esperado) / esperado < 0.05


def test_segmentacao_ignora_sombra_de_contato_fina():
    img = _foto_com_solado_branco()
    img[322:326, 40:560] = 70  # faixa escura fina (~1% da altura) sob o solado, mais larga que ele
    m = gerar_mascara(img)
    assert not m[324, 60], "a ponta da sombra (fora da largura do solado) não pode virar objeto"
    assert m[290, 300]


def test_segmentacao_ignora_moldura_escura_da_foto():
    img = _foto_com_solado_branco()
    img[:, :3] = 45  # moldura escura de captura de tela
    img[-4:, :] = 45
    m = gerar_mascara(img)
    assert not m[200, 0] and not m[-1, 300]
    assert m[180, 300] and m[290, 300]


def test_segmentacao_limiar_manual_pode_ser_mais_rigoroso():
    img = np.full((100, 100, 3), 200, np.uint8)
    img[30:70, 30:70] = 215  # objeto só um pouco mais claro que o fundo
    assert gerar_mascara(img, limiar=5)[50, 50]
    assert not gerar_mascara(img, limiar=60)[50, 50]


# ---------- Alinhamento: caixas de recorte ----------
def test_alinhamento_guarda_caixas_de_recorte():
    lat = np.zeros((100, 200), bool)
    lat[20:60, 30:170] = True
    top = np.zeros((100, 200), bool)
    top[10:50, 30:170] = True
    v = alinhar_vistas(lat, top, None, resolucao=64)
    assert v.caixas["lateral"] == (20, 60, 30, 170)
    assert v.caixas["topo"] == (10, 50, 30, 170)
    assert "frente" not in v.caixas


# ---------- Cor por vértice ----------
def test_srgb_para_linear_pontos_conhecidos():
    from relevo_pipeline.cor import srgb_para_linear

    assert srgb_para_linear(np.array([0.0, 1.0])).tolist() == [0.0, 1.0]
    assert abs(float(srgb_para_linear(np.array(0.5))) - 0.2140) < 1e-3  # cinza médio sRGB


def test_estender_cor_remove_o_fundo_da_borda():
    from relevo_pipeline.cor import estender_cor

    img = np.full((60, 60, 3), 255, np.uint8)  # fundo branco
    img[20:40, 20:40] = (0, 0, 200)  # objeto vermelho (BGR)
    mascara = np.zeros((60, 60), bool)
    mascara[20:40, 20:40] = True
    img[20, 20:40] = (128, 128, 228)  # linha de borda "misturada" com o branco
    saida = estender_cor(img, mascara)
    assert (saida[20, 30] == (0, 0, 200)).all(), "a borda misturada deve copiar a cor interna"
    assert (saida[5, 5] == (0, 0, 200)).all(), "o fundo deve ser preenchido com a cor do objeto"


def test_pipeline_colore_a_malha_com_a_cor_das_fotos(fotos):
    """As fotos sintéticas têm objeto vermelho: o topo do modelo deve sair avermelhado."""
    from relevo_pipeline.cor import srgb_para_linear

    r = processar(fotos["lateral"], fotos["topo"], fotos["frente"], comprimento_cm=28, resolucao=64)
    assert r.metricas["colorida"] is True
    cor = r.malha.visual.vertex_colors[:, :3].astype(float)
    assert cor.shape == (len(r.malha.vertices), 3)
    normais = r.malha.vertex_normals
    cima = cor[normais[:, 1] > 0.8].mean(axis=0)  # R, G, B (linear) das faces voltadas p/ cima
    esperado = srgb_para_linear(np.array([170, 50, 60]) / 255) * 255  # COR_OBJETO em RGB, linear
    assert np.abs(cima - esperado).max() < 25, f"cor do topo {cima} longe de {esperado}"
    baixo = cor[normais[:, 1] < -0.8].mean(axis=0)
    assert baixo.std() < 5, "o solado (sem foto) deve ser cinza neutro"


def test_pipeline_sem_cor_nao_cria_cor_de_vertice(fotos):
    r = processar(fotos["lateral"], fotos["topo"], comprimento_cm=28, resolucao=48, colorir=False)
    assert r.metricas["colorida"] is False


def test_glb_exportado_leva_a_cor(fotos, tmp_path):
    import trimesh
    from relevo_pipeline.exportar import exportar

    r = processar(fotos["lateral"], fotos["topo"], fotos["frente"], comprimento_cm=28, resolucao=48)
    caminho = exportar(r.malha, tmp_path / "t.glb")
    lido = trimesh.load(caminho, force="mesh")
    assert lido.visual.kind == "vertex"
