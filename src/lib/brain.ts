import * as bridge from './bridge'
import type { AskHandlers, Msg } from './types'
export type { AskHandlers, Msg } from './types'
export type { ConnectionState } from './bridge'
// The browser never holds provider credentials. All requests use the local bridge.
export const usingBridge = true
export function ask(prompt: string, _history: Msg[], handlers: AskHandlers) { return bridge.ask(prompt, handlers) }
export const warm = bridge.warmBridge
export const watchServers = bridge.watchServers
export const watchPanels = bridge.watchPanels
export const watchBlades = bridge.watchBlades
export const watchUi = bridge.watchUi
export const watchCapture = bridge.watchCapture
export const cancel = bridge.cancel
export const interrupt = bridge.cancel
export const isConnected = bridge.isConnected
export const watchConnection = bridge.watchConnection
export const connectedLabels = bridge.bridgeServers
