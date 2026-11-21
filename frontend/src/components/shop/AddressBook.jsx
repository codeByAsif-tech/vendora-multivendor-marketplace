import { useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card, { CardHeader } from '@/components/ui/Card'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import { useAuth } from '@/features/auth/useAuth'
import { useDeleteAddressMutation, useGetAddressesQuery, useSetDefaultAddressMutation } from '@/features/shop/shopApi'
import { getErrorMessage } from '@/utils/apiError'
import AddressFormModal from './AddressFormModal'
import AddressText from './AddressText'

export default function AddressBook() {
  const { user } = useAuth()
  const { data: addresses = [], isLoading } = useGetAddressesQuery()
  const [setDefault] = useSetDefaultAddressMutation()
  const [deleteAddress, { isLoading: deleting }] = useDeleteAddressMutation()
  const [editing, setEditing] = useState(null) // { address? }
  const [toDelete, setToDelete] = useState(null)

  async function makeDefault(address) {
    try {
      await setDefault(address._id).unwrap()
      toast.success('Default address updated')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function confirmDelete() {
    try {
      await deleteAddress(toDelete._id).unwrap()
      toast.success('Address deleted')
      setToDelete(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Card>
      <CardHeader
        title="Addresses"
        description="Saved delivery addresses (up to 10)."
        action={
          addresses.length > 0 && addresses.length < 10 && (
            <Button variant="outline" size="sm" onClick={() => setEditing({})}>
              <Plus className="size-4" /> Add
            </Button>
          )
        }
      />
      {isLoading ? (
        <div className="p-5">
          <Skeleton className="h-24 w-full" />
        </div>
      ) : addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add one now to check out faster."
          action={<Button onClick={() => setEditing({})}>Add address</Button>}
        />
      ) : (
        <ul className="grid gap-4 p-5 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address._id} className="flex flex-col rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge tone="gray">{address.type}</Badge>
                {address.isDefault && <Badge tone="brand">Default</Badge>}
              </div>
              <AddressText address={address} className="flex-1" />
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Button variant="ghost" size="sm" onClick={() => setEditing({ address })}>
                  Edit
                </Button>
                {!address.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => makeDefault(address)}>
                    Set as default
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setToDelete(address)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <AddressFormModal
          address={editing.address}
          defaultName={user?.name}
          defaultPhone={user?.phone}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete this address?"
        description="Orders already placed keep their delivery address."
        confirmLabel="Delete"
      />
    </Card>
  )
}
