import os
import sys
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()
except ImportError:
    pass

import mysql.connector
from mysql.connector import errorcode, pooling

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "librax_db")
USE_FALLBACK = os.getenv("USE_SQLITE_FALLBACK", "auto") # "true", "false", "auto"

_pool: Optional[pooling.MySQLConnectionPool] = None
_using_sqlite: bool = False
SQLITE_DB_PATH = Path(__file__).parent / "database" / "librax_fallback.db"

def get_db_config(include_database: bool = True) -> Dict[str, Any]:
    cfg: Dict[str, Any] = {
        "host": DB_HOST,
        "port": DB_PORT,
        "user": DB_USER,
        "password": DB_PASSWORD,
        "charset": "utf8mb4",
        "autocommit": False,
    }
    if include_database:
        cfg["database"] = DB_NAME
    return cfg

def can_connect_mysql() -> bool:
    try:
        conn = mysql.connector.connect(**get_db_config(include_database=False))
        conn.close()
        return True
    except Exception:
        return False

def init_connection_pool() -> Optional[pooling.MySQLConnectionPool]:
    global _pool
    if _pool is not None:
        return _pool
    try:
        _pool = pooling.MySQLConnectionPool(
            pool_name="librax_pool",
            pool_size=5,
            pool_reset_session=True,
            **get_db_config(include_database=True)
        )
        return _pool
    except Exception:
        return None

def get_connection():
    """
    Returns a database connection.
    Priority: MySQL pool -> direct MySQL -> SQLite fallback.
    This is the primary DB-API / ODBC-equivalent entry point used by all endpoints.
    """
    if is_sqlite_mode():
        SQLITE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(SQLITE_DB_PATH))
        conn.row_factory = sqlite3.Row
        return conn

    # Try pool first
    pool = init_connection_pool()
    if pool is not None:
        try:
            return pool.get_connection()
        except Exception:
            pass

    # Direct connection fallback
    try:
        return mysql.connector.connect(**get_db_config(include_database=True))
    except mysql.connector.Error:
        # If MySQL is unreachable, fall back to SQLite
        global _using_sqlite
        _using_sqlite = True
        SQLITE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(SQLITE_DB_PATH))
        conn.row_factory = sqlite3.Row
        return conn


def is_sqlite_mode() -> bool:
    global _using_sqlite
    if USE_FALLBACK.lower() == "true":
        return True
    if USE_FALLBACK.lower() == "false":
        return False
    if _using_sqlite:
        return True
    if not can_connect_mysql():
        _using_sqlite = True
        return True
    return False

class UniversalCursor:
    """Cursor that normalizes MySQL dictionary cursor and SQLite row cursor."""
    def __init__(self, conn):
        self.conn = conn
        self.is_sqlite = is_sqlite_mode()
        if self.is_sqlite:
            self.cursor = conn.cursor()
        else:
            self.cursor = conn.cursor(dictionary=True)

    def execute(self, query: str, params: Optional[Tuple[Any, ...]] = None):
        if self.is_sqlite:
            q = query.replace("%s", "?").replace("FOR UPDATE", "")
            return self.cursor.execute(q, params or ())
        return self.cursor.execute(query, params or ())

    def fetchone(self) -> Optional[Dict[str, Any]]:
        row = self.cursor.fetchone()
        if row is None:
            return None
        if self.is_sqlite:
            return dict(row)
        return row

    def fetchall(self) -> List[Dict[str, Any]]:
        rows = self.cursor.fetchall()
        if self.is_sqlite:
            return [dict(r) for r in rows]
        return rows

    def close(self):
        self.cursor.close()

def get_dict_cursor(conn):
    return UniversalCursor(conn)

