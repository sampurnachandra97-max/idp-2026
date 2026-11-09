"""Accounts and sessions, stored in SQLite.

Passwords are hashed with scrypt. Session tokens are random, sent to the browser
in an HttpOnly cookie, and stored only as SHA-256 digests.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
import threading
import time
from collections import defaultdict
from contextlib import closing
from pathlib import Path

DEFAULT_DB = Path(__file__).resolve().parents[1] / "data" / "app.db"
SESSION_SECONDS = 7 * 24 * 60 * 60
MAX_FAILURES = 10
FAILURE_WINDOW_SECONDS = 15 * 60
SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at REAL NOT NULL
);
"""


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **SCRYPT)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt, digest = stored.split("$", 1)
    candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), **SCRYPT)
    return hmac.compare_digest(candidate.hex(), digest)


# Checked for unknown emails so that they take as long as a wrong password.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class EmailTaken(Exception):
    pass


class TooManyAttempts(Exception):
    pass


class AuthStore:
    def __init__(self, path: str | Path | None = None) -> None:
        self.path = Path(path or os.environ.get("SOIL_DB_PATH") or DEFAULT_DB)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._failures: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()
        with closing(self._connect()) as connection, connection:
            connection.executescript(SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def create_user(self, name: str, email: str, password: str) -> dict:
        password_hash = hash_password(password)
        try:
            with closing(self._connect()) as connection, connection:
                cursor = connection.execute(
                    "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                    (name, email, password_hash, time.time()),
                )
        except sqlite3.IntegrityError as error:
            raise EmailTaken from error
        return {"id": cursor.lastrowid, "name": name, "email": email}

    def email_exists(self, email: str) -> bool:
        with closing(self._connect()) as connection:
            row = connection.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone()
        return row is not None

    def _check_rate_limit(self, email: str) -> None:
        cutoff = time.time() - FAILURE_WINDOW_SECONDS
        with self._lock:
            recent = [moment for moment in self._failures[email] if moment > cutoff]
            self._failures[email] = recent
            if len(recent) >= MAX_FAILURES:
                raise TooManyAttempts

    def authenticate(self, email: str, password: str) -> dict | None:
        self._check_rate_limit(email)
        with closing(self._connect()) as connection:
            row = connection.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if verify_password(password, row["password_hash"] if row else _DUMMY_HASH) and row:
            with self._lock:
                self._failures.pop(email, None)
            return {"id": row["id"], "name": row["name"], "email": row["email"]}
        with self._lock:
            self._failures[email].append(time.time())
        return None

    def create_session(self, user_id: int) -> str:
        token = secrets.token_urlsafe(32)
        now = time.time()
        with closing(self._connect()) as connection, connection:
            connection.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
            connection.execute(
                "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
                (_digest(token), user_id, now + SESSION_SECONDS),
            )
        return token

    def user_for_session(self, token: str) -> dict | None:
        with closing(self._connect()) as connection:
            row = connection.execute(
                """SELECT users.id, users.name, users.email FROM sessions
                   JOIN users ON users.id = sessions.user_id
                   WHERE token_hash = ? AND expires_at > ?""",
                (_digest(token), time.time()),
            ).fetchone()
        return dict(row) if row else None

    def delete_session(self, token: str) -> None:
        with closing(self._connect()) as connection, connection:
            connection.execute("DELETE FROM sessions WHERE token_hash = ?", (_digest(token),))
