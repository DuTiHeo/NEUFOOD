// Share concurrent reads only. Completed reads are never cached, so manual refresh
// and reads after mutations still fetch current server data.
export function singleFlight<T>(read: () => Promise<T>, key: () => string = () => '') {
  const pending = new Map<string, Promise<T>>()
  return () => {
    const requestKey = key()
    const existing = pending.get(requestKey)
    if (existing) return existing
    const request = Promise.resolve().then(read).finally(() => pending.delete(requestKey))
    pending.set(requestKey, request)
    return request
  }
}
