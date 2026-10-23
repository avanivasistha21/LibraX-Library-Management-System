import os
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from db import (
    execute_query,
    execute_dml,
    get_connection,
    get_dict_cursor,
    is_sqlite_mode,
    test_connection,
    setup_database_schema,
    DB_NAME
)
from business_logic import (
    BusinessRuleViolation,
    validate_member_eligibility,
    validate_copy_availability,
    calculate_loan_due_date,
    process_return_and_calculate_fine,
    validate_reservation_dates,
    validate_fine_status_transition,
    DEFAULT_LOAN_DAYS
)

app = FastAPI(
    title="LibraX Backend API",
    description="Relational MySQL Backend with Business Logic and ODBC/DB-API for LibraX Library Management System",
    version="2.0.0"
)

# Enable CORS for React/Vite development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Request & Response Schemas
# -----------------------------------------------------------------------------
class BookCreate(BaseModel):
    isbn: str
    title: str
    subtitle: Optional[str] = None
    authorIds: List[str] = Field(default_factory=list)
    publisherId: str
    categoryId: str
    publishedYear: Optional[int] = 2024
    pages: Optional[int] = 300
    language: Optional[str] = "English"
    description: Optional[str] = ""
    coverTone: Optional[str] = "#B9563E"

class BookUpdate(BaseModel):
    isbn: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    publisherId: Optional[str] = None
    categoryId: Optional[str] = None
    publishedYear: Optional[int] = None
    pages: Optional[int] = None
    language: Optional[str] = None
    description: Optional[str] = None
    coverTone: Optional[str] = None

class CopyStatusUpdate(BaseModel):
    status: str

class MemberCreate(BaseModel):
    memberCode: Optional[str] = None
    name: str
    email: str
    phone: Optional[str] = ""
    memberType: Optional[str] = "Student"
    avatarTone: Optional[str] = "#7E9E9A"
    status: Optional[str] = "Active"

class BorrowCreate(BaseModel):
    copyId: str
    memberId: str
    issuedBy: str
    dueAt: Optional[str] = None

class ReturnBorrowRequest(BaseModel):
    receivedBy: str

class ReservationCreate(BaseModel):
    bookId: str
    memberId: str

class ReservationStatusUpdate(BaseModel):
    status: str

class FineStatusUpdate(BaseModel):
    status: str


# -----------------------------------------------------------------------------
# Helper Mappers between MySQL Schema and Frontend Types
# -----------------------------------------------------------------------------
def map_copy_status_to_fe(status_db: str) -> str:
    s = (status_db or "").upper()
    if s == "AVAILABLE": return "available"
    if s == "ON_LOAN": return "borrowed"
    if s == "DAMAGED": return "repair"
    if s == "LOST": return "lost"
    return status_db.lower()

def map_copy_status_to_db(status_fe: str) -> str:
    s = (status_fe or "").lower()
    if s == "available": return "AVAILABLE"
    if s == "borrowed": return "ON_LOAN"
    if s == "repair": return "DAMAGED"
    if s == "lost": return "LOST"
    return status_fe.upper()

def map_reservation_status_to_fe(status_db: str) -> str:
    s = (status_db or "").upper()
    if s == "PENDING": return "queued"
    if s == "FULFILLED": return "fulfilled"
    if s == "CANCELLED": return "cancelled"
    if s == "EXPIRED": return "cancelled"
    return status_db.lower()

def map_reservation_status_to_db(status_fe: str) -> str:
    s = (status_fe or "").lower()
    if s in ("queued", "ready"): return "PENDING"
    if s == "fulfilled": return "FULFILLED"
    if s == "cancelled": return "CANCELLED"
    return status_fe.upper()

def map_fine_status_to_fe(status_db: str) -> str:
    s = (status_db or "").upper()
    if s == "UNPAID": return "unpaid"
    if s == "PAID": return "paid"
    if s == "WAIVED": return "paid"
    return status_db.lower()

def map_fine_status_to_db(status_fe: str) -> str:
    s = (status_fe or "").lower()
    if s == "unpaid": return "UNPAID"
    if s == "paid": return "PAID"
    if s == "partial": return "UNPAID"
    return status_fe.upper()


