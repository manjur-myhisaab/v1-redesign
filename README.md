# MyHisaab Payroll — Web v2

Marketing landing page and phone/OTP login for MyHisaab Payroll, built with React, TypeScript, Vite and Tailwind CSS v4.

## Tech stack

**Frontend**
- **React 19** + **TypeScript**, **Vite 8**
- **Tailwind CSS v4** via `@tailwindcss/vite` (CSS-based config in `src/index.css`)
- **React Router 7**, **class-variance-authority** + **tailwind-merge** (`cn`)
- **HSB Sans** self-hosted brand typeface (`public/fonts`)

**Backend** (`server/`)
- **Node.js + Express 5** API
- **Prisma ORM 6** + **SQLite** (`prisma/schema.prisma`, `prisma/dev.db`)
- Run with `tsx`; Vite proxies `/api` → `:4000`

See `docs/architecture-and-modules-spec.md` for the data model, API surface, and module build order.

## Getting started

```bash
npm install --legacy-peer-deps   # glide-data-grid pins React 18 as a peer
npm run db:push                  # create the SQLite schema
npm run db:seed                  # seed owner + workspace + sample employees
npm run dev:all                  # web (https://localhost:5173) + api (https://localhost:4000)
```

**Logging in (dev):** open `https://localhost:5173` (accept the self-signed cert warning),
go to **Log in**, enter the seeded owner phone **`+916291946212`**, click Continue, then read
the 6-digit OTP from **`OTP.txt`** in the project root and enter it. Auth is phone+OTP → JWT;
the app is a multi-tenant SaaS (workspace-scoped), and adding members beyond the free tier
(owner + 1) opens a **Razorpay** paywall (test credentials in `razorpay_test_credentials.txt`).

## Scripts

| Command            | Description                                   |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Vite dev server with HMR (:5173)              |
| `npm run server`   | Express API with watch (:4000)                |
| `npm run dev:all`  | Run web + api together (concurrently)         |
| `npm run build`    | Type-check (`tsc -b`) + production build      |
| `npm run preview`  | Preview the production build locally          |
| `npm run lint`     | Run oxlint                                    |
| `npm run format`   | Format with Prettier                          |
| `npm run db:push`  | Sync Prisma schema → SQLite                   |
| `npm run db:seed`  | Seed the database                             |
| `npm run db:studio`| Open Prisma Studio                            |

## Routes

| Path               | Page      | Notes                                          |
| ------------------ | --------- | ---------------------------------------------- |
| `/`                | Landing   | Full-screen hero with rotating layered shades  |
| `/login`           | Login     | Country picker + phone number → 6-box OTP step |
| `/admin/dashboard` | Dashboard | Landed on after a successful OTP verification  |

## Project structure

```
public/
  fonts/                 # HSB Sans (woff2)
  logo-big-black.png     # brand logo (dark)
  logo-big-white.png     # brand logo (light)
  login-bg-payroll.png   # login illustration
  payroll-logo-512.png   # favicon
src/
  components/
    Hero.tsx             # landing hero + rotating circular shades
    Logo.tsx             # brand logo component
    ui/
      button.tsx         # cva button with 3D "pillow" variants
      otp-input.tsx      # 6-box OTP input
  lib/
    countries.ts         # country dial codes + phone length rules
    utils.ts             # cn() class helper
  pages/
    Landing.tsx
    Login.tsx
    Dashboard.tsx
  App.tsx                # routes
  index.css              # Tailwind import, design tokens, fonts, animations
  main.tsx               # app + router bootstrap
```

## Notes

- The login flow is currently UI-only — `src/pages/Login.tsx` has `TODO`s where the
  send-OTP and verify-OTP backend calls should be wired in. `/admin/dashboard` is not
  yet auth-guarded.
- Design tokens (colors, radius) live as HSL channels in `:root` and are exposed to
  Tailwind utilities via `@theme inline` in `src/index.css`.
