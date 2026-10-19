import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { CodexSession } from '../bridge/codex.mjs'
import { flattenTools, dynamicSpecs, codexOutput } from '../bridge/tools.mjs'
import { displayServer } from '../bridge/panels.mjs'
import { uiServer } from '../bridge/ui.mjs'
import { visionServer } from '../bridge/vision.mjs'
import { chromeServer } from '../bridge/chrome.mjs'
import { allowedExternalTool } from '../bridge/mcp.mjs'
const spawnFixture = mode => () => spawn(process.execPath, ['tests/fixtures/fake-codex.mjs', mode || 'chatgpt'], { stdio: ['pipe', 'pipe', 'pipe'] })
const registry = () => flattenTools([displayServer(() => {}, () => {}), uiServer(() => {}), visionServer(async () => ({ data: 'aGVsbG8=', mimeType: 'image/jpeg' })), chromeServer()])
test('preserva todos os schemas da interface e câmera sem SDK de provedor', () => {
  const tools = registry(), specs = dynamicSpecs(tools)
  assert.ok(tools.has('atlas_display')); assert.ok(tools.has('atlas_eyes_watch')); assert.ok(tools.has('atlas_ui_ui_reactor'))
  assert.ok(specs.every(t => t.type === 'function' && t.inputSchema.type === 'object'))
})
test('câmera converte imagem MCP para imagem do protocolo Codex', () => {
  assert.deepEqual(codexOutput({ content: [{ type: 'image', data: 'YWJj', mimeType: 'image/png' }] }), { success: true, contentItems: [{ type: 'inputImage', imageUrl: 'data:image/png;base64,YWJj' }] })
})
test('sessão transmite resposta incremental, executa display e câmera', async t => {
  let shown = false
  const tools = flattenTools([displayServer(() => {}, () => { shown = true }), visionServer(async () => ({ data: 'aGVsbG8=', mimeType: 'image/jpeg' }))])
  const session = new CodexSession({ registry: tools, spawnProcess: spawnFixture() }); t.after(() => session.close())
  assert.equal((await session.initialize()).plan, 'pro')
  let streamed = ''; assert.equal(await session.run('Olá', s => { streamed += s }), 'Olá'); assert.equal(streamed, 'Olá')
  assert.equal(await session.run('tool'), 'Ferramenta executada.'); assert.ok(shown)
  assert.equal(await session.run('camera'), 'Ferramenta executada.')
})
test('interrupção termina o turno anterior antes da próxima pergunta', async t => {
  const session = new CodexSession({ spawnProcess: spawnFixture() }); t.after(() => session.close())
  let heard; const firstDelta = new Promise(r => { heard = r })
  const first = session.run('slow', () => heard())
  await firstDelta; await session.interrupt(); await first
  assert.equal(await session.run('next'), 'next')
})
test('falha ou queda do processo não deixa o turno pendurado', async t => {
  const session = new CodexSession({ spawnProcess: spawnFixture() }); t.after(() => session.close())
  await assert.rejects(session.run('failure'), /falhou/)
  await assert.rejects(session.run('crash'), /encerrado/)
})
test('recusa ausência de login e login com chave para evitar cobrança API acidental', async () => {
  for (const mode of ['apikey', 'missing']) {
    const session = new CodexSession({ spawnProcess: spawnFixture(mode) })
    await assert.rejects(session.initialize(), /npm run login/); session.close()
  }
})
test('ações Chrome e MCP são restritas por padrão', () => {
  const read = chromeServer().tools.map(t => t.name)
  assert.ok(read.includes('chrome_screenshot')); assert.ok(!read.includes('chrome_click'))
  assert.ok(chromeServer({ allowWrites: true }).tools.some(t => t.name === 'chrome_click'))
  assert.equal(allowedExternalTool('list_products'), true)
  assert.equal(allowedExternalTool('get_or_create_order'), false)
  assert.equal(allowedExternalTool('send_email'), false)
  assert.equal(allowedExternalTool('send_email', true), true)
})
