import { useRef, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useAppStore } from '../../store/useAppStore'
import { Button } from '../ui/button'
import { Play, Loader2, BookmarkPlus } from 'lucide-react'
import { TableBrowser } from '../ResultsPanel/TableBrowser'
import { toBucket, trackEvent } from '../../lib/analytics'

export function EditorTab(): JSX.Element {
  const { tabs, activeTabId, activeConnectionId, connectedIds, savedQueries, updateTab, theme, editorFontSize, openSaveQueryDialog, openSaveChangesConfirm, invalidateTableData } = useAppStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)

  const isConnected = activeConnectionId ? connectedIds.includes(activeConnectionId) : false

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor

    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => handleRun()
    })

    const disposable = monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: [' ', '.', '"', "'"],
      provideCompletionItems: (
        model: Monaco.editor.ITextModel,
        position: Monaco.Position
      ) => {
        const { schemaStates, activeConnectionId } = useAppStore.getState()
        if (!activeConnectionId) return { suggestions: [] }
        const state = schemaStates[activeConnectionId]
        if (!state) return { suggestions: [] }

        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        }

        const suggestions: import('monaco-editor').languages.CompletionItem[] = []

        for (const schema of state.schemas) {
          suggestions.push({
            label: schema,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: `"${schema}"`,
            detail: 'schema',
            sortText: '0_' + schema,
            range
          })
        }

        for (const [schemaName, tables] of Object.entries(state.tables)) {
          for (const tbl of tables) {
            suggestions.push({
              label: tbl.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: `"${tbl.name}"`,
              detail: `${schemaName} · ${tbl.type.toLowerCase()}`,
              sortText: '1_' + tbl.name,
              range
            })
            suggestions.push({
              label: `${schemaName}.${tbl.name}`,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: `"${schemaName}"."${tbl.name}"`,
              detail: tbl.type.toLowerCase(),
              sortText: '1_' + schemaName + '_' + tbl.name,
              range
            })
          }
        }

        for (const cols of Object.values(state.columns)) {
          for (const col of cols) {
            suggestions.push({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: `"${col.name}"`,
              detail: col.type + (col.isPrimary ? ' 🔑' : '') + ((col.foreignKeys?.length ?? 0) > 0 ? ' 🔗' : ''),
              sortText: '2_' + col.name,
              range
            })
          }
        }

        const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'INNER JOIN', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'SET', 'VALUES', 'RETURNING', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'AS', 'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ILIKE', 'IS NULL', 'IS NOT NULL', 'BETWEEN', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'COALESCE', 'NULLIF', 'CAST', 'NOW()', 'CURRENT_TIMESTAMP']
        for (const kw of keywords) {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            sortText: '3_' + kw,
            range
          })
        }

        return { suggestions }
      }
    })

    return () => disposable.dispose()
  }

  const handleRun = useCallback(async () => {
    if (!activeTabId || !activeConnectionId || !isConnected) return
    const editor = editorRef.current
    if (!editor) return

    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!model) return

    const selectedText = selection && !selection.isEmpty() ? model.getValueInRange(selection) : null
    const sql = selectedText || model.getValue()
    if (!sql.trim()) return

    updateTab(activeTabId, { isLoading: true, error: null, result: null })

    try {
      const result = await window.api.query.execute(activeConnectionId, sql.trim())
      updateTab(activeTabId, { result, isLoading: false })
      trackEvent('query_executed', {
        success: true,
        durationBucket: toBucket(result.durationMs, [50, 100, 250, 500, 1000, 2000]),
        rowCountBucket: toBucket(result.rowCount ?? 0, [0, 1, 10, 100, 1000, 10000])
      })

      await window.api.history.add({
        connectionId: activeConnectionId,
        sql: sql.trim(),
        executedAt: Date.now(),
        durationMs: result.durationMs,
        rowCount: result.rowCount
      })
      const mutateCommands = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']
      if (mutateCommands.includes(result.command)) {
        invalidateTableData(activeConnectionId)
      }
    } catch (err) {
      trackEvent('query_executed', {
        success: false
      })
      updateTab(activeTabId, {
        error: (err as Error).message,
        isLoading: false
      })
    }
  }, [activeTabId, activeConnectionId, isConnected, updateTab, invalidateTableData])

  const handleSaveQuery = useCallback(() => {
    const editor = editorRef.current
    const model = editor?.getModel()
    const sql = model ? model.getValue() : (activeTab?.sql ?? '')
    if (activeTab?.savedQueryId) {
      openSaveChangesConfirm(activeTab.savedQueryId, sql)
    } else {
      openSaveQueryDialog(sql)
    }
  }, [activeTab?.sql, activeTab?.savedQueryId, openSaveQueryDialog, openSaveChangesConfirm])

  if (!activeTab) return <div className="flex-1" />

  const saved = activeTab.savedQueryId ? savedQueries.find((q) => q.id === activeTab.savedQueryId) : null
  const hasUnsavedChanges = !saved || saved.sql.trim() !== (activeTab.sql ?? '').trim()
  const showSaveButton = hasUnsavedChanges

  if (activeTab.mode === 'table' && activeTab.tableMeta) {
    return <TableBrowser tab={activeTab} />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-7 items-center justify-between border-b border-border bg-background px-3">
        <span className="text-xs text-muted-foreground">
          {isConnected ? `Connected` : 'No connection — select one from the sidebar'}
        </span>
        <div className="flex items-center gap-1.5">
          {showSaveButton && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSaveQuery}
              className="h-6 gap-1.5 text-xs"
              title="Save query"
            >
              <BookmarkPlus className="h-3 w-3" />
              Save
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleRun}
            disabled={!isConnected || activeTab.isLoading}
            className="h-6 gap-1.5 text-xs"
          >
          {activeTab.isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
            Run
            <kbd className="ml-1 hidden rounded bg-primary-foreground/20 px-1 text-2xs opacity-70 sm:inline">
              ⌘↵
            </kbd>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language="sql"
          value={activeTab.sql}
          onChange={(val) => activeTabId && updateTab(activeTabId, { sql: val ?? '' })}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('pg-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [],
              colors: {
                'editor.background': '#1a1a1a',
                'editor.lineHighlightBackground': '#232323',
                'editorLineNumber.foreground': '#444444',
                'editorLineNumber.activeForeground': '#888888',
                'editor.selectionBackground': '#0a84ff33',
                'editorCursor.foreground': '#0a84ff',
                'editorGutter.background': '#1a1a1a'
              }
            })
            monaco.editor.defineTheme('pg-light', {
              base: 'vs',
              inherit: true,
              rules: [],
              colors: {
                'editor.background': '#ffffff',
                'editor.lineHighlightBackground': '#f5f5f5',
                'editorLineNumber.foreground': '#cccccc',
                'editorLineNumber.activeForeground': '#999999',
                'editor.selectionBackground': '#0a84ff22'
              }
            })
          }}
          theme={theme === 'dark' ? 'pg-dark' : 'pg-light'}
          onMount={handleMount}
          options={{
            fontSize: editorFontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            renderLineHighlight: 'gutter',
            padding: { top: 12, bottom: 12 },
            folding: true,
            wordWrap: 'off',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            tabSize: 2,
            insertSpaces: true,
            automaticLayout: true,
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6
            }
          }}
        />
      </div>
    </div>
  )
}
