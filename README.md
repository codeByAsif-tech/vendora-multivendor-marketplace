# Vendora: Multi-Vendor E-Commerce Marketplace

A full-stack, multi-vendor marketplace (MERN). Sellers run their own stores, customers buy from many sellers in one checkout, and an admin manages the whole platform.

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, Redux Toolkit + RTK Query, react-hook-form + Zod |
| Backend | Node.js (>= 20), Express 5, MongoDB (Atlas) + Mongoose, JWT, bcrypt, Zod, Pino |
| Docs / tests | Swagger (OpenAPI 3), Vitest, Supertest, mongodb-memory-server |

## Project status

| Phase | Scope | Status |
|---|---|---|
| 1 | Setup, database, authentication, roles, layouts | **In review** (code written, tests not yet run) |
| 2 | Seller onboarding and approval, admin user management | **In review** (code written, tests not yet run) |
| 3 | Categories, products, variants, inventory, image upload | **In review** (code written, tests not yet run) |
| 4 | Customer storefront, search, filters, product pages | **In review** (code written, tests not yet run) |
| 5 | Cart, wishlist, addresses, checkout, orders | **In review** (code written, tests not yet run) |
| 6 | Payments (COD + manual UTR verification), transactions | **In review** (code written, tests not yet run) |
| 7 | Commission, seller earnings ledger, payouts | **In review** (code written, tests not yet run) |
| 8 | Admin and seller analytics | **In review** (code written, tests not yet run) |
| 9 | Reviews, coupons, returns, notifications | **In review** (code written, tests not yet run) |
| 10 | Live updates (Socket.IO), platform settings, security hardening, deployment | **In review** (code written, tests not yet run) |

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

Fill in `.env`:

- `MONGODB_URI`: your MongoDB Atlas connection string
- `JWT_ACCESS_SECRET`: a long random string. Generate one with
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `DATA_ENCRYPTION_KEY`: 64 hex characters, used to encrypt seller bank account numbers. Generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: credentials for the first admin
- Optional: `SMTP_*` for real emails (empty = emails are only logged), `UPLOAD_DRIVER=cloudinary` + `CLOUDINARY_*`
  for Cloudinary (default `local` saves images to `backend/uploads/`)

```bash
npm run seed:admin        # create the first admin (admins cannot self-register)
npm run seed:categories   # optional: starter category tree (Fashion, Electronics, ...)
npm run dev               # http://localhost:5000/api/v1
npm test                  # run the API test suite (uses an in-memory MongoDB, not Atlas)
```

API docs: **http://localhost:5000/api/docs** (disabled when `NODE_ENV=production`).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

In development, Vite proxies `/api` to `http://localhost:5000`, so no frontend `.env` is needed.
For production, set `VITE_API_URL` (see `frontend/.env.example`).

## Portals

| Portal | Login | Register | Home |
|---|---|---|---|
| Customer | `/login` | `/register` | `/` |
| Seller | `/seller/login` | `/seller/register` | `/seller/dashboard` |
| Admin | `/admin/login` | seed script only | `/admin/dashboard` |

## Authentication design

