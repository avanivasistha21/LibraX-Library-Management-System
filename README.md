# LibraX — Library Management System

> **LibraX** is a responsive, role-aware library management frontend designed for a DBMS course project. It provides a complete operational interface for librarians and administrators to manage books, physical copies, members, circulation, reservations, and fines. A MySQL/REST backend is to be developed separately and connected via a clearly defined API boundary.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Local Development](#local-development)
- [Build for Production](#build-for-production)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Backend Integration Status](#backend-integration-status)
- [API Contract](#api-contract)
- [Relational Model Alignment](#relational-model-alignment)
- [Remaining Integration Work](#remaining-integration-work)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [React 18](https://react.dev/) (with TypeScript) |
| Build tool | [Vite 6](https://vitejs.dev/) |
| Routing | [React Router v7](https://reactrouter.com/) |
| Data fetching | [TanStack Query v5](https://tanstack.com/query/latest) |
| Styling | [Tailwind CSS v3](https://tailwindcss.com/) |
| Charts | [Recharts](https://recharts.org/) |
| Icons | [Lucide React](https://lucide.dev/) |
| Package manager | [pnpm](https://pnpm.io/) |

---

## Project Overview

LibraX ships with the following major areas of functionality:

- **Dashboard** — live collection metrics, utilisation gauge, recent activity feed
- **Book Catalogue** — search, filter, detail view, and full create / edit / delete flows
- **Physical Copies** — accession numbers, shelf locations, and per-copy status management
- **Members & Staff** — member and librarian directories
- **Metadata** — author, publisher, and category reference tables
- **Issue & Return** — full circulation workflow with staff attribution
- **Reservations** — queue management with expiry tracking
- **Fines & Payments** — automatic overdue fine calculation, payment-state transitions
- **Borrowing History** — searchable audit log
- **Analytics** — Recharts-powered charts (category distribution, utilisation trend)
- **Settings** — application and account preferences
- **Role switching** — Administrator / Librarian / Member views (demo-only; enforce server-side in production)
- **Dark mode** — persisted via `localStorage`

All flows work with built-in realistic mock data while a backend is absent.

---

## Prerequisites

| Tool | Minimum version |
|---|---|
| [Node.js](https://nodejs.org/) | 18 LTS |
| [pnpm](https://pnpm.io/installation) | 10.x |
| Git | 2.x |

Install pnpm if not present:

```bash
npm install -g pnpm
```

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/avanivasistha21/LibraX-Library-Management-System.git
cd LibraX-Library-Management-System

# 2. Install dependencies
pnpm install

# 3. Copy the environment template
cp .env.example .env
# Edit .env and set VITE_API_BASE_URL when a backend is available
```

---

## Local Development

```bash
pnpm dev
```

The Vite dev server starts on **http://localhost:3000** with hot module replacement.

Run type checking separately (no build required):

```bash
pnpm typecheck
```

---

## Build for Production

```bash
pnpm build
```

Output is written to `dist/`. Serve with any static host or preview locally:

```bash
pnpm preview
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```dotenv
# .env.example — safe to commit; .env is git-ignored

# The base URL for the REST backend.
# Leave empty to use the built-in mock API (all pages remain fully functional).
# Example: VITE_API_BASE_URL=https://api.yourbackend.edu/v1
VITE_API_BASE_URL=
```

> **Security**: Never store MySQL passwords, JDBC connection strings, private tokens, or any secret in `VITE_*` variables — they are inlined into the browser bundle. All privileged credentials belong exclusively in the backend runtime.

---

## Project Structure

```
librax/
├── public/
│   └── librax-logo.png          # App logo (local asset)
├── src/
│   ├── app/
│   │   ├── App.tsx              # Route tree
│   │   └── session.tsx          # Session context & role state (demo-only auth)
│   ├── components/
│   │   ├── shell.tsx            # App shell: sidebar, topbar, theme toggle
│   │   └── ui.tsx               # Reusable primitives: Badge, Avatar, Button, etc.
│   ├── hooks/
│   │   └── useLibrary.ts        # All TanStack Query reads and mutations
│   ├── pages/
│   │   ├── dashboard.tsx
│   │   ├── catalogue.tsx
│   │   ├── copies.tsx
│   │   ├── people.tsx
│   │   ├── metadata.tsx
│   │   ├── circulation.tsx
│   │   ├── reservations.tsx
│   │   ├── fines.tsx
│   │   ├── history.tsx
│   │   ├── analytics.tsx
│   │   ├── settings.tsx
│   │   ├── login.tsx
│   │   └── operations.ts        # Re-export barrel
│   ├── services/
│   │   ├── api.ts               # LibraryApi interface + HTTP implementation
│   │   ├── mockApi.ts           # In-memory mock; selected when VITE_API_BASE_URL is absent
│   │   └── mockData.ts          # Seed data (not production data)
│   ├── types/
│   │   └── index.ts             # Domain interfaces and status enums
│   ├── lib/
│   │   └── utils.ts             # Formatting, derivation, and business-rule helpers
│   ├── index.css                # Design tokens, Tailwind base, component classes
│   ├── main.tsx                 # React root, QueryClient, providers
│   └── vite-env.d.ts            # Vite env type declaration
├── .env.example                 # Safe template (committed)
├── .gitignore
├── app.config.ts                # App-level config (logo path, etc.)
├── index.html                   # Vite entry HTML
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## Backend Integration Status

| Area | Status |
|---|---|
| API contract (`LibraryApi` interface) | ✅ Defined in `src/services/api.ts` |
| HTTP client (`httpApi`) | ✅ Activated by setting `VITE_API_BASE_URL` |
| Mock fallback (`mockApi`) | ✅ Active when `VITE_API_BASE_URL` is empty |
| Environment variable wiring | ✅ `.env.example` provided with CORS notes |
| Auth headers & 401 interception | ✅ Auto Bearer token dispatch + 401 redirect to `/login` |
| Backend server | ⏳ Not yet implemented |
| Authentication backend (JWT / session) | ⏳ Demo role switcher; wire token via `setToken()` |
| Pagination / server-side filtering | ⏳ Pages currently load a full snapshot |
| Real-time / websocket updates | ⏳ Not implemented |

---

## API Contract

The frontend communicates exclusively through the `LibraryApi` interface in `src/services/api.ts`. The backend must implement:

| Method | Path | Description |
|---|---|---|
| `GET` | `/library/snapshot` | Returns all entities (books, copies, members, borrows, reservations, fines, activity) |
| `POST` | `/books` | Create a new book title |
| `PATCH` | `/books/:id` | Update book metadata |
| `DELETE` | `/books/:id` | Remove a book title (204 No Content supported) |
| `PATCH` | `/book-copies/:id` | Update a physical copy's status |
| `POST` | `/members` | Register a new member |
| `POST` | `/borrows` | Issue a book copy to a member |
| `POST` | `/borrows/:id/return` | Record a return |
| `POST` | `/reservations` | Place a reservation |
| `PATCH` | `/reservations/:id` | Update reservation status |
| `PATCH` | `/fines/:id` | Update fine payment status |

All requests include `Content-Type: application/json` and automatically attach `Authorization: Bearer <token>` when an auth token is set. Responses are JSON (or 204 No Content for empty DELETE responses). If a `401 Unauthorized` status is received, the frontend automatically purges stored tokens and routes to `/login`. Errors use non-2xx status codes and may include an error body.

> When the backend is ready, set `VITE_API_BASE_URL` in `.env` — the frontend automatically switches from mock to live data.

---

## Relational Model Alignment

| Entity | Primary key | Notable relationships |
|---|---|---|
| `BOOK` | `bookId` | `publisherId`, `categoryId`; many-to-many authors via `BOOK_AUTHOR` |
| `BOOK_COPY` | `copyId` | `bookId`; accession number, shelf location, physical status |
| `MEMBER` | `memberId` | owns many `BORROW` and `RESERVATION` records |
| `LIBRARIAN` | `librarianId` | issues (`issuedBy`) and receives (`receivedBy`) `BORROW` records |
| `BORROW` | `borrowId` | `copyId`, `memberId`, `issuedBy`, optional `receivedBy` |
| `RESERVATION` | `reservationId` | `bookId`, `memberId`; queue position and lifecycle status |
| `FINE` | `fineId` | `borrowId`, `memberId`; overdue days, amount, payment status |

Derived values (availability, overdue state, fine amount) are computed client-side in `src/lib/utils.ts`. In production the backend should be authoritative and enforce them transactionally.

---

## Remaining Integration Work

1. Implement the REST resources matching `LibraryApi` in the chosen backend (Java/JDBC, Spring Boot, Express, etc.)
2. Replace the snapshot endpoint with paginated, filterable responses as data grows
3. Implement real authentication — enforce role claims server-side; the role switcher is demo-only
4. Make issue/return, reservation transitions, and fine assessment atomic (MySQL transactions)
5. Add backend contract tests for copy availability checks, overdue windows, and fine rate rules
6. Secure the API with HTTPS and CORS restrictions before deployment

---

## Design Notes

LibraX uses a quiet editorial aesthetic: bone canvas (`#F5F1EA`), ink/navy text, clay (`#B9563E`) as the action colour, and sage for healthy states. `DM Sans` keeps dense tables readable; `Space Grotesk` gives readouts a calm technical character.
