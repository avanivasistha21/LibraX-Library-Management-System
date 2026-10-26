import hashlib
import hmac
import os
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

AUTH_ITERATIONS = 310_000
SESSION_DAYS = 7

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str = Field(min_length=8)
    memberType: Optional[str] = "Student"
    phone: Optional[str] = ""

class PasswordChangeRequest(BaseModel):
    currentPassword: str
    newPassword: str = Field(min_length=8)

class AuthenticatedUser(BaseModel):
    id: str
    entityId: str
    name: str
    email: str
    role: str

def password_digest(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), AUTH_ITERATIONS).hex()

def create_auth_schema() -> None:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""CREATE TABLE IF NOT EXISTS USER_ACCOUNT (
            account_id VARCHAR(50) PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE,
            role VARCHAR(20) NOT NULL, entity_id VARCHAR(50) NOT NULL,
            display_name VARCHAR(255) NOT NULL, password_salt VARCHAR(64) NOT NULL,
            password_hash VARCHAR(128) NOT NULL, is_active INTEGER NOT NULL DEFAULT 1
        )""")
        cursor.execute("""CREATE TABLE IF NOT EXISTS USER_SESSION (
            token_hash VARCHAR(64) PRIMARY KEY, account_id VARCHAR(50) NOT NULL,
            expires_at VARCHAR(40) NOT NULL
        )""")
        conn.commit()
        cursor.close()
        bootstrap_auth_accounts(conn)
    finally:
        conn.close()

def bootstrap_auth_accounts(conn) -> None:
    # Development credentials are supplied in backend/.env and can be changed there.
    cursor = get_dict_cursor(conn)
    accounts = [
        ("admin", "maya@librax.edu", "lib-001", "LIBRAX_ADMIN_PASSWORD", "change-this-admin-password"),
        ("librarian", "arjun@librax.edu", "lib-002", "LIBRAX_LIBRARIAN_PASSWORD", "change-this-librarian-password"),
        ("member", "avani@librax.edu", "mem-001", "LIBRAX_MEMBER_PASSWORD", "change-this-member-password"),
        ("member", "ustat@librax.edu", "mem-002", "LIBRAX_MEMBER_PASSWORD", "change-this-member-password"),
    ]
    for role, email, entity_id, password_key, default_pwd in accounts:
        password = os.getenv(password_key) or default_pwd
        cursor.execute("SELECT account_id FROM USER_ACCOUNT WHERE email = %s", (email,))
        if cursor.fetchone():
            continue
        table, id_column = ("MEMBER", "member_id") if role == "member" else ("LIBRARIAN", "librarian_id")
        cursor.execute(f"SELECT full_name FROM {table} WHERE {id_column} = %s", (entity_id,))
        record = cursor.fetchone()
        if not record:
            continue
        salt = secrets.token_hex(16)
        cursor.execute("""INSERT INTO USER_ACCOUNT
            (account_id, email, role, entity_id, display_name, password_salt, password_hash, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 1)""",
            (f"acct-{uuid.uuid4().hex}", email, role, entity_id, record["full_name"], salt, password_digest(password, salt)))
    conn.commit()
    cursor.close()

def user_payload(row: Dict[str, Any]) -> Dict[str, str]:
    return {"id": row["account_id"], "entityId": row["entity_id"], "name": row["display_name"], "email": row["email"], "role": row["role"]}

@app.post("/api/auth/login")
def login(credentials: LoginRequest):
    rows = execute_query("SELECT * FROM USER_ACCOUNT WHERE LOWER(email) = %s AND is_active = 1", (credentials.email.strip().lower(),))
    if not rows:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    account = rows[0]
    if not hmac.compare_digest(password_digest(credentials.password, account["password_salt"]), account["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    token = secrets.token_urlsafe(40)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    execute_dml("INSERT INTO USER_SESSION (token_hash, account_id, expires_at) VALUES (%s, %s, %s)",
                (hashlib.sha256(token.encode()).hexdigest(), account["account_id"], expires.isoformat()))
    return {"token": token, "user": user_payload(account)}

@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest):
    normalized_email = body.email.strip().lower()
    if not normalized_email or "@" not in normalized_email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required.")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)
        cursor.execute("SELECT account_id FROM USER_ACCOUNT WHERE LOWER(email) = %s", (normalized_email,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        cursor.execute("SELECT member_id FROM MEMBER WHERE LOWER(email) = %s", (normalized_email,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="A member with this email already exists.")

        mem_id = f"mem-{int(datetime.now().timestamp() * 1000)}"
        join_date = date.today().isoformat()
        member_type = body.memberType or "Student"
        cursor.execute("""
            INSERT INTO MEMBER (member_id, full_name, email, phone, member_type, join_date, status)
            VALUES (%s, %s, %s, %s, %s, %s, 'ACTIVE')
        """, (mem_id, body.name.strip(), normalized_email, body.phone or "", member_type, join_date))

        salt = secrets.token_hex(16)
        account_id = f"acct-{uuid.uuid4().hex}"
        cursor.execute("""
            INSERT INTO USER_ACCOUNT (account_id, email, role, entity_id, display_name, password_salt, password_hash, is_active)
            VALUES (%s, %s, 'member', %s, %s, %s, %s, 1)
        """, (account_id, normalized_email, mem_id, body.name.strip(), salt, password_digest(body.password, salt)))

        token = secrets.token_urlsafe(40)
        expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
        cursor.execute("""
            INSERT INTO USER_SESSION (token_hash, account_id, expires_at)
            VALUES (%s, %s, %s)
        """, (hashlib.sha256(token.encode()).hexdigest(), account_id, expires.isoformat()))

        conn.commit()
        cursor.close()

        account = {
            "account_id": account_id,
            "entity_id": mem_id,
            "display_name": body.name.strip(),
            "email": normalized_email,
            "role": "member"
        }
        return {"token": token, "user": user_payload(account)}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as ex:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(ex)}")
    finally:
        conn.close()

def session_user(request: Request) -> Optional[Dict[str, Any]]:
    return getattr(request.state, "user", None)

@app.get("/api/auth/me")
def get_current_user(request: Request):
    return user_payload(session_user(request))

@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request):
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    if token:
        execute_dml("DELETE FROM USER_SESSION WHERE token_hash = %s", (hashlib.sha256(token.encode()).hexdigest(),))
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.post("/api/auth/password", status_code=status.HTTP_204_NO_CONTENT)
def update_password(body: PasswordChangeRequest, request: Request):
    account = request.state.user
    if not hmac.compare_digest(password_digest(body.currentPassword, account["password_salt"]), account["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    salt = secrets.token_hex(16)
    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)
        cursor.execute("UPDATE USER_ACCOUNT SET password_salt = %s, password_hash = %s WHERE account_id = %s",
                       (salt, password_digest(body.newPassword, salt), account["account_id"]))
        token = request.headers.get("authorization", "").removeprefix("Bearer ")
        current_session = hashlib.sha256(token.encode()).hexdigest()
        cursor.execute("DELETE FROM USER_SESSION WHERE account_id = %s AND token_hash <> %s",
                       (account["account_id"], current_session))
        conn.commit()
        cursor.close()
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Could not update password.")
    finally:
        conn.close()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.middleware("http")
async def authenticate_and_authorize(request: Request, call_next):
    path = request.url.path
    if request.method == "OPTIONS":
        return await call_next(request)
    if not path.startswith("/api/") or path in ("/api/auth/login", "/api/auth/register", "/api/health") or path.startswith("/api/docs") or path == "/api/openapi.json":
        return await call_next(request)
    token = request.headers.get("authorization", "")
    if not token.startswith("Bearer "):
        return JSONResponse({"detail": "Authentication required."}, status_code=401)
    token_hash = hashlib.sha256(token[7:].encode()).hexdigest()
    accounts = execute_query("""SELECT a.* FROM USER_SESSION s JOIN USER_ACCOUNT a ON a.account_id = s.account_id
        WHERE s.token_hash = %s AND a.is_active = 1""", (token_hash,))
    if not accounts:
        return JSONResponse({"detail": "Session expired. Please sign in again."}, status_code=401)
    account = accounts[0]
    try:
        expires_at = datetime.fromisoformat(account.get("expires_at", ""))
    except ValueError:
        expires_at = None
    session_rows = execute_query("SELECT expires_at FROM USER_SESSION WHERE token_hash = %s", (token_hash,))
    try:
        expires_at = datetime.fromisoformat(session_rows[0]["expires_at"])
    except (IndexError, KeyError, ValueError):
        expires_at = None
    if not expires_at or expires_at <= datetime.now(timezone.utc):
        execute_dml("DELETE FROM USER_SESSION WHERE token_hash = %s", (token_hash,))
        return JSONResponse({"detail": "Session expired. Please sign in again."}, status_code=401)
    role = account["role"]
    method = request.method.upper()
    allowed_roles = None
    if path.endswith("/auth/me") or path.endswith("/auth/logout") or path.endswith("/auth/password") or path.endswith("/library/snapshot"):
        allowed_roles = {"admin", "librarian", "member"}
    elif path.endswith("/db/init"):
        allowed_roles = {"admin"}
    elif path.endswith("/members") and method == "POST":
        allowed_roles = {"admin", "librarian"}
    elif path.startswith("/api/members/") and path.endswith("/account") and method == "POST":
        allowed_roles = {"admin", "librarian"}
    elif "/reservations" in path:
        allowed_roles = {"admin", "librarian", "member"} if method == "POST" else {"admin", "librarian", "member"}
    elif "/fines/" in path:
        allowed_roles = {"admin", "librarian", "member"}
    elif method == "GET":
        allowed_roles = {"admin", "librarian", "member"}
    else:
        allowed_roles = {"admin", "librarian"}
    if role not in allowed_roles:
        return JSONResponse({"detail": "Your account does not have permission for this operation."}, status_code=403)
    request.state.user = account
    return await call_next(request)

create_auth_schema()


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
    authorIds: Optional[List[str]] = None
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
    password: str = Field(min_length=8)

class MemberAccountProvision(BaseModel):
    password: str = Field(min_length=8)

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
    if s == "READY": return "ready"
    if s == "FULFILLED": return "fulfilled"
    if s == "CANCELLED": return "cancelled"
    if s == "EXPIRED": return "cancelled"
    return status_db.lower()

def map_reservation_status_to_db(status_fe: str) -> str:
    s = (status_fe or "").lower()
    if s == "queued": return "PENDING"
    if s == "ready": return "READY"
    if s == "fulfilled": return "FULFILLED"
    if s == "cancelled": return "CANCELLED"
    return status_fe.upper()

def map_fine_status_to_fe(status_db: str) -> str:
    s = (status_db or "").upper()
    if s == "UNPAID": return "unpaid"
    if s == "PAID": return "paid"
    if s == "WAIVED": return "waived"
    return status_db.lower()

def map_fine_status_to_db(status_fe: str) -> str:
    s = (status_fe or "").lower()
    if s == "unpaid": return "UNPAID"
    if s == "paid": return "PAID"
    if s == "waived": return "WAIVED"
    return status_fe.upper()


# -----------------------------------------------------------------------------
# Core Snapshot Endpoint (Returns Entire Normalized Relational Database)
# -----------------------------------------------------------------------------
@app.get("/api/library/snapshot")
@app.get("/library/snapshot")
def get_library_snapshot(request: Request):
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
                "daysOverdue": max(0, round(amt / 10)) if f["fine_type"] == "OVERDUE" else 0,
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
        queue_positions: Dict[str, int] = {}
        for r in res_raw:
            position = 0
            if (r["status"] or "").upper() in ("PENDING", "READY"):
                position = queue_positions.get(r["book_id"], 0) + 1
                queue_positions[r["book_id"]] = position
            reservations.append({
                "id": r["reservation_id"],
                "bookId": r["book_id"],
                "memberId": r["member_id"],
                "placedAt": str(r["reserved_on"]),
                "expiresAt": str(r["expires_on"]),
                "status": map_reservation_status_to_fe(r["status"]),
                "queuePosition": position
            })

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

        snapshot = {
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
        user = session_user(request)
        if user["role"] == "member":
            member_id = user["entity_id"]
            snapshot["borrows"] = [item for item in borrows if item["memberId"] == member_id]
            snapshot["reservations"] = [item for item in reservations if item["memberId"] == member_id]
            snapshot["fines"] = [item for item in fines if item["memberId"] == member_id]
            snapshot["members"] = [item for item in members if item["id"] == member_id]
            snapshot["librarians"] = []
            snapshot["activity"] = []
        return snapshot

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
    author_ids = updates_dict.pop("authorIds", None)

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

    if not db_fields and author_ids is None:
        return {"status": "no change"}

    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)
        cursor.execute("SELECT book_id FROM BOOK WHERE book_id = %s", (book_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Book not found.")
        if db_fields:
            params.append(book_id)
            cursor.execute(f"UPDATE BOOK SET {', '.join(db_fields)} WHERE book_id = %s", tuple(params))
        if author_ids is not None:
            for author_id in author_ids:
                cursor.execute("SELECT author_id FROM AUTHOR WHERE author_id = %s", (author_id,))
                if not cursor.fetchone():
                    raise HTTPException(status_code=400, detail=f"Author ID '{author_id}' does not exist.")
            cursor.execute("DELETE FROM BOOK_AUTHOR WHERE book_id = %s", (book_id,))
            for order, author_id in enumerate(author_ids, start=1):
                cursor.execute("INSERT INTO BOOK_AUTHOR (book_id, author_id, author_order) VALUES (%s, %s, %s)", (book_id, author_id, order))
        conn.commit()
        cursor.close()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as ex:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update book: {str(ex)}")
    finally:
        conn.close()

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
    target_status = body.status.lower()
    if target_status not in {"available", "repair", "lost"}:
        raise HTTPException(status_code=400, detail="A copy's loan state can only change through issue and return.")
    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)
        cursor.execute("SELECT status FROM BOOK_COPY WHERE copy_id = %s", (copy_id,))
        copy = cursor.fetchone()
        if not copy:
            raise HTTPException(status_code=404, detail="Book copy not found.")
        cursor.execute("SELECT borrow_id FROM BORROW WHERE copy_id = %s AND return_date IS NULL", (copy_id,))
        active_loan = cursor.fetchone()
        if copy["status"] == "ON_LOAN" or active_loan:
            raise HTTPException(status_code=409, detail="Return the active loan before changing this copy's condition.")
        cursor.execute("UPDATE BOOK_COPY SET status = %s WHERE copy_id = %s", (map_copy_status_to_db(target_status), copy_id))
        conn.commit()
        cursor.close()
        return {"id": copy_id, "status": target_status}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as ex:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update copy status: {str(ex)}")
    finally:
        conn.close()


# -----------------------------------------------------------------------------
# Members Endpoints
# -----------------------------------------------------------------------------
@app.post("/api/members", status_code=status.HTTP_201_CREATED)
@app.post("/members", status_code=status.HTTP_201_CREATED)
def create_member(member: MemberCreate):
    mem_id = f"mem-{int(datetime.now().timestamp() * 1000)}"
    db_status = "ACTIVE" if (member.status or "Active").lower() == "active" else "SUSPENDED"

    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)
        normalized_email = member.email.strip().lower()
        cursor.execute("""
            INSERT INTO MEMBER (member_id, full_name, email, phone, member_type, join_date, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            mem_id, member.name, normalized_email, member.phone or "",
            member.memberType or "Student", date.today(), db_status
        ))
        salt = secrets.token_hex(16)
        cursor.execute("""INSERT INTO USER_ACCOUNT
            (account_id, email, role, entity_id, display_name, password_salt, password_hash, is_active)
            VALUES (%s, %s, 'member', %s, %s, %s, %s, 1)""",
            (f"acct-{uuid.uuid4().hex}", normalized_email, mem_id, member.name, salt, password_digest(member.password, salt)))
        conn.commit()
        cursor.close()
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
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create member: {str(ex)}")
    finally:
        conn.close()