- **Access token**: JWT (15 min), returned in the JSON body. The frontend keeps it in memory only (Redux), never in `localStorage`, and sends it as `Authorization: Bearer <token>`.
- **Refresh token**: random opaque token (7 days) in an `httpOnly` cookie scoped to `/api/v1/auth`. The database stores only its SHA-256 hash, in the `sessions` collection (one row per device).
- **Rotation**: every `/auth/refresh` call gives a new refresh token and revokes the old one.
- **Reuse detection**: if an already-rotated token is used again (after a 10-second grace window for parallel tabs), every session of that user is revoked.
- **Auto-refresh**: when any API call returns 401, the frontend refreshes once (parallel requests share one refresh) and retries.
- **Portal check**: login accepts an optional `portal` field. A customer cannot sign in through `/admin/login`.
- **Server-side enforcement**: `authenticate` reloads the user on every request, so blocked accounts lose access at once. `authorize(...roles)` guards role-restricted routes. Frontend route guards only improve the user experience.
- **Email verification**: sign-up sends a link (in the welcome email, valid 24 h). Users see a reminder bar with "Resend email" (once a minute) until they verify. With `REQUIRE_VERIFIED_EMAIL=true`, customers must verify before ordering and sellers before submitting their store (`403 EMAIL_NOT_VERIFIED`).
- **Forgot / reset password**: the request always gets the same answer, whether or not the email has an account (no account discovery). The link is valid for 1 hour and works once; only the newest link works. Resetting signs the user out everywhere: refresh sessions revoked, older access tokens rejected (`passwordChangedAt`) and live connections closed. A "password changed" email is sent.
- **Email links**: random 32-byte tokens; only their SHA-256 hash is stored (`authtokens`, auto-deleted after expiry); used up atomically; the page removes the token from the address bar after reading it.

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/verify-email` | Public | `{ token }` from the email |
| POST | `/auth/verify-email/resend` | Signed in | New link (409 if already verified, 429 within a minute) |
| POST | `/auth/forgot-password` | Public | `{ email }`: same answer either way; 5 per 15 min |
| POST | `/auth/reset-password` | Public | `{ token, password }`: returns `role` so the app opens the right sign-in page |

## Seller onboarding (Phase 2)

```
register-seller ──► PUT /seller/profile ──► pending ──► admin approves ──► approved ──► can list products
                                                  └──► admin rejects (reason) ──► seller edits + saves ──► pending
