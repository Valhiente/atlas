import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

async function client(origin = 'https://example-5173.app.github.dev') {
  const source = await readFile(new URL('../src/lib/bridge.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const instances = []
  class Socket {
    static OPEN = 1
    readyState = 0
    listeners = new Map()
    sent = []
    constructor() { instances.push(this) }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type).add(fn)
    }
    removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn) }
    send(raw) { this.sent.push(JSON.parse(raw)) }
    close() { this.readyState = 3 }
    open() { this.readyState = 1; this.onopen?.() }
    message(data) {
      for (const fn of [...(this.listeners.get('message') ?? [])]) fn({ data: JSON.stringify(data) })
    }
  }
  const exports = {}
  const location = new URL(origin)
  runInNewContext(outputText, {
    exports, WebSocket: Socket, location, console, setTimeout, clearTimeout,
    window: { setTimeout },
    require(name) {
      assert.equal(name, '../config')
      return { BRIDGE_WS_URL: 'wss://' + location.host + '/atlas-bridge' }
    },
  })
  return { api: exports, instances }
}
const handlers = { onText() {}, onTool() {} }

test('cancelar após substituir uma pergunta durante a conexão não deixa o turno pendurado', async () => {
  const { api, instances } = await client()
  const first = api.ask('primeira', handlers)
  const second = api.ask('segunda', handlers)
  const socket = instances[0]
  socket.open()
  await first
  await Promise.resolve()
  assert.equal(socket.sent.filter(frame => frame.type === 'ask').length, 1)
  api.cancel()
  const result = await second
  assert.equal(result.text, '')
  assert.equal(socket.sent.at(-1).type, 'interrupt')
})

test('uma terceira pergunta interrompe a segunda mesmo após conexão compartilhada', async () => {
  const { api, instances } = await client()
  const first = api.ask('primeira', handlers)
  const second = api.ask('segunda', handlers)
  const socket = instances[0]
  socket.open()
  await first
  await Promise.resolve()
  const third = api.ask('terceira', handlers)
  await Promise.resolve()
  socket.message({ type: 'text', ask: socket.sent.filter(frame => frame.type === 'ask').at(-1).id, delta: 'resposta atual' })
  socket.message({ type: 'done', ask: socket.sent.filter(frame => frame.type === 'ask').at(-1).id })
  assert.equal((await second).text, '')
  assert.equal((await third).text, 'resposta atual')
})

test('erro de conexão identifica a origem HTTPS e orienta sobre Codespaces', async () => {
  const { api, instances } = await client()
  const result = api.ask('teste', handlers)
  instances[0].onerror()
  await assert.rejects(result, error =>
    error.message.includes('https://example-5173.app.github.dev') &&
    error.message.includes('Privada') &&
    !error.message.includes('page is on 80'))
})
