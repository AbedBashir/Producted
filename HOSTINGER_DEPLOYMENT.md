# Deploying Producted to Hostinger (hPanel)

This app is a Node.js server (React Router 7 + Prisma) that needs Node.js
hosting with a persistent process — not static file hosting. Follow these
steps in Hostinger's hPanel to get it running on `producted.invitationsbash.com`.

> Requires a Hostinger plan with the **Node.js app** feature (this repo was
> confirmed working on an **Unlimited Web Hosting** plan — same tier already
> running another Node app on this account). Each Node.js site in hPanel gets
> its own **Websites → [site]** panel with **Deployments**, **Environment
> variables**, **Runtime logs**, **Databases**, and **Advanced → SSH Access**
> sections in the left sidebar.

## 1. Create the website in hPanel

1. hPanel → **Websites → Add website**, using the domain/subdomain
   `producted.invitationsbash.com` (create the subdomain first under
   **Domains** if `invitationsbash.com` is on Hostinger's DNS, or add an `A`/`CNAME`
   record for `producted` wherever `invitationsbash.com`'s DNS is hosted if not).
2. When prompted for the site type/stack, choose **Node.js**.
3. Wait for DNS to propagate (usually minutes, can take up to a few hours) —
   you can proceed with the rest of setup while it does.

## 2. Create the MySQL database

1. In the new site's panel → **Databases**.
2. Create a new database (e.g. `producted_db`) and a user with full
   privileges on it. Note the database name, username, password, and host
   (usually `localhost` from within Hostinger, but check the panel — some
   plans show a specific DB host).
3. Build your connection string:
   ```
   mysql://DB_USER:DB_PASSWORD@DB_HOST:3306/DB_NAME
   ```

## 3. Get the code onto Hostinger

**Option A — Git deploy (recommended):** in the site's panel → **Deployments**.
Point it at this repository and branch (`claude/shopify-app-hosting-0xkh9u`,
or `main` once merged) and deploy. Enable auto-deploy on push if you want it
to redeploy automatically on future commits.

**Option B — Manual upload:** zip the repo (excluding `node_modules` and
`.git`) and upload/extract it via **File Manager** into the site's directory.

**Option C — SSH:** use **Advanced → SSH Access** (shown in the site's
sidebar — same as your `finance.abedbashir.com` site) to `git clone` the repo
directly on the server.

## 4. Configure the Node.js app

In the site's panel (wherever hPanel surfaces the Node.js app config — it may
be its own dashboard tab, or under **Advanced**):

- **Node.js version:** 20.x or 22.x (matches `engines` in `package.json`)
- **Application root:** the folder you deployed the code into
- **Application URL:** `producted.invitationsbash.com`
- **Application startup file:** `server.js`
- **Environment variables** (site panel → **Environment variables**, see
  `.env.example`):
  - `SHOPIFY_API_KEY` — from Shopify Partner Dashboard
  - `SHOPIFY_API_SECRET` — from Shopify Partner Dashboard
  - `SCOPES` = `write_products,write_metaobjects,write_metaobject_definitions`
  - `SHOPIFY_APP_URL` = `https://producted.invitationsbash.com`
  - `DATABASE_URL` = the MySQL connection string from step 2
  - `NODE_ENV` = `production`

## 5. Install, build, and run migrations

Via **Advanced → SSH Access**, connect (`ssh -p <port> <user>@<ip>`, shown on
that page) and, from the app's root on the server:

```bash
npm ci
npx prisma migrate deploy
npm run build
```

Then (re)start the app from wherever the Node.js panel's start/restart
control is. It runs `npm run start`, i.e. `node server.js`, which serves
`build/server/index.js` on `process.env.PORT`.

If the panel exposes an "NPM install" / "Run command" button instead of (or
in addition to) SSH, that works too — same three commands.

## 6. Enable SSL

hPanel → **Security → SSL** → issue a free SSL certificate for
`producted.invitationsbash.com` (Let's Encrypt, usually automatic once DNS
resolves). Shopify requires HTTPS for embedded apps — the app will not load
without it.

## 7. Point Shopify at the new URL

This repo's `shopify.app.toml` already targets `https://producted.invitationsbash.com`.
In the Shopify Partner Dashboard (or via `shopify app deploy` if you have the
CLI authenticated), push this config so Shopify's stored `application_url`
and OAuth `redirect_urls` match:

```bash
shopify app deploy
```

Or manually update **App setup** in the Partner Dashboard to match the URLs
in `shopify.app.toml`.

## 8. Smoke test

- Visit `https://producted.invitationsbash.com` — should not show a raw error page.
- Install the app on a dev store and confirm OAuth completes (redirects
  back to the app without errors).
- Check **Runtime logs** in the site's hPanel (or the SSH console) for
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
