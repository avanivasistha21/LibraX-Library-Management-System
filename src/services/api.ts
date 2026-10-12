import type { Book, BookCopy, Borrow, Fine, LibrarySnapshot, Member, Reservation } from '@/types'

export interface LibraryApi {
  getSnapshot(): Promise<LibrarySnapshot>
  createBook(input: Omit<Book, 'id' | 'createdAt'>): Promise<Book>
  updateBook(id: string, input: Partial<Book>): Promise<Book>
  deleteBook(id: string): Promise<void>
  updateCopyStatus(id: string, status: BookCopy['status']): Promise<BookCopy>
  createMember(input: Omit<Member, 'id'>): Promise<Member>
  createBorrow(input: Pick<Borrow, 'copyId' | 'memberId' | 'issuedBy' | 'dueAt'>): Promise<Borrow>
  returnBorrow(id: string, receivedBy: string): Promise<Borrow>
  createReservation(input: Pick<Reservation, 'bookId' | 'memberId'>): Promise<Reservation>
  updateReservationStatus(id: string, status: Reservation['status']): Promise<Reservation>
  updateFineStatus(id: string, status: Fine['status']): Promise<Fine>
}

const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!baseUrl) throw new Error('API base URL is not configured.')
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  if (!response.ok) throw new Error(`API request failed with ${response.status}`)
  return response.json() as Promise<T>
}

export const httpApi: LibraryApi = {
  getSnapshot: () => request('/library/snapshot'),
  createBook: (input) => request('/books', { method: 'POST', body: JSON.stringify(input) }),
  updateBook: (id, input) => request(`/books/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteBook: (id) => request(`/books/${id}`, { method: 'DELETE' }),
  updateCopyStatus: (id, status) => request(`/book-copies/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  createMember: (input) => request('/members', { method: 'POST', body: JSON.stringify(input) }),
  createBorrow: (input) => request('/borrows', { method: 'POST', body: JSON.stringify(input) }),
  returnBorrow: (id, receivedBy) => request(`/borrows/${id}/return`, { method: 'POST', body: JSON.stringify({ receivedBy }) }),
  createReservation: (input) => request('/reservations', { method: 'POST', body: JSON.stringify(input) }),
  updateReservationStatus: (id, status) => request(`/reservations/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateFineStatus: (id, status) => request(`/fines/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
}
