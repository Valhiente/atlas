# Atlas

Assistente pessoal de Carlos com interface holográfica, voz em português brasileiro,
câmera, gestos e ferramentas MCP. Base completa copiada do Jarvis e adaptada;
consulte [NOTICE.md](NOTICE.md) e [LICENSE](LICENSE).

## Executar

1. Instale Node.js 22.12 ou superior e Chrome/Edge.
2. Instale e autentique o Claude Code no computador.
3. Rode `npm ci`.
4. Opcionalmente copie `.env.example` para `.env.local` e ajuste as variáveis.
5. Rode `npm start` e abra `http://localhost:5173`.
6. Clique em **INICIAR ATLAS**, permita o microfone e diga **Ei Atlas**.

A assinatura e o acesso ao modelo são fornecidos pela sua conta Claude.
Não há credenciais incluídas no projeto. `ATLAS_MODEL` permite escolher um modelo
habilitado na sua conta; o valor herdado do projeto original precisa ser validado nela.

## Recursos preservados

- React, Three.js, shaders, reator, partículas e animação de inicialização.
- Voz contínua, chamada pelo nome, interrupção e resposta em streaming.
- Voz do navegador, ElevenLabs opcional e motor Kokoro opcional.
- Painéis, artigos, galerias, vídeos, imagens em órbita e efeitos por comando.
- Câmera: foto, sequência de quadros e buffer temporário de dez segundos.
- Gestos MediaPipe e controle da interface com as mãos.
- MCP configurado em `~/.claude.json`, mais ferramentas internas de interface e câmera.
- Controle do Chrome pela extensão Claude, dependente do host nativo Unix original.
- Sanitização HTML, restrições de origem, proteção contra SSRF e limite de mídia.

## Adaptações Atlas

- Reconhecimento `pt-BR`, vozes portuguesas e chamadas “Atlas”/“Ei Atlas”.
- Personalidade Atlas e frases de atendimento em português.
- Entrada por texto, exportação e limpeza do histórico visual local.
- Servidor limitado a `127.0.0.1` por padrão.
- Arquivo `.env.local` carregado também no servidor.
- Inicialização do cliente direto de IA apenas quando ele é usado.

O histórico salvo é o registro visual do navegador; não restaura a memória da IA
após perda de conexão. Kokoro preserva as vozes inglesas originais, portanto use
voz do sistema ou ElevenLabs para português. Porcupine está preservado da base,
mas não está integrado ao fluxo ativo de reconhecimento.

## Comandos

| Comando | Função |
|---|---|
| `npm start` | Interface + servidor e preparação do WASM dos gestos |
| `npm run bridge` | Apenas servidor |
| `npm run dev` | Apenas interface; execute `npm start` uma vez para preparar gestos |
| `npm start -- --writes` | Habilita ações externas e alterações |
| `npm run setup` | Diagnóstico inicial |
| `npm run lint` | Análise estática |
| `npm run typecheck` | TypeScript |
| `npm run build` | TypeScript + bundle de produção |

Espaço inicia escuta; Escape retorna à espera; G alterna gestos; D mostra diagnóstico;
T testa áudio; V alterna a voz. Ações ficam restritas por padrão. O modo com escrita
herda o acesso às ferramentas configuradas: revise `decideTool()` antes de ativá-lo.

## Estrutura

- `src/App.tsx`: fluxo da conversa e inicialização.
- `src/lib/voice.ts` / `tts.ts`: audição e fala.
- `src/scene`: interface 3D.
- `src/ui`: painéis e controles.
- `bridge/server.mjs`: Claude Agent SDK, HTTP, WebSocket e permissões.
- `bridge/chrome.mjs`: extensão Claude no Chrome.
- `bridge/vision.mjs`: câmera.
- `bridge/net.mjs` / `page.mjs`: proxies e páginas.

Publicar só o frontend não publica o servidor local. Uso no celular exige configuração
de rede, HTTPS, origens e URLs; não é habilitado automaticamente.
O modo `direct` embute chave no navegador e destina-se somente a experimentação local.
A documentação integral da origem está em `docs/JARVIS-ORIGINAL.md`.