def execute_query(query: str, params: Optional[Tuple[Any, ...]] = None) -> List[Dict[str, Any]]:
    """Executes a SELECT query and returns rows as dictionaries."""
    conn = get_connection()
    try:
        if is_sqlite_mode():
            # Convert %s placeholder to ? for sqlite if needed
            q = query.replace("%s", "?")
            cursor = conn.cursor()
            cursor.execute(q, params or ())
            rows = [dict(row) for row in cursor.fetchall()]
            cursor.close()
            return rows
        else:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(query, params or ())
            results = cursor.fetchall()
            cursor.close()
            return results
    finally:
        conn.close()

def execute_dml(query: str, params: Optional[Tuple[Any, ...]] = None) -> int:
    """Executes an INSERT/UPDATE/DELETE query and commits."""
    conn = get_connection()
    try:
        if is_sqlite_mode():
            q = query.replace("%s", "?")
            cursor = conn.cursor()
            cursor.execute(q, params or ())
            conn.commit()
            affected = cursor.rowcount
            cursor.close()
            return affected
        else:
            cursor = conn.cursor()
            cursor.execute(query, params or ())
            conn.commit()
            affected = cursor.rowcount
            cursor.close()
            return affected
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def test_connection() -> Tuple[bool, str]:
    """Tests the active database connection."""
    if is_sqlite_mode():
        return True, f"Connected to Local Relational Fallback DB (SQLite 3.x) at {SQLITE_DB_PATH.name} (MySQL credentials pending in .env)"
    try:
        conn = mysql.connector.connect(**get_db_config(include_database=False))
        cursor = conn.cursor()
        cursor.execute("SELECT VERSION()")
        ver = cursor.fetchone()
        cursor.close()
        conn.close()
        return True, f"Connected to MySQL {ver[0]} at {DB_HOST}:{DB_PORT} as user '{DB_USER}'"
    except mysql.connector.Error as err:
        return False, f"MySQL Error [{err.errno}]: {err.msg}"
    except Exception as ex:
        return False, str(ex)

def setup_database_schema(ddl_path: Optional[str] = None, dml_path: Optional[str] = None) -> Tuple[bool, str]:
    """Executes schema_ddl.sql and data_dml.sql to initialize or re-initialize the database."""
    base_dir = Path(__file__).parent / "database"
    ddl_file = Path(ddl_path) if ddl_path else base_dir / "schema_ddl.sql"
    dml_file = Path(dml_path) if dml_path else base_dir / "data_dml.sql"

    if is_sqlite_mode():
        # Setup SQLite schema & seed
        return setup_sqlite_schema(ddl_file, dml_file)

    try:
        conn = mysql.connector.connect(**get_db_config(include_database=False))
        cursor = conn.cursor()

        if ddl_file.exists():
            with open(ddl_file, "r", encoding="utf-8") as f:
                ddl_sql = f.read()
            for statement in ddl_sql.split(";"):
                stmt = statement.strip()
                if stmt:
                    cursor.execute(stmt)
            conn.commit()

        if dml_file.exists():
            with open(dml_file, "r", encoding="utf-8") as f:
                dml_sql = f.read()
            for statement in dml_sql.split(";"):
                stmt = statement.strip()
                if stmt:
                    cursor.execute(stmt)
            conn.commit()

        cursor.close()
        conn.close()
        return True, "MySQL database initialized and populated successfully!"
    except Exception as ex:
        return False, f"Initialization failed: {ex}"