@app.post("/api/members/{member_id}/account")
def provision_member_account(member_id: str, body: MemberAccountProvision):
    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)
        cursor.execute("SELECT member_id, full_name, email FROM MEMBER WHERE member_id = %s", (member_id,))
        member = cursor.fetchone()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found.")
        cursor.execute("SELECT account_id, entity_id FROM USER_ACCOUNT WHERE LOWER(email) = %s", (member["email"].lower(),))
        existing = cursor.fetchone()
        if existing and existing["entity_id"] != member_id:
            raise HTTPException(status_code=409, detail="This email belongs to another account.")
        salt = secrets.token_hex(16)
        digest = password_digest(body.password, salt)
        if existing:
            cursor.execute("UPDATE USER_ACCOUNT SET password_salt = %s, password_hash = %s, display_name = %s, is_active = 1 WHERE account_id = %s",
                           (salt, digest, member["full_name"], existing["account_id"]))
            cursor.execute("DELETE FROM USER_SESSION WHERE account_id = %s", (existing["account_id"],))
        else:
            cursor.execute("""INSERT INTO USER_ACCOUNT
                (account_id, email, role, entity_id, display_name, password_salt, password_hash, is_active)
                VALUES (%s, %s, 'member', %s, %s, %s, %s, 1)""",
                (f"acct-{uuid.uuid4().hex}", member["email"].lower(), member_id, member["full_name"], salt, digest))
        conn.commit()
        cursor.close()
        return {"memberId": member_id, "email": member["email"], "loginEnabled": True}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as ex:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Could not provision member sign-in: {str(ex)}")
    finally:
        conn.close()

