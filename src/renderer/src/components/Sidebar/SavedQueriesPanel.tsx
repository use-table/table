import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Bookmark, Play, MoreHorizontal, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { SavedQuery } from '../../types'

export function SavedQueriesPanel(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [queryToDelete, setQueryToDelete] = useState<SavedQuery | null>(null)
  const {
    savedQueries,
    loadSavedQueries,
    openSaveQueryDialog,
    openSavedQueryInEditor,
    runSavedQuery,
    deleteSavedQuery,
    activeConnectionId,
    connectedIds
  } = useAppStore()

  useEffect(() => {
    if (window.api?.savedQueries) loadSavedQueries()
  }, [loadSavedQueries])

  const isConnected = activeConnectionId ? connectedIds.includes(activeConnectionId) : false

  const visibleQueries =
    activeConnectionId
      ? savedQueries.filter((q) => q.connectionId === activeConnectionId || q.connectionId === null)
      : savedQueries

  const handleOpenInEditor = (q: SavedQuery): void => {
    openSavedQueryInEditor(q.sql, q.id, q.name)
  }

  const handleRun = async (q: SavedQuery): Promise<void> => {
    if (!isConnected) return
    await runSavedQuery(q.sql, q.id, q.name)
  }

  const handleRename = (q: SavedQuery): void => {
    openSaveQueryDialog(q.sql, q.id)
  }

  const handleDeleteClick = (q: SavedQuery): void => {
    setQueryToDelete(q)
  }

  const handleConfirmDelete = async (): Promise<void> => {
    if (!queryToDelete) return
    await deleteSavedQuery(queryToDelete.id)
    setQueryToDelete(null)
  }

  return (
    <div
      className={cn(
        'flex flex-col border-t border-sidebar-border',
        collapsed ? 'shrink-0' : 'flex-1 min-h-0'
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-3 py-2 shrink-0 hover:bg-accent/50 transition-colors"
      >
        <span className="text-2xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Saved Queries
        </span>
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (visibleQueries.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-muted-foreground">
          <Bookmark className="mx-auto mb-2 h-6 w-6 opacity-50" />
          <p>No saved queries yet.</p>
          <p className="mt-1">
            Write a query and click <strong>Save</strong> in the editor toolbar.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-2 space-y-0.5">
          {visibleQueries.map((q) => (
            <div
              key={q.id}
              role="button"
              tabIndex={0}
              onClick={() => handleOpenInEditor(q)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleOpenInEditor(q)
                }
              }}
              className={cn(
                'group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer',
                'hover:bg-accent/50'
              )}
              title={q.name}
            >
              <span className="flex-1 min-w-0 text-xs truncate">{q.name}</span>
              <div
                className="flex shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRun(q)
                  }}
                  disabled={!isConnected}
                  title="Run"
                >
                  <Play className="h-2.5 w-2.5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-2.5 w-2.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleRename(q)}>
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteClick(q)}
                      className="text-destructive focus:text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      ))}

      <Dialog open={!!queryToDelete} onOpenChange={(open) => !open && setQueryToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Delete saved query?
            </DialogTitle>
            <DialogDescription>
              "{queryToDelete?.name}" will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setQueryToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
