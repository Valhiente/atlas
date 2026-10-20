import { useStore } from '../store'

/** Brief Atlas introduction; connection status is reported separately. */
export function Boot() {
  const phase = useStore((s) => s.phase)
  if (phase !== 'boot') return null
  return (
    <div className="atlas-intro" role="status" aria-live="polite">
      <div className="atlas-emblem" aria-hidden="true">
        <svg viewBox="0 0 100 100" fill="none">
          <ellipse cx="50" cy="50" rx="32" ry="32" />
          <ellipse cx="50" cy="50" rx="14" ry="32" transform="rotate(32 50 50)" />
          <path d="M20 60 Q50 35 80 60" />
          <circle cx="73" cy="30" r="4" className="atlas-emblem-point" />
        </svg>
      </div>
      <h1>Atlas</h1>
      <p>Seu assistente pessoal</p>
      <span className="atlas-intro-note">Preparando a conversa…</span>
    </div>
  )
}