# -----------------------------------------------------------------------------
# Core Snapshot Endpoint (Returns Entire Normalized Relational Database)
# -----------------------------------------------------------------------------
@app.get("/api/library/snapshot")
@app.get("/library/snapshot")
def get_library_snapshot():
    """
    Performs relational queries to construct the complete library operational snapshot.
    Fulfills Phase 2 retrieval and reporting requirements.
    """
    try:
        # 1. Fetch Publishers
        pubs = execute_query("SELECT publisher_id, name, city FROM PUBLISHER ORDER BY name")
        publishers = [{
            "id": p["publisher_id"],
            "name": p["name"],
            "city": p["city"] or "",
            "books": 0,
            "status": "Active"
        } for p in pubs]

        # 2. Fetch Categories
        cats = execute_query("SELECT category_id, name, description FROM CATEGORY ORDER BY name")
        categories = [{
            "id": c["category_id"],
            "name": c["name"],
            "slug": c["name"].lower().replace(" ", "-"),
            "books": 0,
            "accent": "#B9563E"
        } for c in cats]

        # 3. Fetch Authors
        auths = execute_query("SELECT author_id, full_name, country FROM AUTHOR ORDER BY full_name")
        authors = [{
            "id": a["author_id"],
            "name": a["full_name"],
            "initials": "".join([part[0] for part in a["full_name"].split()[:2] if part]).upper(),
            "books": 0,
            "status": "Active"
        } for a in auths]

        # 4. Fetch Books & Book Authors
        books_raw = execute_query("""
            SELECT b.book_id, b.isbn, b.title, b.edition, b.publication_year, b.pages,
                   b.language, b.description, b.cover_tone, b.publisher_id, b.category_id,
                   b.created_at
            FROM BOOK b
            ORDER BY b.title
        """)
        ba_raw = execute_query("SELECT book_id, author_id FROM BOOK_AUTHOR ORDER BY author_order")
        book_authors_map: Dict[str, List[str]] = {}
        for row in ba_raw:
            book_authors_map.setdefault(row["book_id"], []).append(row["author_id"])

        books = []
        for b in books_raw:
            b_id = b["book_id"]
            books.append({
                "id": b_id,
                "isbn": b["isbn"],
                "title": b["title"],
                "subtitle": b["edition"] or "",
                "authorIds": book_authors_map.get(b_id, []),
                "publisherId": b["publisher_id"],
                "categoryId": b["category_id"],
                "publishedYear": b["publication_year"] or 2024,
                "pages": b["pages"] or 200,
                "language": b["language"] or "English",
                "description": b["description"] or "",
                "coverTone": b["cover_tone"] or "#B9563E",
                "createdAt": str(b["created_at"])[:10] if b["created_at"] else "2025-01-01"
            })

        # 5. Fetch Book Copies
        copies_raw = execute_query("SELECT copy_id, book_id, shelf_location, status, acquired_on FROM BOOK_COPY")
        copies = [{
            "id": c["copy_id"],
            "bookId": c["book_id"],
            "accessionNumber": f"LX-{c['copy_id'][-5:]}" if len(c['copy_id']) >= 5 else f"LX-00{c['copy_id']}",
            "shelfLocation": c["shelf_location"] or "General Shelf",
            "status": map_copy_status_to_fe(c["status"]),
            "acquiredAt": str(c["acquired_on"])
        } for c in copies_raw]

        # 6. Fetch Borrows
        borrows_raw = execute_query("""
            SELECT borrow_id, member_id, copy_id, issued_by, received_by,
                   borrow_date, due_date, return_date
            FROM BORROW
            ORDER BY borrow_date DESC
        """)
        today_date = date.today()
        borrows = []
        today_iso = str(today_date)
        for br in borrows_raw:
            d_date_str = str(br["due_date"])[:10]
            b_status = "returned" if br["return_date"] else ("overdue" if d_date_str < today_iso else "active")
            borrows.append({
                "id": br["borrow_id"],
                "copyId": br["copy_id"],
                "memberId": br["member_id"],
                "issuedBy": br["issued_by"],
                "receivedBy": br["received_by"],
                "issuedAt": str(br["borrow_date"]),
                "dueAt": str(br["due_date"]),
                "returnedAt": str(br["return_date"]) if br["return_date"] else None,
                "status": b_status
            })

        # 7. Fetch Members & calculate dynamic loan / fine aggregations
        members_raw = execute_query("SELECT member_id, full_name, email, phone, member_type, join_date, status FROM MEMBER")
        active_loans_by_member: Dict[str, int] = {}
        for br in borrows:
            if br["status"] in ("active", "overdue"):
                active_loans_by_member[br["memberId"]] = active_loans_by_member.get(br["memberId"], 0) + 1

        fines_raw = execute_query("""
            SELECT f.fine_id, f.borrow_id, b.member_id, f.amount, f.fine_date, f.status, f.fine_type
            FROM FINE f
            JOIN BORROW b ON f.borrow_id = b.borrow_id
            ORDER BY f.fine_date DESC
        """)
        unpaid_fines_by_member: Dict[str, float] = {}
        fines = []
        for f in fines_raw:
            m_id = f["member_id"]
            amt = float(f["amount"])
            fe_status = map_fine_status_to_fe(f["status"])
            if fe_status == "unpaid":
                unpaid_fines_by_member[m_id] = unpaid_fines_by_member.get(m_id, 0.0) + amt

            fines.append({
                "id": f["fine_id"],
                "borrowId": f["borrow_id"],
                "memberId": m_id,
                "amount": amt,
                "daysOverdue": max(0, int(amt / 10)) if f["fine_type"] == "OVERDUE" else 0,
                "status": fe_status,
                "reason": f"Overdue penalty ({f['fine_type']})" if f["fine_type"] == "OVERDUE" else f"{f['fine_type']} book penalty",
                "assessedAt": str(f["fine_date"])
            })

        members = [{
            "id": m["member_id"],
            "memberCode": f"MBR-{m['member_id'][-4:]}" if len(m['member_id']) >= 4 else f"MBR-00{m['member_id']}",
            "name": m["full_name"],
            "email": m["email"],
            "phone": m["phone"] or "",
            "memberType": m["member_type"] or "Student",
            "joinedAt": str(m["join_date"]),
            "activeLoans": active_loans_by_member.get(m["member_id"], 0),
            "outstandingFine": unpaid_fines_by_member.get(m["member_id"], 0.0),
            "avatarTone": "#7E9E9A",
            "status": "Active" if m["status"] == "ACTIVE" else "Suspended"
        } for m in members_raw]

        # 8. Fetch Librarians
        libs_raw = execute_query("SELECT librarian_id, full_name, email, phone, role, shift FROM LIBRARIAN")
        librarians = [{
            "id": l["librarian_id"],
            "employeeCode": f"LIB-{l['librarian_id'][-3:]}" if len(l['librarian_id']) >= 3 else f"LIB-0{l['librarian_id']}",
            "name": l["full_name"],
            "email": l["email"],
            "role": l["role"] or "Librarian",
            "shift": l["shift"] or "09:00-17:00",
            "lastActive": datetime.now().isoformat(),
            "avatarTone": "#B9563E",
            "status": "Active"
        } for l in libs_raw]

        # 9. Fetch Reservations
        res_raw = execute_query("""
            SELECT reservation_id, member_id, book_id, reserved_on, expires_on, status
            FROM RESERVATION
            ORDER BY reserved_on ASC
        """)
        reservations = []
        pos = 1
        for r in res_raw:
            reservations.append({
                "id": r["reservation_id"],
                "bookId": r["book_id"],
                "memberId": r["member_id"],
                "placedAt": str(r["reserved_on"]),
                "expiresAt": str(r["expires_on"]),
                "status": map_reservation_status_to_fe(r["status"]),
                "queuePosition": pos
            })
            pos += 1

        # 10. Compute Activity Feed from recent borrows, returns, reservations
        activity = [
            {
                "id": "act-001",
                "kind": "issue",
                "actor": "LibraX System",
                "detail": f"Circulation operational with {len(borrows)} recorded loans",
                "time": datetime.now().isoformat(),
                "accent": "#B9563E"
            },
            {
                "id": "act-002",
                "kind": "return",
                "actor": "MySQL Database",
                "detail": f"Loaded {len(books)} books across {len(categories)} categories",
                "time": datetime.now().isoformat(),
                "accent": "#667A62"
            }
        ]

        return {
            "books": books,
            "copies": copies,
            "authors": authors,
            "publishers": publishers,
            "categories": categories,
            "members": members,
            "librarians": librarians,
            "borrows": borrows,
            "reservations": reservations,
            "fines": fines,
            "activity": activity
        }

    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Database retrieval error: {str(ex)}")


