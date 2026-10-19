import { z } from 'zod'

// Provider-independent registry: preserves the existing panel/UI/camera handlers.
export function tool(name, description, shape, handler) {
  const schema = z.object(shape)
  return { name, description, schema, handler,
    inputSchema: z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) }
}
export function createToolServer({ name, tools }) { return { name, tools } }
export function flattenTools(servers) {
  const registry = new Map()
  for (const server of servers) for (const item of server.tools) {
    const name = `${server.name}_${item.name}`.replace(/[^a-zA-Z0-9_-]/g, '_')
    if (name.length > 64 || registry.has(name)) throw new Error(`Nome de ferramenta inválido: ${name}`)
    registry.set(name, { ...item, server: server.name })
  }
  return registry
}
export function dynamicSpecs(registry) {
  return [...registry].map(([name, item]) => ({ type: 'function', name,
    description: item.description, inputSchema: item.inputSchema }))
}
export function codexOutput(result) {
  return { success: !result.isError, contentItems: (result.content ?? []).flatMap(c => {
    if (c.type === 'text') return [{ type: 'inputText', text: c.text }]
    if (c.type === 'image') return [{ type: 'inputImage', imageUrl: `data:${c.mimeType};base64,${c.data}` }]
    return []
  }) }
}
