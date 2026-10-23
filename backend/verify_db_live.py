"""
LibraX Live Database Inspector
Use this script to demonstrate that actions in the frontend (adding a member,
issuing a loan, adding a book, etc.) directly update the database in real-time.
"""

import sys
import time
from datetime import datetime
from db import execute_query, is_sqlite_mode, DB_NAME, DB_HOST, DB_USER

def print_separator():
    print("=" * 80)

def show_recent_members(limit=10):
    print("\n--- [TABLE: MEMBER] Most Recent Members in Database ---")
    rows = execute_query(f"""
        SELECT member_id, full_name, email, member_type, status, join_date
        FROM MEMBER
        ORDER BY member_id DESC
        LIMIT {limit}
    """)
    print(f"{'Member ID':<22} | {'Full Name':<20} | {'Email':<25} | {'Type':<8} | {'Status':<8}")
    print("-" * 80)
    for r in rows:
        print(f"{r['member_id']:<22} | {r['full_name'][:20]:<20} | {r['email'][:25]:<25} | {r['member_type']:<8} | {r['status']:<8}")
    print(f"Total shown: {len(rows)}")

def show_recent_borrows(limit=8):
    print("\n--- [TABLE: BORROW] Active & Recent Loans ---")
    rows = execute_query(f"""
        SELECT b.borrow_id, m.full_name, b.copy_id, b.borrow_date, b.due_date, b.return_date
        FROM BORROW b
        JOIN MEMBER m ON b.member_id = m.member_id
        ORDER BY b.borrow_date DESC, b.borrow_id DESC
        LIMIT {limit}
    """)
    print(f"{'Borrow ID':<22} | {'Member Name':<18} | {'Copy ID':<10} | {'Borrow Date':<11} | {'Return Date':<11}")
    print("-" * 80)
    for r in rows:
        ret = str(r['return_date']) if r['return_date'] else "ACTIVE LOAN"
        print(f"{r['borrow_id']:<22} | {r['full_name'][:18]:<18} | {r['copy_id']:<10} | {str(r['borrow_date']):<11} | {ret:<11}")

def show_recent_books(limit=5):
    print("\n--- [TABLE: BOOK] Books in Catalogue ---")
    rows = execute_query(f"""
        SELECT b.book_id, b.title, b.isbn, p.name AS publisher, c.name AS category
        FROM BOOK b
        JOIN PUBLISHER p ON b.publisher_id = p.publisher_id
        JOIN CATEGORY c ON b.category_id = c.category_id
        ORDER BY b.book_id DESC
        LIMIT {limit}
    """)
    print(f"{'Book ID':<22} | {'Title':<28} | {'ISBN':<15} | {'Category':<15}")
    print("-" * 80)
    for r in rows:
        print(f"{r['book_id']:<22} | {r['title'][:28]:<28} | {r['isbn']:<15} | {r['category'][:15]}")

def main():
    watch_mode = "--watch" in sys.argv or "-w" in sys.argv
    
    while True:
        if watch_mode:
            # Clear console screen for clean live monitoring
            print("\033[H\033[J", end="")

        print_separator()
        print("  LibraX Live Database Inspector (Phase 2 Verification)")
        if is_sqlite_mode():
            print("  Active Database: Local Relational DB (librax_fallback.db)")
        else:
            print(f"  Active Database: MySQL {DB_NAME} on {DB_HOST} (User: {DB_USER})")
        print(f"  Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        if watch_mode:
            print("  [LIVE MONITORING MODE: Auto-refreshing every 2s (Press Ctrl+C to stop)]")
        print_separator()

        show_recent_members()
        show_recent_borrows()
        show_recent_books()

        print_separator()
        if not watch_mode:
            print("Tip: Run in watch mode to see live changes while clicking in the UI:")
            print("     Command: py verify_db_live.py --watch")
            print_separator()
            break
        else:
            time.sleep(2)

if __name__ == "__main__":
    main()
