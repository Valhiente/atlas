import { chromium } from 'playwright-core'
import { z } from 'zod'
import { createToolServer, tool } from './tools.mjs'
import { vetTarget } from './net.mjs'

export function chromeServer({ allowWrites = false } = {}) {
  let browser, activeTab = null
  async function connect() {
    const endpoint = process.env.ATLAS_CHROME_URL || 'http://127.0.0.1:9222'
    const url = new URL(endpoint)
    if (!['http:', 'ws:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
      throw new Error('ATLAS_CHROME_URL deve apontar para um navegador local.')
    }
    if (!browser?.isConnected()) {
      try { browser = await chromium.connectOverCDP(endpoint, { timeout: 3000 }) }
      catch { throw new Error('Chrome/Edge dedicado não está aberto. Execute npm run chrome em outro terminal.') }
    }
    return browser.contexts().flatMap(c => c.pages()).filter(p => !p.isClosed())
  }
  async function page(tabId) {
    const pages = await connect()
    const index = Number(tabId ?? activeTab ?? 0)
    if (!Number.isInteger(index) || !pages[index]) throw new Error('Aba não encontrada. Use chrome_tabs.')
    activeTab = index
    return pages[index]
  }
  const text = value => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }] })
  const tabId = z.number().int().min(0).optional().describe('Índice da aba retornado por chrome_tabs.')
  const withPage = handler => async args => handler(await page(args.tabId), args)
  const tools = [
    tool('chrome_status', 'Verifica conexão ao Chrome/Edge local dedicado.', {}, async () => text({ connected: true, tabs: (await connect()).length })),
    tool('chrome_tabs', 'Lista as abas disponíveis; tabId é o índice.', {}, async () => text(await Promise.all((await connect()).map(async (p, i) => ({ tabId: i, url: p.url(), title: await p.title() }))))),
    tool('chrome_navigate', 'Abre uma página pública HTTP/HTTPS na aba selecionada.', { url: z.string(), tabId }, withPage(async (p, a) => { vetTarget(a.url); await p.goto(a.url, { waitUntil: 'domcontentloaded', timeout: 30000 }); return text({ url: p.url() }) })),
    tool('chrome_page_text', 'Lê o texto visível da página.', { tabId }, withPage(async p => text((await p.locator('body').innerText({ timeout: 10000 })).slice(0, 24000)))),
    tool('chrome_read_page', 'Lê a estrutura acessível e lista referências para elementos interativos.', { tabId }, withPage(async p => {
      const elements = await p.locator('a,button,input,textarea,select,[role="button"]').evaluateAll(nodes => nodes.slice(0, 200).map((el, index) => {
        const ref = `atlas_${index}`; el.setAttribute('data-atlas-ref', ref)
        return { ref, tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 160) }
      }))
      return text({ structure: (await p.locator('body').ariaSnapshot()).slice(0, 24000), elements })
    })),
    tool('chrome_screenshot', 'Captura imagem da aba para análise visual.', { tabId }, withPage(async p => ({ content: [{ type: 'image', mimeType: 'image/png', data: (await p.screenshot({ timeout: 10000 })).toString('base64') }] }))),
    tool('chrome_scroll', 'Rola a página para leitura.', { tabId, direction: z.enum(['up', 'down']).default('down') }, withPage(async (p, a) => { await p.mouse.wheel(0, a.direction === 'up' ? -600 : 600); return text('Página rolada.') })),
  ]
  if (allowWrites) {
    const ref = z.string().regex(/^atlas_\d+$/)
    tools.push(
      tool('chrome_click', 'Clica na referência obtida por chrome_read_page. Use somente para ações pedidas pelo usuário.', { ref, tabId }, withPage(async (p, a) => { await p.locator(`[data-atlas-ref="${a.ref}"]`).click({ timeout: 10000 }); return text('Clique executado.') })),
      tool('chrome_form_input', 'Preenche um campo por referência. Não envia o formulário.', { ref, value: z.string(), tabId }, withPage(async (p, a) => { await p.locator(`[data-atlas-ref="${a.ref}"]`).fill(a.value, { timeout: 10000 }); return text('Campo preenchido.') })),
      tool('chrome_key', 'Pressiona uma tecla na aba, como Enter ou Escape.', { key: z.enum(['Enter', 'Escape', 'Tab', 'ArrowDown', 'ArrowUp']), tabId }, withPage(async (p, a) => { await p.keyboard.press(a.key); return text('Tecla pressionada.') })),
      tool('chrome_new_tab', 'Abre uma aba vazia no perfil dedicado.', {}, async () => { await connect(); await browser.contexts()[0].newPage(); activeTab = null; return text('Aba aberta.') }),
      tool('chrome_close_tab', 'Fecha uma aba pelo índice.', { tabId: z.number().int().min(0) }, withPage(async p => { await p.close(); activeTab = null; return text('Aba fechada.') })),
    )
  }
  return createToolServer({ name: 'atlas_chrome', tools })
}
