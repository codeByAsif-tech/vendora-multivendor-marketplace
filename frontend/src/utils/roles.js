export const ROLES = Object.freeze({
  CUSTOMER: 'customer',
  SELLER: 'seller',
  ADMIN: 'admin',
})

const HOME_BY_ROLE = {
  [ROLES.CUSTOMER]: '/',
  [ROLES.SELLER]: '/seller/dashboard',
  [ROLES.ADMIN]: '/admin/dashboard',
}

const LOGIN_BY_ROLE = {
  [ROLES.CUSTOMER]: '/login',
  [ROLES.SELLER]: '/seller/login',
  [ROLES.ADMIN]: '/admin/login',
}

export const homePathFor = (role) => HOME_BY_ROLE[role] || '/'
export const loginPathFor = (role) => LOGIN_BY_ROLE[role] || '/login'
