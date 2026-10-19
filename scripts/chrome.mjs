import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
const candidates = [process.env.ATLAS_CHROME_EXECUTABLE,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ...[process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
    .flatMap(root => [join(root, 'Google/Chrome/Application/chrome.exe'), join(root, 'Microsoft/Edge/Application/msedge.exe')]),
].filter(Boolean)
const executable = candidates.find(p => existsSync(p))
if (!executable) { console.error('Chrome/Edge não encontrado. Defina ATLAS_CHROME_EXECUTABLE.'); process.exit(1) }
const profile = join(homedir(), '.atlas', 'browser'); mkdirSync(profile, { recursive: true })
const child = spawn(executable, ['--remote-debugging-port=9222', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { detached: true, stdio: 'ignore', windowsHide: false })
child.on('error', () => { console.error('Não foi possível abrir o navegador.'); process.exitCode = 1 })
child.unref()
console.log('Navegador dedicado Atlas iniciado. Faça login nos sites que deseja usar nesse perfil.')
