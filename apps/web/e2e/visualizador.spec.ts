/**
 * F2-T09 — o estúdio renderiza com WebGL (por software no CI) em cada modo; os prints ficam em
 * out/e2e/prints/ para conferir a olho (não é comparação pixel a pixel: GPU e fonte mudam entre máquinas).
 */
import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'

const PRINTS = resolve(import.meta.dirname, '../../../out/e2e/prints')

test('cada modo de renderização desenha o tênis de exemplo', async ({ page }) => {
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))
  await page.goto('/visualizador?modelo=exemplo')
  const canvas = page.locator('.viewer canvas')
  await expect(canvas).toBeVisible()
  await expect(page.locator('.carregando')).toHaveCount(0, { timeout: 30_000 })

  for (const [id, modo] of [['solido', 'Sólido'], ['wireframe', 'Wireframe'], ['normais', 'Normais']]) {
    await page.getByRole('group', { name: 'Modo de visualização' }).getByRole('button', { name: modo }).click()
    await expect(page.getByRole('button', { name: modo, pressed: true })).toBeVisible()
    await page.waitForTimeout(400) // um quadro novo
    const png = await canvas.screenshot({ path: resolve(PRINTS, `visualizador-${id}.png`) })
    expect(png.length).toBeGreaterThan(5_000) // canvas vazio dá um PNG minúsculo
  }
  expect(erros).toEqual([])
})
