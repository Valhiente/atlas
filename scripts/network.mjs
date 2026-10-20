/** Shared by the launcher, Vite and the bridge. Never trust request headers
 * to decide which remote origin is allowed to operate the agent. */
export function getNetworkConfig(env = process.env) {
  const port = (raw, fallback, name) => {
    const value = raw ? Number(raw) : fallback
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(name + ' inválida')
    return value
  }
  const facePort = port(env.PORT, 5173, 'PORT')
  const bridgePort = port(env.ATLAS_BRIDGE_PORT, 8787, 'ATLAS_BRIDGE_PORT')
  let codespaceOrigin
  if (env.CODESPACES === 'true' && env.CODESPACE_NAME) {
    const name = env.CODESPACE_NAME
    const domain = env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev'
    const label = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i
    if (!label.test(name) || !domain.split('.').every(part => label.test(part))) {
      throw new Error('Nome ou domínio de encaminhamento do Codespace inválido')
    }
    codespaceOrigin = 'https://' + name + '-' + facePort + '.' + domain
  }
  return { facePort, bridgePort, codespaceOrigin }
}
