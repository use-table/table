import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from '../../hooks/use-toast'

export function SaveQueryDialog(): JSX.Element {
  const {
    saveQueryDialogOpen,
    editingSavedQueryId,
    saveQueryInitialSql,
    savedQueries,
    closeSaveQueryDialog,
    saveSavedQuery,
    activeConnectionId
  } = useAppStore()

  const editing = editingSavedQueryId
    ? savedQueries.find((q) => q.id === editingSavedQueryId)
    : null

  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (saveQueryDialogOpen) {
      setName(editing?.name ?? '')
    }
  }, [saveQueryDialogOpen, editing?.name])

  const handleSave = async (): Promise<void> => {
    const sql = saveQueryInitialSql
    if (!name.trim()) return
    if (!sql.trim()) return

    setSaving(true)
    try {
      await saveSavedQuery({
        id: editingSavedQueryId ?? undefined,
        name: name.trim(),
        sql: sql.trim(),
        connectionId: activeConnectionId ?? null
      })
    } catch (err) {
      const safeMessage =
        err instanceof Error
          ? err.message
          : err != null &&
              typeof (err as { message?: unknown }).message === 'string'
            ? (err as { message: string }).message
            : String(err ?? 'Unknown error')
      toast({
        title: 'Save failed',
        description: safeMessage,
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={saveQueryDialogOpen} onOpenChange={(o) => !o && closeSaveQueryDialog()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Rename Saved Query' : 'Save Query'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Change the name for this saved query.'
              : 'Save the current query for quick access later.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. Active users last 7 days"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={closeSaveQueryDialog}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {editing ? 'Rename' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
