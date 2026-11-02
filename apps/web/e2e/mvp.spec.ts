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
  await request.post('/api/creditos/recarregar?quantidade=10')
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

  // Raio-X (F5-T01 + F1-T02): percorre todas as 7 etapas (fotos → silhuetas → voxels → malha bruta → suavizada Taubin → decimada → final)
  await page.getByRole('button', { name: 'Raio-X do pipeline' }).click()
  await expect(page.getByRole('heading', { level: 3, name: /1\. Fotos/ })).toBeVisible()
  await page.getByRole('button', { name: 'Próxima etapa' }).click()
  await expect(page.getByRole('img', { name: 'Silhueta Lateral' })).toBeVisible()
  await page.getByRole('button', { name: 'Próxima etapa' }).click()
  await expect(page.getByRole('heading', { level: 3, name: /3\. Voxels/ })).toBeVisible()
  await expect(page.locator('.raio-x-palco canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Próxima etapa' }).click()
  await expect(page.getByRole('heading', { level: 3, name: /4\. Malha bruta/ })).toBeVisible()
  await page.getByRole('button', { name: 'Próxima etapa' }).click()
  await expect(page.getByRole('heading', { level: 3, name: /5\. Suavizada · Filtro de Taubin/ })).toBeVisible()
  await page.getByRole('button', { name: 'Próxima etapa' }).click()
  await expect(page.getByRole('heading', { level: 3, name: /6\. Decimada/ })).toBeVisible()
  await page.getByRole('button', { name: 'Próxima etapa' }).click()
  await expect(page.getByRole('heading', { level: 3, name: /7\. Final · Cor por vértice/ })).toBeVisible()

  // Incorporar iframe (F5-T06): painel de embed e rota pública /embed/:id
  await page.getByRole('button', { name: 'Incorporar (<iframe>)' }).click()
  await expect(page.getByLabel('Código HTML do iframe')).toContainText(`/embed/${id}`)
  const respPublico = await request.get(`/api/publico/${id}`)
  expect(respPublico.status()).toBe(200)
  const respPublicoGlb = await request.get(`/api/publico/${id}/glb`)
  expect(respPublicoGlb.status()).toBe(200)
  expect((await respPublicoGlb.body()).subarray(0, 4).toString()).toBe('glTF')

  // Pincel de correção da máscara (F5-T05): abrir editor na aba Fotos, pintar e regerar v2
  await page.getByRole('button', { name: /Fotos e contornos/ }).click()
  await page.getByRole('button', { name: 'Corrigir com pincel Lateral' }).click()
  const canvasMascara = page.getByLabel('Pintar máscara da foto Lateral')
  await expect(canvasMascara).toBeVisible()
  const boxMascara = (await canvasMascara.boundingBox())!
  await page.mouse.move(boxMascara.x + boxMascara.width * 0.5, boxMascara.y + boxMascara.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(boxMascara.x + boxMascara.width * 0.55, boxMascara.y + boxMascara.height * 0.5, { steps: 4 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Regerar modelo com esta máscara' }).click()
  await expect(page.getByText('versão 2')).toBeVisible({ timeout: 90_000 })

  // Download (.glb, .obj e .stl — F4-T05)
  const href = (await baixar.getAttribute('href'))!
  const glb = await request.get(href)
  expect(glb.status()).toBe(200)
  expect(glb.headers()['content-type']).toBe('model/gltf-binary')
  expect((await glb.body()).subarray(0, 4).toString()).toBe('glTF')

  const hrefObj = (await page.getByRole('link', { name: 'Baixar .obj' }).getAttribute('href'))!
  const obj = await request.get(hrefObj)
  expect(obj.status()).toBe(200)
  expect(obj.headers()['content-type']).toContain('model/obj')

  const hrefStl = (await page.getByRole('link', { name: 'Baixar .stl' }).getAttribute('href'))!
  const stl = await request.get(hrefStl)
  expect(stl.status()).toBe(200)
  expect(stl.headers()['content-type']).toContain('model/stl')

  // Salvar transformação 4×4 como nova versão (v3) e restaurar v1 (F4-T03, F4-T04)
  await page.getByRole('button', { name: 'Modelo 3D' }).click()
  await page.getByRole('tab', { name: 'Transformar' }).click()
  await page.getByRole('button', { name: 'Salvar como nova versão' }).click()
  await expect(page.getByText('versão 3')).toBeVisible()
  await page.getByRole('button', { name: 'v1' }).click()
  await expect(page.getByText('versão 1')).toBeVisible()

  // Visualizar página pública /embed/:id no navegador (F5-T06)
  await page.goto(`/embed/${id}`)
  await expect(page.getByText(NOME)).toBeVisible()
  await expect(page.locator('.embed-palco canvas')).toBeVisible()
  await page.goto(`/modelos/${id}`)

  // Conta e créditos (F4-T02): saldo e histórico visíveis em /conta
  await page.getByRole('link', { name: 'Conta e créditos' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Conta e créditos' })).toBeVisible()
  await expect(page.getByText('Geração de modelo 3D').first()).toBeVisible()

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

test('criar conta, ver 10 créditos de boas-vindas, sair e entrar com JWT (F4-T01)', async ({ page }) => {
  const email = `e2e-${Date.now()}@relevo.local`
  await page.goto('/cadastrar')
  await page.getByLabel('Nome').fill('Integrante E2E')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel(/Senha/).fill('senha1234')
  await page.getByRole('button', { name: 'Criar conta' }).click()

  await expect(page).toHaveURL('/conta')
  await expect(page.getByText('Integrante E2E')).toBeVisible()
  await expect(page.getByLabel('Saldo de créditos')).toContainText('10 créditos')
  await expect(page.getByText('Créditos de boas-vindas')).toBeVisible()

  // Sair e entrar novamente com a mesma conta
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('senha1234')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL('/conta')
  await expect(page.getByText(email)).toBeVisible()
})
