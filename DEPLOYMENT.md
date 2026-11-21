# Deploying Vendora

Vendora has two parts: the **API** (`backend/`, Node + Express + Socket.IO) and the **web app**
(`frontend/`, a static React build). The data lives in **MongoDB Atlas** and images in **Cloudinary**,
so the servers themselves keep no data and can be rebuilt at any time.

There are two ways to host it. **Option A is recommended**: one domain means simpler, safer cookies.

---

## Before you start (both options)

1. **MongoDB Atlas**
   - Use a dedicated database user for production, with a long random password.
   - *Network Access*: allow your server's IP (Option A), or `0.0.0.0/0` for hosts with changing IPs
     (Option B; the database password is then your only protection, so make it strong).
   - Transactions need a replica set. Every Atlas cluster, including the free M0, has one.
2. **Cloudinary**: copy the cloud name, API key and **revealed** API secret (*Settings → API Keys*).
3. **Secrets**: generate fresh values, never reuse the development ones:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # JWT_ACCESS_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"        # DATA_ENCRYPTION_KEY
   ```
   ⚠️ `DATA_ENCRYPTION_KEY` encrypts seller bank account numbers. **If you lose or change it, saved account
   numbers can no longer be read.** Store it in a password manager.
4. **Email** (optional but recommended): SMTP details from your mail provider (Brevo, Mailgun, SES, Gmail
   app password…). Without `SMTP_HOST`, emails are only logged.
5. Install dependencies once on your machine so the lock files include Socket.IO:
   `cd backend && npm install`, then `cd frontend && npm install`. Commit both `package-lock.json` files.

### Production environment

On the server, create `backend/.env` from `backend/.env.example` with production values (Option A),
or enter the same values in your host's environment settings (Option B). The API **refuses to start** in production if
cookies are not secure, `CLIENT_URL` is not `https://`, or images are not on Cloudinary.

| Variable | Option A (one domain) | Option B (two domains) |
|---|---|---|
| `NODE_ENV` | `production` | `production` |
| `CLIENT_URL` | `https://shop.example.com` | `https://your-app.vercel.app` |
| `COOKIE_SECURE` | `true` | `true` |
| `COOKIE_SAMESITE` | `lax` | `none` (the cookie crosses domains) |
| `TRUST_PROXY` | `1` (Nginx) | `1` (Render / Railway) |
| `UPLOAD_DRIVER` | `cloudinary` | `cloudinary` |
| `MONGODB_URI`, `JWT_ACCESS_SECRET`, `DATA_ENCRYPTION_KEY`, `CLOUDINARY_*`, `SMTP_*`, `MAIL_FROM` | your values | your values |

---

## Option A: one server, one domain (Node + PM2 + Nginx), recommended

Nginx serves the built web app **and** forwards `/api`, `/socket.io` and `/uploads` to the API, so the
browser sees a single origin.

