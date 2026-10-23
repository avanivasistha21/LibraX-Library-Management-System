

USE librax_db;


-- 1. POPULATE PUBLISHER

INSERT INTO PUBLISHER (publisher_id, name, city) VALUES
('pub-001', 'Faber & Faber', 'London'),
('pub-002', 'Penguin Classics', 'New Delhi'),
('pub-003', 'Vintage Books', 'New York'),
('pub-004', 'HarperCollins', 'London'),
('pub-005', 'Pearson Education', 'London'),
('pub-006', 'McGraw Hill', 'New York'),
('pub-007', 'Wiley', 'Hoboken')
ON DUPLICATE KEY UPDATE name=VALUES(name), city=VALUES(city);


-- 2. POPULATE CATEGORY

INSERT INTO CATEGORY (category_id, name, description) VALUES
('cat-001', 'Literary Fiction', 'Novels, drama and narrative masterworks'),
('cat-002', 'Science Fiction', 'Speculative fiction, space exploration, and futuristic works'),
('cat-003', 'Essays & Criticism', 'Literary criticism, philosophical essays, and social theory'),
('cat-004', 'Computer Science', 'Algorithms, systems, database management, and computing'),
('cat-005', 'Networking', 'Communication networks, protocols, and architecture'),
('cat-006', 'History', 'Historical treatises, biographical accounts, and chronicles')
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description);


-- 3. POPULATE AUTHOR

INSERT INTO AUTHOR (author_id, full_name, country) VALUES
('aut-001', 'Ursula K. Le Guin', 'United States'),
('aut-002', 'James Baldwin', 'United States'),
('aut-003', 'Octavia E. Butler', 'United States'),
('aut-004', 'Italo Calvino', 'Italy'),
('aut-005', 'Virginia Woolf', 'United Kingdom'),
('aut-006', 'John Smith', 'United Kingdom'),
('aut-007', 'Mary Lee', 'Canada'),
('aut-008', 'Andrew Tan', 'Singapore'),
('aut-009', 'David Kim', 'South Korea'),
('aut-010', 'Robert Brown', 'United States')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), country=VALUES(country);


-- 4. POPULATE BOOK

INSERT INTO BOOK (book_id, isbn, title, edition, publication_year, pages, language, description, cover_tone, publisher_id, category_id) VALUES
('book-001', '978-0571200535', 'A Room of One’s Own', '1st Edition', 1929, 112, 'English', 'A landmark extended essay on women, writing, and the conditions required for creative work.', '#C69D8A', 'pub-001', 'cat-001'),
('book-002', '978-0141185064', 'The Left Hand of Darkness', 'Classic Edition', 1969, 304, 'English', 'An ambassador travels to a world whose people are ambisexual, upending every assumption about politics and intimacy.', '#7E9E9A', 'pub-002', 'cat-002'),
('book-003', '978-0374521513', 'The Fire Next Time', 'Centenary Edition', 1963, 128, 'English', 'James Baldwin’s bracing, intimate meditation on race, religion, and the American promise.', '#C78B5A', 'pub-003', 'cat-003'),
('book-004', '978-1538732182', 'Kindred', 'Illustrated Edition', 1979, 288, 'English', 'A young Black woman is pulled through time into the life of a slaveholding ancestor.', '#8C6C78', 'pub-004', 'cat-002'),
('book-005', '978-0099283621', 'Invisible Cities', 'Revised Edition', 1972, 165, 'English', 'A luminous series of imagined conversations about cities, memory, desire, and the stories we tell about place.', '#D4AF63', 'pub-001', 'cat-001'),
('book-006', '978-0141182803', 'The Waves', 'Standard Edition', 1931, 177, 'English', 'Six interior voices meet in a lyrical novel about time, identity, and friendship.', '#7791AA', 'pub-002', 'cat-001'),
('book-007', '978-0807083697', 'Parable of the Sower', '1st Edition', 1993, 345, 'English', 'In a near-future California, a young woman walks north with a radical vision for survival.', '#B87058', 'pub-003', 'cat-002'),
('book-008', '978-0141182575', 'The Complete Essays', 'Library Edition', 2019, 864, 'English', 'A broad selection of Baldwin’s essays, criticism, and cultural writing across four decades.', '#789C86', 'pub-002', 'cat-003'),
('B001', '9780000000001', 'DBMS Fundamentals', '7th Edition', 2021, 620, 'English', 'Core principles of database design, relational algebra, and SQL transactions.', '#B9563E', 'pub-005', 'cat-004'),
('B002', '9780000000002', 'Operating Systems', '10th Edition', 2020, 580, 'English', 'Process scheduling, concurrency, virtual memory, and storage management.', '#4B6D82', 'pub-006', 'cat-004'),
('B003', '9780000000003', 'Data Structures', '3rd Edition', 2022, 510, 'English', 'Fundamental data structures and algorithm analysis in modern software engineering.', '#667A62', 'pub-005', 'cat-004'),
('B004', '9780000000004', 'Computer Networks', '5th Edition', 2019, 740, 'English', 'Network architecture, routing protocols, and transport layer security.', '#7E6A98', 'pub-007', 'cat-005')
ON DUPLICATE KEY UPDATE title=VALUES(title), edition=VALUES(edition), publication_year=VALUES(publication_year);


