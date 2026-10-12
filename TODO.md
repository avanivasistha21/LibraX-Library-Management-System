# LibraX delivery outcomes

- [ ] Build a complete responsive React + TypeScript + Vite frontend for LibraX with Tailwind CSS, accessible reusable components, React Router, TanStack Query-style hooks, and Recharts analytics.
- [ ] Provide a polished dashboard showing book statistics, available and borrowed copies, overdue books, pending reservations, and recent activity with derived values rather than duplicated hardcoded statistics.
- [ ] Provide a functional book catalogue with search, filters, details, and add/edit/delete actions, plus a separate physical book-copy management view with accession numbers, shelf locations, and availability status.
- [ ] Provide functional member and librarian management, plus author, publisher, and category management.
- [ ] Provide functional issue and return workflows, reservation creation/status tracking, overdue tracking, fine calculation, and payment-status management.
- [ ] Provide borrowing history and analytics views with role-based navigation for members, librarians, and administrators.
- [ ] Keep all future data access behind a centralized typed API service using an environment-controlled API base URL; never connect the browser directly to MySQL or expose credentials.
- [ ] Keep realistic mock data clearly separated from the API layer and implement loading, empty, success, error, confirmation, and mutation feedback states.
- [ ] Keep normalized relational data models with primary-key identifiers, foreign-key relationships, and a distinct BOOK model from BOOK_COPY; centralize availability, borrowing eligibility, overdue, and fine business rules.
- [ ] Include a clean project structure, route manifest, installation/run instructions, and README; confirm the app passes typecheck/build and runs successfully on the configured preview port.
