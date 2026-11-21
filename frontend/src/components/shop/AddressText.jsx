/** Formatted postal address block. */
export default function AddressText({ address, className }) {
  if (!address) return null
  return (
    <div className={className}>
      <p className="font-semibold text-slate-900">{address.fullName}</p>
      <p className="text-sm text-slate-600">
        {[address.line1, address.line2, address.landmark && `Near ${address.landmark}`].filter(Boolean).join(', ')}
      </p>
      <p className="text-sm text-slate-600">
        {address.city}, {address.state} {address.postalCode}
      </p>
      <p className="mt-1 text-sm text-slate-600">Phone: {address.phone}</p>
    </div>
  )
}
