import { useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { useAppStore } from '../../store/useAppStore'
import { Table2, Eye, Columns, PlugZap, Plus, Loader2, ChevronDown, Check, Bookmark } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TableInfo, ColumnInfo } from '../../types'

const ITEM_CLASS = cn(
  'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
  'cursor-default select-none',
  'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground'
)

const TABLE_PREVIEW_COUNT = 8

export function CommandPalette(): JSX.Element {
  const {
    commandPaletteOpen,
    closeCommandPalette,
    toggleCommandPalette,
    activeConnectionId,
    connectedIds,
    connections,
    schemaStates,
    savedQueries,
    openTableBrowser,
    openConnectionDialog,
    connectToDb,
    setActiveConnection,
    loadTables,
    openSavedQueryInEditor,
  } = useAppStore()

  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [showAllTables, setShowAllTables] = useState(false)
  const [search, setSearch] = useState('')

  const isConnected = activeConnectionId ? connectedIds.includes(activeConnectionId) : false
  const schemaState = activeConnectionId ? schemaStates[activeConnectionId] : undefined

  // Reset state when palette opens/closes
  useEffect(() => {
    if (commandPaletteOpen) {
      setShowAllTables(false)
      setConnectingId(null)
      setSearch('')
    }
  }, [commandPaletteOpen])

  // Cmd+K / Ctrl+K toggle
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        // Don't hijack Cmd+K inside editable fields (Monaco editor, inputs, etc.)
        const el = e.target as HTMLElement
        if (
          el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable
        ) {
          return
        }
        e.preventDefault()
        toggleCommandPalette()
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [toggleCommandPalette])

  // When palette opens with a connection, ensure all schema tables are loaded
  useEffect(() => {
    if (!commandPaletteOpen || !activeConnectionId || !schemaState) return
    for (const schema of schemaState.schemas) {
      if (!schemaState.tables[schema] && !schemaState.loadingTables.includes(schema)) {
        loadTables(activeConnectionId, schema)
      }
    }
  }, [commandPaletteOpen, activeConnectionId, schemaState?.schemas])

  // Flatten all tables across schemas
  const allTables = useMemo(() => {
    if (!schemaState) return []
    const result: Array<{ schema: string; table: TableInfo; keywords: string[] }> = []
    for (const schema of schemaState.schemas) {
      const tables = schemaState.tables[schema]
      if (!tables) continue
      for (const table of tables) {
        const colKey = `${schema}.${table.name}`
        const cachedCols = schemaState.columns[colKey]
        const keywords = cachedCols ? cachedCols.map((c) => c.name) : []
        result.push({ schema, table, keywords })
      }
    }
    return result
  }, [schemaState])

  // Flatten all cached columns for the "Columns" group
  const allColumns = useMemo(() => {
    if (!schemaState) return []
    const result: Array<{ schema: string; tableName: string; column: ColumnInfo }> = []
    for (const [key, cols] of Object.entries(schemaState.columns)) {
      const dotIdx = key.indexOf('.')
      const schema = key.slice(0, dotIdx)
      const tableName = key.slice(dotIdx + 1)
      for (const col of cols) {
        result.push({ schema, tableName, column: col })
      }
    }
    return result
  }, [schemaState])

  const isSearching = search.trim().length > 0
  const visibleTables = (isSearching || showAllTables) ? allTables : allTables.slice(0, TABLE_PREVIEW_COUNT)
  const hasMoreTables = !isSearching && allTables.length > TABLE_PREVIEW_COUNT

  const visibleSavedQueries = activeConnectionId
    ? savedQueries.filter((q) => q.connectionId === activeConnectionId || q.connectionId === null)
    : savedQueries

  const handleSelectTable = (schema: string, table: string): void => {
    if (!activeConnectionId) return
    openTableBrowser(activeConnectionId, schema, table)
    closeCommandPalette()
  }

  const handleConnect = async (id: string): Promise<void> => {
    setConnectingId(id)
    try {
      await connectToDb(id)
      closeCommandPalette()
    } catch {
      // Error handled by store / toast
    } finally {
      setConnectingId(null)
    }
  }

  const handleSwitchConnection = (id: string): void => {
    setActiveConnection(id)
    closeCommandPalette()
  }

  const handleNewConnection = (): void => {
    closeCommandPalette()
    openConnectionDialog()
  }

  return (
    <Command.Dialog
      open={commandPaletteOpen}
      onOpenChange={(open) => { if (!open) closeCommandPalette() }}
      label="Command Palette"
      loop
      contentClassName={cn(
        'fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2',
        'rounded-lg border border-border bg-popover text-popover-foreground shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
        'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
        'data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2',
        'duration-150'
      )}
      overlayClassName="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
    >
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder={isConnected ? 'Search tables, views, columns...' : 'Search connections...'}
        className={cn(
          'h-10 w-full border-b border-border bg-transparent px-4',
          'text-xs text-foreground outline-none',
          'placeholder:text-muted-foreground/50'
        )}
      />
      <Command.List className="max-h-[300px] overflow-y-auto overscroll-contain p-2">
        <Command.Empty className="py-6 text-center text-xs text-muted-foreground">
          No results found.
        </Command.Empty>

        {/* Tables group — only when connected */}
        {isConnected && allTables.length > 0 && (
          <Command.Group heading="Tables">
            {visibleTables.map(({ schema, table, keywords }) => (
              <Command.Item
                key={`${schema}.${table.name}`}
                value={`${schema}.${table.name}`}
                keywords={keywords}
                onSelect={() => handleSelectTable(schema, table.name)}
                className={ITEM_CLASS}
              >
                {table.type === 'TABLE'
                  ? <Table2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  : <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                }
                <span className="flex-1 truncate">
                  <span className="text-muted-foreground">{schema}.</span>
                  {table.name}
                </span>
                {table.type !== 'TABLE' && (
                  <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-2xs text-muted-foreground">
                    {table.type === 'VIEW' ? 'view' : 'mat view'}
                  </span>
                )}
              </Command.Item>
            ))}
            {/* Show all / collapse toggle */}
            {hasMoreTables && !showAllTables && (
              <Command.Item
                value="_show_all_tables"
                onSelect={() => setShowAllTables(true)}
                className={ITEM_CLASS}
              >
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-muted-foreground">
                  Show all ({allTables.length - TABLE_PREVIEW_COUNT} more)
                </span>
              </Command.Item>
            )}
          </Command.Group>
        )}

        {/* Columns group — surfaces tables when searching by column name */}
        {isConnected && allColumns.length > 0 && (
          <Command.Group heading="Columns">
            {allColumns.map(({ schema, tableName, column }) => (
              <Command.Item
                key={`col:${schema}.${tableName}.${column.name}`}
                value={`${column.name} ${schema}.${tableName}`}
                keywords={[column.type]}
                onSelect={() => handleSelectTable(schema, tableName)}
                className={ITEM_CLASS}
              >
                <Columns className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">
                  {column.name}
                  <span className="ml-1.5 text-muted-foreground/60">
                    {schema}.{tableName}
                  </span>
                </span>
                <span className="shrink-0 text-2xs text-muted-foreground/50 font-mono">
                  {column.type}
                  {column.isPrimary ? ' 🔑' : ''}
                  {(column.foreignKeys?.length ?? 0) > 0 ? ' 🔗' : ''}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Saved Queries — when connected */}
        {isConnected && visibleSavedQueries.length > 0 && (
          <Command.Group heading="Saved Queries">
            {visibleSavedQueries.map((q) => (
              <Command.Item
                key={q.id}
                value={q.name}
                onSelect={() => {
                  openSavedQueryInEditor(q.sql, q.id, q.name)
                  closeCommandPalette()
                }}
                className={ITEM_CLASS}
              >
                <Bookmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{q.name}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {(isConnected && (allTables.length > 0 || allColumns.length > 0 || visibleSavedQueries.length > 0)) && (
          <Command.Separator className="-mx-2 my-1 h-px bg-border" alwaysRender />
        )}

        {/* Connections group — always visible */}
        {connections.length > 0 && (
          <Command.Group heading="Connections">
            {connections.map((conn) => {
              const isActive = conn.id === activeConnectionId
              const isThisConnected = connectedIds.includes(conn.id)
              const isConnecting = connectingId === conn.id

              return (
                <Command.Item
                  key={conn.id}
                  value={`${conn.name} ${conn.host} ${conn.database}`}
                  onSelect={() => {
                    if (isConnecting) return
                    if (isActive) return // Already viewing this one
                    if (isThisConnected) {
                      handleSwitchConnection(conn.id)
                    } else {
                      handleConnect(conn.id)
                    }
                  }}
                  className={ITEM_CLASS}
                >
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: conn.color }}
                  />
                  <PlugZap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{conn.name}</span>
                  {isConnecting ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                  ) : isActive ? (
                    <Check className="h-3 w-3 shrink-0 text-primary" />
                  ) : (
                    <span className="shrink-0 text-2xs text-muted-foreground">
                      {isThisConnected ? 'Switch' : 'Connect'}
                    </span>
                  )}
                </Command.Item>
              )
            })}
          </Command.Group>
        )}

        {/* New connection item — always at the end */}
        <Command.Item
          value="new connection add"
          onSelect={handleNewConnection}
          className={ITEM_CLASS}
        >
          <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1">New Connection</span>
        </Command.Item>
      </Command.List>
    </Command.Dialog>
  )
}
