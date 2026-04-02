# ✦ VibeKit Studio

> **"Generate a theme. Build a mini-site. Ship it."**

A full-stack web app where users pick a design vibe, build a themed mini-site using a live page editor, and publish it to a public URL — built for the Purple Merit Technologies Full Stack Vibe Coder Intern Assessment.

---

## 🚀 Live Demo

**Deployed URL:** `https://vibestudiomain.netlify.app`

**Test credentials:**
- Email: `test@vibekit.studio`
- Password: `vibekit2026`

> Or sign up with your own account — it's free and instant.

---

## 📁 Project Structure

```
vibekit-studio/
├── index.html                  # Landing page (/)
├── auth.html                   # Login + Signup (/login, /signup)
├── app.html                    # Dashboard (/app)
├── editor.html                 # Page builder (/editor?id=<pageId>)
├── public-page.html            # Published page renderer (/p/:slug)
├── netlify.toml                # Netlify build + redirect config
├── _redirects                  # Fallback SPA routing
├── package.json                # Functions dependencies
└── netlify/
    └── functions/
        ├── _db.js              # PostgreSQL pool + schema init
        ├── _auth.js            # JWT sign/verify helpers
        ├── auth-signup.js      # POST /api/auth/signup
        ├── auth-login.js       # POST /api/auth/login
        ├── auth-logout.js      # POST /api/auth/logout
        ├── auth-me.js          # GET  /api/auth/me
        ├── pages.js            # GET/POST /api/pages
        ├── page.js             # GET/PUT/DELETE /api/pages/:id + actions
        └── public-view.js      # GET/POST /api/public/pages/:slug
```

---

## 🛠 Local Setup

### Prerequisites

