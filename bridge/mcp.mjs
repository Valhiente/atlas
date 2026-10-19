import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export function allowedExternalTool(name, allowWrites = false) {
  if (allowWrites) return true
  if (/(send|call|post|create|delete|remove|update|edit|write|install|launch|tap|swipe|press|type|buy|pay|charge|publish|deploy|download)/i.test(name)) return false
  return /^(get|list|read|search|find|query|fetch|check|describe|inspect|show|view|screenshot)/i.test(name)
}
export async function externalServers({ allowWrites = false, onWarning = () => {} } = {}) {
  const path = process.env.ATLAS_MCP_CONFIG || join(homedir(), '.atlas', 'mcp.json')
  let config
  try { config = JSON.parse(await readFile(path, 'utf8')) } catch (err) {
    if (err.code !== 'ENOENT') onWarning('Não foi possível ler a configuração MCP do Atlas.')
    return { servers: [], close: async () => {} }
  }
  const clients = [], servers = []
  for (const [name, cfg] of Object.entries(config.mcpServers ?? {})) {
    if (!/^[a-zA-Z0-9_-]{1,24}$/.test(name)) { onWarning('Nome MCP inválido.'); continue }
    const client = new Client({ name: 'atlas', version: '0.2.0' })
    clients.push(client)
    try {
      const transport = cfg.url
        ? new StreamableHTTPClientTransport(new URL(cfg.url), { requestInit: { headers: cfg.headers ?? {} } })
        : new StdioClientTransport({ command: cfg.command, args: cfg.args ?? [], env: { ...process.env, ...cfg.env }, stderr: 'ignore' })
      await client.connect(transport, { timeout: 10000 })
      const tools = []; let cursor
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined)
        for (const item of page.tools) {
          if (!/^[a-zA-Z0-9_-]+$/.test(item.name) || !allowedExternalTool(item.name, allowWrites)) continue
          tools.push({ name: item.name, description: item.description ?? item.name, inputSchema: item.inputSchema,
            handler: args => client.callTool({ name: item.name, arguments: args }, undefined, { timeout: 60000 }) })
        }
        cursor = page.nextCursor
      } while (cursor)
      servers.push({ name: `mcp_${name}`, tools })
    } catch { onWarning(`Servidor MCP ${name} indisponível.`); await client.close().catch(() => {}) }
  }
  return { servers, close: () => Promise.allSettled(clients.map(c => c.close())) }
}
