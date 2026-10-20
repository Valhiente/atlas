/** Atlas uses only the local OpenAI Codex bridge. Never place model credentials in VITE_* variables. */
const str = (value: unknown) => typeof value === 'string' ? value.trim() : ''
export const BACKEND = 'bridge' as string
// Use the page's host and TLS through Vite's proxy, including private Codespaces.
const page = typeof window === 'undefined' ? undefined : window.location
const defaultBridge = page
  ? `${page.protocol === 'https:' ? 'wss:' : 'ws:'}//${page.host}/atlas-bridge`
  : 'ws://localhost:8787'
export const BRIDGE_WS_URL = str(import.meta.env.VITE_BRIDGE_URL) || defaultBridge
export const BRIDGE_HTTP_URL = BRIDGE_WS_URL.replace(/^ws/, 'http')
export const USE_ELEVENLABS = ['1', 'true'].includes(str(import.meta.env.VITE_USE_ELEVENLABS))
export const TTS_ENGINE: 'system' | 'kokoro' = import.meta.env.VITE_TTS_ENGINE === 'kokoro' ? 'kokoro' : 'system'
const voices = ['bm_george', 'bm_fable', 'bm_lewis', 'bm_daniel']
export const KOKORO_VOICE = voices.includes(str(import.meta.env.VITE_KOKORO_VOICE)) ? str(import.meta.env.VITE_KOKORO_VOICE) : 'bm_george'
export const env = { elevenKey: '', elevenVoiceId: '', porcupineKey: '' }
