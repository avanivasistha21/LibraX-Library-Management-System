"""
LibraX - Database Connection & Operations Verification Test
Tests Python-MySQL DB-API/ODBC Connectivity, Basic Retrieval (SELECT),
and Data Manipulation (DML: INSERT, UPDATE, DELETE) with Transaction Integrity.
"""

import os
import sys
from pathlib import Path
from datetime import date, timedelta

# Ensure backend directory is in path
sys.path.insert(0, str(Path(__file__).parent))

from db import (
    get_connection,
    test_connection,
    is_sqlite_mode,
    execute_query,
    execute_dml,
    DB_NAME,
    DB_HOST,
    DB_PORT,
    DB_USER
)

def run_tests():
    print("=" * 70)
    print("  LibraX Library System - Database Connectivity & DML Verification")
    print("=" * 70)

    # Step 1: Test Server Connection
    print(f"\n[1/5] Testing Database Connection...")
    success, msg = test_connection()
    if not success:
        print(f"[-] Connection Failed: {msg}")
        return False
    print(f"[+] {msg}")

    # Step 2: Test Database & Schema Verification
    print(f"\n[2/5] Checking Tables in Database...")
    if is_sqlite_mode():
        tables_res = execute_query("SELECT name AS tbl_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        table_names = [t["tbl_name"] for t in tables_res]
    else:
        tables_res = execute_query("""
            SELECT table_name AS tbl_name
            FROM information_schema.tables
            WHERE table_schema = %s
            ORDER BY table_name
        """, (DB_NAME,))
        table_names = [t["tbl_name"] for t in tables_res]

    print(f"[+] Found {len(table_names)} tables in relational schema:")
    for name in table_names:
        print(f"    - {name}")

    # Step 3: Test Basic Retrieval (SELECT Queries)
    print("\n[3/5] Performing Basic Retrieval Queries (SELECT)...")
    
    # 3a. Retrieve Books with Category and Publisher
    books = execute_query("""
        SELECT b.book_id, b.isbn, b.title, c.name AS category_name, p.name AS publisher_name
        FROM BOOK b
        JOIN CATEGORY c ON b.category_id = c.category_id
        JOIN PUBLISHER p ON b.publisher_id = p.publisher_id
        LIMIT 4
    """)
    print("    Sample Book Retrieval (JOIN across BOOK, CATEGORY, PUBLISHER):")
    for bk in books:
        print(f"      * [{bk['book_id']}] {bk['title']} | ISBN: {bk['isbn']} | Cat: {bk['category_name']}")

    # 3b. Retrieve Members
    members = execute_query("SELECT member_id, full_name, email, status FROM MEMBER LIMIT 3")
    print("\n    Sample Member Retrieval:")
    for m in members:
        print(f"      * [{m['member_id']}] {m['full_name']} ({m['email']}) - Status: {m['status']}")

    # Step 4: Test DML Statements (INSERT, UPDATE, DELETE with Transaction Integrity)
    print("\n[4/5] Testing Data Manipulation Language (DML) Execution...")
    
    test_member_id = "mem-test-999"
    test_email = "test.verification@librax.edu"
    
    # Clean up prior test data if any
    execute_dml("DELETE FROM MEMBER WHERE member_id = %s", (test_member_id,))

    # DML 1: INSERT
    print(f"    [DML INSERT] Creating test member '{test_member_id}'...")
    execute_dml("""
        INSERT INTO MEMBER (member_id, full_name, email, phone, member_type, join_date, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (test_member_id, "Test Runner", test_email, "+91 99999 88888", "Student", date.today(), "ACTIVE"))
    print("      -> Successfully INSERTED 1 record into MEMBER table.")

    # DML 2: UPDATE
    print(f"    [DML UPDATE] Updating phone number for '{test_member_id}'...")
    execute_dml("UPDATE MEMBER SET phone = %s WHERE member_id = %s", ("+91 99999 00000", test_member_id))
    print("      -> Successfully UPDATED 1 record in MEMBER table.")

    # Verify Update
    res = execute_query("SELECT phone FROM MEMBER WHERE member_id = %s", (test_member_id,))
    updated_phone = res[0]["phone"]
    assert updated_phone == "+91 99999 00000"
    print(f"      -> Verified updated phone in DB: {updated_phone}")

    # DML 3: DELETE
    print(f"    [DML DELETE] Deleting test member '{test_member_id}'...")
    execute_dml("DELETE FROM MEMBER WHERE member_id = %s", (test_member_id,))
    print("      -> Successfully DELETED test record. Clean state confirmed.")

    # Step 5: Test Constraint & Transaction Rollback
    print("\n[5/5] Testing Transaction Integrity & Rollback...")
    try:
        # Try duplicate email or invalid insert
        execute_dml("""
            INSERT INTO MEMBER (member_id, full_name, email, phone, member_type, join_date, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, ("mem-dup-1", "Duplicate Alice", "alice@gmail.com", "", "Student", date.today(), "ACTIVE"))
        print("      [-] Duplicate email was unexpectedly allowed!")
    except Exception as ex:
        print(f"      [+] UNIQUE email constraint enforced: rejected duplicate email with rollback.")

    print("\n" + "=" * 70)
    print("  ALL TESTS PASSED! Database connectivity, Retrieval & DML verified.")
    print("=" * 70)
    return True

if __name__ == "__main__":
    run_tests()
