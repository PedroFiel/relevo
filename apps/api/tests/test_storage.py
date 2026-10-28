"""Storage local: salvar/abrir/apagar numa pasta temporária e recusa de chaves perigosas."""

from uuid import uuid4

import pytest
from relevo_api.storage import (
    ChaveInvalida,
    LocalStorage,
    chave_foto,
    chave_glb,
    prefixo_modelo,
)


@pytest.fixture
def storage(tmp_path):
    return LocalStorage(tmp_path / "storage")


def test_salva_e_abre(storage):
    chave = "modelos/abc/fotos/lateral.jpg"
    assert storage.salvar(chave, b"\xff\xd8bytes") == chave
    assert storage.abrir(chave) == b"\xff\xd8bytes"
    assert storage.caminho_local(chave).read_bytes() == b"\xff\xd8bytes"


def test_salvar_de_novo_substitui_sem_deixar_temporario(storage):
    chave = "modelos/abc/v1/modelo.glb"
    storage.salvar(chave, b"antigo")
    storage.salvar(chave, b"novo")
    assert storage.abrir(chave) == b"novo"
    assert [p.name for p in storage.caminho_local(chave).parent.iterdir()] == ["modelo.glb"]


def test_abrir_inexistente_levanta_file_not_found(storage):
    with pytest.raises(FileNotFoundError):
        storage.abrir("modelos/nada/fotos/topo.png")


def test_apagar_prefixo_apaga_so_o_modelo(storage):
    a, b = uuid4(), uuid4()
    storage.salvar(chave_foto(a, "lateral", "jpg"), b"1")
    storage.salvar(chave_glb(a, 1), b"2")
    storage.salvar(chave_foto(b, "topo", "png"), b"3")

    storage.apagar_prefixo(prefixo_modelo(a))

    assert not storage.caminho_local(prefixo_modelo(a)).exists()
    assert storage.abrir(chave_foto(b, "topo", "png")) == b"3"


def test_apagar_prefixo_inexistente_nao_e_erro(storage):
    storage.apagar_prefixo("modelos/que-nao-existe")


def test_chaves_do_modelo():
    m = uuid4()
    assert chave_foto(m, "outro_lado", "jpg") == f"modelos/{m}/fotos/outro_lado.jpg"
    assert chave_glb(m, 3) == f"modelos/{m}/v3/modelo.glb"
    assert prefixo_modelo(m) == f"modelos/{m}"


@pytest.mark.parametrize(
    "chave",
    [
        "",
        "../fora.txt",
        "modelos/../../fora.txt",
        "modelos/./x.glb",
        "/etc/passwd",
        "modelos//x.glb",
        "modelos/x/",
        "modelos\\..\\fora.txt",
        "modelos/.oculto",
        "modelos/com espaco.jpg",
    ],
)
def test_chave_perigosa_e_rejeitada(storage, chave):
    with pytest.raises(ChaveInvalida):
        storage.salvar(chave, b"x")
    with pytest.raises(ChaveInvalida):
        storage.apagar_prefixo(chave)
    # Nada foi criado fora (nem dentro) da raiz
    assert not storage.raiz.parent.joinpath("fora.txt").exists()


def test_link_simbolico_para_fora_da_raiz_e_rejeitado(storage, tmp_path):
    fora = tmp_path / "fora"
    fora.mkdir()
    storage.raiz.mkdir(parents=True)
    (storage.raiz / "atalho").symlink_to(fora)
    with pytest.raises(ChaveInvalida):
        storage.salvar("atalho/x.txt", b"x")
    assert not (fora / "x.txt").exists()
