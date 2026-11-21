import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowLeft, Plus, X } from 'lucide-react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'
import FormSection from '@/components/common/FormSection'
import PageHeader from '@/components/common/PageHeader'
import StatusBadge from '@/components/common/StatusBadge'
import ApprovedStoreGate from '@/components/seller/ApprovedStoreGate'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Skeleton from '@/components/ui/Skeleton'
import Switch from '@/components/ui/Switch'
import Textarea from '@/components/ui/Textarea'
import { useGetCategoryTreeQuery } from '@/features/catalog/catalogApi'
import {
  useCreateProductMutation,
  useGetSellerProductQuery,
  useUpdateProductMutation,
} from '@/features/seller/sellerApi'
import { getErrorMessage, getFieldErrors } from '@/utils/apiError'
import ProductImagesField from './product-form/ProductImagesField'
import { emptyProductForm, productFormSchema, toFormValues, toPayload } from './product-form/productForm'
import VariantsSection from './product-form/VariantsSection'

function CategorySelect({ categories, error, ...props }) {
  return (
    <Select
      label="Category"
      placeholder="Choose a category"
      error={error}
      hint={categories.length ? undefined : 'No categories yet. Ask the admin to create them.'}
      {...props}
    >
      {categories.map((parent) =>
        parent.children.length ? (
          <optgroup key={parent._id} label={parent.name}>
            {parent.children.map((child) => (
              <option key={child._id} value={child._id}>
                {child.name}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={parent._id} value={parent._id}>
            {parent.name}
          </option>
        ),
      )}
    </Select>
  )
}

function ProductForm({ product, categories }) {
  const navigate = useNavigate()
  const [createProduct, createState] = useCreateProductMutation()
  const [updateProduct, updateState] = useUpdateProductMutation()
  const saving = createState.isLoading || updateState.isLoading

  const form = useForm({
    resolver: zodResolver(productFormSchema),
    defaultValues: product ? toFormValues(product) : emptyProductForm(),
    mode: 'onTouched',
  })
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = form

  const highlights = useFieldArray({ control, name: 'highlights' })
  const specifications = useFieldArray({ control, name: 'specifications' })

  async function onSubmit(values) {
    const payload = toPayload(values)
    try {
      const response = product
        ? await updateProduct({ id: product._id, ...payload }).unwrap()
        : await createProduct(payload).unwrap()
      toast.success(response.message)
      navigate('/seller/products')
    } catch (error) {
      Object.entries(getFieldErrors(error)).forEach(([field, message]) => setError(field, { message }))
      toast.error(getErrorMessage(error, 'Could not save the product'))
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, () => toast.error('Please fix the highlighted fields'))}
      noValidate
      className="grid gap-6 lg:grid-cols-3"
    >
      <div className="space-y-6 lg:col-span-2">
        <FormSection title="Basic information">
          <Input label="Product name" placeholder="Classic Cotton Crew T-Shirt" error={errors.name?.message} {...register('name')} />
          <div className="grid gap-5 sm:grid-cols-2">
            <CategorySelect
              categories={categories}
              error={errors.category?.message}
              {...register('category')}
            />
            <Input label="Brand (optional)" error={errors.brand?.message} {...register('brand')} />
          </div>
          <Textarea
            label="Description"
            rows={6}
            placeholder="Materials, fit, care instructions, what's in the box…"
            error={errors.description?.message}
            {...register('description')}
          />
        </FormSection>

        <FormSection title="Images" description="Clear photos on a plain background sell best.">
          <Controller
            control={control}
            name="images"
            render={({ field }) => (
              <ProductImagesField
                value={field.value}
                onChange={field.onChange}
                error={errors.images?.message || errors.images?.root?.message}
              />
            )}
          />
        </FormSection>

        <VariantsSection form={form} />

        <FormSection
          title="Highlights"
          description="Short bullet points shown near the price (up to 8)."
          actions={
            highlights.fields.length < 8 && (
              <Button variant="outline" size="sm" onClick={() => highlights.append({ value: '' })}>
                <Plus className="size-4" /> Add
              </Button>
            )
          }
        >
          {highlights.fields.length === 0 && <p className="text-sm text-slate-500">No highlights yet.</p>}
          {highlights.fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="e.g. 100% combed cotton"
                error={errors.highlights?.[index]?.value?.message}
                {...register(`highlights.${index}.value`)}
              />
              <Button variant="ghost" size="icon" onClick={() => highlights.remove(index)} aria-label="Remove highlight">
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </FormSection>

        <FormSection
          title="Specifications"
          description="Technical details shown in a table (e.g. Fabric: Cotton)."
          actions={
            specifications.fields.length < 30 && (
              <Button variant="outline" size="sm" onClick={() => specifications.append({ key: '', value: '' })}>
                <Plus className="size-4" /> Add
              </Button>
            )
          }
        >
          {specifications.fields.length === 0 && <p className="text-sm text-slate-500">No specifications yet.</p>}
          {specifications.fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
              <Input placeholder="Name" error={errors.specifications?.[index]?.key?.message} {...register(`specifications.${index}.key`)} />
              <Input placeholder="Value" error={errors.specifications?.[index]?.value?.message} {...register(`specifications.${index}.value`)} />
              <Button variant="ghost" size="icon" onClick={() => specifications.remove(index)} aria-label="Remove specification">
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </FormSection>
      </div>

      <div className="space-y-6">
        {product && (
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Review status</p>
              <StatusBadge status={product.status} />
            </div>
            {product.status === 'rejected' && product.rejectionReason && (
              <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="size-4" /> Changes requested
                </p>
                <p className="mt-1">{product.rejectionReason}</p>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Changing the name, description, images, category or specifications sends the product back for
              review. Price and stock changes go live straight away.
            </p>
          </Card>
        )}

        <Card className="p-5">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onChange={field.onChange}
                label="Visible in store"
                description="Turn off to hide the product without deleting it."
              />
            )}
          />
        </Card>

        <FormSection title="Search tags">
          <Input
            placeholder="tshirt, cotton, summer"
            hint="Comma separated. Helps customers find the product."
            error={errors.tags?.message}
            {...register('tags')}
          />
        </FormSection>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-3 border-t border-slate-200 bg-white/90 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border lg:col-span-3">
        <Button variant="outline" to="/seller/products">
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {product ? 'Save product' : 'Submit for review'}
        </Button>
      </div>
    </form>
  )
}

export default function ProductFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { data: product, isLoading, isError } = useGetSellerProductQuery(id, { skip: !isEdit })
  // Load categories before mounting the form so the <select> can show the saved category.
  const { data: categories = [], isLoading: categoriesLoading } = useGetCategoryTreeQuery()

  let content
  if ((isEdit && isLoading) || categoriesLoading) {
    content = (
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[480px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  } else if (isEdit && (isError || !product)) {
    content = (
      <Card>
        <EmptyState
          title="Product not found"
          description="It may have been deleted."
          action={<Button to="/seller/products">Back to products</Button>}
        />
      </Card>
    )
  } else {
    content = <ProductForm key={product?._id ?? 'new'} product={product} categories={categories} />
  }

  return (
    <>
      <Link
        to="/seller/products"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" /> Products
      </Link>
      <PageHeader
        title={isEdit ? 'Edit product' : 'Add product'}
        description={isEdit ? product?.name : 'New products are reviewed by our team before they go live.'}
      />
      <ApprovedStoreGate>{content}</ApprovedStoreGate>
    </>
  )
}
