"""RELEVO — pipeline de computação gráfica (sem IA).

Fluxo: 3 fotos -> máscaras (segmentação clássica) -> alinhamento -> visual hull em voxels
-> Marching Cubes -> malha -> exportação.

Convenção de eixos (ver docs/03-pipeline-cg.md):
    x = comprimento (calcanhar -> bico)
    y = altura (chão -> topo)
    z = largura (lado externo -> lado interno)
"""

from relevo_pipeline.pipeline import ETAPAS, AoProgredir, ResultadoPipeline, processar

__all__ = ["processar", "ResultadoPipeline", "AoProgredir", "ETAPAS"]
__version__ = "0.1.0"
