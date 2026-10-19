import { homedir } from 'node:os'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
export const codexHome = resolve(process.env.ATLAS_CODEX_HOME || join(homedir(), '.atlas', 'codex'))
export const workspace = join(codexHome, 'workspace')
export const codexCli = fileURLToPath(new URL('../node_modules/@openai/codex/bin/codex.js', import.meta.url))
export function runtimeEnv() {
  // Dedicated login and config; no accidental switch to API-key billing.
  const env = { ...process.env, CODEX_HOME: codexHome }
  delete env.OPENAI_API_KEY
  delete env.OPENAI_BASE_URL
  return env
}
export function prepareRuntime() { mkdirSync(workspace, { recursive: true, mode: 0o700 }) }
