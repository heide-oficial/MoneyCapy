export type EntityScope = 'expense' | 'income' | 'both'

export interface CategoryRecord {
  id: number
  name: string
  icon: string
  color: string
  scope?: EntityScope
}

export interface CategoryCreateInput {
  name: string
  icon: string
  color: string
  scope?: EntityScope
}

export interface CategoryUpdateInput extends Partial<CategoryCreateInput> {
  id: number
}

export interface SubcategoryRecord {
  id: number
  name: string
  color: string
  scope?: EntityScope
  categoryIds?: number[]
}

export interface SubcategoryCreateInput {
  name: string
  color?: string
  scope?: EntityScope
  categoryIds?: number[]
}

export interface SubcategoryUpdateInput extends Partial<SubcategoryCreateInput> {
  id: number
}

export interface TagRecord {
  id: number
  name: string
  color: string
}

export interface TagCreateInput {
  name: string
  color: string
}

export interface TagUpdateInput extends Partial<TagCreateInput> {
  id: number
}

export interface StoreRecord {
  id: number
  name: string
  color: string
}

export interface StoreCreateInput {
  name: string
  color?: string
}

export interface StoreUpdateInput extends Partial<StoreCreateInput> {
  id: number
}

export interface PersonRecord {
  id: number
  name: string
  color: string
}

export interface PersonCreateInput {
  name: string
  color?: string
}

export interface PersonUpdateInput extends Partial<PersonCreateInput> {
  id: number
}
