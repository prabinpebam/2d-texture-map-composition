export interface EnvironmentCapabilities {
  indexedDb: boolean
  persistentStorage: boolean
  secureContext: boolean
  workers: boolean
}

export function detectEnvironment(): EnvironmentCapabilities {
  return {
    indexedDb: typeof globalThis.indexedDB !== 'undefined',
    persistentStorage:
      typeof navigator !== 'undefined' &&
      typeof navigator.storage?.persist === 'function',
    secureContext: globalThis.isSecureContext === true,
    workers: typeof globalThis.Worker !== 'undefined',
  }
}
