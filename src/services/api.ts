import type { AuthUser, Book, BookCopy, Borrow, Fine, LibrarySnapshot, Member, Reservation } from '@/types'

export interface LibraryApi {
  getSnapshot(): Promise<LibrarySnapshot>
  createBook(input: Omit<Book, 'id' | 'createdAt'>): Promise<Book>
  updateBook(id: string, input: Partial<Book>): Promise<Book>
  deleteBook(id: string): Promise<void>
  updateCopyStatus(id: string, status: BookCopy['status']): Promise<BookCopy>
  createMember(input: Omit<Member, 'id'> & { password: string }): Promise<Member>
  createBorrow(input: Pick<Borrow, 'copyId' | 'memberId' | 'issuedBy' | 'dueAt'>): Promise<Borrow>
  returnBorrow(id: string, receivedBy: string): Promise<Borrow>
  createReservation(input: Pick<Reservation, 'bookId' | 'memberId'>): Promise<Reservation>
  updateReservationStatus(id: string, status: Reservation['status']): Promise<Reservation>
  updateFineStatus(id: string, status: Fine['status']): Promise<Fine>
}

export interface LoginResult { token: string; user: AuthUser }

const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
const TOKEN_KEY = 'librax_auth_token'

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token)
  }
}

export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!baseUrl) throw new Error('API base URL is not configured.')
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) ?? {}),
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    clearAuthToken()
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized: Session expired or invalid token.')
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`API request failed with status ${response.status}${errorBody ? `: ${errorBody}` : ''}`)
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

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

export async function login(email: string, password: string): Promise<LoginResult> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export async function getCurrentUser(): Promise<AuthUser> {
  return request('/auth/me')
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' })
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
}

export async function setMemberPassword(memberId: string, password: string): Promise<void> {
  await request('/members/' + encodeURIComponent(memberId) + '/account', { method: 'POST', body: JSON.stringify({ password }) })
}
