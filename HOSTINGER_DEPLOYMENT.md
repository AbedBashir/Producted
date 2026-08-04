# Deploying Producted to Hostinger (hPanel)

This app is a Node.js server (React Router 7 + Prisma) that needs Node.js
hosting with a persistent process — not static file hosting. Follow these
steps in Hostinger's hPanel to get it running on `producted.bashfusion.com`.

> Requires a Hostinger plan that includes the **Node.js** app feature
> (Business/Cloud web hosting or higher). If your current plan doesn't show
> "Node.js" under Websites → Advanced, you'll need to upgrade first.

## 1. Point the subdomain at Hostinger

1. In hPanel, go to **Domains → producted.bashfusion.com** (or **Subdomains**
   if `bashfusion.com` is managed elsewhere in Hostinger) and create the
   subdomain `producted.bashfusion.com`.
2. If `bashfusion.com`'s DNS is *not* on Hostinger, add an `A` record for
   `producted` pointing at your Hostinger hosting IP (or a `CNAME` if
   Hostinger gives you one) at wherever `bashfusion.com`'s DNS is hosted.
3. Wait for DNS to propagate (usually minutes, can take up to a few hours).

## 2. Create the MySQL database

1. hPanel → **Databases → MySQL Databases**.
2. Create a new database (e.g. `producted_db`) and a user with full
   privileges on it. Note the database name, username, password, and host
   (usually `localhost` from within Hostinger, but check the panel — some
   plans show a specific DB host).
3. Build your connection string:
   ```
   mysql://DB_USER:DB_PASSWORD@DB_HOST:3306/DB_NAME
   ```

## 3. Get the code onto Hostinger

Two options:

**Option A — Git deploy (recommended):** hPanel → **Advanced → Git**. Point
it at this repository and branch (`claude/hostinger-deployment-setup-q2t9ha`,
or `main` once merged), set the deploy path to the subdomain's document
root, and enable auto-deploy on push if you want it to redeploy
automatically.

**Option B — Manual upload:** zip the repo (excluding `node_modules` and
`.git`) and upload/extract it via **File Manager** into the subdomain's
directory.

## 4. Configure the Node.js app

hPanel → **Websites → producted.bashfusion.com → Advanced → Node.js**:

- **Node.js version:** 20.x or 22.x (matches `engines` in `package.json`)
- **Application root:** the folder you deployed the code into
- **Application URL:** `producted.bashfusion.com`
- **Application startup file:** `build/server/index.js`
- **Environment variables** — add each of these (see `.env.example`):
  - `SHOPIFY_API_KEY` — from Shopify Partner Dashboard
  - `SHOPIFY_API_SECRET` — from Shopify Partner Dashboard
  - `SCOPES` = `write_products,write_metaobjects,write_metaobject_definitions`
  - `SHOPIFY_APP_URL` = `https://producted.bashfusion.com`
  - `DATABASE_URL` = the MySQL connection string from step 2
  - `NODE_ENV` = `production`

## 5. Install, build, and run migrations

Using the **NPM install** button in the Node.js app panel (or its "Run
command" / terminal feature if available), run in the app's root:

```bash
npm ci
npx prisma migrate deploy
npm run build
```

Then start (or restart) the app from the Node.js panel — it runs
`npm run start`, which serves `build/server/index.js`.

If the panel doesn't expose a terminal, use **hPanel → Advanced → SSH
Access** (available on most Business/Cloud plans) to run the same three
commands manually.

## 6. Enable SSL

hPanel → **Security → SSL** → issue a free SSL certificate for
`producted.bashfusion.com` (Let's Encrypt, usually automatic once DNS
resolves). Shopify requires HTTPS for embedded apps — the app will not load
without it.

## 7. Point Shopify at the new URL

This repo's `shopify.app.toml` already targets `https://producted.bashfusion.com`.
In the Shopify Partner Dashboard (or via `shopify app deploy` if you have the
CLI authenticated), push this config so Shopify's stored `application_url`
and OAuth `redirect_urls` match:

```bash
shopify app deploy
```

Or manually update **App setup** in the Partner Dashboard to match the URLs
in `shopify.app.toml`.

## 8. Smoke test

- Visit `https://producted.bashfusion.com` — should not show a raw error page.
- Install the app on a dev store and confirm OAuth completes (redirects
  back to the app without errors).
- Check the Node.js app's logs (hPanel panel or `npm run start` console) for
  Prisma connection errors if anything fails — almost always a bad
  `DATABASE_URL` or migrations not having been run.

## Notes on this setup

- The database was switched from PostgreSQL to **MySQL** to match what
  Hostinger's shared/cloud hosting provides — see `prisma/schema.prisma`
  and `prisma/migrations/20260804000000_init_mysql/`.
- The `Dockerfile` in this repo is unused for hPanel deployment (no Docker
  on shared hosting) — keep it around only if you later move to a
  Hostinger VPS or another Docker-capable host.
- Redeploying: Git-based deploys just need a new `npm ci && npx prisma
  migrate deploy && npm run build` + restart after each pull. There's no
  CI/CD wired up here — this is a manual (or Hostinger auto-deploy) flow.
