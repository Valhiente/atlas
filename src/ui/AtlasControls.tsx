import { useEffect, useState } from 'react'
import { useStore, type Turn } from '../store'
const KEY = 'atlas.transcript.v1'
function readHistory(): Turn[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((t): t is Turn => t && typeof t.id === 'string' && typeof t.text === 'string' && ['user', 'atlas'].includes(t.role)).slice(-40)
  } catch { return [] }
}
export function AtlasControls({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('')
  const phase = useStore(s => s.phase)
  const disabled = phase === 'offline' || phase === 'boot'
  useEffect(() => {
    if (useStore.getState().turns.length === 0) useStore.setState({ turns: readHistory() })
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.turns === prev.turns) return
      clearTimeout(timer)
      timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state.turns.slice(-40))) } catch { /* Storage may be disabled. */ } }, 300)
    })
    const flush = () => { try { localStorage.setItem(KEY, JSON.stringify(useStore.getState().turns.slice(-40))) } catch { /* Storage may be disabled. */ } }
    window.addEventListener('pagehide', flush)
    return () => { clearTimeout(timer); unsubscribe(); flush(); window.removeEventListener('pagehide', flush) }
  }, [])
  const exportHistory = () => {
    const body = useStore.getState().turns.map(t => `${t.role === 'atlas' ? 'Atlas' : 'Você'}: ${t.text}`).join('\n\n')
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'atlas-conversa.txt'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="atlas-controls" aria-label="Comandos do Atlas">
    <form onSubmit={e => { e.preventDefault(); const value = text.trim(); if (value && !disabled) { setText(''); onSend(value) } }}>
      <label className="sr-only" htmlFor="atlas-command">Mensagem para Atlas</label>
      <input id="atlas-command" value={text} onChange={e => setText(e.target.value)} disabled={disabled} maxLength={8000} placeholder={disabled ? 'Inicie o Atlas para conversar' : 'Digite uma mensagem para Atlas…'} autoComplete="off" />
      <button type="submit" disabled={disabled || !text.trim()}>Enviar</button>
    </form>
    <div><span>pt-BR · histórico neste navegador</span><button onClick={exportHistory}>Exportar</button><button onClick={() => useStore.setState({ turns: [] })}>Limpar histórico</button></div>
  </section>
}