# -----------------------------------------------------------------------------
# Books Endpoints (CRUD)
# -----------------------------------------------------------------------------
@app.post("/api/books", status_code=status.HTTP_201_CREATED)
@app.post("/books", status_code=status.HTTP_201_CREATED)
def create_book(book: BookCreate):
    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)
        book_id = f"book-{int(datetime.now().timestamp() * 1000)}"

        # Verify publisher and category existence
        cursor.execute("SELECT publisher_id FROM PUBLISHER WHERE publisher_id = %s", (book.publisherId,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Publisher ID '{book.publisherId}' does not exist.")

        cursor.execute("SELECT category_id FROM CATEGORY WHERE category_id = %s", (book.categoryId,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail=f"Category ID '{book.categoryId}' does not exist.")

        # Insert into BOOK table
        cursor.execute("""
            INSERT INTO BOOK (book_id, isbn, title, edition, publication_year, pages, language, description, cover_tone, publisher_id, category_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            book_id, book.isbn, book.title, book.subtitle or "1st Edition",
            book.publishedYear or 2024, book.pages or 250, book.language or "English",
            book.description or "", book.coverTone or "#B9563E",
            book.publisherId, book.categoryId
        ))

        # Insert M:N BOOK_AUTHOR associations
        order = 1
        for a_id in book.authorIds:
            cursor.execute("""
                INSERT INTO BOOK_AUTHOR (book_id, author_id, author_order)
                VALUES (%s, %s, %s)
            """, (book_id, a_id, order))
            order += 1

        # Automatically create initial copy for physical tracking
        copy_id = f"copy-{int(datetime.now().timestamp() * 1000)}"
        cursor.execute("""
            INSERT INTO BOOK_COPY (copy_id, book_id, shelf_location, status, acquired_on)
            VALUES (%s, %s, %s, %s, %s)
        """, (copy_id, book_id, "Shelf A / Sec 1", "AVAILABLE", date.today()))

        conn.commit()
        cursor.close()

        return {
            "id": book_id,
            "isbn": book.isbn,
            "title": book.title,
            "subtitle": book.subtitle or "1st Edition",
            "authorIds": book.authorIds,
            "publisherId": book.publisherId,
            "categoryId": book.categoryId,
            "publishedYear": book.publishedYear or 2024,
            "pages": book.pages or 250,
            "language": book.language or "English",
            "description": book.description or "",
            "coverTone": book.coverTone or "#B9563E",
            "createdAt": date.today().isoformat()
        }
    except BusinessRuleViolation as br:
        conn.rollback()
        raise HTTPException(status_code=400, detail=br.message)
    except HTTPException:
        conn.rollback()
        raise
    except Exception as ex:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create book: {str(ex)}")
    finally:
        conn.close()


@app.patch("/api/books/{book_id}")
@app.patch("/books/{book_id}")
def update_book(book_id: str, updates: BookUpdate):
    updates_dict = updates.model_dump(exclude_unset=True)
    if not updates_dict:
        raise HTTPException(status_code=400, detail="No fields provided to update.")

    db_fields = []
    params = []
    mapping = {
        "title": "title",
        "isbn": "isbn",
        "subtitle": "edition",
        "publisherId": "publisher_id",
        "categoryId": "category_id",
        "publishedYear": "publication_year",
        "pages": "pages",
        "language": "language",
        "description": "description",
        "coverTone": "cover_tone",
    }

    for fe_field, val in updates_dict.items():
        if fe_field in mapping and val is not None:
            db_fields.append(f"{mapping[fe_field]} = %s")
            params.append(val)

    if not db_fields:
        return {"status": "no change"}

    params.append(book_id)
    sql = f"UPDATE BOOK SET {', '.join(db_fields)} WHERE book_id = %s"
    affected = execute_dml(sql, tuple(params))
    if affected == 0:
        raise HTTPException(status_code=404, detail="Book not found.")

    return {"id": book_id, **updates_dict}


@app.delete("/api/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
@app.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: str):
    affected = execute_dml("DELETE FROM BOOK WHERE book_id = %s", (book_id,))
    if affected == 0:
        raise HTTPException(status_code=404, detail="Book not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -----------------------------------------------------------------------------
# Copies Endpoints
# -----------------------------------------------------------------------------
@app.patch("/api/book-copies/{copy_id}")
@app.patch("/book-copies/{copy_id}")
def update_copy_status(copy_id: str, body: CopyStatusUpdate):
    db_status = map_copy_status_to_db(body.status)
    affected = execute_dml("UPDATE BOOK_COPY SET status = %s WHERE copy_id = %s", (db_status, copy_id))
    if affected == 0:
        raise HTTPException(status_code=404, detail="Book copy not found.")
    return {"id": copy_id, "status": body.status}


# -----------------------------------------------------------------------------
# Members Endpoints
# -----------------------------------------------------------------------------
@app.post("/api/members", status_code=status.HTTP_201_CREATED)
@app.post("/members", status_code=status.HTTP_201_CREATED)
def create_member(member: MemberCreate):
    mem_id = f"mem-{int(datetime.now().timestamp() * 1000)}"
    db_status = "ACTIVE" if (member.status or "Active").lower() == "active" else "SUSPENDED"

    try:
        execute_dml("""
            INSERT INTO MEMBER (member_id, full_name, email, phone, member_type, join_date, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            mem_id, member.name, member.email, member.phone or "",
            member.memberType or "Student", date.today(), db_status
        ))
        return {
            "id": mem_id,
            "memberCode": member.memberCode or f"MBR-{mem_id[-4:]}",
            "name": member.name,
            "email": member.email,
            "phone": member.phone or "",
            "memberType": member.memberType or "Student",
            "joinedAt": date.today().isoformat(),
            "activeLoans": 0,
            "outstandingFine": 0,
            "avatarTone": member.avatarTone or "#7E9E9A",
            "status": member.status or "Active"
        }
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"Failed to create member: {str(ex)}")


# -----------------------------------------------------------------------------
# Circulation (Borrow & Return) Endpoints with Core Business Logic
# -----------------------------------------------------------------------------
@app.post("/api/borrows", status_code=status.HTTP_201_CREATED)
@app.post("/borrows", status_code=status.HTTP_201_CREATED)
def issue_borrow(borrow_in: BorrowCreate):
    """
    Executes book loan issuance with transaction integrity and business validations:
    - Verifies copy availability (status == 'AVAILABLE')
    - Verifies member eligibility (active status, loan count, fine thresholds)
    - Sets due date enforcing due_date > borrow_date
    - Updates copy status to 'ON_LOAN'
    """
    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)

        # 1. Fetch copy
        cursor.execute("SELECT copy_id, status FROM BOOK_COPY WHERE copy_id = %s", (borrow_in.copyId,))
        copy = cursor.fetchone()
        if not copy:
            raise HTTPException(status_code=404, detail="Book copy not found.")
        validate_copy_availability(copy)

        # 2. Fetch member
        cursor.execute("SELECT member_id, full_name, status, member_type FROM MEMBER WHERE member_id = %s", (borrow_in.memberId,))
        member = cursor.fetchone()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found.")

        # 3. Calculate active loans and unpaid fines for member
        cursor.execute("SELECT COUNT(*) AS active_count FROM BORROW WHERE member_id = %s AND return_date IS NULL", (borrow_in.memberId,))
        active_loans = cursor.fetchone()["active_count"]

        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0.0) AS unpaid_fines
            FROM FINE f
            JOIN BORROW b ON f.borrow_id = b.borrow_id
            WHERE b.member_id = %s AND f.status = 'UNPAID'
        """, (borrow_in.memberId,))
        unpaid_fines = float(cursor.fetchone()["unpaid_fines"])

        validate_member_eligibility(member, active_loans, unpaid_fines)

        # 4. Determine dates
        borrow_date = date.today()
        if borrow_in.dueAt:
            try:
                due_date = datetime.fromisoformat(borrow_in.dueAt.replace("Z", "")).date()
            except ValueError:
                due_date = calculate_loan_due_date(borrow_date)
        else:
            due_date = calculate_loan_due_date(borrow_date)

        if due_date <= borrow_date:
            raise BusinessRuleViolation("Due date must be strictly after borrow date.")

        # 5. Insert Borrow record
        borrow_id = f"brw-{int(datetime.now().timestamp() * 1000)}"
        cursor.execute("""
            INSERT INTO BORROW (borrow_id, member_id, copy_id, issued_by, borrow_date, due_date)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (borrow_id, borrow_in.memberId, borrow_in.copyId, borrow_in.issuedBy, borrow_date, due_date))

        # 6. Update copy status to ON_LOAN
        cursor.execute("UPDATE BOOK_COPY SET status = 'ON_LOAN' WHERE copy_id = %s", (borrow_in.copyId,))

        conn.commit()
        cursor.close()

        return {
            "id": borrow_id,
            "copyId": borrow_in.copyId,
            "memberId": borrow_in.memberId,
            "issuedBy": borrow_in.issuedBy,
            "issuedAt": borrow_date.isoformat(),
            "dueAt": due_date.isoformat(),
            "status": "active"
        }

    except BusinessRuleViolation as br:
        conn.rollback()
        raise HTTPException(status_code=400, detail=br.message)
    except HTTPException:
        conn.rollback()
        raise
    except Exception as ex:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to issue loan: {str(ex)}")
    finally:
        conn.close()


