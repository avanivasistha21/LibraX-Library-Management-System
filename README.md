# LibraX — Library Management System

> **LibraX** is a responsive library management system with a React frontend and a FastAPI backend. It supports separate administrator, librarian, and member accounts, with role enforcement and member-scoped records.

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
- **Account security** — Server-authenticated Administrator / Librarian / Member roles, password changes, and member account provisioning
- **Dark mode** — persisted via `localStorage`

The frontend uses the backend API for library records; it does not fall back to mock data.

---

## Prerequisites

| Tool | Minimum version |
|---|---|
| [Node.js](https://nodejs.org/) | 18 LTS |
| [pnpm](https://pnpm.io/installation) | 10.x |
| [Python](https://www.python.org/downloads/) | 3.10 or newer |
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

# 3. Configure the frontend and backend
cp .env.example .env
cp backend/.env.example backend/.env
# Change local demo passwords in backend/.env before sharing or exposing the service.

# 4. Install backend dependencies and create a virtual environment
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
```

On Windows PowerShell, use `py -m venv .venv` and `.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt` instead.

---

## Local Development

Start the backend in one terminal:

```bash
cd backend
../.venv/bin/python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

On Windows PowerShell, run `cd backend` then `..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000`.

Start the frontend in a second terminal at the repository root:

```bash
pnpm dev
```

The Vite dev server starts on **http://localhost:3000** with hot module replacement.

The API health check is at **http://localhost:8000/api/health** and the interactive API docs are at **http://localhost:8000/docs**.

Run type checking separately:

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
# Local FastAPI backend
VITE_API_BASE_URL=http://localhost:8000/api
```

The backend reads database and local account settings from `backend/.env`. `USE_SQLITE_FALLBACK=true` uses the included local SQLite database; MySQL connection variables are also available in `backend/.env.example`.

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
│   │   └── api.ts               # Auth and backend HTTP client
│   ├── types/
│   │   └── index.ts             # Domain interfaces and status enums
│   ├── lib/
│   │   └── utils.ts             # Formatting, derivation, and business-rule helpers
│   ├── index.css                # Design tokens, Tailwind base, component classes
│   ├── main.tsx                 # React root, QueryClient, providers
│   └── vite-env.d.ts            # Vite env type declaration
├── backend/                     # FastAPI service, business rules, and database adapter
├── .env.example                 # Frontend local configuration template
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
| HTTP client (`httpApi`) | ✅ Uses the FastAPI service configured by `VITE_API_BASE_URL` |
| Backend server | ✅ FastAPI API with SQLite fallback and MySQL configuration |
| Authentication | ✅ Hashed passwords, expiring server sessions, and role checks |
| Member data access | ✅ Member loans, reservations, and fines are scoped to the signed-in member |
| Circulation and fines | ✅ API-backed issue/return, reservation, copy-status, and fine workflows |
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

Authentication endpoints include `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, and `POST /auth/password`. The member account endpoint is `POST /members/{member_id}/account` and is administrator-only. Protected requests include `Authorization: Bearer <token>`. If a `401 Unauthorized` status is received, the frontend clears the stored token and routes to `/login`.

The API documentation is available at `http://localhost:8000/docs` while the backend is running.

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

The backend is authoritative for copy availability, overdue status, fine assessment, and role checks. The frontend formats and displays the values returned in the library snapshot.

---

## Local demo accounts

The backend example environment file contains local placeholders for the accounts `maya@librax.edu` (admin), `arjun@librax.edu` (librarian), and `avani@librax.edu` (member). Copy it to `backend/.env` and set your own passwords before the first backend start. These credentials are for local development only; change them before exposing the service or using real data.

## Deployment notes

The included configuration is intended for local development. Before deployment, configure private credentials, a production database, HTTPS, and restricted CORS origins. The API currently returns a full library snapshot rather than paginating records.

---

## Design Notes

LibraX uses a quiet editorial aesthetic: bone canvas (`#F5F1EA`), ink/navy text, clay (`#B9563E`) as the action colour, and sage for healthy states. `DM Sans` keeps dense tables readable; `Space Grotesk` gives readouts a calm technical character.
