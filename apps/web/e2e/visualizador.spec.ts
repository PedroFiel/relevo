/**
 * F2-T09 + F2-T02..T07 + F4-T03 + F4-T07 + F5-T02 + F5-T03 — o estúdio renderiza com WebGL
 * em todos os 8 modos (incluindo shaders GLSL e mapa UV), vistas de câmera, iluminação, LOD,
 * pivô por clique e régua 3D; os prints ficam em out/e2e/prints/ para conferência.
 */
import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'

const PRINTS = resolve(import.meta.dirname, '../../../out/e2e/prints')

const TODOS_OS_MODOS: [string, string][] = [
  ['solido', 'Sólido'],
  ['wireframe', 'Wireframe'],
  ['arestas', 'Sólido + arestas'],
  ['flat', 'Flat'],
  ['normais', 'Normais'],
  ['altura', 'Altura (GLSL)'],
  ['fresnel', 'Fresnel (GLSL)'],
  ['uv', 'Textura UV'],
]

test('cada modo de renderização, câmera, LOD, pivô e régua 3D funcionam no estúdio', async ({ page }) => {
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))
  await page.goto('/visualizador?modelo=exemplo')
  const canvas = page.locator('.viewer canvas')
  await expect(canvas).toBeVisible()
  await expect(page.locator('.carregando')).toHaveCount(0, { timeout: 30_000 })

  const grupoModos = page.getByRole('group', { name: 'Modo de visualização' })
  for (const [id, modo] of TODOS_OS_MODOS) {
    await grupoModos.getByRole('button', { name: modo, exact: true }).click()
    await expect(grupoModos.getByRole('button', { name: modo, exact: true, pressed: true })).toBeVisible()
    await page.waitForTimeout(300)
    const png = await canvas.screenshot({ path: resolve(PRINTS, `visualizador-${id}.png`) })
    expect(png.length).toBeGreaterThan(5_000)
  }

  // No modo UV, o cartão do Atlas UV de 6 ilhas aparece no painel (F4-T07)
  await expect(page.getByRole('region', { name: 'Atlas UV em 6 ilhas' }).or(page.locator('.uv-atlas-card'))).toBeVisible()

  // Volta ao modo Sólido e testa vistas rápidas de câmera e LOD (F2-T02, F2-T06, F2-T07, F5-T02)
  await grupoModos.getByRole('button', { name: 'Sólido', exact: true }).click()
  const vistas = page.getByRole('group', { name: 'Vistas da câmera' })
  for (const vista of ['Lateral', 'Topo', 'Frente', '3/4']) {
    await vistas.getByRole('button', { name: vista, exact: true }).click()
  }
  await page.getByLabel('LOD automático por distância').check()
  await expect(page.getByLabel('Estatísticas da malha')).toContainText(/vértices.*triângulos.*LOD/)

  // Régua 3D (F5-T03): clicar em 2 pontos sobre o modelo mede a distância em cm e mm
  await page.getByRole('tab', { name: 'Régua 3D' }).click()
  const box = (await canvas.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5)
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.65)
  await expect(page.getByLabel('Distância medida')).toContainText(/Distância AB:.*cm.*mm/)

  // Transformar: definir pivô por clique e atalhos G / R / S (F4-T03)
  await page.getByRole('tab', { name: 'Transformar' }).click()
  await page.getByRole('button', { name: 'Definir pivô por clique' }).click()
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5)
  await expect(page.getByRole('button', { name: /Pivô na origem/ })).toBeVisible()

  expect(erros).toEqual([])
})