# -----------------------------------------------------------------------------
# Circulation (Borrow & Return) Endpoints with Core Business Logic
# -----------------------------------------------------------------------------
@app.post("/api/borrows", status_code=status.HTTP_201_CREATED)
@app.post("/borrows", status_code=status.HTTP_201_CREATED)
def issue_borrow(borrow_in: BorrowCreate, request: Request):
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
        """, (borrow_id, borrow_in.memberId, borrow_in.copyId, request.state.user["entity_id"], borrow_date, due_date))

        # 6. Update copy status to ON_LOAN
        cursor.execute("UPDATE BOOK_COPY SET status = 'ON_LOAN' WHERE copy_id = %s", (borrow_in.copyId,))

        conn.commit()
        cursor.close()

        return {
            "id": borrow_id,
            "copyId": borrow_in.copyId,
            "memberId": borrow_in.memberId,
            "issuedBy": request.state.user["entity_id"],
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
def return_borrow(borrow_id: str, return_in: ReturnBorrowRequest, request: Request):
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
        """, (return_date, request.state.user["entity_id"], borrow_id))

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
            "receivedBy": request.state.user["entity_id"],
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
def create_reservation(res_in: ReservationCreate, request: Request):
    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)

        member_id = request.state.user["entity_id"] if request.state.user["role"] == "member" else res_in.memberId
        # Validate member
        cursor.execute("SELECT status FROM MEMBER WHERE member_id = %s", (member_id,))
        mem = cursor.fetchone()
        if not mem:
            raise HTTPException(status_code=404, detail="Member not found.")
        if (mem["status"] or "").upper() != "ACTIVE":
            raise BusinessRuleViolation("Only active members can place reservations.")

        # Compute dates
        res_date, exp_date = validate_reservation_dates(date.today())

        # Queue position calculation
        cursor.execute("SELECT COUNT(*) AS q_count FROM RESERVATION WHERE book_id = %s AND status IN ('PENDING', 'READY')", (res_in.bookId,))
        q_pos = cursor.fetchone()["q_count"] + 1

        res_id = f"res-{int(datetime.now().timestamp() * 1000)}"
        cursor.execute("""
            INSERT INTO RESERVATION (reservation_id, member_id, book_id, reserved_on, expires_on, status)
            VALUES (%s, %s, %s, %s, %s, 'PENDING')
        """, (res_id, member_id, res_in.bookId, res_date, exp_date))

        conn.commit()
        cursor.close()

        return {
            "id": res_id,
            "bookId": res_in.bookId,
            "memberId": member_id,
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
def update_reservation_status(res_id: str, body: ReservationStatusUpdate, request: Request):
    target = body.status.lower()
    if target not in {"queued", "ready", "fulfilled", "cancelled"}:
        raise HTTPException(status_code=400, detail="Unsupported reservation status.")
    current = execute_query("SELECT member_id, status FROM RESERVATION WHERE reservation_id = %s", (res_id,))
    if not current:
        raise HTTPException(status_code=404, detail="Reservation not found.")
    old_status = current[0]["status"].upper()
    if request.state.user["role"] == "member":
        if current[0]["member_id"] != request.state.user["entity_id"]:
            raise HTTPException(status_code=404, detail="Reservation not found.")
        if target != "cancelled":
            raise HTTPException(status_code=403, detail="Members may only cancel their own reservation.")
    allowed = {"PENDING": {"READY", "FULFILLED", "CANCELLED"}, "READY": {"PENDING", "FULFILLED", "CANCELLED"}}
    db_status = map_reservation_status_to_db(body.status)
    if db_status == old_status:
        return {"id": res_id, "status": map_reservation_status_to_fe(old_status)}
    if db_status not in allowed.get(old_status, set()):
        raise HTTPException(status_code=400, detail="This reservation can no longer change status.")
    affected = execute_dml("UPDATE RESERVATION SET status = %s WHERE reservation_id = %s", (db_status, res_id))
    if affected == 0:
        raise HTTPException(status_code=404, detail="Reservation not found.")
    return {"id": res_id, "status": body.status}


# -----------------------------------------------------------------------------
# Fines Endpoints
# -----------------------------------------------------------------------------
@app.patch("/api/fines/{fine_id}")
@app.patch("/fines/{fine_id}")
def update_fine_status(fine_id: str, body: FineStatusUpdate, request: Request):
    conn = get_connection()
    try:
        cursor = get_dict_cursor(conn)
        cursor.execute("SELECT * FROM FINE WHERE fine_id = %s", (fine_id,))
        fine = cursor.fetchone()
        if not fine:
            raise HTTPException(status_code=404, detail="Fine not found.")

        if request.state.user["role"] == "member":
            cursor.execute("SELECT member_id FROM BORROW WHERE borrow_id = %s", (fine["borrow_id"],))
            borrow_owner = cursor.fetchone()
            if not borrow_owner or borrow_owner["member_id"] != request.state.user["entity_id"]:
                raise HTTPException(status_code=404, detail="Fine not found.")
            if body.status != "paid":
                raise HTTPException(status_code=403, detail="Members may only pay their own outstanding fines.")

        target_status = map_fine_status_to_db(body.status)
        if target_status not in ("PAID", "WAIVED"):
            raise HTTPException(status_code=400, detail="Fine status must be paid or waived.")
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
