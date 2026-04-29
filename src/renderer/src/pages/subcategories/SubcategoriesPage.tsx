import { useEffect, useState } from 'react'
import { Bookmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { KebabMenu } from '../../components/ui/KebabMenu'
import { Modal } from '../../components/ui/Modal'
import { SectionLayout } from '../../components/layout/SectionLayout'
import { useTranslation } from '../../contexts/LanguageContext'
import { useUndoableDelete } from '../../hooks/useUndoableDelete'

interface Category {
  id: number
  name: string
  color: string
  scope?: 'expense' | 'income' | 'both'
}

interface Subcategory {
  id: number
  name: string
  color: string
  categoryIds?: number[]
}

export default function SubcategoriesPage() {
  const { t } = useTranslation()
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Subcategory | null>(null)
  const [name, setName] = useState('')
  const [categoryIds, setCategoryIds] = useState<number[]>([])

  const loadData = async () => {
    const [subs, cats] = await Promise.all([
      window.api.subcategories.list(),
      window.api.categories.list()
    ])
    setSubcategories(subs)
    setCategories(cats)
  }

  useEffect(() => { loadData() }, [])

  const openCreate = () => {
    setEditing(null)
    setName('')
    setCategoryIds([])
    setShowForm(true)
  }

  const openEdit = (subcat: Subcategory) => {
    setEditing(subcat)
    setName(subcat.name)
    setCategoryIds(subcat.categoryIds || [])
    setShowForm(true)
  }

  const toggleCategory = (categoryId: number) => {
    setCategoryIds(ids => ids.includes(categoryId)
      ? ids.filter(id => id !== categoryId)
      : [...ids, categoryId]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error(t('common.nameRequired')); return }
    if (categoryIds.length === 0) { toast.error(t('subcategories.categoryRequired')); return }
    if (editing) {
      await window.api.subcategories.update({ id: editing.id, name: name.trim(), categoryIds })
      toast.success(t('subcategories.subcategoryUpdated'))
    } else {
      await window.api.subcategories.create({ name: name.trim(), categoryIds })
      toast.success(t('subcategories.subcategoryCreated'))
    }
    setShowForm(false)
    loadData()
  }

  const { requestDelete, isPending } = useUndoableDelete({
    onDelete: async (id) => { await window.api.subcategories.delete(id); loadData() },
    toastLabel: t('subcategories.subcategoryDeleted')
  })

  const getCategoryNames = (subcat: Subcategory) => {
    const ids = new Set(subcat.categoryIds || [])
    return categories.filter(cat => ids.has(cat.id)).map(cat => cat.name)
  }

  return (
    <SectionLayout
      icon={Bookmark}
      title={t('subcategories.title')}
      actionButton={<Button size="sm" onClick={openCreate}><Plus size={16} /> {t('subcategories.createSubcategory')}</Button>}
    >
      {subcategories.filter(subcat => !isPending(subcat.id)).length === 0 ? (
        <Card className="p-8 text-center">
          <Bookmark size={48} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{t('subcategories.noSubcategories')}</p>
          <Button size="sm" className="mt-4" onClick={openCreate}><Plus size={16} /> {t('subcategories.createSubcategory')}</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {subcategories.filter(subcat => !isPending(subcat.id)).map(subcat => {
            const linkedCategories = getCategoryNames(subcat)
            return (
              <Card key={subcat.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Bookmark size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{subcat.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {linkedCategories.length > 0 ? linkedCategories.join(', ') : t('subcategories.noLinkedCategories')}
                    </p>
                  </div>
                  <KebabMenu size={16} items={[
                    { label: t('common.edit'), icon: Pencil, onClick: () => openEdit(subcat) },
                    { label: t('common.delete'), icon: Trash2, onClick: () => requestDelete(subcat.id), destructive: true }
                  ]} />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? t('subcategories.editSubcategory') : t('subcategories.createSubcategory')}
      >
        <div className="space-y-4">
          <Input
            label={t('common.name')}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('subcategories.placeholder')}
            autoFocus
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">{t('categories.title')}</label>
            <div className="rounded-lg border border-border bg-card p-3">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('categories.noCategories')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(category => {
                    const selected = categoryIds.includes(category.id)
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => toggleCategory(category.id)}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all border ${
                          selected ? 'ring-1 ring-offset-1 ring-offset-card' : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: `${category.color || '#6b7280'}20`,
                          color: category.color || '#6b7280',
                          borderColor: selected ? category.color || '#6b7280' : 'transparent'
                        }}
                      >
                        {category.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editing ? t('common.save') : t('common.create')}</Button>
          </div>
        </div>
      </Modal>
    </SectionLayout>
  )
}
