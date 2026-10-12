import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Book, BookCopy, Borrow, CopyStatus, Fine, LibrarySnapshot } from '@/types'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export function formatCurrency(value: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value) }
export function formatDate(value: string) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) }
export function formatCompactDate(value: string) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(value)) }
export function initials(name: string) { return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() }
export function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime())
  const minutes = Math.round(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function copiesForBook(copies: BookCopy[], bookId: string) { return copies.filter((copy) => copy.bookId === bookId) }
export function availableCopies(copies: BookCopy[], bookId: string) { return copiesForBook(copies, bookId).filter((copy) => copy.status === 'available') }
export function getCopyStatusLabel(status: CopyStatus) { return { available: 'Available', borrowed: 'On loan', repair: 'In repair', lost: 'Lost' }[status] }
export function getBookAuthorNames(book: Book, authors: LibrarySnapshot['authors']) { return book.authorIds.map((id) => authors.find((author) => author.id === id)?.name).filter(Boolean).join(', ') }
export function getBookCategory(book: Book, categories: LibrarySnapshot['categories']) { return categories.find((category) => category.id === book.categoryId)?.name ?? 'Unsorted' }
export function getBookTitle(bookId: string, books: Book[]) { return books.find((book) => book.id === bookId)?.title ?? 'Unknown title' }
export function getMemberName(memberId: string, members: LibrarySnapshot['members']) { return members.find((member) => member.id === memberId)?.name ?? 'Unknown member' }
export function getBorrowDueState(borrow: Borrow) { if (borrow.status === 'returned') return 'returned'; const due = new Date(borrow.dueAt).getTime(); return due < Date.now() ? 'overdue' : 'on-track' }
export function daysOverdue(borrow: Borrow) { return Math.max(0, Math.ceil((Date.now() - new Date(borrow.dueAt).getTime()) / 86400000)) }
export function calculateFine(borrow: Borrow, ratePerDay = 8) { return daysOverdue(borrow) * ratePerDay }
export function dashboardMetrics(snapshot: LibrarySnapshot) {
  const totalCopies = snapshot.copies.length
  const available = snapshot.copies.filter((copy) => copy.status === 'available').length
  const borrowed = snapshot.copies.filter((copy) => copy.status === 'borrowed').length
  const overdue = snapshot.borrows.filter((borrow) => getBorrowDueState(borrow) === 'overdue').length
  const pendingReservations = snapshot.reservations.filter((reservation) => reservation.status === 'queued' || reservation.status === 'ready').length
  const finesDue = snapshot.fines.filter((fine) => fine.status !== 'paid').reduce((sum, fine) => sum + fine.amount, 0)
  return { totalTitles: snapshot.books.length, totalCopies, availableCopies: available, borrowedCopies: borrowed, overdueLoans: overdue, pendingReservations, finesDue, utilization: totalCopies ? Math.round((borrowed / totalCopies) * 100) : 0 }
}
