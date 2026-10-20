# Atlas · OpenAI

Assistente pessoal de Carlos com interface holográfica, voz em português,
câmera, gestos e ferramentas. A inteligência usa **Codex app-server com login
ChatGPT**, executado no seu computador. A API paga por chave não é usada.
Acesso a modelos e limites dependem da sua conta e plano; ter Pro não elimina limites.

## Instalar ou atualizar

Requisitos: Node.js 22.12+ e Chrome/Edge em uma janela real.

Primeira instalação:

```bash
git clone https://github.com/Valhiente/atlas.git
cd atlas
npm ci
npm run login
npm start
```

Se já tem o projeto, dentro da pasta `atlas`:

```bash
git pull --ff-only
npm ci
npm run login
npm start
```

No login, use sua conta ChatGPT. O Codex é instalado como dependência local;
não é necessário instalar outro agente global. Para terminal remoto sem navegador,
use `npm run login -- --device-auth` e siga as instruções oficiais apresentadas.
Depois abra `http://localhost:5173`, clique **INICIAR ATLAS**, permita o microfone
e diga **Ei Atlas** ou digite uma mensagem.

A sessão fica em `~/.atlas/codex`, separada de outros projetos. O servidor exige
login do tipo ChatGPT e remove `OPENAI_API_KEY` de seu processo filho, evitando
uma troca involuntária para cobrança por chave. Não copie tokens nem senhas
para arquivos do projeto. As memórias desta conversa no ChatGPT não são importadas.

## GitHub Codespaces (uso pessoal)

Após atualizar com `git pull --ff-only && npm ci`, faça o login com
`npm run login -- --device-auth` se ainda não estiver autenticado e execute
`npm start`. Mantenha esse terminal rodando; Ctrl+C encerra a interface e a ponte.

Na aba **PORTAS**, abra a porta **5173** no navegador, com visibilidade **Privada**.
O launcher também imprime o endereço HTTPS exato do Codespace atual. Se mudou
`PORT`, use a porta e o endereço impressos. Não é necessário encaminhar a 8787.

O navegador usa `wss://<endereço-da-interface>/atlas-bridge`; o Vite encaminha
WebSocket e HTTP para a ponte em `127.0.0.1:8787` (ou `ATLAS_BRIDGE_PORT`).
Health, voz e mídia usam o mesmo endereço HTTPS, sem autenticar uma segunda porta.
O cabeçalho Origin é preservado e a ponte permite apenas a origem HTTPS exata
derivada das variáveis do Codespace, além das origens locais e das explicitamente
configuradas em `ATLAS_ALLOWED_ORIGINS`. Outros Codespaces não são autorizados.
Não configure `allowedHosts: true`, curingas de origem ou `rewriteWsOrigin: true`.

Deixe `VITE_BRIDGE_URL` vazio no Codespaces; se tiver um arquivo `.env.local`
antigo com `ws://localhost:8787`, remova essa configuração e reinicie o Atlas.
HTTPS/WSS são fornecidos pelo túnel privado do GitHub; os serviços internos
continuam em HTTP no loopback.

O Chrome iniciado dentro do Codespace é remoto: ele não controla o Chrome do
seu computador. Microfone/câmera são capturados pelo navegador onde você abre a
interface. Os testes de CI simulam a origem do Codespaces; não validam o login
do túnel GitHub, sua conta ChatGPT ou seus dispositivos.

## Recursos

- Interface React/Three.js, reator, partículas, shaders e áudios originais.
- Voz `pt-BR`, chamada pelo nome, interrupção e respostas em streaming.
- Entrada por texto e histórico visual local com exportação e limpeza.
- Painéis e telas de artigos, imagens, galerias, vídeos e câmera.
- Tema, reator, imagens em órbita e efeitos controlados por ferramentas.
- MediaPipe para gestos; processamento de mãos no navegador.
- Ferramentas `look`/`watch` enviam foto ou grade de quadros ao modelo somente
  quando solicitadas. O buffer recente de dez segundos existe enquanto a câmera está aberta.
