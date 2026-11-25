# My Home Cookin'

A mobile-friendly front end for a self-hosted [Mealie](https://mealie.io) server.
Friends and family browse, cook from, and add recipes here. Mealie stays on your
home network and handles storage, recipe scraping and accounts.

```
Phone ──https──▶ Cloudflare Tunnel ──▶ this app (Next.js, :3000) ──▶ Mealie (:9000, private)
```

## What's here

- **Sign in** with your Mealie account. The token is kept in an httpOnly cookie.
- **Browse and search** every recipe, with photos served through the app (`/img/[id]`).
- **Recipe page** with an "Adapted from *site*" backlink for imported recipes,
  ingredients you can tick off, tap-to-finish steps, and **Cook mode**, which
  enlarges the text and keeps the screen awake.
- **Add a recipe** three ways:
  - **Website:** paste a link. Mealie scrapes it and saves the source URL.
    Links that were already imported open the existing recipe instead of
    making a duplicate.
  - **Photo:** snap a recipe card, cookbook page or screenshot (up to 4
    photos). Claude reads it and fills in the form for the person to check
    and fix before saving. Every photo is kept in an "Original recipe card"
    section (tap to enlarge), and the first is the recipe's picture until
    someone adds a photo of the dish. Needs `ANTHROPIC_API_KEY` (see below).
  - **Type it:** for family recipes.
- **Recipe photos:** any recipe page has "Photo of the dish" (replaces the
  main picture) and "Add a card photo" buttons. Card photos are stored as
  Mealie recipe assets and served through `/asset/[id]/[file]`. Mealie serves
  assets without a login, which is one more reason to keep it off the internet.
- **Credits:** a website gets an "Adapted from *site*" backlink. A person or
  book gets "From Aunt Mary" (stored in the recipe's `extras.source_credit`
  in Mealie).
- **Installable** as an app (Add to Home Screen). On Android it also shows up
  in the Share menu, so you can share a recipe page straight into the app.

| Path | File |
|---|---|
| Mealie API client | `src/lib/mealie.ts` |
| Session / auth helpers | `src/lib/session.ts`, `src/proxy.ts`, `src/app/actions.ts` |
| Pages | `src/app/(app)/…`, `src/app/login/` |
| PWA | `src/app/manifest.ts`, `src/app/icons/`, `src/app/apple-icon.tsx` |
| Brand: colors, fonts | `src/app/globals.css`, `src/app/layout.tsx` (from `MyHomeCookin_Logo-StyleGuide/`) |
| Brand: logos, app icons | `public/brand/`; regenerate icons with `node scripts/make-icons.mjs` |
| Photo import (Claude) | `src/lib/photo-import.ts`, photo tab in `src/app/(app)/add/add-forms.tsx` |

## Run it locally

You need Node 24+ and a Mealie server. To start a throwaway Mealie with Docker:

```bash
docker run -d --name mealie -p 9925:9000 -e ALLOW_SIGNUP=false ghcr.io/mealie-recipes/mealie:v3.31.0
```

Then:

```bash
cp .env.example .env.local   # set MEALIE_URL=http://localhost:9925
npm install
npm run dev
```

Open http://localhost:3000 and sign in with a Mealie account. A new Mealie
starts with `changeme@example.com` / `MyPassword`; change that right away.

## Deploy on Unraid

1. **Mealie:** install it from Community Apps. **Pin the version tag** (e.g.
   `ghcr.io/mealie-recipes/mealie:v3.31.0`, not `latest`), because this app
   depends on Mealie's API. Upgrade on purpose and test after.
2. **A shared Docker network**, so the two containers can find each other by name:
   ```bash
   docker network create recipes
   ```
   Set both containers' *Network Type* to `Custom: recipes`.
3. **Build this app's image.** On your Mac (Unraid is x86_64):
   ```bash
   docker build --platform linux/amd64 --build-arg NEXT_PUBLIC_SITE_NAME="My Home Cookin'" -t recipes-web .
   ```
   Push it to a registry (e.g. GitHub Container Registry), or `docker save` it
   and `docker load` it on Unraid.
4. **Add the container** in Unraid's Docker tab → *Add Container*:
   - Repository: your image
   - Network: `Custom: recipes`
   - Port: container `3000` → host port of your choice
   - Variable `MEALIE_URL` = `http://mealie:9000` (the Mealie container's name)
5. **Remote access:** point a Cloudflare Tunnel (or Tailscale) at this app's
   port. Mealie itself doesn't need to be exposed. Keep using its own UI on
   your LAN for admin work such as inviting users and backups.

### Photo import

Add a variable `ANTHROPIC_API_KEY` to the app's container (get one at
https://platform.claude.com). Without it, the Photo tab says it isn't switched
on yet. Photos are shrunk in the browser before upload, then sent to
Anthropic's API to be read. Each photo uses Claude Opus 5.5 and costs a few
cents. Only signed-in users can use it. Let family know their photos go to
Anthropic to be read.

`docker-compose.yml` starts both containers together, for trying the whole
stack on one machine.

## Inviting family

In Mealie (on your network): **Settings → Users → Invite**. They follow the
invite link to set a password, then sign in here.
