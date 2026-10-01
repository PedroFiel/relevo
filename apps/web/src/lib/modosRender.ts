/** Modos de visualização do modelo — cada um demonstra um conceito de CG. */
export type ModoRender = 'solido' | 'wireframe' | 'normais'

export const MODOS: { id: ModoRender; rotulo: string; conceito: string }[] = [
  { id: 'solido', rotulo: 'Sólido', conceito: 'Iluminação e shading (modelo de Phong/PBR)' },
  { id: 'wireframe', rotulo: 'Wireframe', conceito: 'Malha poligonal (arestas dos triângulos)' },
  { id: 'normais', rotulo: 'Normais', conceito: 'Vetores normais mapeados para RGB' },
]