approved ──► admin suspends (reason) ──► suspended ──► admin reinstates ──► approved
```

- Only **approved** stores can create or edit products, upload images or change stock (`requireApprovedSeller`).
  Blocked requests return `403` with `code`: `STORE_PROFILE_REQUIRED`, `STORE_PENDING`, `STORE_REJECTED` or `STORE_SUSPENDED`.
- Every status change is stored in `statusHistory` (who, when, reason) and the seller is emailed.
- The bank account number is **encrypted with AES-256-GCM**. Only the last 4 digits are ever returned.
- Admins can block or unblock customers and sellers. Blocking revokes every session at once.

## Catalog (Phase 3)

- **Categories**: two levels (category → subcategory). Products go into a *leaf* (a subcategory, or a category without children).
  Subcategory slugs include the parent (`fashion-t-shirts`), and renaming a parent updates them.
- **Products**: every product has **1–50 variants** (a simple product is one variant without attributes). Each variant has its own
  SKU (unique per seller), price, optional sale price, stock and low-stock threshold. **All money is integer paise** (₹799 = `79900`).
- Derived fields (`minPrice`, `maxPrice`, `maxDiscount`, `totalStock`, `variantOptions`) are computed on every save.
- **Moderation**: new products start as `pending`. Changing the name, description, images, category, brand, highlights or
  specifications sends an approved product back to `pending`. Price and stock edits do not. Editing a rejected product resubmits it.
- **Images**: upload first (`POST /seller/uploads/product-images`), then use the returned `{ url, publicId }` in the product.
  The server checks real file bytes (JPG/PNG/WebP only, max 5 MB), and a product may only use images from its seller's own folder.
- **Delete** is a soft delete (`deletedAt`), so past orders keep working.

## Storefront (Phase 4)

A product is shown to customers only when **all** of these are true (`buildVisibilityFilter()` in
`backend/src/services/catalog.service.js`):

- product `approved` by an admin, switched on by the seller (`isActive`), not deleted
- its store is `approved` (not pending, rejected or suspended)
- its category is active, and so is the parent category

Customer pages: `/products` (search + filters + sort), `/products/:slug`, `/categories/:slug` (a parent includes its
subcategories), `/stores/:slug`. Filters live in the URL (`?q=&brand=&min=&max=&inStock=1&sort=&page=`), so results can be shared.
Public responses never include seller account data, moderation fields or store bank/tax/contact details.

| Method | Path | Description |
|---|---|---|
| GET | `/products` | Browse: `search`, `category`, `store`, `brand` (comma list), `minPrice`/`maxPrice` (paise), `inStock`, `minRating`, `sort`, `page`, `limit` (max 48). Returns `{ items, pagination, facets: { brands, priceRange } }` |
| GET | `/products/:slug` | `{ product, related }` (inactive variants removed) |
| GET | `/categories/:slug` | Category with parent (breadcrumbs) and subcategories |
| GET | `/stores/:slug` | Public store profile and product count |

## Cart, checkout and orders (Phase 5)

- **Cart** stores only product + variant + quantity. Prices, stock and availability are read live on every request;
  quantities above stock are lowered automatically and unavailable lines are flagged (and excluded from totals).
- **Shipping** is per seller shipment: free from ₹499, otherwise ₹49. A customer's **first order ships free**
  (no earlier order that was not cancelled). The cart summary returns `firstOrderFreeDelivery`, which also decides
  whether the storefront banner shows the first-order offer.
- **Checkout** (`POST /orders`) runs in one MongoDB transaction: conditional stock decrement per line → one `Order`
  (what the customer paid) + one `SellerOrder` per seller (what each seller ships) → empty cart. If any line lost stock or
  visibility, nothing changes and the API returns `409 CART_CHANGED`.
- **Idempotency**: the browser sends a UUID `idempotencyKey` per checkout page. Retries and double clicks return the
  same order (unique index on `customer + idempotencyKey`).
- **Payment**: `cod` orders are confirmed immediately (marked paid when every shipment is delivered). `manual` orders
  need a UTR and stay `pending` until an admin verifies the payment (see Phase 6).
- **Statuses** per shipment: `pending → confirmed → processing → shipped → out_for_delivery → delivered`, or `cancelled`
  before shipping. Sellers can only move their own shipments forward; cancelling returns the stock. The order's overall
  status is derived from its shipments.
- Order items are **snapshots** (name, SKU, price, image) so later product edits never change past orders.

| Method | Path | Access | Description |
|---|---|---|---|
| GET / DELETE | `/cart` | Customer | Cart with totals / empty it |
| POST | `/cart/items` | Customer | Add `{ productId, variantId, quantity }` |
| PATCH / DELETE | `/cart/items/:itemId` | Customer | Change quantity / remove |
| GET / POST | `/wishlist` | Customer | List / save `{ productId }` |
| DELETE | `/wishlist/:productId` | Customer | Remove |
| GET / POST | `/addresses` | Customer | List / add (max 10) |
| PATCH / DELETE | `/addresses/:id` | Customer | Edit / delete |
| PATCH | `/addresses/:id/default` | Customer | Make default |
| POST | `/orders` | Customer | Place order `{ addressId, paymentMethod, utr?, idempotencyKey }` |
| GET | `/orders`, `/orders/:orderNumber` | Customer | My orders / one order with shipments |
| POST | `/orders/:orderNumber/cancel` | Customer | Cancel all (or `sellerOrderId`) before shipping |
| GET | `/seller/orders`, `/seller/orders/:id` | Seller | My shipments |
| PATCH | `/seller/orders/:id/status` | Seller | Next step / cancel (`carrier`, `trackingNumber` when shipping) |
| GET | `/admin/orders`, `/admin/orders/:id` | Admin | All orders |
| PATCH | `/admin/seller-orders/:id/status` | Admin | Cancel before shipping only. Confirming happens by verifying the payment; packing/shipping is seller-only |

## Payments and transactions (Phase 6)

No payment gateway: customers pay **Cash on Delivery** or by **UPI / bank transfer** and enter the UTR; an admin checks
the bank statement. The frontend never decides that something is paid.

- `Payment` (one per order) is the source of truth: `amount`, `amountPaid`, `refundDue`, `refundedAmount`, status
  history. `Order.payment` is a read-only copy kept in sync for display.
- **UTR rules**: a UTR can be used once in the whole marketplace (unique index), and a rejected UTR can never be used again.
- **Verify** (admin): payment → `paid`, a `payment_received` transaction is written, every shipment waiting for payment
  → `confirmed`, customer emailed. Shipments the customer already cancelled become refund due.
- **Reject** (admin, reason required): customer is emailed and submits a new UTR from the order page (`POST /orders/:orderNumber/payment`).
- **COD**: each delivered shipment writes a `cod_collected` transaction; the payment is `paid` once every non-cancelled shipment is delivered.
- **Refunds**: cancelling a shipment of a paid online order adds its total to `refundDue`. The admin sends the money
  outside the app and records it (`refund` transaction, never more than what is due).
- `Transaction` is an append-only ledger (`payment_received`, `cod_collected`, `refund`) with totals: received, cash collected, refunded, net.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/admin/payments` | Admin | Queue: `status=pending_verification` (oldest first), `refund_due`, `rejected`, ... |
| GET | `/admin/payments/:id` | Admin | Payment with history and transactions |
| POST | `/admin/payments/:id/verify` | Admin | Mark paid + confirm order |
| POST | `/admin/payments/:id/reject` | Admin | `{ reason }` |
| POST | `/admin/payments/:id/refunds` | Admin | `{ amount (paise), reference, note? }` |
| GET | `/admin/transactions` | Admin | Ledger with `type`, `from`, `to`, `search` and totals |
| POST | `/orders/:orderNumber/payment` | Customer | Submit a new UTR after a rejection |

