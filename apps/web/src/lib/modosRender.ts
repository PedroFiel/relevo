/** Modos de visualização do modelo — cada um demonstra um conceito de CG (F2-T03, F2-T05, F4-T07). */
export type ModoRender =
  | 'solido'
  | 'wireframe'
  | 'arestas'
  | 'flat'
  | 'normais'
  | 'altura'
  | 'fresnel'
  | 'uv'

export const MODOS: { id: ModoRender; rotulo: string; conceito: string }[] = [
  { id: 'solido', rotulo: 'Sólido', conceito: 'Iluminação e shading suave (interpolação de normais / PBR)' },
  { id: 'wireframe', rotulo: 'Wireframe', conceito: 'Malha poligonal (arestas dos triângulos)' },
  { id: 'arestas', rotulo: 'Sólido + arestas', conceito: 'Superfície sombreada com sobreposição da topologia triangular (F2-T03)' },
  { id: 'flat', rotulo: 'Flat', conceito: 'Shading constante por face: uma única normal por triângulo (F2-T03)' },
  { id: 'normais', rotulo: 'Normais', conceito: 'Vetores normais (nx, ny, nz) mapeados diretamente para RGB' },
  { id: 'altura', rotulo: 'Altura (GLSL)', conceito: 'Shader GLSL por cota Y com isolinhas topográficas a cada 1 cm (F2-T05)' },
  { id: 'fresnel', rotulo: 'Fresnel (GLSL)', conceito: 'Shader GLSL de silhueta: (1 − |N·V|)^p realça bordas rasantes (F2-T05)' },
  { id: 'uv', rotulo: 'Textura UV', conceito: 'Atlas UV em 6 ilhas ortográficas com padrão xadrez de distorção (F4-T07)' },
]