-- 5. POPULATE BOOK_AUTHOR

INSERT INTO BOOK_AUTHOR (book_id, author_id, author_order) VALUES
('book-001', 'aut-005', 1),
('book-002', 'aut-001', 1),
('book-003', 'aut-002', 1),
('book-004', 'aut-003', 1),
('book-005', 'aut-004', 1),
('book-006', 'aut-005', 1),
('book-007', 'aut-003', 1),
('book-008', 'aut-002', 1),
('B001', 'aut-006', 1),
('B001', 'aut-007', 2),
('B002', 'aut-008', 1),
('B003', 'aut-006', 1),
('B003', 'aut-009', 2),
('B004', 'aut-010', 1)
ON DUPLICATE KEY UPDATE author_order=VALUES(author_order);


-- 6. POPULATE BOOK_COPY

INSERT INTO BOOK_COPY (copy_id, book_id, shelf_location, status, acquired_on) VALUES
('copy-001', 'book-001', 'A / 02 / 14', 'AVAILABLE', '2025-01-07'),
('copy-002', 'book-001', 'A / 02 / 14', 'ON_LOAN',   '2025-01-07'),
('copy-003', 'book-002', 'B / 04 / 07', 'AVAILABLE', '2025-01-13'),
('copy-004', 'book-002', 'B / 04 / 07', 'ON_LOAN',   '2025-01-13'),
('copy-005', 'book-003', 'C / 01 / 09', 'AVAILABLE', '2025-01-22'),
('copy-006', 'book-004', 'B / 04 / 12', 'ON_LOAN',   '2025-02-04'),
('copy-007', 'book-005', 'A / 03 / 03', 'AVAILABLE', '2025-02-10'),
('copy-008', 'book-006', 'A / 02 / 18', 'DAMAGED',   '2025-02-15'),
('copy-009', 'book-007', 'B / 04 / 20', 'ON_LOAN',   '2025-02-24'),
('copy-010', 'book-008', 'C / 01 / 14', 'AVAILABLE', '2025-03-07'),
('copy-011', 'book-008', 'C / 01 / 14', 'AVAILABLE', '2025-03-07'),
('C001', 'B001', 'D / 01 / 01', 'AVAILABLE', '2026-08-01'),
('C002', 'B001', 'D / 01 / 02', 'ON_LOAN',   '2026-08-01'),
('C003', 'B002', 'D / 02 / 01', 'AVAILABLE', '2026-08-05'),
('C004', 'B003', 'D / 03 / 01', 'LOST',      '2026-08-10'),
('C005', 'B003', 'D / 03 / 02', 'DAMAGED',   '2026-08-10'),
('C006', 'B004', 'D / 04 / 01', 'ON_LOAN',   '2026-08-15')
ON DUPLICATE KEY UPDATE status=VALUES(status), shelf_location=VALUES(shelf_location);


-- 7. POPULATE MEMBER

INSERT INTO MEMBER (member_id, full_name, email, phone, member_type, join_date, status) VALUES
('mem-001', 'Avani Vasistha', 'avani@librax.edu', '+91 98765 01421', 'Student', '2024-08-14', 'ACTIVE'),
('mem-002', 'Ustat Kaur',     'ustat@librax.edu', '+91 98765 01087', 'Faculty', '2024-06-03', 'ACTIVE'),
('mem-003', 'Praisy Mathew',  'praisy@librax.edu', '+91 98765 01211', 'Student', '2025-01-09', 'ACTIVE'),
('mem-004', 'Rohan Mehta',    'rohan@librax.edu',  '+91 98765 01992', 'Student', '2024-12-18', 'SUSPENDED'),
('mem-005', 'Nisha Menon',    'nisha@librax.edu',  '+91 98765 01844', 'Staff',   '2024-09-22', 'ACTIVE'),
('M001',    'Alice Green',    'alice@gmail.com',   '+91 91234 56781', 'Student', '2026-08-15', 'ACTIVE'),
('M002',    'Bob Vance',      'bob@gmail.com',     '+91 91234 56782', 'Faculty', '2026-08-18', 'ACTIVE'),
('M003',    'Carol Danvers',  'carol@gmail.com',   '+91 91234 56783', 'Student', '2026-08-20', 'SUSPENDED')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), status=VALUES(status);