## Commission, earnings and payouts (Phase 7)

No payout gateway: the admin sends money from the bank (NEFT / IMPS / UPI) and records it.

- **Commission** is a percentage of the **item subtotal** (shipping goes to the seller, who ships). Platform rate comes
  from the admin settings (`DEFAULT_COMMISSION_RATE` until an admin saves one); a store can have its own rate.
- The rate is **snapshotted at checkout** on each `SellerOrder` (`commissionRate`, `commissionAmount`, `sellerEarning`),
  so later rate changes never touch placed orders. Customers never see these fields.
- **Delivered** shipment → an `earning` ledger entry for the seller (`total − commission`), **on hold** for
  `EARNINGS_HOLD_DAYS` (returns window), then **available**. Holds are released lazily whenever balances are read or a
  payout is made (no cron). Cancelled shipments earn nothing; one earning per shipment (unique index).
- `SellerWallet` keeps running totals (`onHold`, `available`, `totalEarned`, `totalCommission`, `totalPaidOut`), always
  changed together with a ledger entry inside a transaction. `LedgerEntry` is append-only (`earning` +, `payout` −).
- **Payout** (admin): `{ storeId, amount, method, reference }`. The wallet is debited with a conditional update
  (`available ≥ amount`), so payouts can never exceed the balance, even when two admins click at once. References are
  unique. The seller's bank details at that moment are copied onto the payout and the seller is emailed.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/seller/earnings` | Seller | Wallet: on hold, available, paid out, commission rate, next release, bank |
| GET | `/seller/earnings/ledger` | Seller | Ledger entries (`type`: earning or payout) |
| GET | `/seller/payouts` | Seller | Payouts received |
| GET / PUT | `/admin/settings/commission` | Admin | Platform rate `{ defaultRate }` (0–50, 2 decimals) |
| PATCH | `/admin/sellers/:id/commission` | Admin | Store rate `{ rate }`, `null` = platform rate |
| GET | `/admin/payouts/balances` | Admin | Seller balances (`due=true` → money available) with platform totals |
| GET | `/admin/payouts` | Admin | Payout history (`store`, `search`, `from`, `to`) |
| POST | `/admin/payouts` | Admin | Record a payout |

## Analytics (Phase 8)

Computed live from `SellerOrder` with one aggregation per request (no extra collections to keep in sync).

- **Sales** = total of shipments that were not cancelled, grouped by the day the order was placed. **Orders** = distinct
  checkouts. Days and months use Indian Standard Time; empty days are filled with zero so charts have every point.
- Ranges: `7d`, `30d`, `90d` (by day) and `12m` (by month). Every report also returns the previous period of the same
  length, for the "▲ 12%" comparisons.
- Report: `totals` (sales, orders, units, average order, commission / seller earnings, cancel rate), `previous`,
  `series`, `statuses`, `payments` (COD vs UPI / bank), `topProducts`; admins also get `topSellers` and `signups`.
