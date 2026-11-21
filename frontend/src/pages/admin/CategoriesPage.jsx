import { useMemo, useState } from 'react'
import { CornerDownRight, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/common/PageHeader'
import Thumb from '@/components/common/Thumb'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import { useDeleteCategoryMutation, useGetAdminCategoriesQuery } from '@/features/admin/adminApi'
import { getErrorMessage } from '@/utils/apiError'
import { formatNumber } from '@/utils/format'
import CategoryFormModal from './categories/CategoryFormModal'

/** Flat API list → parents, each followed by its subcategories. */
function toTreeRows(categories) {
  const parents = categories.filter((c) => !c.parent)
  return parents.flatMap((parent) => {
    const children = categories.filter((c) => c.parent === parent._id)
    return [{ ...parent, childCount: children.length }, ...children.map((child) => ({ ...child, childCount: 0 }))]
  })
}

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useGetAdminCategoriesQuery()
  const [deleteCategory, { isLoading: deleting }] = useDeleteCategoryMutation()
  const [editing, setEditing] = useState(null) // { category?, defaultParent? }
  const [toDelete, setToDelete] = useState(null)

  const rows = useMemo(() => toTreeRows(categories), [categories])
  const parents = useMemo(() => categories.filter((c) => !c.parent), [categories])

  async function confirmDelete() {
    try {
      await deleteCategory(toDelete._id).unwrap()
      toast.success('Category deleted')
      setToDelete(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
      setToDelete(null)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Category',
      render: (c) => (
        <div className={`flex min-w-60 items-center gap-3 ${c.parent ? 'pl-6' : ''}`}>
          {c.parent && <CornerDownRight className="size-4 shrink-0 text-slate-300" />}
          <Thumb src={c.image?.url} className="size-9" />
          <div className="min-w-0">
            <p className={`truncate ${c.parent ? 'text-slate-800' : 'font-semibold text-slate-900'}`}>{c.name}</p>
            <p className="truncate font-mono text-xs text-slate-400">{c.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (c) =>
        c.parent ? (
          <span className="text-slate-500">Subcategory</span>
        ) : (
          <span className="text-slate-700">Category{c.childCount ? ` · ${c.childCount} sub` : ''}</span>
        ),
    },
    { key: 'products', header: 'Products', align: 'right', render: (c) => formatNumber(c.productCount) },
    { key: 'sort', header: 'Order', align: 'right', render: (c) => c.sortOrder },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (c.isActive ? <Badge tone="green" dot>Active</Badge> : <Badge tone="gray" dot>Hidden</Badge>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <div className="flex justify-end gap-1">
          {!c.parent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing({ defaultParent: c._id })}
              disabled={c.productCount > 0}
              title={c.productCount > 0 ? 'Move its products before adding subcategories' : 'Add subcategory'}
            >
              <Plus className="size-4" /> Sub
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setEditing({ category: c })} aria-label={`Edit ${c.name}`}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setToDelete(c)}
            disabled={c.childCount > 0 || c.productCount > 0}
            title={c.childCount > 0 || c.productCount > 0 ? 'Only empty categories can be deleted' : 'Delete'}
            aria-label={`Delete ${c.name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise the catalog. Sellers pick from active subcategories."
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> New category
          </Button>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          emptyState={
            <EmptyState
              icon={FolderTree}
              title="No categories yet"
              description="Create top-level categories like Fashion or Electronics, then add subcategories."
              action={<Button onClick={() => setEditing({})}>New category</Button>}
            />
          }
        />
      </Card>

      {editing && (
        <CategoryFormModal
          category={editing.category ?? null}
          defaultParent={editing.defaultParent ?? ''}
          parents={parents}
          hasChildren={Boolean(editing.category?.childCount)}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={`Delete "${toDelete?.name ?? ''}"?`}
        description="This cannot be undone."
        confirmLabel="Delete category"
      />
    </>
  )
}
