# Verificação Atlas 0.2

A integração anterior foi removida do código ativo, dependências, configurações
e instruções de instalação. A licença MIT e os créditos da origem permanecem.

Validação automatizada:
- Ferramentas de interface e câmera geram schemas válidos para Codex.
- Texto e imagem são convertidos para o protocolo do app-server.
- Cliente JSON-RPC testa inicialização, login ChatGPT, streaming e conclusão.
- Display e câmera são executados contra processo de protocolo simulado.
- Interrupção, falhas e encerramento não deixam turnos pendurados.
- Login por chave e ausência de login são recusados.
- Ferramentas Chrome e MCP de alteração são restritas por padrão.
- Codex nativo 0.163.0: handshake JSON-RPC e leitura de estado de conta verificados sem inferência.
- Servidor real: /health 200 com provider openai-codex; frontend HTTP 200; origem externa 403.
- Pergunta WebSocket sem conta autenticada retorna orientação npm run login, sem ficar pendurada.
- Lint, TypeScript e build passaram localmente; CI também os executa.

A simulação de protocolo não equivale a inferência com a conta do usuário.
É necessário executar npm run login no computador de uso para validar assinatura,
modelo, cotas e inferência real. Microfone, câmera, gestos e perfil Chrome também
exigem verificação física no computador de uso.