- Voz do navegador como padrão; ElevenLabs opcional. Kokoro mantém vozes inglesas.

O histórico local é visual e não restaura o contexto do modelo após reconexão.
A memória do agente dura a conexão atual. Voz e câmera dependem de permissões,
WebGL e suporte do dispositivo; build aprovado não comprova esses acessos.

## Controle do Chrome/Edge

Em outro terminal, dentro do projeto, execute:

```bash
npm run chrome
```

Isso abre um perfil exclusivo em `~/.atlas/browser`, com depuração limitada ao
loopback. Faça login nos sites nesse perfil. Não usa extensões de outro provedor
e não reaproveita automaticamente as abas e cookies do seu navegador pessoal.
O CDP deve ficar apenas em `127.0.0.1`; não exponha a porta 9222 à rede.

Por padrão: listar abas, navegar por páginas públicas, ler estrutura/texto,
rolar e capturar tela. Para cliques, campos, teclas e abrir/fechar abas,
inicie explicitamente `npm start -- --writes`. Revise as ações antes de habilitar.

## MCP externo

Servidores são opcionais e não são importados de outro agente.
Crie `~/.atlas/mcp.json` com um objeto `mcpServers` (exemplo em
`docs/mcp.example.json`). São aceitos stdio (`command`, `args`, `env`) e
Streamable HTTP (`url`, `headers`). Credenciais ficam nesse arquivo local;
não o envie ao GitHub. Servidores são processos/serviços escolhidos por você.
O SDK MCP converte suas ferramentas para as chamadas do Codex. No modo restrito,
só nomes com verbos de leitura são expostos; nomes com verbos de alteração são
recusados. Esta heurística não substitui a revisão do servidor e suas permissões.
OAuth de terceiros deve ser configurado no respectivo serviço; o Atlas não cria
contas, credenciais ou conectores automaticamente.

## Configuração e permissões

Copie `.env.example` para `.env.local` apenas se precisar mudar os padrões.
`ATLAS_MODEL` vazio usa o modelo padrão da sua conta. Voz do navegador não
precisa de chave. ElevenLabs tem conta/cobrança própria.

O processo Codex usa uma pasta de trabalho dedicada, sandbox de leitura e shell
desativado; solicitações de comandos, edição e expansão de permissões são negadas.
O modo `--writes` habilita somente as ferramentas externas do Atlas; não libera
shell do Codex. Ferramentas de interface e câmera têm escopo próprio.
O protocolo de ferramentas dinâmicas é experimental; Codex está fixado em
`0.163.0` e deve ser validado antes de atualizar.

Esta é uma aplicação **local**. Hospedar somente o frontend não hospeda o agente.
Uma oferta comercial/hospedada exige rever autenticação e condições de uso;
não exponha esta sessão pessoal como serviço público.

## Comandos úteis

| Comando | Função |
|---|---|
| `npm run login` | Login ChatGPT no Codex do Atlas |
| `npm run logout` | Remove o login próprio do Atlas |
| `npm run setup` | Verifica instalação e presença de autenticação |
| `npm start` | Servidor, interface e arquivos WASM dos gestos |
| `npm run chrome` | Abre perfil dedicado Chrome/Edge |
| `npm start -- --writes` | Libera ferramentas externas de alteração |
| `npm test` | Testes de protocolo, ferramentas e permissões |
| `npm run lint` | Análise estática |
| `npm run typecheck` | Verificação TypeScript |
| `npm run build` | TypeScript e bundle de produção |

Atalhos: Espaço para falar; Escape para espera; G para gestos; D para diagnóstico;
T para testar voz; V para alternar voz instalada.

## Origem e licença

Base visual e multimodal derivada de [Jarvis](https://github.com/Valhiente/jarvis).
Copyright e licença MIT originais preservados em `LICENSE`, atribuição em
`NOTICE.md` e créditos dos áudios em `public/audio/CREDITS.md`.
A migração substitui integralmente o backend de inteligência anterior.
