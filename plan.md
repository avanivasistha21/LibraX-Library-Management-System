# LibraX implementation plan

## Product scope
LibraX is a single-branch library operations workspace for administrators and librarians, with a member-facing mode available through role-aware navigation. It covers catalogue records, physical copies, people, metadata, circulation, reservations, fines, history, and analytics while keeping the current frontend data source mocked and the future MySQL/JDBC or REST boundary explicit.

## Implementation approach
- **React + TypeScript + Vite** with Tailwind CSS and a small shadcn/ui-inspired component layer built from accessible primitives.
- **React Router** for all primary workspace pages and the login entry route.
- **TanStack Query-shaped hooks**: query/mutation hooks own loading, empty, success, and error UI states; mock repositories are replaceable by HTTP repositories without changing page components.
- **Recharts** for circulation and catalogue analytics.
- **Central API service** in `src/services/api.ts` reads `VITE_API_BASE_URL`, never opens a database connection in the browser, and exposes typed resource methods. `src/services/mockApi.ts` implements the same contract with realistic normalized records.
- **Relational models** keep `Book` separate from `BookCopy`; junction and foreign-key identifiers are represented directly (`bookId`, `authorIds`, `publisherId`, `categoryId`, `copyId`, `memberId`, `issuedBy`, `receivedBy`, `borrowId`). Business helpers calculate availability, loan status, overdue days, and fines from model data rather than duplicated constants.
- **Feature pages** are organized by domain, with reusable `DataTable`, `StatCard`, `StatusBadge`, `PageHeader`, `Drawer`, `Dialog`, and form controls. Table actions use local mutation state and toasts so the prototype is functional before a backend exists.
- **Role-aware navigation** uses a lightweight mock session context. Demo credentials are visible on the login screen, and switching roles changes available nav items and the dashboard copy without pretending to be production authentication.

## Project structure
- `src/app`: router, session provider, query provider, app shell, and global styles.
- `src/components`: reusable layout, data display, form, feedback, and visualization components.
- `src/features`: page-level domain modules for dashboard, catalogue, copies, people, metadata, circulation, reservations, fines, history, analytics, and settings.
- `src/hooks`: query/mutation wrappers and cross-domain derived calculations.
- `src/services`: typed API contract, HTTP client, mock implementation, and repository selector.
- `src/types`: normalized domain interfaces and enums.
- `src/lib`: formatting, status, class-name, and business-rule helpers.
- `public`: `manus-routes.json` and static app metadata.

## Design direction
- **Design movement:** editorial operations dashboard / quiet luxury utility, inspired by library catalogues and contemporary publishing systems rather than generic SaaS gradients.
- **Core principles:** calm density, obvious hierarchy, tactile paper-like surfaces, and evidence-first status feedback.
- **Color philosophy:** a warm bone canvas keeps long work sessions easy on the eye; ink/navy establishes trust and legibility; a distinctive clay/terracotta accent acts as the operational signal for actions and overdue attention; sage and butter support secondary status meaning.
- **Layout paradigm:** persistent left navigation plus a wide editorial workbench; key pages open with a compact context strip, then alternate between dense records and generous breathing room instead of uniform card grids.
- **Signature elements:** a small stacked-book LibraX mark, thin ruled separators, and compact uppercase metadata labels paired with oversized numeric readouts.
- **Interaction philosophy:** actions are direct and reversible; filters update immediately, destructive actions confirm, and all mutations show a clear result state. Motion is limited to 160–220ms fades/slides for drawers and row feedback.
- **Animation:** no decorative loops; use subtle entrance transitions for content regions and a restrained shimmer only while data is loading.
- **Typography:** `DM Sans` for interface text and `Space Grotesk` for numbers, page titles, and the LibraX wordmark. Use tight display tracking and relaxed body line-height.
- **Brand essence:** "The library control room for people who keep knowledge moving." Personality: precise, considered, quietly confident.
- **Brand voice:** concise, observant, and operational. Example lines: “Keep the shelf in sync.” and “One view for every handoff.”
- **Wordmark/logo:** a three-line stacked-book glyph inside a rounded square, paired with a compact LibraX wordmark; the mark doubles as the rail home button.
- **Signature brand color:** clay `#B9563E`, used sparingly for active actions, overdue signal, and the primary mark.

## Build and handoff workflow
1. Install pinned dependencies, enable TypeScript diagnostics, and create the route manifest before starting Vite.
2. Implement the domain types, mock data, API boundary, app shell, and core pages in staged batches.
3. Run typecheck and production build; correct actionable diagnostics.
4. Start Vite on the configured port `3000`, verify `/manus-routes.json`, and inspect the live preview for responsive layout.
5. Commit the complete source and documentation to the project’s canonical `main` branch and report the preview URL unless a published URL is explicitly confirmed.

## Explicit constraints
- No browser-to-MySQL connection and no database credentials in client code.
- Mock data must remain clearly separated from the API layer.
- Availability, eligibility, overdue, and fine calculations are centralized and backend-replaceable.
- The frontend must remain useful when the Java/JDBC or REST backend does not yet exist.
