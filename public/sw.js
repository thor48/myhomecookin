/*
 * Service worker: lets recipes you've opened work without a connection
 * (a kitchen with bad Wi-Fi), and shows a friendly page instead of the
 * browser's "no internet" error.
 *
 * - Pages: always try the network first. A copy of the home page and every
 *   recipe page you open is kept on the phone; with no connection (or the
 *   server down) that copy is shown, or /offline.html if there isn't one.
 * - Next's build files (/_next/static, fingerprinted): kept once, served from the phone.
 * - Recipe photos, logo and background: network first, the kept copy when offline.
 * - Signing out (or being sent to the login page) deletes the kept pages and
 *   photos, so the next person to sign in on this phone doesn't see them.
 *
 * Registered by src/components/pwa.tsx (production builds only).
 * Bump VERSION to drop everything kept by an older version.
 */
const VERSION = "v1";
const SHELL = `shell-${VERSION}`; // offline page + its images
const STATIC = `static-${VERSION}`; // /_next/static build files
const PAGES = `pages-${VERSION}`; // kept recipe pages (per user)
const PHOTOS = `photos-${VERSION}`; // kept recipe photos (per user)
const ALL = [SHELL, STATIC, PAGES, PHOTOS];
const LIMITS = { [STATIC]: 400, [PAGES]: 80, [PHOTOS]: 300 };

const OFFLINE_URL = "/offline.html";
const SHELL_FILES = [OFFLINE_URL, "/brand/logo-mark.png"];

// Pages worth keeping: the recipe list and single recipes (not their edit pages).
const KEEP_PAGE = /^\/(?:recipes\/[^/]+)?$/;
const PHOTO = /^\/(?:img|asset|made-photo)\//;
const BRAND = /^\/(?:brand|icons)\//; // logo, background photo
// Pages that mean "nobody is signed in": forget the last person's recipes.
const SIGNED_OUT = /^\/(?:login|logout)(?:\/|$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !ALL.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    if (SIGNED_OUT.test(url.pathname)) {
      event.waitUntil(forgetUser());
      return; // let the browser load it normally
    }
    event.respondWith(page(event, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  if (PHOTO.test(url.pathname)) {
    event.respondWith(networkFirst(req, PHOTOS));
    return;
  }
  if (BRAND.test(url.pathname)) {
    event.respondWith(networkFirst(req, STATIC));
  }
});

// The app tells us which page is open after in-app navigations (those fetch
// data, not the page itself), so we fetch and keep the page in the background.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "keep-page" && typeof data.path === "string") {
    event.waitUntil(keepPage(data.path).catch(() => {}));
  } else if (data.type === "forget-user") {
    event.waitUntil(forgetUser());
  }
});

/** Network first; the kept copy (or the offline page) when that fails. */
async function page(event, url) {
  try {
    const res = await fetch(event.request);
    const landed = new URL(res.url || url.href);
    if (res.redirected && SIGNED_OUT.test(landed.pathname)) {
      // Session ended (expired token → /logout → /login).
      event.waitUntil(forgetUser());
    } else if (res.ok && !res.redirected && KEEP_PAGE.test(url.pathname)) {
      event.waitUntil(store(PAGES, pageKey(url.pathname), res.clone()));
    }
    // Server or tunnel down (Cloudflare 502/530): a kept copy beats an error page.
    if (res.status >= 500) return (await keptPage(url)) || res;
    return res;
  } catch {
    return (await keptPage(url)) || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function keptPage(url) {
  if (!KEEP_PAGE.test(url.pathname)) return undefined;
  const cache = await caches.open(PAGES);
  return cache.match(pageKey(url.pathname));
}

// One copy per page, whatever its ?query (e.g. a "Saved!" banner).
function pageKey(pathname) {
  return new URL(pathname, self.location.origin).href;
}

const recentlyKept = new Map();

async function keepPage(path) {
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin || !KEEP_PAGE.test(url.pathname)) return;
  // Opening the same recipe again a minute later needn't fetch it twice.
  const last = recentlyKept.get(url.pathname);
  if (last && Date.now() - last < 5 * 60 * 1000) return;
  recentlyKept.set(url.pathname, Date.now());

  const res = await fetch(url.pathname, { credentials: "same-origin" });
  if (!res.ok || res.redirected) return;
  const html = await res.clone().text();
  await store(PAGES, pageKey(url.pathname), res);

  // Also keep what the page needs to show: build files and recipe photos.
  const found = new Set();
  for (const m of html.matchAll(/\/(?:_next\/static|img|asset|made-photo|brand)\/[^"'\s,)\\<>]+/g)) {
    found.add(m[0].replace(/&amp;/g, "&"));
  }
  await Promise.all(
    [...found].map((p) => {
      const cacheName = PHOTO.test(p) ? PHOTOS : STATIC;
      return caches.match(p).then((hit) => hit || fetchAndStore(new Request(p), cacheName).catch(() => {}));
    }),
  );
}

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req);
  return hit || fetchAndStore(req, cacheName);
}

async function networkFirst(req, cacheName) {
  try {
    return await fetchAndStore(req, cacheName);
  } catch (e) {
    const hit = await caches.match(req);
    if (hit) return hit;
    throw e;
  }
}

async function fetchAndStore(req, cacheName) {
  const res = await fetch(req);
  if (res.ok && res.type === "basic") await store(cacheName, req, res.clone());
  return res;
}

async function store(cacheName, key, res) {
  const cache = await caches.open(cacheName);
  await cache.delete(key); // re-adding moves it to the end, so trimming drops the oldest
  await cache.put(key, res);
  const max = LIMITS[cacheName];
  if (!max) return;
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

function forgetUser() {
  recentlyKept.clear();
  return Promise.all([caches.delete(PAGES), caches.delete(PHOTOS)]);
}
