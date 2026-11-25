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
| Brand: logos, app icons | Built from `MyHomeCookin_Logo-StyleGuide/MyHomeCookin_Logo_Primary_Final.png` into `public/brand/` and the icons by `node scripts/make-brand-assets.mjs` |
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
2. **The app's image** is built by GitHub Actions on every push to `main`
   (`.github/workflows/docker.yml`) and published as
   `ghcr.io/thor48/myhomecookin:latest` (plus `:sha-<commit>` for rolling back).
3. **Add the container.** Copy `unraid/my-myhomecookin.xml` to
   `/boot/config/plugins/dockerMan/templates-user/` on the Unraid USB, then
   Docker tab → *Add Container* → *Template*: `myhomecookin`. Fill in:
   - **Mealie URL:** `http://<unraid-ip>:9925`
   - **Anthropic API key:** optional, turns on photo import
   - **Web port:** `3080` (or any free port)
4. **Remote access:** in Cloudflare Zero Trust → Networks → Tunnels, add a
   public hostname `myhomecookin.com` → `http://<unraid-ip>:3080` to your
   existing tunnel. Don't add Mealie: it serves photos without a login, so keep
   it on your network and use its own UI there for admin work and backups.
5. **Updating:** push to `main`, wait for the Actions build, then *Check for
   Updates* → *Update* on the container in Unraid.

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

1. Signed in as an admin (or anyone you've given **Can invite** in Mealie),
   tap **Invite family** at the bottom of any page.
2. Choose who it's for (one person, up to 5, or up to 10) and tap **Make invite
   link**. Share it by text or email.
3. They open `https://myhomecookin.com/join?token=…`, enter their name, email
   and a password (8+ characters), and they're signed in. They never see Mealie.

Each link stops working once it's used up. New accounts can't invite others
unless you tick **Can invite** on them in Mealie (Settings → Users).