@app.post("/api/borrows/{borrow_id}/return")
@app.post("/borrows/{borrow_id}/return")
def return_borrow(borrow_id: str, return_in: ReturnBorrowRequest):
    """
    Executes book return with transaction integrity:
    - Sets return_date = TODAY
    - Validates return_date >= borrow_date
    - Updates copy status back to 'AVAILABLE'
    - Calculates overdue days and automatically generates FINE record if overdue
    """
    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)

        cursor.execute("SELECT * FROM BORROW WHERE borrow_id = %s", (borrow_id,))
        borrow = cursor.fetchone()
        if not borrow:
            raise HTTPException(status_code=404, detail="Borrow record not found.")

        if borrow["return_date"]:
            raise BusinessRuleViolation("This loan has already been marked as returned.")

        return_date = date.today()
        calc_result = process_return_and_calculate_fine(
            borrow_date_val=borrow["borrow_date"],
            due_date_val=borrow["due_date"],
            return_date_val=return_date
        )

        # 1. Update BORROW record
        cursor.execute("""
            UPDATE BORROW
            SET return_date = %s, received_by = %s
            WHERE borrow_id = %s
        """, (return_date, return_in.receivedBy, borrow_id))

        # 2. Update BOOK_COPY status to AVAILABLE
        cursor.execute("UPDATE BOOK_COPY SET status = 'AVAILABLE' WHERE copy_id = %s", (borrow["copy_id"],))

        # 3. Create FINE record if overdue
        fine_id = None
        if calc_result["is_overdue"] and calc_result["fine_amount"] > 0:
            fine_id = f"fine-{int(datetime.now().timestamp() * 1000)}"
            cursor.execute("""
                INSERT INTO FINE (fine_id, borrow_id, fine_type, amount, fine_date, status)
                VALUES (%s, %s, 'OVERDUE', %s, %s, 'UNPAID')
            """, (fine_id, borrow_id, calc_result["fine_amount"], return_date))

        conn.commit()
        cursor.close()

        return {
            "id": borrow_id,
            "copyId": borrow["copy_id"],
            "memberId": borrow["member_id"],
            "issuedBy": borrow["issued_by"],
            "receivedBy": return_in.receivedBy,
            "issuedAt": str(borrow["borrow_date"]),
            "dueAt": str(borrow["due_date"]),
            "returnedAt": return_date.isoformat(),
            "status": "returned",
            "fineAssessed": calc_result["fine_amount"]
        }

    except BusinessRuleViolation as br:
        conn.rollback()
        raise HTTPException(status_code=400, detail=br.message)
    except HTTPException:
        conn.rollback()
        raise
    except Exception as ex:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Return failed: {str(ex)}")
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# Reservations Endpoints
# -----------------------------------------------------------------------------
@app.post("/api/reservations", status_code=status.HTTP_201_CREATED)
@app.post("/reservations", status_code=status.HTTP_201_CREATED)
def create_reservation(res_in: ReservationCreate):
    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)

        # Validate member
        cursor.execute("SELECT status FROM MEMBER WHERE member_id = %s", (res_in.memberId,))
        mem = cursor.fetchone()
        if not mem:
            raise HTTPException(status_code=404, detail="Member not found.")
        if (mem["status"] or "").upper() != "ACTIVE":
            raise BusinessRuleViolation("Only active members can place reservations.")

        # Compute dates
        res_date, exp_date = validate_reservation_dates(date.today())

        # Queue position calculation
        cursor.execute("SELECT COUNT(*) AS q_count FROM RESERVATION WHERE book_id = %s AND status = 'PENDING'", (res_in.bookId,))
        q_pos = cursor.fetchone()["q_count"] + 1

        res_id = f"res-{int(datetime.now().timestamp() * 1000)}"
        cursor.execute("""
            INSERT INTO RESERVATION (reservation_id, member_id, book_id, reserved_on, expires_on, status)
            VALUES (%s, %s, %s, %s, %s, 'PENDING')
        """, (res_id, res_in.memberId, res_in.bookId, res_date, exp_date))

        conn.commit()
        cursor.close()

        return {
            "id": res_id,
            "bookId": res_in.bookId,
            "memberId": res_in.memberId,
            "placedAt": res_date.isoformat(),
            "expiresAt": exp_date.isoformat(),
            "status": "queued",
            "queuePosition": q_pos
        }
    except BusinessRuleViolation as br:
        conn.rollback()
        raise HTTPException(status_code=400, detail=br.message)
    except HTTPException:
        conn.rollback()
        raise
    except Exception as ex:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create reservation: {str(ex)}")
    finally:
        conn.close()


