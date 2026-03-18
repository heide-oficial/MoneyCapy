import { useState, useEffect } from 'react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { SectionLayout } from '../../components/layout/SectionLayout'
import { useActivePerson } from '../../contexts/ActivePersonContext'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'
import { useColorMode } from '../../contexts/ColorModeContext'
import { useTranslation } from '../../contexts/LanguageContext'
import { ColorPicker } from '../../components/ui/ColorPicker'
import { Users, Plus, Pencil, Trash2, Palette } from 'lucide-react'
import { toast } from 'sonner'

interface Person { id: number; name: string; color: string }

import { PRESET_COLORS } from '../../lib/constants'

export default function PeoplePage() {
  const { t } = useTranslation()
  const { reloadPeople } = useActivePerson()
  const { colorMode, resolveEntityColor } = useColorMode()
  const [people, setPeople] = useState<Person[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Person | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [showColorPicker, setShowColorPicker] = useState(false)

  const load = async () => { setPeople(await window.api.people.list()) }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setName(''); setColor('#3b82f6'); setShowForm(true) }
  const openEdit = (p: Person) => { setEditing(p); setName(p.name); setColor(p.color); setShowForm(true) }

  const handleSave = async () => {
    if (!name.trim()) { toast.error(t('common.nameRequired')); return }
    if (editing) {
      await window.api.people.update({ id: editing.id, name, color })
      toast.success(t('people.personUpdated'))
    } else {
      await window.api.people.create({ name, color })
      toast.success(t('people.personAdded'))
    }
    setShowForm(false)
    load()
    reloadPeople()
  }

  const { requestDelete, isPending: isDeletePending } = useUndoableDelete({
    onDelete: async (id) => { await window.api.people.delete(id); load(); reloadPeople() },
    toastLabel: t('people.personDeleted')
  })

  return (
    <SectionLayout
      icon={Users}
      title={t('people.title')}
      actionButton={<Button size="sm" onClick={openCreate}><Plus size={16} /> {t('people.newPerson')}</Button>}
      stats={[
        { label: t('people.total'), value: people.length !== 1 ? t('people.registeredPlural', { count: people.length }) : t('people.registered', { count: people.length }) }
      ]}
    >
      {people.length === 0 ? (
        <Card className="p-8 text-center">
          <Users size={48} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{t('people.noPeople')}</p>
          <Button size="sm" className="mt-4" onClick={openCreate}><Plus size={16} /> {t('people.createPerson')}</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {people.filter(p => !isDeletePending(p.id)).map((p, idx) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold text-sm"
                    style={{ backgroundColor: resolveEntityColor(p.color, idx) }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{p.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => requestDelete(p.id)}><Trash2 size={14} className="text-destructive" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? t('people.editPerson') : t('people.newPerson')}>
        <div className="space-y-4">
          <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('people.placeholder')} autoFocus />

          {/* Color Picker — only in custom mode */}
          {colorMode === 'custom' && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">{t('common.color')}</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`h-8 w-8 rounded-full transition-all ${
                        color === c ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <button
                    onClick={() => setShowColorPicker(true)}
                    className={`h-8 w-8 rounded-full border-2 border-dashed border-border hover:border-primary flex items-center justify-center transition-all hover:scale-105 ${
                      !PRESET_COLORS.includes(color) ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : ''
                    }`}
                    style={!PRESET_COLORS.includes(color) ? { backgroundColor: color } : undefined}
                    title={t('common.customColor')}
                  >
                    {PRESET_COLORS.includes(color) && <Palette size={14} className="text-muted-foreground" />}
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold"
                  style={{ backgroundColor: color }}
                >
                  {(name || 'A').charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium">{name || t('common.preview')}</span>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editing ? t('common.save') : t('common.create')}</Button>
          </div>
        </div>
      </Modal>
      <ColorPicker
        open={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        value={color}
        onConfirm={c => { setColor(c); setShowColorPicker(false) }}
      />
    </SectionLayout>
  )
}