- Node.js 18+
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) — `npm install -g netlify-cli`
- A PostgreSQL database (local or [Supabase](https://supabase.com) free tier)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/vibekit-studio.git
cd vibekit-studio
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the project root (never commit this):

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
JWT_SECRET=your-super-secret-key-change-this-in-production-min-32-chars
```

> **Supabase tip:** Your `DATABASE_URL` is at  
> Project Settings → Database → Connection string → URI

### 4. Run locally

```bash
netlify dev
```

This starts the local server at `http://localhost:8888` and hot-proxies all  
`/api/*` routes to your Netlify Functions automatically.

> The database schema (tables, indexes) is created automatically on first cold start via `initDb()` in `_db.js`. No manual migration needed.

---

## 🌐 Deploying to Netlify

### Option A — Netlify CLI (recommended)

```bash
# Link to your Netlify site (first time only)
netlify link

# Set env vars
netlify env:set DATABASE_URL "postgresql://..."
netlify env:set JWT_SECRET "your-secret-here"

# Deploy to production
npm run deploy
```

### Option B — GitHub integration

1. Push repo to GitHub
2. Connect to Netlify via **Import from Git**
3. Set environment variables in **Site Settings → Environment Variables**:
   - `DATABASE_URL`
   - `JWT_SECRET`
4. Deploy — Netlify auto-detects `netlify.toml`

### Required environment variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `super-secret-random-string-here` |
| `RESEND_API_KEY` | (Optional) Resend API key for contact form email notifications | `re_xxxxxxxxxxxx` |

> **Note:** `RESEND_API_KEY` is optional. If not set, contact submissions are still stored in the database; the email step is silently skipped.

---

## 🎨 Theme System

6 hand-crafted vibe presets, each defined as CSS design tokens:

| Vibe | Aesthetic | Key Colors |
|---|---|---|
| **Minimal / Editorial** | Clean, whitespace-heavy | `#f8f6f1` bg, `#1a1a1a` text |
| **Neo-Brutal** | Bold borders, raw energy | `#f5e6c8` bg, `#ff5f3d` accent |
| **Dark / Neon** | Electric glow, night mode | `#050510` bg, `#00e5b0` + `#7c5cfc` accents |
| **Pastel / Soft** | Gentle, rounded, friendly | `#fdf6f0` bg, `#f7a8b8` accent |
| **Luxury / Serif** | Gold, dark, refined | `#0e0b07` bg, `#c9a96e` gold |
| **Retro / Pixel** | 8-bit nostalgia, chunky | `#1a0a2e` bg, `#ff00ff` neon |

Each preset defines: color palette, font pairing, spacing scale, border-radius style, and button style — applied via CSS variables.

---

## 🔐 Auth Architecture

- **Passwords:** Hashed with `bcryptjs` (12 salt rounds)
- **Sessions:** JWT tokens signed with `JWT_SECRET`, 7-day expiry
- **Storage:** Token stored in `localStorage` on the client; sent as `Authorization: Bearer <token>` header on every API request
- **Server-side enforcement:** Every authenticated endpoint calls `getUser(event)` — if the token is missing or invalid, the request is rejected with `401`
- **Ownership:** All page read/write operations include `AND user_id = $userId` — users can never access or modify another user's pages

> **Note on httpOnly cookies:** The logout function clears a `vk_token` cookie if present, supporting both cookie-based and header-based token delivery. For this assessment, `localStorage` + `Authorization` header was chosen for simplicity and easier local dev with Netlify CLI.

---

## 📡 API Reference

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup` | — | Create account, returns JWT |
| `POST` | `/api/auth/login` | — | Login, returns JWT |
| `POST` | `/api/auth/logout` | — | Clears cookie |
| `GET` | `/api/auth/me` | ✅ | Get current user |

### Pages (authenticated)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/pages` | List user's pages |
| `POST` | `/api/pages` | Create a new page |
| `GET` | `/api/pages/:id` | Get page with content |
| `PUT` | `/api/pages/:id` | Update page |
| `DELETE` | `/api/pages/:id` | Delete page |
| `POST` | `/api/pages/:id/publish` | Publish page |
| `POST` | `/api/pages/:id/unpublish` | Unpublish page |
| `POST` | `/api/pages/:id/duplicate` | Clone page as draft |

### Public
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/public/pages/:slug` | Fetch published page |
| `POST` | `/api/public/pages/:slug/view` | Increment view count |
| `POST` | `/api/public/pages/:slug/contact` | Submit contact form |

---

## ✅ Responsiveness

Tested at:
- **Mobile:** 320px–480px — single column, touch-safe 44px targets
- **Tablet:** 768px–1024px — 2-column layouts, full navigation
- **Desktop:** 1280px+ — full bento grids, sidebar layouts

Editor preview toggle actually changes iframe/container width (not just CSS zoom).

---

## ⚖️ Tradeoffs + What I'd Improve Next

1. **Image uploads vs URLs** — Gallery sections currently use image URLs. Next step: integrate Cloudinary or Supabase Storage for drag-and-drop uploads with automatic optimization.

2. **JWT dual delivery (httpOnly cookie + localStorage)** — Both signup and login now set a `vk_token` httpOnly cookie (Secure, SameSite=Strict, 7-day) AND return the token in the response body. The client stores it in localStorage as a fallback for local Netlify CLI dev (where Secure cookies may not be set). In production, the httpOnly cookie is the authoritative session; the logout endpoint clears it server-side. Next improvement: remove the localStorage path entirely and migrate to a pure cookie + CSRF token pattern.

3. **No rate limiting** — The `/api/public/pages/:slug/view` endpoint could be spammed. Next: add Redis-backed rate limiting per IP (Upstash is a natural fit with Netlify Functions).

4. **Contact form emails via Resend** — Submissions are stored in DB and optionally emailed to the page owner via [Resend](https://resend.com). Email is triggered server-side in `public-view.js` if `RESEND_API_KEY` is set; failures are caught and logged without breaking the form. Next: add rate-limiting per page per IP to prevent submission spam.

5. **Slug auto-generation collision UX** — Currently collisions silently append `-2`, `-3` etc. Better UX would show the final slug in the editor before save and let the user override it inline.

---

## 🎨 Design Extras (3 Chosen)

1. **Subtle animations** — Scroll-triggered section reveals (`IntersectionObserver` + CSS `@keyframes`) on the landing page; button hover lift + shadow transitions; modal entrance animation (`scale(0.95) → scale(1)`).

2. **Micro-interactions** — Every interactive element has distinct hover, focus, and pressed states: nav links (background fill), page cards (translateY + shadow), CTA buttons (translateY + glow box-shadow), action buttons (border-color + background), publish toggle (color swap + dot pulse), toast notifications (slide-in).

3. **Accessibility pass** — All interactive elements have `focus-visible` outline rings using `var(--accent2)` at 2px offset. Touch targets on mobile are enforced at ≥44px for primary actions. Navigation works fully without hover (action buttons always visible via `@media (hover: none)`). Color contrast checked: accent on dark bg passes AA at all body sizes.

A 1–2 minute screen recording demonstrating:
- Landing page at mobile (375px) + tablet (768px)
- Editor preview toggle switching breakpoints
- Published page `/p/:slug` on mobile + tablet
- Full flow: create → theme → preview → publish → open public URL

> See `screen-recording.mp4` in the submission email.

---
