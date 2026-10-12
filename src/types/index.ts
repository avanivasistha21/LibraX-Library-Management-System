export type Role = 'admin' | 'librarian' | 'member'
export type CopyStatus = 'available' | 'borrowed' | 'repair' | 'lost'
export type BorrowStatus = 'active' | 'returned' | 'overdue'
export type ReservationStatus = 'queued' | 'ready' | 'fulfilled' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface Author { id: string; name: string; initials: string; books: number; status: 'Active' | 'Draft' }
export interface Publisher { id: string; name: string; city: string; books: number; status: 'Active' | 'Draft' }
export interface Category { id: string; name: string; slug: string; books: number; accent: string }

export interface Book {
  id: string
  isbn: string
  title: string
  subtitle?: string
  authorIds: string[]
  publisherId: string
  categoryId: string
  publishedYear: number
  pages: number
  language: string
  description: string
  coverTone: string
  createdAt: string
}

export interface BookCopy {
  id: string
  bookId: string
  accessionNumber: string
  shelfLocation: string
  status: CopyStatus
  acquiredAt: string
}

export interface Member {
  id: string
  memberCode: string
  name: string
  email: string
  phone: string
  memberType: 'Student' | 'Faculty' | 'Staff'
  joinedAt: string
  activeLoans: number
  outstandingFine: number
  avatarTone: string
  status: 'Active' | 'Suspended'
}

export interface Librarian {
  id: string
  employeeCode: string
  name: string
  email: string
  role: 'Head librarian' | 'Librarian' | 'Assistant'
  shift: string
  lastActive: string
  avatarTone: string
  status: 'Active' | 'Away'
}

export interface Borrow {
  id: string
  copyId: string
  memberId: string
  issuedBy: string
  receivedBy?: string
  issuedAt: string
  dueAt: string
  returnedAt?: string
  status: BorrowStatus
}

export interface Reservation {
  id: string
  bookId: string
  memberId: string
  placedAt: string
  expiresAt: string
  status: ReservationStatus
  queuePosition: number
}

export interface Fine {
  id: string
  borrowId: string
  memberId: string
  amount: number
  daysOverdue: number
  status: PaymentStatus
  reason: string
  assessedAt: string
}

export interface Activity {
  id: string
  kind: 'issue' | 'return' | 'reservation' | 'member' | 'fine'
  actor: string
  detail: string
  time: string
  accent: string
}

export interface LibrarySnapshot {
  books: Book[]
  copies: BookCopy[]
  authors: Author[]
  publishers: Publisher[]
  categories: Category[]
  members: Member[]
  librarians: Librarian[]
  borrows: Borrow[]
  reservations: Reservation[]
  fines: Fine[]
  activity: Activity[]
}

export interface DashboardMetrics {
  totalTitles: number
  totalCopies: number
  availableCopies: number
  borrowedCopies: number
  overdueLoans: number
  pendingReservations: number
  finesDue: number
  utilization: number
}

export interface ApiError { message: string; code?: string }
export interface ApiResult<T> { data: T; error?: ApiError }