@app.patch("/api/reservations/{res_id}")
@app.patch("/reservations/{res_id}")
def update_reservation_status(res_id: str, body: ReservationStatusUpdate):
    db_status = map_reservation_status_to_db(body.status)
    affected = execute_dml("UPDATE RESERVATION SET status = %s WHERE reservation_id = %s", (db_status, res_id))
    if affected == 0:
        raise HTTPException(status_code=404, detail="Reservation not found.")
    return {"id": res_id, "status": body.status}


# -----------------------------------------------------------------------------
# Fines Endpoints
# -----------------------------------------------------------------------------
@app.patch("/api/fines/{fine_id}")
@app.patch("/fines/{fine_id}")
def update_fine_status(fine_id: str, body: FineStatusUpdate):
    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)
        cursor.execute("SELECT * FROM FINE WHERE fine_id = %s", (fine_id,))
        fine = cursor.fetchone()
        if not fine:
            raise HTTPException(status_code=404, detail="Fine not found.")

        target_status = map_fine_status_to_db(body.status)
        validate_fine_status_transition(fine["status"], target_status)

        paid_date = date.today() if target_status == "PAID" else None
        cursor.execute("UPDATE FINE SET status = %s, paid_date = %s WHERE fine_id = %s", (target_status, paid_date, fine_id))

        conn.commit()
        cursor.close()

        return {"id": fine_id, "status": body.status}
    except BusinessRuleViolation as br:
        conn.rollback()
        raise HTTPException(status_code=400, detail=br.message)
    except HTTPException:
        conn.rollback()
        raise
    except Exception as ex:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update fine: {str(ex)}")
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# System Diagnostic & Database Init Endpoints
# -----------------------------------------------------------------------------
@app.get("/api/health")
@app.get("/health")
@app.get("/")
def health_check():
    connected, msg = test_connection()
    return {
        "app": "LibraX Library Operations Backend",
        "status": "healthy",
        "database": {
            "connected": connected,
            "message": msg,
            "target": DB_NAME
        }
    }

@app.post("/api/db/init")
def initialize_database():
    success, msg = setup_database_schema()
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"success": True, "message": msg}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
