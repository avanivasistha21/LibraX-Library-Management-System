-
CREATE DATABASE IF NOT EXISTS librax_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE librax_db;


-- Drop tables in reverse dependency order if re-initializing

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS FINE;
DROP TABLE IF EXISTS RESERVATION;
DROP TABLE IF EXISTS BORROW;
DROP TABLE IF EXISTS BOOK_COPY;
DROP TABLE IF EXISTS BOOK_AUTHOR;
DROP TABLE IF EXISTS BOOK;
DROP TABLE IF EXISTS LIBRARIAN;
DROP TABLE IF EXISTS MEMBER;
DROP TABLE IF EXISTS AUTHOR;
DROP TABLE IF EXISTS CATEGORY;
DROP TABLE IF EXISTS PUBLISHER;
SET FOREIGN_KEY_CHECKS = 1;


-- 1. PUBLISHER TABLE

CREATE TABLE PUBLISHER (
    publisher_id   VARCHAR(50)   NOT NULL,
    name           VARCHAR(255)  NOT NULL,
    city           VARCHAR(100)  NULL,
    created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_publisher PRIMARY KEY (publisher_id),
    CONSTRAINT uq_publisher_name UNIQUE (name)
) ENGINE=InnoDB;


-- 2. CATEGORY TABLE

CREATE TABLE CATEGORY (
    category_id    VARCHAR(50)   NOT NULL,
    name           VARCHAR(100)  NOT NULL,
    description    TEXT          NULL,
    created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_category PRIMARY KEY (category_id),
    CONSTRAINT uq_category_name UNIQUE (name)
) ENGINE=InnoDB;


-- 3. AUTHOR TABLE

CREATE TABLE AUTHOR (
    author_id      VARCHAR(50)   NOT NULL,
    full_name      VARCHAR(255)  NOT NULL,
    country        VARCHAR(100)  NULL,
    created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_author PRIMARY KEY (author_id)
) ENGINE=InnoDB;


-- 4. BOOK TABLE