def setup_sqlite_schema(ddl_file: Path, dml_file: Path) -> Tuple[bool, str]:
    try:
        SQLITE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        if SQLITE_DB_PATH.exists():
            SQLITE_DB_PATH.unlink()
        conn = sqlite3.connect(str(SQLITE_DB_PATH))
        cursor = conn.cursor()

        # DDL for SQLite
        sqlite_ddl = """
        CREATE TABLE IF NOT EXISTS PUBLISHER (
            publisher_id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            city TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS CATEGORY (
            category_id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS AUTHOR (
            author_id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            country TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS BOOK (
            book_id TEXT PRIMARY KEY,
            isbn TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            edition TEXT,
            publication_year INTEGER,
            pages INTEGER,
            language TEXT DEFAULT 'English',
            description TEXT,
            cover_tone TEXT DEFAULT '#B9563E',
            publisher_id TEXT NOT NULL REFERENCES PUBLISHER(publisher_id),
            category_id TEXT NOT NULL REFERENCES CATEGORY(category_id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS BOOK_AUTHOR (
            book_id TEXT NOT NULL REFERENCES BOOK(book_id) ON DELETE CASCADE,
            author_id TEXT NOT NULL REFERENCES AUTHOR(author_id) ON DELETE CASCADE,
            author_order INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (book_id, author_id)
        );
        CREATE TABLE IF NOT EXISTS BOOK_COPY (
            copy_id TEXT PRIMARY KEY,
            book_id TEXT NOT NULL REFERENCES BOOK(book_id) ON DELETE CASCADE,
            shelf_location TEXT,
            status TEXT NOT NULL DEFAULT 'AVAILABLE',
            acquired_on DATE NOT NULL
        );
        CREATE TABLE IF NOT EXISTS MEMBER (
            member_id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            member_type TEXT DEFAULT 'Student',
            join_date DATE NOT NULL,
            status TEXT NOT NULL DEFAULT 'ACTIVE'
        );
        CREATE TABLE IF NOT EXISTS LIBRARIAN (
            librarian_id TEXT PRIMARY KEY,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            hired_on DATE,
            role TEXT DEFAULT 'Librarian',
            shift TEXT DEFAULT '09:00-17:00'
        );
        CREATE TABLE IF NOT EXISTS BORROW (
            borrow_id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL REFERENCES MEMBER(member_id),
            copy_id TEXT NOT NULL REFERENCES BOOK_COPY(copy_id),
            issued_by TEXT NOT NULL REFERENCES LIBRARIAN(librarian_id),
            received_by TEXT REFERENCES LIBRARIAN(librarian_id),
            borrow_date DATE NOT NULL,
            due_date DATE NOT NULL,
            return_date DATE
        );
        CREATE TABLE IF NOT EXISTS RESERVATION (
            reservation_id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL REFERENCES MEMBER(member_id) ON DELETE CASCADE,
            book_id TEXT NOT NULL REFERENCES BOOK(book_id) ON DELETE CASCADE,
            reserved_on DATE NOT NULL,
            expires_on DATE NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING'
        );
        CREATE TABLE IF NOT EXISTS FINE (
            fine_id TEXT PRIMARY KEY,
            borrow_id TEXT NOT NULL REFERENCES BORROW(borrow_id) ON DELETE CASCADE,
            fine_type TEXT NOT NULL DEFAULT 'OVERDUE',
            amount REAL NOT NULL DEFAULT 0.0,
            fine_date DATE NOT NULL,
            paid_date DATE,
            status TEXT NOT NULL DEFAULT 'UNPAID'
        );
        """
        cursor.executescript(sqlite_ddl)

        # Populate SQLite using DML statements (converting ON DUPLICATE KEY UPDATE to OR REPLACE)
        if dml_file.exists():
            with open(dml_file, "r", encoding="utf-8") as f:
                dml_sql = f.read()
            for statement in dml_sql.split(";"):
                stmt = statement.strip()
                if not stmt or stmt.upper().startswith("USE "):
                    continue
                # Replace MySQL ON DUPLICATE KEY UPDATE with INSERT OR REPLACE for SQLite
                if "ON DUPLICATE KEY UPDATE" in stmt.upper():
                    stmt = stmt.split("ON DUPLICATE KEY UPDATE")[0].strip()
                    stmt = stmt.replace("INSERT INTO", "INSERT OR REPLACE INTO")
                try:
                    cursor.execute(stmt)
                except Exception as e:
                    pass
            conn.commit()

        cursor.close()
        conn.close()
        return True, "Fallback relational database initialized and seeded successfully!"
    except Exception as ex:
        return False, f"Fallback database initialization error: {ex}"
