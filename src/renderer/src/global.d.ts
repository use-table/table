import type {
  SavedConnection,
  ConnectionConfig,
  QueryResult,
  TableData,
  TableInfo,
  ColumnInfo,
  QueryHistoryEntry,
  SavedQuery
} from './types'

declare global {
  interface Window {
    api: {
      connections: {
        list(): Promise<SavedConnection[]>
        save(config: ConnectionConfig): Promise<SavedConnection>
        delete(id: string): Promise<void>
        connect(id: string): Promise<{ connected: boolean }>
        disconnect(id: string): Promise<void>
        test(config: Omit<ConnectionConfig, 'id' | 'name' | 'color'>): Promise<{
          success: boolean
          latencyMs?: number
          error?: string
        }>
        status(id: string): Promise<{ connected: boolean }>
      }
      query: {
        execute(connectionId: string, sql: string): Promise<QueryResult>
        fetchTable(params: {
          connectionId: string
          schema: string
          table: string
          limit: number
          offset: number
          orderBy?: { column: string; dir: 'ASC' | 'DESC' }
          where?: string
        }): Promise<TableData>
        insertRow(params: {
          connectionId: string
          schema: string
          table: string
          values: Record<string, unknown>
        }): Promise<Record<string, unknown>>
        deleteRows(params: {
          connectionId: string
          schema: string
          table: string
          primaryKeys: string[]
          pkValuesList: Record<string, unknown>[]
        }): Promise<{ deleted: number }>
        updateRow(params: {
          connectionId: string
          schema: string
          table: string
          primaryKeys: string[]
          pkValues: Record<string, unknown>
          updates: Record<string, unknown>
        }): Promise<{ success: boolean }>
        getPrimaryKeys(connectionId: string, schema: string, table: string): Promise<string[]>
        searchTable(params: {
          connectionId: string
          schema: string
          table: string
          term: string
          orderBy?: { column: string; dir: 'ASC' | 'DESC' }
        }): Promise<{ matchingRows: number[]; total: number }>
      }
      schema: {
        getSchemas(connectionId: string): Promise<string[]>
        getTables(connectionId: string, schema: string): Promise<TableInfo[]>
        getColumns(connectionId: string, schema: string, table: string): Promise<ColumnInfo[]>
        getFunctions(
          connectionId: string,
          schema: string
        ): Promise<{ name: string; returnType: string; language: string }[]>
      }
      export: {
        csv(
          rows: Record<string, unknown>[],
          fields: { name: string }[]
        ): Promise<{ success: boolean; path: string } | undefined>
        json(rows: Record<string, unknown>[]): Promise<{ success: boolean; path: string } | undefined>
      }
      history: {
        add(entry: Omit<QueryHistoryEntry, 'id'>): Promise<QueryHistoryEntry>
        list(connectionId?: string): Promise<QueryHistoryEntry[]>
        clear(connectionId?: string): Promise<void>
      }
      savedQueries: {
        list(connectionId?: string | null): Promise<SavedQuery[]>
        save(payload: {
          id?: string
          name: string
          sql: string
          connectionId?: string | null
        }): Promise<SavedQuery>
        delete(id: string): Promise<void>
      }
      session: {
        get(): Promise<{
          activeConnectionId: string | null
          activeTabId: string | null
          tabs: {
            id: string
            title: string
            sql: string
            mode: 'query' | 'table'
            tableMeta: { schema: string; table: string; connectionId: string } | null
            connectionId: string | null
            savedQueryId?: string | null
          }[]
        }>
        save(session: {
          activeConnectionId: string | null
          activeTabId: string | null
          tabs: {
            id: string
            title: string
            sql: string
            mode: 'query' | 'table'
            tableMeta: { schema: string; table: string; connectionId: string } | null
            connectionId: string | null
            savedQueryId?: string | null
          }[]
        }): Promise<void>
      }
      settings: {
        get(): Promise<{
          theme: 'auto' | 'dark' | 'light'
          editorFontSize: number
          analyticsEnabled: boolean
          preReleaseUpdates: boolean
        }>
        set(
          settings: Partial<{
            theme: 'auto' | 'dark' | 'light'
            editorFontSize: number
            analyticsEnabled: boolean
            preReleaseUpdates: boolean
          }>
        ): Promise<{
          theme: 'auto' | 'dark' | 'light'
          editorFontSize: number
          analyticsEnabled: boolean
          preReleaseUpdates: boolean
        }>
        onOpenRequest(callback: () => void): () => void
      }
      window: {
        close(): Promise<void>
        onCloseTabOrWindowRequest(callback: () => void): () => void
      }
      theme: {
        onChange(callback: (theme: 'dark' | 'light') => void): () => void
      }
      updater: {
        download(): Promise<void>
        quitAndInstall(): Promise<void>
        onUpdateAvailable(callback: () => void): () => void
        onUpdateDownloaded(callback: () => void): () => void
        onUpdateNotAvailable(callback: () => void): () => void
        onDownloadProgress(callback: (progress: {
          bytesPerSecond: number
          percent: number
          transferred: number
          total: number
        }) => void): () => void
        onUpdateError(callback: (message: string) => void): () => void
      }
    }
  }
}

export {}