-- 8. POPULATE LIBRARIAN

INSERT INTO LIBRARIAN (librarian_id, full_name, email, phone, hired_on, role, shift) VALUES
('lib-001', 'Maya Iyer',  'maya@librax.edu',  '+91 98765 00001', '2023-01-15', 'Head Librarian', '09:00-17:00'),
('lib-002', 'Arjun Rao',  'arjun@librax.edu', '+91 98765 00002', '2023-06-01', 'Librarian',      '11:00-19:00'),
('lib-003', 'Leena Das',  'leena@librax.edu', '+91 98765 00003', '2024-02-10', 'Assistant',      '08:00-14:00'),
('L001',    'Suresh Nair', 'suresh@librax.edu', '+91 98765 00004', '2022-05-10', 'Head Librarian', '09:00-17:00'),
('L002',    'Pooja Sharma','pooja@librax.edu',  '+91 98765 00005', '2023-09-12', 'Librarian',      '10:00-18:00')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), email=VALUES(email);


-- 9. POPULATE BORROW

INSERT INTO BORROW (borrow_id, member_id, copy_id, issued_by, received_by, borrow_date, due_date, return_date) VALUES
('brw-001', 'mem-001', 'copy-002', 'lib-002', NULL,      '2026-10-03', '2026-10-17', NULL),
('brw-002', 'mem-002', 'copy-004', 'lib-001', NULL,      '2026-09-28', '2026-10-10', NULL),
('brw-003', 'mem-003', 'copy-006', 'lib-002', NULL,      '2026-10-01', '2026-10-15', NULL),
('brw-004', 'mem-004', 'copy-009', 'lib-001', NULL,      '2026-09-22', '2026-10-05', NULL),
('brw-005', 'mem-005', 'copy-010', 'lib-002', NULL,      '2026-10-06', '2026-10-20', NULL),
('brw-006', 'mem-003', 'copy-003', 'lib-002', 'lib-003', '2026-09-02', '2026-09-16', '2026-09-15'),
('BR001',   'M001',    'C001',     'L001',    'L001',    '2026-09-01', '2026-09-15', '2026-09-12'),
('BR002',   'M003',    'C004',     'L001',    NULL,      '2026-09-05', '2026-09-19', NULL),
('BR003',   'M001',    'C006',     'L002',    NULL,      '2026-09-10', '2026-09-24', NULL)
ON DUPLICATE KEY UPDATE due_date=VALUES(due_date), return_date=VALUES(return_date);


-- 10. POPULATE RESERVATION

INSERT INTO RESERVATION (reservation_id, member_id, book_id, reserved_on, expires_on, status) VALUES
('res-001', 'mem-003', 'book-002', '2026-10-07', '2026-10-14', 'PENDING'),
('res-002', 'mem-001', 'book-006', '2026-10-09', '2026-10-20', 'PENDING'),
('res-003', 'mem-005', 'book-004', '2026-10-10', '2026-10-18', 'PENDING'),
('res-004', 'mem-002', 'book-001', '2026-09-28', '2026-10-06', 'FULFILLED'),
('R001',    'M001',    'B001',     '2026-08-20', '2026-08-30', 'FULFILLED'),
('R002',    'M002',    'B002',     '2026-08-25', '2026-09-05', 'PENDING'),
('R003',    'M001',    'B004',     '2026-09-08', '2026-09-18', 'CANCELLED')
ON DUPLICATE KEY UPDATE status=VALUES(status);


-- 11. POPULATE FINE

INSERT INTO FINE (fine_id, borrow_id, fine_type, amount, fine_date, paid_date, status) VALUES
('fine-001', 'brw-002', 'OVERDUE', 120.00, '2026-10-11', NULL,         'UNPAID'),
('fine-002', 'brw-004', 'OVERDUE', 240.00, '2026-10-12', NULL,         'UNPAID'),
('fine-003', 'brw-006', 'OVERDUE',   0.00, '2026-09-15', '2026-09-15', 'PAID'),
('F001',     'BR001',   'OVERDUE',   0.00, '2026-09-12', '2026-09-12', 'PAID'),
('F002',     'BR002',   'LOST',    500.00, '2026-09-20', NULL,         'UNPAID')
ON DUPLICATE KEY UPDATE amount=VALUES(amount), status=VALUES(status);
