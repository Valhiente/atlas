import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { codexCli, codexHome, runtimeEnv, prepareRuntime } from '../bridge/runtime.mjs'
prepareRuntime()
console.log('Atlas · verificação local OpenAI Codex')
const [major, minor] = process.versions.node.split('.').map(Number)
let ok = major > 22 || (major === 22 && minor >= 12)
console.log(`${ok ? 'OK' : 'FALTA'} Node.js ${process.versions.node} (mínimo 22.12).`)
if (!existsSync(codexCli)) { console.log('FALTA instalar dependências: npm ci'); ok = false }
else {
  const version = spawnSync(process.execPath, [codexCli, '--version'], { env: runtimeEnv(), encoding: 'utf8', timeout: 10000 })
  console.log(version.status === 0 ? `OK ${version.stdout.trim()}` : 'FALTA executável Codex compatível com o sistema.')
  const auth = spawnSync(process.execPath, [codexCli, 'login', 'status'], { env: runtimeEnv(), encoding: 'utf8', timeout: 10000 })
  if (auth.status === 0) console.log('OK autenticação local encontrada. O servidor validará o uso da conta ChatGPT.')
  else { console.log('FALTA autenticar sua conta ChatGPT: npm run login'); ok = false }
}
console.log(`Configuração e sessão próprias do Atlas: ${codexHome}`)
console.log('Voz: navegador em pt-BR; ElevenLabs opcional (ELEVENLABS_API_KEY).')
console.log('Navegador dedicado opcional: npm run chrome')
console.log('Iniciar: npm start → http://localhost:5173 → INICIAR ATLAS')
process.exitCode = ok ? 0 : 1
