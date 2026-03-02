import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { store, type SavedQuery } from '../store'

export function registerSavedQueriesHandlers(): void {
  ipcMain.handle('savedQueries:list', (_e, connectionId?: string | null) => {
    const queries = store.get('savedQueries')
    if (connectionId) {
      return queries.filter((q) => q.connectionId === connectionId || q.connectionId === null)
    }
    return queries
  })

  ipcMain.handle(
    'savedQueries:save',
    (_e, payload: { id?: string; name: string; sql: string; connectionId?: string | null }) => {
      const queries = store.get('savedQueries')
      const now = Date.now()

      if (payload.id) {
        const idx = queries.findIndex((q) => q.id === payload.id)
        if (idx < 0) {
          throw new Error(`Saved query not found: ${payload.id}`)
        }
        const updated: SavedQuery = {
          ...queries[idx],
          name: payload.name,
          sql: payload.sql,
          connectionId: payload.connectionId ?? null,
          updatedAt: now
        }
        const next = [...queries]
        next[idx] = updated
        store.set('savedQueries', next)
        return updated
      }

      const newQuery: SavedQuery = {
        id: randomUUID(),
        name: payload.name,
        sql: payload.sql,
        connectionId: payload.connectionId ?? null,
        createdAt: now,
        updatedAt: now
      }
      store.set('savedQueries', [newQuery, ...queries])
      return newQuery
    }
  )

  ipcMain.handle('savedQueries:delete', (_e, id: string) => {
    const queries = store.get('savedQueries').filter((q) => q.id !== id)
    store.set('savedQueries', queries)
  })
}
