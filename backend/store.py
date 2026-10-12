"""Tiny SQLite store: persists decision status + audit trail across restarts."""
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


class Store:
    def __init__(self, path: Optional[Path] = None):
        self.path = path or Path(__file__).resolve().parent / "warroom.db"
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init()

    def _init(self) -> None:
        with self._lock:
            self._conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS decision_state (
                    decision_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    updated_by TEXT NOT NULL,
                    note TEXT
                );
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT NOT NULL,
                    decision_id TEXT NOT NULL,
                    title TEXT,
                    from_status TEXT,
                    to_status TEXT,
                    role TEXT,
                    note TEXT
                );
                """
            )
            self._conn.commit()

    @staticmethod
    def _now() -> str:
        return datetime.now().isoformat(timespec="seconds")

    def states(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM decision_state").fetchall()
        return {r["decision_id"]: dict(r) for r in rows}

    def transition(self, decision_id: str, title: str, from_status: str,
                   to_status: str, role: str, note: str = "") -> None:
        ts = self._now()
        with self._lock:
            self._conn.execute(
                """INSERT INTO decision_state (decision_id, status, updated_at, updated_by, note)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(decision_id) DO UPDATE SET
                     status=excluded.status, updated_at=excluded.updated_at,
                     updated_by=excluded.updated_by, note=excluded.note""",
                (decision_id, to_status, ts, role, note),
            )
            self._conn.execute(
                """INSERT INTO audit_log (ts, decision_id, title, from_status, to_status, role, note)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (ts, decision_id, title, from_status, to_status, role, note),
            )
            self._conn.commit()

    def audit(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    def reset(self) -> None:
        with self._lock:
            self._conn.executescript("DELETE FROM decision_state; DELETE FROM audit_log;")
            self._conn.commit()
