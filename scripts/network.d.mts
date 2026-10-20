export function getNetworkConfig(env?: Record<string, string | undefined>): {
  facePort: number
  bridgePort: number
  codespaceOrigin: string | undefined
}
