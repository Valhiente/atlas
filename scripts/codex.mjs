import { spawn } from 'node:child_process'
import { codexCli, runtimeEnv, prepareRuntime } from '../bridge/runtime.mjs'
prepareRuntime()
const child = spawn(process.execPath, [codexCli, ...process.argv.slice(2)], { env: runtimeEnv(), stdio: 'inherit', windowsHide: false })
child.on('error', err => { console.error(`Não foi possível iniciar o Codex: ${err.message}`); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
