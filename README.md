# Perfume Boutique

A catalog website for showcasing and selling imported perfumes. Visitors can
browse and search the collection; you (the admin) log in to add, edit, and
remove fragrances, and to read messages from interested customers.

There's no shopping cart or payment processing — customers order by
messaging you directly on WhatsApp, which is the simplest and most common
approach for a small import/resale business.
Nothing here stops you from adding a cart and payments later; see
"Extending this" below.

## Features

- Public catalog: home page, filterable/searchable shop page, individual
  product pages with fragrance notes (top/heart/base)
- Recently arrived fragrances stay on the homepage for 7 days, then remain
  available in the full collection
- "Order via WhatsApp" button with a pre-filled message, plus social media
  links on the contact page
- Admin-only login to add/edit/delete fragrances, including photo upload
- An admin panel for managing the fragrance catalog
- Cloud data storage with Supabase

## Requirements

- [Node.js](https://nodejs.org) version 18 or newer

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Copy the example environment file and edit it, including Supabase values
cp .env.example .env

# 3. Start the server
npm start
```

Then open **http://localhost:3000** in your browser. The admin panel is at
**http://localhost:3000/admin/login** — sign in with the `ADMIN_USERNAME`
and `ADMIN_PASSWORD` you set in `.env`.

Before starting the app, create a Supabase project, run
`supabase/schema.sql` in its SQL editor, and set `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` in `.env`. Keep the service-role key server-side
only; never expose it in browser code.

The first time the server runs, it also seeds three sample fragrances so the
site isn't empty. Delete or edit them from the admin dashboard once you've
added your own.

## Configuring your site

Everything you're likely to want to change lives in `.env` (copy it from
`.env.example` if you haven't already):

| Variable | What it controls |
|---|---|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Your admin login. The account is created once in Supabase when the admin table is empty. |
| `SESSION_SECRET` | A long random string used to keep logins secure. Change it to anything random before going live. |
| `SITE_NAME` / `SITE_TAGLINE` | Your shop name and tagline, shown across the site. |
| `CURRENCY_SYMBOL` | Shown before every price, e.g. `$`, `€`, or a currency code like `ETB`. |
| `WHATSAPP_NUMBER` | Country code + number, digits only (e.g. `15551234567`). Leave blank to hide the WhatsApp button. |
| `CONTACT_EMAIL` / `CONTACT_PHONE` / `ADDRESS` | Shown in the footer and contact page. |
| `INSTAGRAM_URL` / `TELEGRAM_URL` / `FACEBOOK_URL` | Optional social links; blank ones are hidden automatically. |

You do not need to touch any code to change these.

## Project structure

```
perfume-boutique/
├── server.js              Express app entry point
├── config/site.js          Reads .env into one config object used by every view
├── db/store.js             All Supabase data access
├── supabase/schema.sql     Tables to run in the Supabase SQL editor
├── middleware/auth.js      Protects /admin routes
├── routes/
│   ├── public.js           Home, shop, product, about, contact
│   └── admin.js             Login, dashboard, perfume CRUD, inquiries
├── views/                  EJS templates (server-rendered HTML)
│   ├── partials/            Shared header/nav/footer/product-card
│   └── admin/                Admin-only pages
└── public/                  CSS, client-side JS, and uploaded photos
```

## How ordering works

Each product page lets a visitor reach you in these ways:

1. **WhatsApp** — opens a chat with your number and a pre-filled message
   naming the fragrance, so you can confirm price and availability directly.
2. **Social media links** — the contact page displays your configured social
   media accounts.

## Extending this

The app is deliberately kept simple, but is structured so it's
straightforward to grow:

- **Customer accounts.** Right now only the admin can log in. `db/store.js`
  already separates "admin" from the rest of the data layer, so adding a
  `users` collection and a public registration/login flow later is additive
  — it won't require reworking the existing routes.
- **A real database.** If your catalog grows large or you need multiple
  admins editing simultaneously,   Supabase is already used by the app; keep the schema and store API stable.
- **Cart & payments.** Since ordering currently happens over WhatsApp/message,
  there's no cart or checkout. Adding one is a matter of a new `cart`
  session field and a checkout route/view — the product data model already
  has everything (price, stock, images) a cart would need.

## Deployment

This is a standard Node.js/Express app, so it runs on most Node hosts
(Render, Railway, a VPS, etc.). A few things to do before going live:

1. Set real values in `.env` on the host — especially `ADMIN_PASSWORD`,
   `SESSION_SECRET`, and `NODE_ENV=production`.
2. Make sure the `public/uploads/` folder persists between deploys, or move
   uploaded images to Supabase Storage.
3. Serve the site over HTTPS (most hosts do this for you automatically).

Login sessions are kept in memory, which is fine for the single-process
setup this project runs by default. If you later scale to multiple server
processes (e.g. a host that auto-scales or runs a process cluster), admins
would need to reuse the same process to stay logged in — swap in a
persistent session store (e.g. `connect-sqlite3`) at that point.

If you'd like help wiring this up on a specific host, just ask.
