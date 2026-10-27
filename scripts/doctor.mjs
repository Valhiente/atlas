import { CodexSession } from '../bridge/codex.mjs'
import { codexHome } from '../bridge/runtime.mjs'
import { getNetworkConfig } from './network.mjs'

const network = getNetworkConfig()
console.log('Diagnóstico Atlas — nenhum token ou conteúdo de autenticação será exibido.')
console.log('Login usado pelo Atlas:', codexHome)
console.log('Abra a interface em:', network.codespaceOrigin || `http://127.0.0.1:${network.facePort}`)
let failed = false
for (const [label, path] of [['Interface', '/'], ['Ponte via proxy', '/atlas-bridge/health']]) {
  try {
    const response = await fetch(`http://127.0.0.1:${network.facePort}${path}`, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    if (path !== '/') {
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Retornou HTML ou outro conteúdo em vez de JSON. Verifique o proxy /atlas-bridge.')
      const health = await response.json()
      if (!health.ok || health.provider !== 'openai-codex') throw new Error('Resposta inesperada da ponte.')
    }
    console.log(`${label}: OK`)
  } catch (error) {
    failed = true
    console.error(`${label}: FALHOU — ${error.message}. Mantenha npm start ativo em outro terminal.`)
  }
}
const session = new CodexSession({ model: process.env.ATLAS_MODEL?.trim() || undefined })
try {
  const info = await session.initialize()
  console.log(`Login ChatGPT e sessão Codex: OK; modelo: ${info.model}`)
  if (process.argv.includes('--ask')) {
    const answer = await session.run('Responda em português, em uma frase curta: você está pronto para conversar como Atlas?')
    console.log('Resposta real do Codex:', answer)
  } else {
    console.log('Para testar uma resposta real usando sua conta: npm run doctor -- --ask')
  }
} catch (error) {
  failed = true
  console.error('Codex: FALHOU —', error.message)
  if (error.message.includes('npm run login')) console.error('No Codespaces, autentique com npm run login -- --device-auth e repita este diagnóstico.')
} finally {
  session.close()
}
process.exitCode = failed ? 1 : 0
