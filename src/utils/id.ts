let fallbackCounter = 0

/**
 * Eindeutige ID. `crypto.randomUUID` gibt es nur in sicheren Kontexten (HTTPS, localhost),
 * beim Testen über `http://` im LAN fehlt es.
 */
export const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  fallbackCounter += 1
  const random = Math.random().toString(36).slice(2, 10)
  return `id-${Date.now().toString(36)}-${random}-${fallbackCounter}`
}
