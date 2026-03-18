import { Modal } from './Modal'
import { Button } from './Button'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'destructive' | 'default'
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel, variant = 'destructive'
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm')
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="flex items-start gap-3 mb-6">
        <div className={`rounded-full p-2 ${variant === 'destructive' ? 'bg-destructive/10' : 'bg-primary/10'}`}>
          <AlertTriangle size={20} className={variant === 'destructive' ? 'text-destructive' : 'text-primary'} />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant={variant} size="sm" onClick={() => { onConfirm(); onClose() }}>
          {resolvedConfirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
