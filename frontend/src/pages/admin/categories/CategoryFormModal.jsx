import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import ImagePicker from '@/components/common/ImagePicker'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Switch from '@/components/ui/Switch'
import Textarea from '@/components/ui/Textarea'
import {
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useUploadCategoryImageMutation,
} from '@/features/admin/adminApi'
import { getErrorMessage, getFieldErrors } from '@/utils/apiError'

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  parent: z.string(),
  description: z.string().trim().max(500),
  sortOrder: z.string().trim().regex(/^\d{1,4}$/, 'Enter a number from 0 to 9999'),
  isActive: z.boolean(),
})

/**
 * Create or edit a category. `category` = existing (edit) or null (create).
 * `defaultParent` pre-selects the parent for "Add subcategory".
 */
export default function CategoryFormModal({ category, defaultParent = '', parents, hasChildren, onClose }) {
  const isEdit = Boolean(category)
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  const [createCategory, createState] = useCreateCategoryMutation()
  const [updateCategory, updateState] = useUpdateCategoryMutation()
  const [uploadImage, uploadState] = useUploadCategoryImageMutation()
  const saving = createState.isLoading || updateState.isLoading || uploadState.isLoading

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? '',
      parent: category?.parent ?? defaultParent,
      description: category?.description ?? '',
      sortOrder: String(category?.sortOrder ?? 0),
      isActive: category?.isActive ?? true,
    },
  })

  // Free the local preview URL when it changes or the modal closes.
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  function selectImage(file) {
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function onSubmit(values) {
    const body = {
      name: values.name,
      parent: values.parent || null,
      description: values.description,
      sortOrder: Number(values.sortOrder),
      isActive: values.isActive,
    }

    try {
      const saved = isEdit
        ? await updateCategory({ id: category._id, ...body }).unwrap()
        : await createCategory(body).unwrap()

      if (imageFile) {
        const formData = new FormData()
        formData.append('image', imageFile)
        await uploadImage({ id: saved._id, formData }).unwrap()
      }

      toast.success(isEdit ? 'Category updated' : 'Category created')
      onClose()
    } catch (error) {
      Object.entries(getFieldErrors(error)).forEach(([field, message]) => setError(field, { message }))
      toast.error(getErrorMessage(error, 'Could not save the category'))
    }
  }

  const parentOptions = parents.filter((p) => p._id !== category?._id).map((p) => ({ value: p._id, label: p.name }))

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit "${category.name}"` : 'New category'}
      description="Two levels: categories and subcategories. Products go into subcategories (or categories without any)."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" loading={saving}>
            {isEdit ? 'Save changes' : 'Create category'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Name" placeholder="e.g. T-Shirts" error={errors.name?.message} {...register('name')} />
          <Select
            label="Parent"
            placeholder="None (top-level category)"
            options={parentOptions}
            disabled={hasChildren}
            hint={hasChildren ? 'Categories with subcategories cannot be moved.' : undefined}
            error={errors.parent?.message}
            {...register('parent')}
          />
        </div>
        <Textarea label="Description (optional)" rows={3} error={errors.description?.message} {...register('description')} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Sort order"
            inputMode="numeric"
            hint="Lower numbers are shown first."
            error={errors.sortOrder?.message}
            {...register('sortOrder')}
          />
          <div className="pt-7">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Switch checked={field.value} onChange={field.onChange} label="Active" description="Inactive categories are hidden from the store." />
              )}
            />
          </div>
        </div>
        <ImagePicker label="Image (optional)" imageUrl={previewUrl ?? category?.image?.url} onSelect={selectImage} />
      </form>
    </Modal>
  )
}
