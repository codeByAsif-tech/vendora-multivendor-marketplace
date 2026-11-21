import toast from 'react-hot-toast'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { getErrorMessage } from '@/utils/apiError'
import { ROLES } from '@/utils/roles'
import { useAddToCartMutation, useAddToWishlistMutation, useGetWishlistQuery, useRemoveFromWishlistMutation } from './shopApi'

/**
 * Cart / wishlist actions for product pages.
 * Guests are sent to login (and come back here afterwards); sellers and admins are told to use a customer account.
 */
export function useShopActions() {
  const { isAuthenticated, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isCustomer = isAuthenticated && role === ROLES.CUSTOMER

  const [addToCartMutation, cartState] = useAddToCartMutation()
  const [addWish, addWishState] = useAddToWishlistMutation()
  const [removeWish, removeWishState] = useRemoveFromWishlistMutation()
  const { data: wishlist } = useGetWishlistQuery(undefined, { skip: !isCustomer })

  function requireCustomer() {
    if (!isAuthenticated) {
      toast('Please sign in to continue', { icon: '🔐' })
      navigate('/login', { state: { from: location.pathname + location.search } })
      return false
    }
    if (role !== ROLES.CUSTOMER) {
      toast.error('Shopping needs a customer account')
      return false
    }
    return true
  }

  async function addToCart({ productId, variantId, quantity = 1, goToCart = false }) {
    if (!requireCustomer()) return
    try {
      await addToCartMutation({ productId, variantId, quantity }).unwrap()
      if (goToCart) navigate('/cart')
      else toast.success('Added to cart')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not add to cart'))
    }
  }

  const isWishlisted = (productId) => Boolean(wishlist?.productIds?.includes(String(productId)))

  async function toggleWishlist(productId) {
    if (!requireCustomer()) return
    try {
      if (isWishlisted(productId)) {
        await removeWish(productId).unwrap()
        toast.success('Removed from wishlist')
      } else {
        await addWish(productId).unwrap()
        toast.success('Saved to wishlist')
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return {
    addToCart,
    addingToCart: cartState.isLoading,
    toggleWishlist,
    isWishlisted,
    wishlistBusy: addWishState.isLoading || removeWishState.isLoading,
  }
}
