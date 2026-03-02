import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Loader2 } from 'lucide-react'

export function ConfirmSaveChangesDialog(): JSX.Element {
  const {
    saveChangesConfirmOpen,
    saveChangesConfirmPayload,
    savedQueries,
    closeSaveChangesConfirm,
    confirmSaveChanges
  } = useAppStore()

  const [saving, setSaving] = useState(false)
  const saved = saveChangesConfirmPayload
    ? savedQueries.find((q) => q.id === saveChangesConfirmPayload.savedQueryId)
    : null

  const handleConfirm = async (): Promise<void> => {
    setSaving(true)
    try {
      await confirmSaveChanges()
    } catch (err) {
      console.error('[ConfirmSaveChanges] confirmSaveChanges failed:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={saveChangesConfirmOpen} onOpenChange={(o) => !o && closeSaveChangesConfirm()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save changes</DialogTitle>
          <DialogDescription>
            Save changes to <strong>{saved?.name ?? 'this query'}</strong>?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={closeSaveChangesConfirm}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
