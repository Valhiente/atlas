import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { get } from 'node:http'
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getNetworkConfig } from '../scripts/network.mjs'
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

// node:http preserves an explicit Host; fetch may replace this forbidden header.
function requestWithHost(path, headers) {
  return new Promise((resolve, reject) => {
    const request = get(localOrigin + path, { headers }, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { body += chunk })
      response.on('end', () => resolve({ status: response.statusCode, body }))
    })
    request.setTimeout(5000, () => request.destroy(new Error('HTTP timeout')))
    request.on('error', reject)
  })
}

function handshake(origin, url = 'ws://127.0.0.1:' + bridgePort) {
  return new Promise(resolve => {
    const socket = new WebSocket(url, { origin, handshakeTimeout: 3000 })
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
  assert.equal(bridge.host, location.host)
  assert.equal(bridge.pathname, '/atlas-bridge')
  assert.equal(exports.BRIDGE_HTTP_URL, cloudOrigin + '/atlas-bridge')
  for (const [origin, override, expected] of [
    [localOrigin, '', 'ws://127.0.0.1:' + facePort + '/atlas-bridge'],
    [cloudOrigin, 'wss://custom.example/bridge', 'wss://custom.example/bridge'],
  ]) {
    const result = {}, location = new URL(origin)
    runInNewContext(outputText, { exports: result, __viteEnv: { VITE_BRIDGE_URL: override }, location, window: { location }, URL })
    assert.equal(result.BRIDGE_WS_URL, expected)
  }
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
      ATLAS_ALLOWED_ORIGINS: 'https://custom.example',
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

  await t.test('proxy Vite entrega health na mesma origem, inclusive com Host do Codespace', async () => {
    const response = await requestWithHost('/atlas-bridge/health', { Origin: cloudOrigin, Host: new URL(cloudOrigin).host })
    assert.equal(response.status, 200)
    assert.equal(JSON.parse(response.body).provider, 'openai-codex')
  })
  await t.test('proxy Vite abre WebSocket para a ponte preservando a origem', async () => {
    assert.equal(await handshake(cloudOrigin, localOrigin.replace('http:', 'ws:') + '/atlas-bridge'), 'open')
    assert.equal(await handshake(localOrigin, localOrigin.replace('http:', 'ws:') + '/atlas-bridge'), 'open')
  })
  await t.test('proxy Vite também encaminha voz e arquivos de imagem', async () => {
    const tts = await fetch(localOrigin + '/atlas-bridge/tts', {
      method: 'POST', headers: { Origin: cloudOrigin, 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'teste' }),
    })
    assert.equal(tts.status, 503) // No premium voice key in CI; no paid call.
    assert.equal(await tts.text(), 'no elevenlabs key')
    const dir = await mkdtemp(join(tmpdir(), 'atlas-proxy-'))
    try {
      const path = join(dir, 'pixel.png')
      const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64')
      await writeFile(path, pixel)
      const response = await fetch(localOrigin + '/atlas-bridge/file?path=' + encodeURIComponent(path))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('content-type'), 'image/png')
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), pixel)
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
  await t.test('origem extra explícita é preservada mesmo com PORT definido', async () => {
    assert.equal(await handshake('https://custom.example'), 'open')
  })
  await t.test('outros Codespaces, origens falsas e Origin ausente não atravessam o proxy', async () => {
    const denied = [
      'https://another-codespace-' + facePort + '.app.github.dev',
      cloudOrigin + '.untrusted.example',
      cloudOrigin.replace('https:', 'http:'),
      cloudOrigin.replace('-' + facePort + '.', '-5198.'),
      'null', undefined,
    ]
    for (const origin of denied) {
      assert.equal(await handshake(origin, localOrigin.replace('http:', 'ws:') + '/atlas-bridge'), 403, String(origin))
      if (origin) {
        const response = await fetch(localOrigin + '/atlas-bridge/health', { headers: { Origin: origin } })
        assert.equal(response.status, 403, origin)
      }
    }
  })
  await t.test('Vite aceita somente o Host remoto configurado', async () => {
    const response = await requestWithHost('/', { Host: 'another-codespace-5173.app.github.dev' })
    assert.equal(response.status, 403)
  })

})

test('configuração de rede valida portas e deriva uma origem remota exata', () => {
  assert.equal(getNetworkConfig({}).codespaceOrigin, undefined)
  assert.equal(getNetworkConfig({ CODESPACES: 'true', CODESPACE_NAME: 'example' }).codespaceOrigin,
    'https://example-5173.app.github.dev')
  assert.throws(() => getNetworkConfig({ PORT: '0' }))
  assert.throws(() => getNetworkConfig({ ATLAS_BRIDGE_PORT: 'invalid' }))
  assert.throws(() => getNetworkConfig({ CODESPACES: 'true', CODESPACE_NAME: 'example/evil' }))
  assert.throws(() => getNetworkConfig({ CODESPACES: 'true', CODESPACE_NAME: 'example',
    GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: '*.app.github.dev' }))
})