CREATE TABLE BOOK (
    book_id          VARCHAR(50)   NOT NULL,
    isbn             VARCHAR(20)   NOT NULL,
    title            VARCHAR(255)  NOT NULL,
    edition          VARCHAR(50)   NULL,
    publication_year INT           NULL,
    pages            INT           NULL,
    language         VARCHAR(50)   DEFAULT 'English',
    description      TEXT          NULL,
    cover_tone       VARCHAR(20)   DEFAULT '#B9563E',
    publisher_id     VARCHAR(50)   NOT NULL,
    category_id      VARCHAR(50)   NOT NULL,
    created_at       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_book PRIMARY KEY (book_id),
    CONSTRAINT uq_book_isbn UNIQUE (isbn),
    CONSTRAINT fk_book_publisher FOREIGN KEY (publisher_id)
        REFERENCES PUBLISHER (publisher_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_book_category FOREIGN KEY (category_id)
        REFERENCES CATEGORY (category_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE=InnoDB;


-- 5. BOOK_AUTHOR TABLE (M:N Relationship between BOOK and AUTHOR)

CREATE TABLE BOOK_AUTHOR (
    book_id        VARCHAR(50)   NOT NULL,
    author_id      VARCHAR(50)   NOT NULL,
    author_order   INT           NOT NULL DEFAULT 1,
    CONSTRAINT pk_book_author PRIMARY KEY (book_id, author_id),
    CONSTRAINT fk_ba_book FOREIGN KEY (book_id)
        REFERENCES BOOK (book_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_ba_author FOREIGN KEY (author_id)
        REFERENCES AUTHOR (author_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_author_order CHECK (author_order >= 1)
) ENGINE=InnoDB;


-- 6. BOOK_COPY TABLE (Physical inventory instances)

CREATE TABLE BOOK_COPY (
    copy_id          VARCHAR(50)   NOT NULL,
    book_id          VARCHAR(50)   NOT NULL,
    shelf_location   VARCHAR(100)  NULL,
    status           VARCHAR(20)   NOT NULL DEFAULT 'AVAILABLE',
    acquired_on      DATE          NOT NULL,
    CONSTRAINT pk_book_copy PRIMARY KEY (copy_id),
    CONSTRAINT fk_copy_book FOREIGN KEY (book_id)
        REFERENCES BOOK (book_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_copy_status CHECK (status IN ('AVAILABLE', 'ON_LOAN', 'LOST', 'DAMAGED'))
) ENGINE=InnoDB;


-- 7. MEMBER TABLE

CREATE TABLE MEMBER (
    member_id        VARCHAR(50)   NOT NULL,
    full_name        VARCHAR(255)  NOT NULL,
    email            VARCHAR(255)  NOT NULL,
    phone            VARCHAR(30)   NULL,
    member_type      VARCHAR(50)   DEFAULT 'Student',
    join_date        DATE          NOT NULL,
    status           VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT pk_member PRIMARY KEY (member_id),
    CONSTRAINT uq_member_email UNIQUE (email),
    CONSTRAINT chk_member_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED'))
) ENGINE=InnoDB;


-- 8. LIBRARIAN TABLE

CREATE TABLE LIBRARIAN (
    librarian_id     VARCHAR(50)   NOT NULL,
    full_name        VARCHAR(255)  NOT NULL,
    email            VARCHAR(255)  NOT NULL,
    phone            VARCHAR(30)   NULL,
    hired_on         DATE          NULL,
    role             VARCHAR(50)   DEFAULT 'Librarian',
    shift            VARCHAR(50)   DEFAULT '09:00-17:00',
    CONSTRAINT pk_librarian PRIMARY KEY (librarian_id),
    CONSTRAINT uq_librarian_email UNIQUE (email)
) ENGINE=InnoDB;


-- 9. BORROW TABLE (Loan Transactions)

CREATE TABLE BORROW (
    borrow_id        VARCHAR(50)   NOT NULL,
    member_id        VARCHAR(50)   NOT NULL,
    copy_id          VARCHAR(50)   NOT NULL,
    issued_by        VARCHAR(50)   NOT NULL,
    received_by      VARCHAR(50)   NULL,
    borrow_date      DATE          NOT NULL,
    due_date         DATE          NOT NULL,
    return_date      DATE          NULL,
    CONSTRAINT pk_borrow PRIMARY KEY (borrow_id),
    CONSTRAINT fk_borrow_member FOREIGN KEY (member_id)
        REFERENCES MEMBER (member_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_borrow_copy FOREIGN KEY (copy_id)
        REFERENCES BOOK_COPY (copy_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_borrow_issued_by FOREIGN KEY (issued_by)
        REFERENCES LIBRARIAN (librarian_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_borrow_received_by FOREIGN KEY (received_by)
        REFERENCES LIBRARIAN (librarian_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    CONSTRAINT chk_due_after_borrow CHECK (due_date > borrow_date),
    CONSTRAINT chk_return_after_borrow CHECK (return_date IS NULL OR return_date >= borrow_date)
) ENGINE=InnoDB;


-- 10. RESERVATION TABLE (Waitlist and Hold Queue)

CREATE TABLE RESERVATION (
    reservation_id   VARCHAR(50)   NOT NULL,
    member_id        VARCHAR(50)   NOT NULL,
    book_id          VARCHAR(50)   NOT NULL,
    reserved_on      DATE          NOT NULL,
    expires_on       DATE          NOT NULL,
    status           VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    CONSTRAINT pk_reservation PRIMARY KEY (reservation_id),
    CONSTRAINT fk_res_member FOREIGN KEY (member_id)
        REFERENCES MEMBER (member_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_res_book FOREIGN KEY (book_id)
        REFERENCES BOOK (book_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_res_status CHECK (status IN ('PENDING', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
    CONSTRAINT chk_expires_after_reserved CHECK (expires_on > reserved_on)
) ENGINE=InnoDB;


-- 11. FINE TABLE (Overdue and Damage Penalties)

CREATE TABLE FINE (
    fine_id          VARCHAR(50)     NOT NULL,
    borrow_id        VARCHAR(50)     NOT NULL,
    fine_type        VARCHAR(20)     NOT NULL DEFAULT 'OVERDUE',
    amount           DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    fine_date        DATE            NOT NULL,
    paid_date        DATE            NULL,
    status           VARCHAR(20)     NOT NULL DEFAULT 'UNPAID',
    CONSTRAINT pk_fine PRIMARY KEY (fine_id),
    CONSTRAINT fk_fine_borrow FOREIGN KEY (borrow_id)
        REFERENCES BORROW (borrow_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_fine_type CHECK (fine_type IN ('OVERDUE', 'LOST', 'DAMAGED')),
    CONSTRAINT chk_fine_amount CHECK (amount >= 0.00),
    CONSTRAINT chk_fine_status CHECK (status IN ('UNPAID', 'PAID', 'WAIVED'))
) ENGINE=InnoDB;


-- Indexes for Performance & Query Optimization

CREATE INDEX idx_book_title ON BOOK (title);
CREATE INDEX idx_copy_status ON BOOK_COPY (status);
CREATE INDEX idx_borrow_status ON BORROW (return_date, due_date);
CREATE INDEX idx_reservation_status ON RESERVATION (status);
CREATE INDEX idx_fine_status ON FINE (status);