- Charts are small hand-made SVG components (`frontend/src/components/charts`), no chart library: line + area with a
  hover / arrow-key tooltip and a screen-reader table, plus ranked bar lists.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/admin/analytics?range=30d` | Admin | Whole marketplace |
| GET | `/seller/analytics?range=30d` | Seller | Own shipments only |

## Reviews, coupons, returns, notifications (Phase 9)

**Reviews**: only customers with a *delivered* order of the product can review (every review is a verified purchase);
one review per customer per product (editing replaces it). The product's `ratingAvg` / `ratingCount` are recalculated
on every change. Admins can hide a review with a reason (it stops counting; the author is notified). Public reviews show
"Ram K." instead of the full name.

**Coupons** (admin-created, platform-funded): percent (with optional cap) or fixed amount, minimum item total, start / end
dates, total and per-customer limits, first-order-only. The customer applies a code in the cart; it is re-checked on
every cart read and again inside the checkout transaction, where the use is counted with a conditional update (the last
slot cannot be used twice). The discount is split over the shipments by subtotal (`SellerOrder.discountShare`), and
`SellerOrder.payable` (what the customer pays for that shipment) drives COD collection and refunds. Sellers still earn
on the full price. If the whole order is cancelled the use is given back.

**Returns**: within `EARNINGS_HOLD_DAYS` of delivery (so refunds never chase money already paid out), for chosen items
and quantities of one shipment. `requested → approved | rejected`, `approved → received`. On *received*, in one
transaction: stock goes back, the units are marked returned, the payment gets `refundDue` (the admin pays it from
Payments → Refunds due, as for cancellations), and the seller's wallet is debited with a `return` ledger entry
(item value minus commission). A wallet can go below zero; payouts need a positive balance.

**Notifications**: in-app bell for every role, polled every minute (live push in Phase 10). Written after the
transaction commits and never block a request. Sent for new / cancelled orders, status changes, payment verified /
rejected, refunds, product and store decisions, payouts, reviews and every return step. Auto-deleted after 90 days.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/products/:slug/reviews` | Public | Reviews + summary (average, count, per-star). `sort`, `rating`, paging |
| GET / PUT / DELETE | `/products/:slug/reviews/me` | Customer | Can I review? / write or edit `{ rating, title?, body? }` / delete |
| GET / PATCH | `/admin/reviews`, `/admin/reviews/:id` | Admin | Moderate `{ status: hidden, reason }` or `published` |
| POST / DELETE | `/cart/coupon` | Customer | Apply `{ code }` / remove |
| GET / POST / PATCH | `/admin/coupons`, `/admin/coupons/:id` | Admin | List / create / edit (code and type fixed) |
| POST | `/orders/:orderNumber/returns` | Customer | `{ sellerOrderId, items: [{ itemId, quantity }], reason, details?, refundUpi? }` |
| GET | `/returns` | Customer | My returns (`orderNumber` filter) |
| GET / PATCH | `/seller/returns`, `/seller/returns/:id` | Seller | `{ action, note? }`: approve, reject (note required) or receive |
| GET / PATCH | `/admin/returns`, `/admin/returns/:id` | Admin | Same, for any return |
| GET | `/notifications`, `/notifications/unread-count` | Signed in | My notifications |
| PATCH / POST | `/notifications/:id/read`, `/notifications/read-all` | Signed in | Mark read |

## Live updates, settings, security, deployment (Phase 10)

**Live updates (Socket.IO)**: every in-app notification is also pushed to the user's open tabs, which
refreshes the bell and the affected lists (orders, returns, earnings...) and shows a toast. The socket
authenticates with the same 15-minute access token; each user only joins their own room; the server closes
the socket when the token expires and the client renews it and reconnects. Blocking a user disconnects them
at once. If the socket is down, the bell falls back to checking every minute.

