import { useEffect, useRef } from 'react'
import type { ImperativePanelHandle } from 'react-resizable-panels'
import { cn } from './lib/utils'
import { useAppStore } from './store/useAppStore'
import { ConnectionList } from './components/Sidebar/ConnectionList'
import { SchemaTree } from './components/Sidebar/SchemaTree'
import { SavedQueriesPanel } from './components/Sidebar/SavedQueriesPanel'
import { TitleBar } from './components/TitleBar/TitleBar'
import { QueryHistoryPanel } from './components/QueryHistory/QueryHistoryPanel'
import { EditorTab } from './components/QueryEditor/EditorTab'
import { QueryResultPanel } from './components/ResultsPanel/QueryResultPanel'
import { StatusBar } from './components/StatusBar/StatusBar'
import { ConnectionDialog } from './components/Dialogs/ConnectionDialog'
import { SettingsDialog } from './components/Dialogs/SettingsDialog'
import { SaveQueryDialog } from './components/Dialogs/SaveQueryDialog'
import { ConfirmSaveChangesDialog } from './components/Dialogs/ConfirmSaveChangesDialog'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { Toaster } from './components/ui/toaster'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable'
import { TooltipProvider } from './components/ui/tooltip'
import { initAnalytics, setAnalyticsEnabled, trackEvent } from './lib/analytics'

export default function App(): JSX.Element {
  const { theme, setTheme, setUpdaterState, openSettings, loadSettings, loadConnections, loadSavedQueries, restoreSession, historyPanelOpen } =
    useAppStore()

  const inspectedRow = useAppStore((s) => s.inspectedRow)
  const activeTab = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const bottomPanelRef = useRef<ImperativePanelHandle>(null)

  // Keep the bottom panel tight when there's nothing to inspect;
  // expand it once a row is selected in table-browse mode.
  useEffect(() => {
    const panel = bottomPanelRef.current
    if (!panel) return
    const isTableMode = activeTab?.mode === 'table'
    if (isTableMode && inspectedRow) {
      // Only expand if the panel is still at the compact size
      if (panel.getSize() < 25) {
        panel.resize(40)
      }
    } else if (isTableMode && !inspectedRow) {
      panel.resize(15)
    }
  }, [inspectedRow, activeTab?.mode])

  useEffect(() => {
    if (!window.api) return

    ;(async () => {
      await loadSettings()
      await loadConnections()
      if (window.api.savedQueries) await loadSavedQueries()
      await restoreSession()
      const settings = await window.api.settings.get()
      initAnalytics(settings.analyticsEnabled)
      setAnalyticsEnabled(settings.analyticsEnabled)
      trackEvent('app_opened', {
        theme: settings.theme,
        os: navigator.platform,
        appVersion: (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
          .VITE_APP_VERSION ?? 'unknown'
      })
    })()

    const unlisten = window.api.theme.onChange((t) => {
      setTheme(t)
      document.documentElement.classList.toggle('dark', t === 'dark')
    })

    const unlistenUpdate = window.api.updater.onUpdateAvailable(() => {
      setUpdaterState({ status: 'available', progress: null, error: null })
      trackEvent('update_available')
    })
    const unlistenDownloaded = window.api.updater.onUpdateDownloaded(() => {
      setUpdaterState({ status: 'downloaded', progress: 100, error: null })
      trackEvent('update_downloaded')
    })
    const unlistenNotAvailable = window.api.updater.onUpdateNotAvailable(() => {
      setUpdaterState({ status: 'idle', progress: null, error: null })
    })
    const unlistenProgress = window.api.updater.onDownloadProgress((progress) => {
      setUpdaterState({ status: 'downloading', progress: progress.percent, error: null })
    })
    const unlistenError = window.api.updater.onUpdateError((message) => {
      setUpdaterState({ status: 'error', progress: null, error: message })
      trackEvent('update_error', { message })
    })
    const unlistenSettings = window.api.settings.onOpenRequest(() => openSettings())
    const unlistenCloseTabOrWindow = window.api.window.onCloseTabOrWindowRequest(() => {
      const { tabs, activeTabId, closeTab } = useAppStore.getState()
      if (tabs.length <= 1) {
        void window.api.window.close()
        return
      }
      const tabId = activeTabId ?? tabs[0]?.id
      if (tabId) {
        closeTab(tabId)
      }
    })

    return () => {
      unlisten()
      unlistenUpdate()
      unlistenDownloaded()
      unlistenNotAvailable()
      unlistenProgress()
      unlistenError()
      unlistenSettings()
      unlistenCloseTabOrWindow()
    }
  }, [])

  return (
    <TooltipProvider delayDuration={600}>
      <div className={cn('flex h-screen flex-col overflow-hidden', theme === 'dark' && 'dark')}>
        <TitleBar />

        <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
          {/* Left sidebar — connections + schema tree */}
          <ResizablePanel
            defaultSize={20}
            minSize={14}
            maxSize={35}
            className="flex flex-col sidebar-bg border-r border-sidebar-border"
          >
            <ConnectionList />
            <SchemaTree />
            <SavedQueriesPanel />
          </ResizablePanel>

          <ResizableHandle />

          {/* Main content */}
          <ResizablePanel defaultSize={historyPanelOpen ? 60 : 80} className="flex flex-col bg-background">
            <ResizablePanelGroup direction="vertical" className="flex-1 overflow-hidden">
              <ResizablePanel defaultSize={55} minSize={20}>
                <EditorTab />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel ref={bottomPanelRef} defaultSize={45} minSize={10}>
                <QueryResultPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Right sidebar — query history, collapsible */}
          {historyPanelOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel
                defaultSize={20}
                minSize={14}
                maxSize={35}
                className="flex flex-col sidebar-bg border-l border-sidebar-border"
              >
                <QueryHistoryPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        <StatusBar />
        <ConnectionDialog />
        <SettingsDialog />
        <SaveQueryDialog />
        <ConfirmSaveChangesDialog />
        <CommandPalette />
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
