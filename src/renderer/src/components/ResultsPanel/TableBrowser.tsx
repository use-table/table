import { useEffect, useState, useCallback, useRef } from 'react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Plus, Trash2, Filter, X, Search, Database, Save, AlertTriangle } from 'lucide-react'

import { trackEvent } from '../../lib/analytics'
import { useAppStore, type EditorTab } from '../../store/useAppStore'
import { ResultsGrid, type SortState } from './ResultsGrid'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '../ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../ui/dialog'
import { toast } from '../../hooks/use-toast'
import { cn } from '../../lib/utils'

type FilterMode = 'query' | 'search'

const PAGE_SIZE = 200

export function TableBrowser({ tab }: { tab: EditorTab }): JSX.Element {
  const { updateTab, tableInvalidationTrigger } = useAppStore()
  const meta = tab.tableMeta!

  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sortState, setSortState] = useState<SortState>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>('query')
  const [filterInput, setFilterInput] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [filterError, setFilterError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  // Search navigation
  const [matchRows, setMatchRows] = useState<number[]>([])
  const [matchIdx, setMatchIdx] = useState(-1)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchDone, setSearchDone] = useState(false)
  const [scrollToRow, setScrollToRow] = useState<number | undefined>(undefined)

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [pendingNewRow, setPendingNewRow] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showRefreshDialog, setShowRefreshDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const filterRef = useRef<HTMLInputElement>(null)

  // Lifted state for batch saving
  const [pendingEdits, setPendingEdits] = useState<Map<string, Record<string, unknown>>>(new Map())
  const [newRowValues, setNewRowValues] = useState<Record<string, unknown>>({})

  // Refs for mutable state — avoids stale closure bugs in async flows
  const pageRef = useRef(page)
  pageRef.current = page
  const sortRef = useRef(sortState)
  sortRef.current = sortState
  const matchRowsRef = useRef(matchRows)
  matchRowsRef.current = matchRows
  const matchIdxRef = useRef(matchIdx)
  matchIdxRef.current = matchIdx
  const activeFilterRef = useRef(activeFilter)
  activeFilterRef.current = activeFilter

  const fetchPage = useCallback(
    async (pageNum: number, sort: SortState = sortRef.current, filter: string = activeFilter) => {
      setLoading(true)
      setFilterError('')
      try {
        const data = await window.api.query.fetchTable({
          connectionId: meta.connectionId,
          schema: meta.schema,
          table: meta.table,
          limit: PAGE_SIZE,
          offset: pageNum * PAGE_SIZE,
          orderBy: sort ?? undefined,
          where: filter || undefined
        })
        updateTab(tab.id, { tableData: data })
        setPage(pageNum)
        pageRef.current = pageNum
        setSelectedRows(new Set())
      } catch (err) {
        const msg = (err as Error).message
        if (filter) {
          setFilterError(msg)
        } else {
          toast({ title: 'Error', description: msg, variant: 'destructive' })
        }
      } finally {
        setLoading(false)
      }
    },
    [meta, tab.id, updateTab, activeFilter]
  )

  useEffect(() => {
    if (!tab.tableData) fetchPage(0, null, '')
  }, [tab.id])

  useEffect(() => {
    if (tableInvalidationTrigger.connectionId === meta.connectionId && tableInvalidationTrigger.at > 0) {
      fetchPage(pageRef.current, sortRef.current, activeFilterRef.current)
    }
  }, [tableInvalidationTrigger.at, tableInvalidationTrigger.connectionId, meta.connectionId, fetchPage])

  // Clear row selection when switching between tabs (but keep pending edits)
  useEffect(() => {
    setSelectedRows(new Set())
  }, [tab.id])

  useEffect(() => {
    trackEvent('table_opened', {
      schema: meta.schema
    })
  }, [tab.id, meta.schema])

  const handleSort = (col: string): void => {
    const next: SortState =
      sortState?.column === col
        ? sortState.dir === 'ASC'
          ? { column: col, dir: 'DESC' }
          : null
        : { column: col, dir: 'ASC' }
    setSortState(next)
    sortRef.current = next
    fetchPage(0, next)
  }

  // --- Search navigation ---

  const doScrollToRow = (localIdx: number): void => {
    // Use a tick + rAF to ensure grid has rendered before scrolling
    requestAnimationFrame(() => {
      setScrollToRow(localIdx)
      setTimeout(() => setScrollToRow(undefined), 300)
    })
  }

  const navigateToGlobalRow = async (globalRowIdx: number): Promise<void> => {
    const targetPage = Math.floor(globalRowIdx / PAGE_SIZE)
    const localIdx = globalRowIdx % PAGE_SIZE
    if (targetPage !== pageRef.current) {
      await fetchPage(targetPage)
      // Extra rAF wait for new page data to render
      await new Promise((r) => requestAnimationFrame(r))
    }
    doScrollToRow(localIdx)
  }

  const runSearch = async (term: string): Promise<void> => {
    if (!term.trim()) {
      setMatchRows([])
      setMatchIdx(-1)
      setSearchDone(false)
      return
    }
    setSearchLoading(true)
    setSearchDone(true)
    try {
      const result = await window.api.query.searchTable({
        connectionId: meta.connectionId,
        schema: meta.schema,
        table: meta.table,
        term: term.trim(),
        orderBy: sortRef.current ?? undefined
      })
      const rows = result.matchingRows
      setMatchRows(rows)
      matchRowsRef.current = rows
      if (rows.length > 0) {
        // Jump to first match at or after current viewport
        const currentOffset = pageRef.current * PAGE_SIZE
        let idx = rows.findIndex((r) => r >= currentOffset)
        if (idx === -1) idx = 0
        setMatchIdx(idx)
        matchIdxRef.current = idx
        await navigateToGlobalRow(rows[idx])
      } else {
        setMatchIdx(-1)
        matchIdxRef.current = -1
      }
    } catch (err) {
      console.error('[searchTable]', err)
      toast({ title: 'Search error', description: (err as Error).message, variant: 'destructive' })
      setMatchRows([])
      setMatchIdx(-1)
    } finally {
      setSearchLoading(false)
    }
  }

  const searchNext = async (): Promise<void> => {
    const rows = matchRowsRef.current
    if (rows.length === 0) return
    const next = (matchIdxRef.current + 1) % rows.length
    setMatchIdx(next)
    matchIdxRef.current = next
    await navigateToGlobalRow(rows[next])
  }

  const searchPrev = async (): Promise<void> => {
    const rows = matchRowsRef.current
    if (rows.length === 0) return
    const prev = (matchIdxRef.current - 1 + rows.length) % rows.length
    setMatchIdx(prev)
    matchIdxRef.current = prev
    await navigateToGlobalRow(rows[prev])
  }

  // --- Filter handlers ---

  const handleApplyFilter = (): void => {
    if (filterMode === 'search') {
      setSearchTerm(filterInput)
      runSearch(filterInput)
      return
    }
    // Strip leading WHERE if user typed it (backend adds WHERE automatically)
    const cleanFilter = filterInput.replace(/^\s*where\s+/i, '')
    setActiveFilter(cleanFilter)
    setFilterInput(cleanFilter)
    fetchPage(0, sortRef.current, cleanFilter)
  }

  const handleClearFilter = (): void => {
    setFilterInput('')
    if (filterMode === 'search') {
      setSearchTerm('')
      setMatchRows([])
      setMatchIdx(-1)
      setSearchDone(false)
      return
    }
    setActiveFilter('')
    setFilterError('')
    fetchPage(0, sortRef.current, '')
  }

  const handleFilterByValue = (col: string, value: string): void => {
    setFilterMode('query')
    setSearchTerm('')
    setMatchRows([])
    setMatchIdx(-1)
    setSearchDone(false)
    const clause = `"${col}" = '${value.replace(/'/g, "''")}'`
    setFilterInput(clause)
    setActiveFilter(clause)
    fetchPage(0, sortRef.current, clause)
  }

  const handleSwitchMode = (mode: FilterMode): void => {
    if (mode === filterMode) return
    setFilterInput('')
    setFilterError('')
    if (filterMode === 'query' && activeFilter) {
      setActiveFilter('')
      fetchPage(0, sortRef.current, '')
    }
    if (filterMode === 'search') {
      setSearchTerm('')
      setMatchRows([])
      setMatchIdx(-1)
      setSearchDone(false)
    }
    setFilterMode(mode)
    setTimeout(() => filterRef.current?.focus(), 0)
  }

  // Cmd+F / Ctrl+F: focus search bar, toggle mode on repeat press
  useHotkey('Mod+F', () => {
    const isFocused = document.activeElement === filterRef.current
    if (!isFocused) {
      // First press: just focus the input in its current mode
      filterRef.current?.focus()
    } else {
      // Already focused: toggle between search and query mode
      handleSwitchMode(filterMode === 'search' ? 'query' : 'search')
    }
  }, { ignoreInputs: false })

  // --- Row operations ---

  const handleRowSelect = (idx: number, selected: boolean): void => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (selected) next.add(idx)
      else next.delete(idx)
      return next
    })
  }

  const handleSelectAll = (checked: boolean): void => {
    const data = tab.tableData
    if (!data) return
    if (checked) {
      setSelectedRows(new Set(data.rows.map((_, i) => i)))
    } else {
      setSelectedRows(new Set())
    }
  }

  const handleDeleteSelected = (): void => {
    if (!tab.tableData || selectedRows.size === 0) return
    setShowDeleteDialog(true)
  }

  const confirmDelete = async (): Promise<void> => {
    const data = tab.tableData
    if (!data || selectedRows.size === 0) return

    const pks = await window.api.query.getPrimaryKeys(meta.connectionId, meta.schema, meta.table)
    if (pks.length === 0) {
      toast({ title: 'No primary key', description: 'Cannot delete rows without a primary key.', variant: 'destructive' })
      setShowDeleteDialog(false)
      return
    }

    const pkValuesList = Array.from(selectedRows).map((idx) =>
      Object.fromEntries(pks.map((pk) => [pk, data.rows[idx][pk]]))
    )

    setDeleting(true)
    setShowDeleteDialog(false)
    try {
      const result = await window.api.query.deleteRows({
        connectionId: meta.connectionId,
        schema: meta.schema,
        table: meta.table,
        primaryKeys: pks,
        pkValuesList
      })
      trackEvent('rows_deleted', {
        count: result.deleted
      })
      toast({ title: `Deleted ${result.deleted} row${result.deleted !== 1 ? 's' : ''}` })
      setSelectedRows(new Set())
      fetchPage(page)
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const hasPendingChanges = pendingNewRow || pendingEdits.size > 0

  const handleSaveAll = async (): Promise<void> => {
    const data = tab.tableData
    if (!data) return

    setSaving(true)
    let insertedCount = 0
    let updatedCount = 0
    const errors: string[] = []

    try {
      // 1. Insert new row if pending
      if (pendingNewRow && Object.keys(newRowValues).length > 0) {
        try {
          await window.api.query.insertRow({
            connectionId: meta.connectionId,
            schema: meta.schema,
            table: meta.table,
            values: newRowValues
          })
          insertedCount = 1
          trackEvent('row_inserted', { fieldCount: Object.keys(newRowValues).length })
        } catch (err) {
          errors.push(`Insert: ${(err as Error).message}`)
        }
      }

      // 2. Update edited rows
      if (pendingEdits.size > 0) {
        const pks = await window.api.query.getPrimaryKeys(meta.connectionId, meta.schema, meta.table)
        if (pks.length === 0 && pendingEdits.size > 0) {
          errors.push('Cannot update rows without a primary key.')
        } else {
          for (const [rowIdxStr, updates] of pendingEdits.entries()) {
            const rowIdx = parseInt(rowIdxStr, 10)
            const row = data.rows[rowIdx]
            if (!row) continue
            const pkValues = Object.fromEntries(pks.map((pk) => [pk, row[pk]]))
            try {
              await window.api.query.updateRow({
                connectionId: meta.connectionId,
                schema: meta.schema,
                table: meta.table,
                primaryKeys: pks,
                pkValues,
                updates
              })
              updatedCount++
            } catch (err) {
              errors.push(`Row ${rowIdx + 1}: ${(err as Error).message}`)
            }
          }
          if (updatedCount > 0) {
            trackEvent('rows_updated', { count: updatedCount })
          }
        }
      }

      // Clear state and refresh
      if (errors.length === 0) {
        setPendingNewRow(false)
        setNewRowValues({})
        setPendingEdits(new Map())
        const parts: string[] = []
        if (insertedCount > 0) parts.push(`${insertedCount} inserted`)
        if (updatedCount > 0) parts.push(`${updatedCount} updated`)
        toast({ title: `Saved: ${parts.join(', ')}` })
        fetchPage(page)
      } else {
        toast({ title: 'Some changes failed', description: errors.join('; '), variant: 'destructive' })
        // Still refresh to show what succeeded
        fetchPage(page)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDiscardAll = (): void => {
    setPendingNewRow(false)
    setNewRowValues({})
    setPendingEdits(new Map())
  }

  const handleRefresh = (): void => {
    if (hasPendingChanges) {
      setShowRefreshDialog(true)
    } else {
      fetchPage(page)
    }
  }

  const handleRefreshDiscard = (): void => {
    handleDiscardAll()
    setShowRefreshDialog(false)
    fetchPage(page)
  }

  const handleRefreshSave = async (): Promise<void> => {
    await handleSaveAll()
    setShowRefreshDialog(false)
    // handleSaveAll already calls fetchPage on success
  }

  const tableData = tab.tableData
  const totalPages = tableData ? Math.ceil(tableData.total / PAGE_SIZE) : 0
  const hasActiveFilter = activeFilter.length > 0

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
        <span className="text-xs font-medium text-muted-foreground shrink-0">
          {meta.schema}.{meta.table}
        </span>
        {hasPendingChanges && (
          <>
            <Button
              variant="default"
              size="sm"
              className="h-6 gap-1.5"
              onClick={handleSaveAll}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save{pendingEdits.size > 0 || pendingNewRow ? ` (${pendingEdits.size + (pendingNewRow ? 1 : 0)})` : ''}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1.5"
              onClick={handleDiscardAll}
              disabled={saving}
            >
              <X className="h-3 w-3" />
              Discard
            </Button>
          </>
        )}
        <div className="flex-1" />
        {selectedRows.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1.5 text-destructive hover:text-destructive"
            onClick={handleDeleteSelected}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Delete {selectedRows.size}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5"
          onClick={() => { setPendingNewRow(true); setSelectedRows(new Set()) }}
          disabled={pendingNewRow}
        >
          <Plus className="h-3 w-3" />
          Insert row
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleRefresh}
          disabled={loading}
          title="Refresh"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-muted/20 px-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'shrink-0 rounded p-0.5 transition-colors hover:bg-accent',
                (hasActiveFilter || searchTerm) ? 'text-primary' : 'text-muted-foreground/50'
              )}
              title={`Filter mode: ${filterMode === 'query' ? 'SQL WHERE' : 'Text search'}`}
            >
              {filterMode === 'query'
                ? <Filter className="h-3 w-3" />
                : <Search className="h-3 w-3" />
              }
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[180px]">
            <DropdownMenuItem
              onClick={() => handleSwitchMode('query')}
              className="gap-2"
            >
              <Database className="h-3.5 w-3.5" />
              <div className="flex flex-col">
                <span className={cn(filterMode === 'query' && 'text-primary font-medium')}>SQL Filter</span>
                <span className="text-2xs text-muted-foreground">WHERE clause query</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleSwitchMode('search')}
              className="gap-2"
            >
              <Search className="h-3.5 w-3.5" />
              <div className="flex flex-col">
                <span className={cn(filterMode === 'search' && 'text-primary font-medium')}>Text Search</span>
                <span className="text-2xs text-muted-foreground">Highlight matching cells</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={filterRef}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
          placeholder={filterMode === 'query'
            ? "column name = 'value' (e.g. id > 100 or name = 'john')"
            : 'Search across all cells...'
          }
          value={filterInput}
          onChange={(e) => {
            setFilterInput(e.target.value)
            if (filterMode === 'search') {
              setSearchTerm(e.target.value)
              // Reset server matches — will re-search on Enter
              setSearchDone(false)
              setMatchRows([])
              setMatchIdx(-1)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              handleClearFilter()
              return
            }
            if (e.key === 'Enter' && filterMode === 'search') {
              e.preventDefault()
              if (matchRowsRef.current.length > 0 && searchTerm === filterInput) {
                // Already have results — cycle through
                if (e.shiftKey) searchPrev()
                else searchNext()
              } else {
                handleApplyFilter()
              }
              return
            }
            if (e.key === 'Enter') handleApplyFilter()
          }}
          spellCheck={false}
        />
        {filterInput && (
          <button onClick={handleClearFilter} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3 w-3" />
          </button>
        )}
        {filterMode === 'query' && filterInput !== activeFilter && (
          <button
            onClick={handleApplyFilter}
            className="shrink-0 rounded bg-primary px-2 py-0.5 text-2xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Apply ↵
          </button>
        )}
        {filterMode === 'search' && searchLoading && (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
        )}
        {filterMode === 'search' && !searchLoading && matchRows.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-2xs text-muted-foreground tabular-nums">
              {matchIdx + 1} of {matchRows.length}
            </span>
            <button
              onClick={searchPrev}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Previous match (Shift+Enter)"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              onClick={searchNext}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Next match (Enter)"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
        {filterMode === 'search' && !searchLoading && searchDone && matchRows.length === 0 && (
          <span className="shrink-0 text-2xs text-muted-foreground">No matches</span>
        )}
        {filterError && (
          <span className="shrink-0 text-2xs text-destructive truncate max-w-[200px]" title={filterError}>
            {filterError.split('\n')[0]}
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden">
        {tableData ? (
          <ResultsGrid
            rows={tableData.rows}
            fields={tableData.fields}
            connectionId={meta.connectionId}
            schema={meta.schema}
            table={meta.table}
            selectedRows={selectedRows}
            onRowSelect={handleRowSelect}
            sortState={sortState}
            onSort={handleSort}
            onFilterByValue={handleFilterByValue}
            pendingNewRow={pendingNewRow}
            onCancelNewRow={() => { setPendingNewRow(false); setNewRowValues({}) }}
            searchTerm={searchTerm}
            scrollToRow={scrollToRow}
            pendingEdits={pendingEdits}
            onPendingEditsChange={setPendingEdits}
            newRowValues={newRowValues}
            onNewRowValuesChange={setNewRowValues}
            onSelectAll={handleSelectAll}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex h-7 shrink-0 items-center justify-center gap-2 border-t border-border bg-background/50 px-3">
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === 0 || loading} onClick={() => fetchPage(page - 1)}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page >= totalPages - 1 || loading} onClick={() => fetchPage(page + 1)}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Refresh confirmation dialog */}
      <Dialog open={showRefreshDialog} onOpenChange={setShowRefreshDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Unsaved Changes
            </DialogTitle>
            <DialogDescription>
              You have {pendingEdits.size + (pendingNewRow ? 1 : 0)} unsaved change{(pendingEdits.size + (pendingNewRow ? 1 : 0)) !== 1 ? 's' : ''}. 
              What would you like to do before refreshing?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowRefreshDialog(false)}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefreshDiscard}>
              Discard & Refresh
            </Button>
            <Button size="sm" onClick={handleRefreshSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Save & Refresh
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Delete {selectedRows.size} row{selectedRows.size !== 1 ? 's' : ''}?
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The selected row{selectedRows.size !== 1 ? 's' : ''} will be permanently deleted from the database.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