**Platform settings** (Admin → Settings): delivery fee, free-delivery threshold, first-order free delivery,
an optional storefront announcement, and the support contact. Stored in the `Setting` collection with
defaults, so a new database needs no setup.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/settings` | Public | Delivery terms, announcement, support contact |
| GET / PUT | `/admin/settings` | Admin | Read / save (send only the sections that change; money in paise) |

**Security measures** (full list):
- Auth: bcrypt passwords; 15-minute JWT access token kept in memory only; opaque refresh token in an httpOnly,
  `Secure` (production) cookie scoped to `/api/v1/auth`, stored hashed, rotated on every use with reuse detection;
  users re-loaded on every request, so blocking works instantly.
- Every role check happens on the server (`authorize`), and every seller query is scoped to the seller's own id.
- Input: Zod validation on every route (unknown fields rejected), request-body size limits, operator-injection
  sanitising, image type checked by file content (magic bytes), 5 MB per image.
- Rate limits: whole API, login/register, session refresh, coupon attempts (per user), and creating orders,
  returns and reviews (per user).
- Headers: Helmet on the API; Nginx adds `nosniff`, `X-Frame-Options`, referrer and permissions policies.
- Money: integer paise; stock, coupons, payouts and refunds use conditional updates inside transactions,
  so double clicks or two admins at once cannot overspend or oversell.
- Data: seller bank account numbers encrypted (AES-256-GCM); emails/names never shown on public reviews.
- Production guard: the API refuses to start with insecure cookies, non-HTTPS `CLIENT_URL`, local image
  storage or a placeholder JWT secret. API docs are disabled in production. Errors never leak stack traces.
- Slow-request protection (header and request timeouts); proxy hops are configured (`TRUST_PROXY`), not trusted blindly.

**Deployment**: see [DEPLOYMENT.md](DEPLOYMENT.md): one server with Node + PM2 + Nginx (recommended), or Render/Railway + Vercel/Netlify.

## API

Base URL: `/api/v1`. Full interactive docs at `/api/docs`. Every response has the shape `{ success, message?, data }` or
`{ success: false, message, code?, errors? }`. Lists return `{ items, pagination: { page, limit, total, totalPages }, counts? }`.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| POST | `/auth/register` | Public | Register a customer |
| POST | `/auth/register-seller` | Public | Register a seller |
| POST | `/auth/login` | Public | Log in (optional `portal`) |
| POST | `/auth/refresh` | Refresh cookie | Rotate the refresh token and get a new access token |
| POST | `/auth/logout` | Refresh cookie | Revoke the session |
| GET | `/auth/me` | Logged in | Current user |
| GET | `/categories` | Public | Active category tree |
| GET / PUT | `/seller/profile` | Seller | Read / submit / update my store |
| PUT | `/seller/profile/media` | Seller | Upload logo and/or banner (multipart) |
| GET / POST | `/seller/products` | Seller / approved | List my products / create a product |
| GET / PATCH / DELETE | `/seller/products/:id` | Seller / approved | One of my products |
| PATCH | `/seller/products/:id/visibility` | Approved seller | Show / hide |
| POST | `/seller/uploads/product-images` | Approved seller | Upload up to 8 images |
| GET | `/seller/inventory`, `/seller/inventory/stats` | Seller | Stock per SKU, totals |
| PATCH | `/seller/inventory/:productId/variants/:variantId` | Approved seller | Set stock |
| GET | `/admin/overview` | Admin | Dashboard counts |
| GET | `/admin/sellers`, `/admin/sellers/:id` | Admin | Seller applications and stores |
| PATCH | `/admin/sellers/:id/status` | Admin | Approve / reject / suspend / reinstate |
| GET | `/admin/users` | Admin | Customers or sellers |
| PATCH | `/admin/users/:id/status` | Admin | Block / unblock |
| GET / POST | `/admin/categories` | Admin | List / create |
| PATCH / DELETE | `/admin/categories/:id` | Admin | Update / delete (empty only) |
| PUT | `/admin/categories/:id/image` | Admin | Category image |
| GET | `/admin/products`, `/admin/products/:id` | Admin | Moderation queue and details |
| PATCH | `/admin/products/:id/moderation` | Admin | Approve / reject (reason required) |

### Examples

**Register**

```http
POST /api/v1/auth/register
Content-Type: application/json

{ "name": "Ram Kumar", "email": "ram@example.com", "password": "Secret@123", "phone": "+919876543210" }
```

```json
201 Created
Set-Cookie: refreshToken=...; Path=/api/v1/auth; HttpOnly; SameSite=Lax

{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": { "_id": "665f...", "name": "Ram Kumar", "email": "ram@example.com", "role": "customer", "status": "active" },
    "accessToken": "eyJhbGciOi..."
  }
}
```

**Validation error**

```json
400 Bad Request
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Enter a valid email address" },
    { "field": "password", "message": "Password must contain a number" }
  ]
}
```

**Login with the wrong portal**

```json
403 Forbidden
{ "success": false, "message": "This account cannot sign in to the admin portal" }
```

**Create a product with variants** (approved seller)

```http
POST /api/v1/seller/products
Authorization: Bearer <accessToken>

