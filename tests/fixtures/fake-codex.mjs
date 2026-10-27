import readline from 'node:readline'
const send = msg => process.stdout.write(JSON.stringify(msg) + '\n')
let turn = 0, pendingTool = null
for await (const line of readline.createInterface({ input: process.stdin })) {
  const msg = JSON.parse(line), p = msg.params ?? {}
  const reply = result => send({ id: msg.id, result })
  const completed = (id, status = 'completed') => send({ method: 'turn/completed', params: { threadId: 'thread-test', turn: { id, status } } })
  if (msg.method === 'initialize') reply({ userAgent: 'fixture' })
  else if (msg.method === 'account/read') reply({ account: { type: process.argv[2] || 'chatgpt', planType: 'pro' } })
  else if (msg.method === 'thread/start') {
    if (!p.dynamicTools?.every(t => t.type === 'function' && t.inputSchema)) throw new Error('invalid tool spec')
    reply({ thread: { id: 'thread-test' }, model: 'fixture-model' })
  } else if (msg.method === 'turn/start') {
    const id = `t${++turn}`; reply({ turn: { id } })
    send({ method: 'turn/started', params: { threadId: 'thread-test', turn: { id } } })
    const prompt = p.input[0].text
    if (prompt === 'crash') process.exit(1)
    else if (prompt === 'tool' || prompt === 'camera') {
      pendingTool = id
      send({ id: 900 + turn, method: 'item/tool/call', params: { threadId: 'thread-test', turnId: id, tool: prompt === 'camera' ? 'atlas_eyes_look' : 'atlas_display', arguments: prompt === 'camera' ? {} : { title: 'Teste', html: '<p>Olá</p>' } } })
    } else if (prompt === 'final-only') {
      send({ method: 'item/completed', params: { threadId: 'thread-test', turnId: id, item: { id: 'final', type: 'agentMessage', text: 'Olá, Carlos.' } } }); completed(id)
    } else if (prompt === 'empty') completed(id)
    else if (prompt === 'failure') completed(id, 'failed')
    else {
      send({ method: 'item/agentMessage/delta', params: { threadId: 'thread-test', turnId: id, itemId: 'message-' + id, delta: prompt } })
      send({ method: 'item/completed', params: { threadId: 'thread-test', turnId: id, item: { id: 'message-' + id, type: 'agentMessage', text: prompt } } })
      if (prompt !== 'slow') completed(id)
    }
  } else if (msg.method === 'turn/interrupt') { reply({}); completed(p.turnId, 'interrupted') }
  else if (!msg.method && pendingTool) {
    const correct = msg.result.success && msg.result.contentItems.length > 0
    send({ method: 'item/agentMessage/delta', params: { threadId: 'thread-test', turnId: pendingTool, delta: correct ? 'Ferramenta executada.' : 'Erro na ferramenta.' } })
    completed(pendingTool); pendingTool = null
  }
}
