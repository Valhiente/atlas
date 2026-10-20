import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { WebSocket } from 'ws'

const facePort = 5197
const bridgePort = 18787
const localOrigin = 'http://127.0.0.1:' + facePort
const codespace = 'atlas-connectivity-test'
const cloudOrigin = 'https://' + codespace + '-' + facePort + '.app.github.dev'
const bridgeBase = 'http://127.0.0.1:' + bridgePort
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function handshake(origin) {
  return new Promise(resolve => {
    const socket = new WebSocket('ws://127.0.0.1:' + bridgePort, { origin, handshakeTimeout: 3000 })
    const finish = value => {
      clearTimeout(timer)
      if (socket.readyState === WebSocket.OPEN) socket.close()
      resolve(value)
    }
    const timer = setTimeout(() => { socket.terminate(); resolve('timeout') }, 4000)
    socket.once('open', () => finish('open'))
    socket.once('unexpected-response', (_request, response) => {
      response.resume()
      finish(response.statusCode)
      socket.terminate()
    })
    socket.once('error', error => finish(error.message))
  })
}

test('URL padrão da interface deve alcançar o Codespace por WebSocket seguro', async () => {
  // Execute the real config module with the browser location and Vite env supplied
  // by this fixture. This checks URL selection, not browser rendering or login.
  const source = await readFile(new URL('../src/config.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source.replaceAll('import.meta.env', '__viteEnv'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const exports = {}
  const location = new URL(cloudOrigin)
  runInNewContext(outputText, { exports, __viteEnv: {}, location, window: { location }, URL })
  const bridge = new URL(exports.BRIDGE_WS_URL)
  assert.equal(bridge.protocol, 'wss:', 'Página HTTPS remota precisa de WebSocket seguro')
  assert.ok(bridge.hostname.endsWith('.app.github.dev'), 'A ponte deve estar no Codespace, não no localhost do visitante')
})

test('inicialização real e conexões HTTP/WebSocket em ambiente Codespaces simulado', { timeout: 60000 }, async t => {
  let logs = ''
  const detached = process.platform !== 'win32'
  const child = spawn(process.execPath, ['scripts/start.mjs'], {
    detached,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(facePort),
      ATLAS_BRIDGE_PORT: String(bridgePort),
      ATLAS_HOST: '127.0.0.1',
      ATLAS_ALLOW_WRITES: '0',
      ATLAS_ALLOWED_ORIGINS: '',
      ATLAS_ALLOW_NO_ORIGIN: '0',
      ATLAS_MCP_CONFIG: '/tmp/atlas-connectivity-no-mcp.json',
      CODESPACES: 'true',
      CODESPACE_NAME: codespace,
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev',
    },
  })
  child.stdout.on('data', data => { logs += data })
  child.stderr.on('data', data => { logs += data })
  let spawnError
  child.on('error', error => { spawnError = error })
  t.after(async () => {
    if (child.exitCode === null && child.pid) {
      try {
        if (detached) process.kill(-child.pid, 'SIGTERM')
        else child.kill('SIGTERM')
      } catch { /* process already stopped */ }
      for (let i = 0; i < 30 && child.exitCode === null; i++) await delay(100)
      if (child.exitCode === null) {
        try {
          if (detached) process.kill(-child.pid, 'SIGKILL')
          else child.kill('SIGKILL')
        } catch { /* process already stopped */ }
      }
    }
  })

  let ready = false
  for (let i = 0; i < 100; i++) {
    if (spawnError) throw spawnError
    assert.equal(child.exitCode, null, 'Launcher encerrou antes de ficar pronto: ' + logs)
    try {
      const face = await fetch(localOrigin, { signal: AbortSignal.timeout(1000) })
      const health = await fetch(bridgeBase + '/health', { signal: AbortSignal.timeout(1000) })
      if (face.ok && health.ok) { ready = true; break }
    } catch { /* wait for startup */ }
    await delay(250)
  }
  assert.ok(ready, 'Interface e ponte devem iniciar: ' + logs)

  await t.test('interface responde HTTP 200 enquanto o launcher está ativo', async () => {
    const response = await fetch(localOrigin)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /id="root"/)
  })
  await t.test('health local identifica o backend OpenAI Codex', async () => {
    const response = await fetch(bridgeBase + '/health', { headers: { Origin: localOrigin } })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).provider, 'openai-codex')
  })
  await t.test('WebSocket local conecta sem executar inferência', async () => {
    assert.equal(await handshake(localOrigin), 'open')
  })
  await t.test('health aceita a origem HTTPS do próprio Codespace', async () => {
    const response = await fetch(bridgeBase + '/health', { headers: { Origin: cloudOrigin } })
    assert.equal(response.status, 200, 'Origem do Codespace foi recusada')
  })
  await t.test('WebSocket aceita a origem HTTPS do próprio Codespace', async () => {
    assert.equal(await handshake(cloudOrigin), 'open', 'Handshake do Codespace foi recusado')
  })
  await t.test('origens externas continuam proibidas', async () => {
    const response = await fetch(bridgeBase + '/health', { headers: { Origin: 'https://untrusted.example' } })
    assert.equal(response.status, 403)
    assert.equal(await handshake('https://untrusted.example'), 403)
  })
})