1. A small Linux VPS (1 GB RAM is enough) with **Node 20+**, **Nginx** and **Certbot**, and a domain pointing to it.
2. Copy the project to the server (e.g. `/var/www/vendora`) and create `backend/.env` (table above).
3. **API**, kept running and restarted on crash / reboot with [PM2](https://pm2.keymetrics.io):
   ```bash
   cd /var/www/vendora/backend
   npm ci --omit=dev
   npm install -g pm2
   pm2 start src/server.js --name vendora-api
   pm2 save && pm2 startup          # run the command it prints, so it starts on boot
   pm2 logs vendora-api            # look for "MongoDB connected", "Cloudinary connected", "Realtime (Socket.IO) ready"
   ```
4. **Web app**: build it (leave `VITE_API_URL` empty: same domain):
   ```bash
   cd /var/www/vendora/frontend
   npm ci
   VITE_PAYMENT_UPI_ID=yourname@upi npm run build    # creates frontend/dist
   ```
5. **Nginx site** (`/etc/nginx/sites-available/vendora`, then link it into `sites-enabled` and `sudo nginx -t && sudo systemctl reload nginx`):
   ```nginx
   map $http_upgrade $connection_upgrade { default upgrade; '' close; }

   server {
     server_name shop.example.com;
     root /var/www/vendora/frontend/dist;
     server_tokens off;
     client_max_body_size 45m;            # product forms: up to 8 images of 5 MB

     add_header X-Content-Type-Options "nosniff" always;
     add_header X-Frame-Options "DENY" always;
     add_header Referrer-Policy "strict-origin-when-cross-origin" always;

     location /api/ {
       proxy_pass http://127.0.0.1:5000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
     location /socket.io/ {                # live updates (WebSocket)
       proxy_pass http://127.0.0.1:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection $connection_upgrade;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_read_timeout 3600s;
     }
     location /uploads/ { proxy_pass http://127.0.0.1:5000; }
     location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; try_files $uri =404; }
     location / { add_header Cache-Control "no-cache"; try_files $uri $uri/ /index.html; }
   }
   ```
6. **HTTPS**: `sudo certbot --nginx -d shop.example.com` (adds the certificate and renews it automatically).
7. Updates:
   ```bash
   git pull
   cd backend && npm ci --omit=dev && pm2 restart vendora-api
   cd ../frontend && npm ci && npm run build
   ```

### Automatic deploys (GitHub Actions)

`.github/workflows/deploy.yml` runs on every push to `main`: backend tests and frontend lint + build first,
then, only if they pass, it SSHes into the server, runs the update steps above and checks `/api/v1/health`.

One-time setup:
1. Push the project to a GitHub repository and clone it on the server into `APP_DIR` (e.g. `/var/www/vendora`).
   Do steps 1–6 above once by hand (the server keeps its own `backend/.env`, which is never in git).
2. Create an SSH key pair for deploys; add the public key to `~/.ssh/authorized_keys` of the server user,
   and make sure that user can `git fetch` (a read-only *deploy key* on the repository) and run `pm2`.
3. In GitHub → *Settings → Secrets and variables → Actions*:
   - **Secrets**: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, optionally `SSH_PORT`
   - **Variables**: `APP_DIR`, `APP_URL` (e.g. `https://shop.example.com`), `VITE_PAYMENT_UPI_ID`
4. Push to `main` (or use *Actions → Deploy → Run workflow*).

The deploy runs `git reset --hard origin/main` on the server: never edit code there by hand.
`.env` and `uploads/` are git-ignored, so they are kept.

## Option B: managed hosts (API on Render / Railway, web app on Vercel / Netlify)

**API (Render "Web Service" or Railway)**
- Root directory `backend`, build `npm ci`, start `npm start`, Node 20+.
- Add the variables from the table (Option B column). Health check path: `/api/v1/health`.
- WebSockets are supported on both; nothing extra to set.

**Web app (Vercel or Netlify)**
- Root directory `frontend`, build `npm run build`, output `dist`.
- Environment: `VITE_API_URL=https://your-api.onrender.com/api/v1`, `VITE_PAYMENT_UPI_ID`, `VITE_APP_NAME`.
- Single-page routing: `frontend/vercel.json` is included for Vercel. On Netlify add a `_redirects`
  file in `frontend/public` with `/*  /index.html  200`.
- Put the web app's exact URL in the API's `CLIENT_URL` (comma-separate several, e.g. a custom domain too).

> Two domains need `COOKIE_SAMESITE=none`. Some browsers (Safari with strict tracking protection) block
> such third-party cookies, so users there would be signed out on reload. Option A does not have this problem.

---

## After the first deploy

```bash
# Option A: in backend/ on the server. Option B: the host's shell / one-off job for the API.
npm run seed:admin        # creates the first admin from ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD
npm run seed:categories   # optional starter categories with photos
```
Then remove `ADMIN_PASSWORD` from the environment.

**Smoke test**
1. `https://…/api/v1/health` returns `{"success":true,…}`.
2. Register a customer, sign in, reload the page: you stay signed in (refresh cookie works).
3. Register a seller, upload a store logo (Cloudinary works), approve the store as admin.
4. Add and approve a product, order it as the customer: the seller's bell updates **without reloading** (Socket.IO works).
5. Check the API logs for errors.

## Running it

- **Logs**: JSON lines on stdout (`pm2 logs vendora-api`, or the host's log viewer).
- **Backups**: enable Atlas backups (paid tiers) or a scheduled `mongodump`. Cloudinary keeps the images.
- **Scaling to several API instances**: works for the API itself, but live updates would only reach users
  connected to the same instance. Add the Socket.IO Redis adapter first.
- **Rotating secrets**: changing `JWT_ACCESS_SECRET` signs everyone out (fine). Never change
  `DATA_ENCRYPTION_KEY` without re-encrypting the stored bank account numbers.
