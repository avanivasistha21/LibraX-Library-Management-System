import { mockSnapshot } from './mockData'
import { httpApi, type LibraryApi } from './api'
import type { Book, BookCopy, Borrow, Fine, LibrarySnapshot, Member, Reservation } from '@/types'
import { calculateFine } from '@/lib/utils'
let snapshot: LibrarySnapshot = structuredClone(mockSnapshot)
const pause = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms))
export const mockApi: LibraryApi = {
  async getSnapshot() { await pause(340); return structuredClone(snapshot) },
  async createBook(input) { await pause(); const book: Book = { ...input, id: `book-${Date.now()}`, createdAt: new Date().toISOString() }; snapshot.books = [book, ...snapshot.books]; return book },
  async updateBook(id, input) { await pause(); const index = snapshot.books.findIndex((book) => book.id === id); if (index < 0) throw new Error('Book not found'); snapshot.books[index] = { ...snapshot.books[index], ...input }; return snapshot.books[index] },
  async deleteBook(id) { await pause(); snapshot.books = snapshot.books.filter((book) => book.id !== id); snapshot.copies = snapshot.copies.filter((copy) => copy.bookId !== id) },
  async updateCopyStatus(id, status) { await pause(); const copy = snapshot.copies.find((item) => item.id === id); if (!copy) throw new Error('Copy not found'); copy.status = status; return copy },
  async createMember(input) { await pause(); const member: Member = { ...input, id: `mem-${Date.now()}` }; snapshot.members = [member, ...snapshot.members]; return member },
  async createBorrow(input) { await pause(); const borrow: Borrow = { ...input, id: `brw-${Date.now()}`, issuedAt: new Date().toISOString(), status: 'active' }; snapshot.borrows = [borrow, ...snapshot.borrows]; const copy = snapshot.copies.find((item) => item.id === input.copyId); if (copy) copy.status = 'borrowed'; return borrow },
  async returnBorrow(id, receivedBy) { await pause(); const borrow = snapshot.borrows.find((item) => item.id === id); if (!borrow) throw new Error('Borrow not found'); borrow.returnedAt = new Date().toISOString(); borrow.receivedBy = receivedBy; borrow.status = 'returned'; const copy = snapshot.copies.find((item) => item.id === borrow.copyId); if (copy) copy.status = 'available'; const fine = calculateFine(borrow); if (fine > 0) snapshot.fines = [{ id: `fine-${Date.now()}`, borrowId: borrow.id, memberId: borrow.memberId, amount: fine, daysOverdue: fine / 8, status: 'unpaid', reason: 'Overdue return', assessedAt: new Date().toISOString() }, ...snapshot.fines]; return borrow },
  async createReservation(input) { await pause(); const position = snapshot.reservations.filter((item) => item.bookId === input.bookId && (item.status === 'queued' || item.status === 'ready')).length + 1; const expires = new Date(); expires.setDate(expires.getDate() + 7); const reservation: Reservation = { ...input, id: `rsv-${Date.now()}`, placedAt: new Date().toISOString(), expiresAt: expires.toISOString(), status: 'queued', queuePosition: position }; snapshot.reservations = [reservation, ...snapshot.reservations]; return reservation },
  async updateReservationStatus(id, status) { await pause(); const reservation = snapshot.reservations.find((item) => item.id === id); if (!reservation) throw new Error('Reservation not found'); reservation.status = status; return reservation },
  async updateFineStatus(id, status) { await pause(); const fine = snapshot.fines.find((item) => item.id === id); if (!fine) throw new Error('Fine not found'); fine.status = status; return fine },
}
export function getLibraryApi(): LibraryApi { return baseUrlAvailable() ? httpApi : mockApi }
function baseUrlAvailable() { return Boolean(import.meta.env.VITE_API_BASE_URL) }
