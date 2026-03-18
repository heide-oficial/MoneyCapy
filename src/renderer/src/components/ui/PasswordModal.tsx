import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Input } from './Input'
import { Lock } from 'lucide-react'
import { useSession } from '../../contexts/SessionContext'
import { useTranslation } from '../../contexts/LanguageContext'

interface PasswordModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  mode?: 'unlock' | 'set'
}

export function PasswordModal({ open, onClose, onSuccess, mode = 'unlock' }: PasswordModalProps) {
  const { unlock, setInitialPassword } = useSession()
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'set') {
        if (password.length < 4) {
          setError(t('settings.passwordMinChars'))
          return
        }
        if (password !== confirmPassword) {
          setError(t('settings.passwordMismatch'))
          return
        }
        const result = await setInitialPassword(password)
        if (result) {
          setPassword('')
          setConfirmPassword('')
          onSuccess?.()
          onClose()
        }
      } else {
        const result = await unlock(password)
        if (result) {
          setPassword('')
          onSuccess?.()
          onClose()
        } else {
          setError(t('passwordModal.incorrectPassword'))
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'set' ? t('passwordModal.setPassword') : t('passwordModal.unlockData')}
      maxWidth="max-w-sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-center mb-2">
          <div className="rounded-full bg-primary/10 p-3">
            <Lock size={24} className="text-primary" />
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {mode === 'set'
            ? t('passwordModal.setPasswordDesc')
            : t('passwordModal.unlockDesc')
          }
        </p>
        <Input
          type="password"
          placeholder={t('passwordModal.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {mode === 'set' && (
          <Input
            type="password"
            placeholder={t('passwordModal.confirmPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        )}
        {error && <p className="text-sm text-center text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading || !password}>
          {loading ? t('passwordModal.verifying') : mode === 'set' ? t('passwordModal.setPassword') : t('passwordModal.unlock')}
        </Button>
      </form>
    </Modal>
  )
}