{
  "name": "Classic Cotton Crew T-Shirt",
  "brand": "Urban Threads",
  "category": "665f1c2e8b3a4c0012ab34cd",
  "description": "Soft 180 GSM combed cotton tee with a relaxed fit.",
  "images": [{ "url": "/uploads/marketplace/products/<sellerId>/a1.jpg", "publicId": "marketplace/products/<sellerId>/a1.jpg" }],
  "variants": [
    { "sku": "TS-BLK-M", "attributes": [{ "name": "Color", "value": "Black" }, { "name": "Size", "value": "M" }], "price": 99900, "salePrice": 79900, "stock": 25 },
    { "sku": "TS-BLK-L", "attributes": [{ "name": "Color", "value": "Black" }, { "name": "Size", "value": "L" }], "price": 99900, "stock": 10 }
  ]
}
```

```json
201 Created
{
  "success": true,
  "message": "Product submitted for review",
  "data": { "product": { "_id": "...", "slug": "classic-cotton-crew-t-shirt-a1b2c3", "status": "pending",
    "minPrice": 79900, "maxPrice": 99900, "maxDiscount": 20, "totalStock": 35,
    "variantOptions": [{ "name": "Color", "values": ["Black"] }, { "name": "Size", "values": ["M", "L"] }], "...": "..." } }
}
```

**Store not approved yet**

```json
403 Forbidden
{ "success": false, "message": "Your store is awaiting approval. You can add products once it is approved.", "code": "STORE_PENDING" }
```

## Security

- bcrypt password hashing (12 rounds), password never returned (`select: false` + `toJSON` transform)
- Helmet headers, CORS allow-list with credentials, `x-powered-by` disabled
- Rate limits: 300 req / 15 min per IP on the API, 20 / 15 min on login and register
- NoSQL-injection protection: `$` and `.` keys are removed from body and params, and strict Zod schemas run on every input
- 100 kb body limit, central error handler (no stack traces in production), secrets redacted from logs
- Environment variables checked at startup; the server refuses to start if they are invalid
- Ownership: every seller query is scoped to the logged-in seller. Another seller's product returns `404`, not `403`
- Seller bank account numbers are encrypted at rest (AES-256-GCM)
- Uploads: MIME allow-list plus magic-byte check, 5 MB limit, file count limit, served with `nosniff` and a locked-down CSP
- Search input is regex-escaped (no regex injection or ReDoS); list `limit` is capped at 100
- Phase 10 additions (extra rate limits, socket auth, production config guard, timeouts, Nginx headers):
  see [Live updates, settings, security, deployment](#live-updates-settings-security-deployment-phase-10)

## Folder structure

```
backend/
  scripts/         seedAdmin.js, seedCategories.js
  src/
    config/        env (Zod-validated), db, swagger
    controllers/   thin HTTP handlers
    services/      business logic: auth, tokens, email, storage, seller store, products, inventory, categories, admin
    models/        User, Session, SellerProfile, Category, Product
    routes/        /api/v1 routers with OpenAPI annotations
    middlewares/   authenticate, authorize, requireApprovedSeller, validate, sanitize, upload, rate limit, errors
    validators/    Zod request schemas
    templates/     email templates
    utils/         ApiError, crypto, pricing, pagination, text, image type, logger, constants
  tests/           Vitest + Supertest (in-memory MongoDB replica set)

frontend/src/
  app/             Redux store
  services/        RTK Query base API (auth header + auto refresh)
  features/        auth, admin, seller, catalog (RTK Query endpoints)
  components/ui/   Button, Input, Select, Textarea, Switch, Tabs, Badge, DataTable, Pagination, Modal, ...
  components/common/ StatusBadge, ImagePicker, ReasonDialog, FormSection, StatCard, Thumb, ...
  components/seller/ StoreStatusBanner, ApprovedStoreGate
  layouts/         Customer, Seller, Admin (shared DashboardLayout), Auth
  routes/          AppRouter, ProtectedRoute, GuestRoute
  pages/           auth, customer, seller (store settings, products, product form, inventory), admin (sellers, users, categories, products)
```
