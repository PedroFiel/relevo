/**
 * F3-T12 — o fluxo do MVP de ponta a ponta, com a API e o banco de verdade (de teste):
 * fotos (uma recortada no editor) → etapas → modelo 3D → aba Fotos com contorno → download → apagar.
 */
import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { PASTA_FOTOS } from './ambiente.ts'

const foto = (vista: string) => resolve(PASTA_FOTOS, `${vista}.jpg`)
const NOME = `E2E tenis-01 ${Date.now()}`

// Sobras de uma execução interrompida (o banco de teste é real, não é desfeito como no pytest)
test.beforeAll(async ({ request }) => {
  const modelos: { id: string; nome: string }[] = await (await request.get('/api/modelos')).json()
  for (const m of modelos.filter((m) => m.nome.startsWith('E2E '))) await request.delete(`/api/modelos/${m.id}`)
})

test('do upload ao download, e apagar no fim', async ({ page, request }) => {
  await page.goto('/novo')
  await expect(page.getByRole('heading', { level: 1, name: 'Novo modelo' })).toBeVisible()

  await page.getByLabel('Foto Lateral').setInputFiles(foto('lateral'))
  await page.getByLabel('Foto De cima').setInputFiles(foto('topo'))
  await page.getByLabel('Foto Frontal (bico)').setInputFiles(foto('frente'))
  await expect(page.getByRole('img', { name: 'Foto Lateral' })).toBeVisible() // miniatura

  // Editor (F3-T13): girar ida e volta e recortar a lateral com folga em volta do tênis
  await page.getByRole('button', { name: 'Ajustar' }).first().click()
  const editor = page.getByRole('region', { name: 'Ajustar a foto Lateral' })
  await editor.getByRole('button', { name: 'Girar 90° horário' }).click()
  await editor.getByRole('button', { name: 'Girar 90° anti-horário' }).click()
  const visor = editor.locator('canvas')
  const caixa = (await visor.boundingBox())!
  await page.mouse.move(caixa.x + caixa.width * 0.06, caixa.y + caixa.height * 0.06)
  await page.mouse.down()
  await page.mouse.move(caixa.x + caixa.width * 0.94, caixa.y + caixa.height * 0.94, { steps: 8 })
  await page.mouse.up()
  await expect(editor.getByText(/Recorte de \d+ × \d+ px/)).toBeVisible()
  await editor.getByRole('button', { name: 'Concluir' }).click()
  await expect(page.getByRole('button', { name: 'Ajustada · editar' })).toBeVisible()

  await page.getByLabel('Nome').fill(NOME)
  await page.getByLabel('Comprimento real (cm)').fill('30')
  await page.getByRole('button', { name: 'Rápida' }).click()

  await page.getByRole('button', { name: 'Gerar modelo 3D' }).click()

  // Página do modelo: etapas e depois o resultado (F3-T09, F3-T10)
  await expect(page).toHaveURL(/\/modelos\/[0-9a-f-]{36}$/)
  const id = page.url().split('/').pop()!
  const baixar = page.getByRole('link', { name: /Baixar \.glb/ })
  await expect(baixar).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('malha fechada')).toBeVisible()
  await expect(page.locator('.viewer canvas')).toBeVisible()
  // O recorte feito no editor chegou ao pipeline (fica registrado nas métricas da versão)
  const detalhe = await (await request.get(`/api/modelos/${id}`)).json()
  expect(detalhe.versao.metricas.ajustes.lateral.recorte).toHaveLength(4)
  expect(detalhe.versao.metricas.ajustes.topo.recorte).toBeNull()

  // Aba Fotos (F3-T14): uma foto por vista, cada uma com o contorno do pipeline
  await page.getByRole('button', { name: /Fotos e contornos/ }).click()
  await expect(page.getByText(/contorno com \d+ vértices/)).toHaveCount(3)
  await expect(page.getByText(/recorte \d+ × \d+ px/)).toHaveCount(1)

  // Download
  const href = (await baixar.getAttribute('href'))!
  const glb = await request.get(href)
  expect(glb.status()).toBe(200)
  expect(glb.headers()['content-type']).toBe('model/gltf-binary')
  expect((await glb.body()).subarray(0, 4).toString()).toBe('glTF')

  // Meus modelos mostra o cartão; apagar pede confirmação e some da lista (F3-T11)
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Meus modelos' }).click()
  await page.getByRole('button', { name: `Apagar ${NOME}` }).click()
  await page.getByRole('button', { name: `Confirmar apagar ${NOME}` }).click()
  await expect(page.getByText(NOME)).toHaveCount(0)
  expect((await request.get(`/api/modelos/${id}`)).status()).toBe(404)
})

test('foto que não é imagem é recusada antes de enviar', async ({ page }) => {
  await page.goto('/novo')
  await page.getByLabel('Foto Lateral').setInputFiles({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
  await expect(page.getByRole('alert')).toContainText('não é JPEG nem PNG')
  await expect(page.getByRole('button', { name: 'Gerar modelo 3D' })).toBeDisabled()
})
