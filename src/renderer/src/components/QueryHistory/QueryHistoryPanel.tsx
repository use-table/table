import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { Clock, Trash2, RotateCcw } from 'lucide-react'
import { formatDuration } from '../../lib/utils'
import { ScrollArea } from '../ui/scroll-area'
import { Separator } from '../ui/separator'
import type { QueryHistoryEntry } from '../../types'

export function QueryHistoryPanel(): JSX.Element {
  const { activeConnectionId, toggleHistoryPanel, addTab, updateTab, tabs, activeTabId } =
    useAppStore()
  const [history, setHistory] = useState<QueryHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!window.api) return
    setLoading(true)
    window.api.history.list(activeConnectionId ?? undefined).then((h) => {
      setHistory(h)
      setLoading(false)
    })
  }, [activeConnectionId])

  const handleRestore = (entry: QueryHistoryEntry): void => {
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (activeTab && activeTab.mode === 'query') {
      updateTab(activeTab.id, { sql: entry.sql, savedQueryId: null })
    } else {
      addTab({ sql: entry.sql, title: 'Query', mode: 'query' })
    }
  }

  const handleClear = async (): Promise<void> => {
    await window.api.history.clear(activeConnectionId ?? undefined)
    setHistory([])
  }

  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffH = Math.floor(diffMin / 60)
    const diffD = Math.floor(diffH / 24)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffH < 24) return `${diffH}h ago`
    return `${diffD}d ago`
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-sidebar-foreground/50" />
          <span className="text-2xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            History
          </span>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
            title="Clear history"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            Loading…
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground">No queries yet</p>
          </div>
        ) : (
          <div className="py-1">
            {history.map((entry) => (
              <button
                key={entry.id}
                onClick={() => handleRestore(entry)}
                className="group w-full border-b border-sidebar-border/50 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-2xs text-muted-foreground/60">{formatTime(entry.executedAt)}</span>
                  <div className="flex items-center gap-2">
                    {entry.durationMs !== undefined && (
                      <span className="text-2xs text-muted-foreground/60">
                        {formatDuration(entry.durationMs)}
                      </span>
                    )}
                    {entry.rowCount !== undefined && (
                      <span className="text-2xs text-muted-foreground/60">
                        {entry.rowCount}r
                      </span>
                    )}
                    <RotateCcw className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <pre className="truncate font-mono text-xs text-sidebar-foreground/80 overflow-hidden">
                  {entry.sql.replace(/\s+/g, ' ').trim()}
                </pre>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
