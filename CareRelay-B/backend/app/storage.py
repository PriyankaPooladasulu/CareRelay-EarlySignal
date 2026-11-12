import json
import sqlite3
from datetime import datetime, timezone
from contextlib import contextmanager
from pathlib import Path


class Store:
    """One synthetic case; replace analysis atomically, never partial-write a failed AI call."""
    def __init__(self, path, patient, records):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS evidence (event_id TEXT PRIMARY KEY, source_id TEXT NOT NULL,
                    payload TEXT NOT NULL, FOREIGN KEY(event_id) REFERENCES events(id),
                    FOREIGN KEY(source_id) REFERENCES records(id));
                CREATE TABLE IF NOT EXISTS analysis (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS navigation_plans (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS reminder_actions (id TEXT PRIMARY KEY, plan_id TEXT NOT NULL,
                    payload TEXT NOT NULL, calendar TEXT, FOREIGN KEY(plan_id) REFERENCES navigation_plans(id));
                CREATE TABLE IF NOT EXISTS audit_events (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL, entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL, event_type TEXT NOT NULL,
                    from_status TEXT, to_status TEXT, revision TEXT, details TEXT NOT NULL);
                CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_events
                    BEGIN SELECT RAISE(ABORT, 'Audit entries are append-only'); END;
                CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_events
                    BEGIN SELECT RAISE(ABORT, 'Audit entries are append-only'); END;
            """)
            # Serialize first-time audit initialization; never invent pre-upgrade history.
            db.execute("BEGIN IMMEDIATE")
            if not db.execute("SELECT 1 FROM audit_events LIMIT 1").fetchone():
                self.audit_event(db, "system", "amina", "audit_started",
                                 details={"legacy_history_available": False})
                for table, kind in [("navigation_plans", "plan"), ("reminder_actions", "action")]:
                    for row in db.execute(f"SELECT id,payload FROM {table}").fetchall():
                        value = json.loads(row["payload"])
                        self.audit_event(db, kind, row["id"], "legacy_snapshot",
                                         to_status=value["status"], revision=value["revision"],
                                         details={"imported_snapshot": True, "prior_transitions_unknown": True,
                                                  "active": value.get("active")})
                old = db.execute("SELECT payload FROM analysis WHERE id=1").fetchone()
                if old:
                    self.audit_event(db, "analysis", "amina", "legacy_snapshot",
                                     to_status="analyzed", revision=json.loads(old[0])["revision"],
                                     details={"imported_snapshot": True})

            db.execute("INSERT OR IGNORE INTO patients VALUES(?,?)", (patient["id"], json.dumps(patient)))
            # A fresh database exposes the synthetic originals even before extraction.
            if not db.execute("SELECT 1 FROM records LIMIT 1").fetchone():
                db.executemany("INSERT INTO records VALUES(?,?)", [(r["id"], json.dumps(r)) for r in records])

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=20)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def patient(self):
        with self.connection() as db:
            return json.loads(db.execute("SELECT payload FROM patients WHERE id='DEMO-001'").fetchone()[0])

    def records(self):
        with self.connection() as db:
            rows = [json.loads(r[0]) for r in db.execute("SELECT payload FROM records")]
        return sorted(rows, key=lambda r: (r["date"], r["id"]))

    def analysis(self):
        with self.connection() as db:
            row = db.execute("SELECT payload FROM analysis WHERE id=1").fetchone()
        return json.loads(row[0]) if row else None

    def save_analysis(self, result):
        with self.connection() as db:
            previous = db.execute("SELECT payload FROM analysis WHERE id=1").fetchone()
            if previous and json.loads(previous[0])["revision"] != result["revision"]:
                self.invalidate_workflow(db, "analysis_changed")
            db.execute("DELETE FROM evidence")
            db.execute("DELETE FROM events")
            db.execute("DELETE FROM records")
            for record in result["records"]:
                db.execute("INSERT INTO records VALUES(?,?)", (record["id"], json.dumps(record)))
            for event in result["events"]:
                db.execute("INSERT INTO events VALUES(?,?)", (event["id"], json.dumps(event)))
                db.execute("INSERT INTO evidence VALUES(?,?,?)",
                           (event["id"], event["evidence"]["source_id"], json.dumps(event["evidence"])))
            db.execute("INSERT INTO analysis VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
                       (json.dumps(result),))

            self.audit_event(db, "analysis", "amina", "analysis_saved",
                             from_status="analyzed" if previous else None, to_status="analyzed",
                             revision=result["revision"],
                             details={"previous_revision": json.loads(previous[0])["revision"] if previous else None,
                                      "mode": result["mode"], "event_count": len(result["events"])})

    @staticmethod
    def audit_event(db, entity_type, entity_id, event_type, from_status=None, to_status=None,
                    revision=None, details=None):
        db.execute("""INSERT INTO audit_events
            (created_at,entity_type,entity_id,event_type,from_status,to_status,revision,details)
            VALUES(?,?,?,?,?,?,?,?)""",
            (datetime.now(timezone.utc).isoformat(), entity_type, entity_id, event_type,
             from_status, to_status, revision, json.dumps(details or {}, sort_keys=True)))

    def audit_history(self, after=0, limit=100):
        with self.connection() as db:
            rows = db.execute("SELECT * FROM audit_events WHERE sequence>? ORDER BY sequence LIMIT ?",
                              (after, limit + 1)).fetchall()
            events = []
            for row in rows[:limit]:
                event = dict(row)
                event["details"] = json.loads(event["details"])
                events.append(event)
            return {"events": events, "next_cursor": events[-1]["sequence"] if len(rows) > limit else None}

    @staticmethod
    def invalidate_workflow(db, reason):
        for row in db.execute("SELECT id,payload FROM navigation_plans").fetchall():
            payload = json.loads(row["payload"])
            if payload["active"]:
                Store.audit_event(db, "plan", row["id"], "plan_invalidated",
                                  from_status=payload["status"], to_status="inactive",
                                  revision=payload["revision"], details={"reason": reason})
                payload["active"] = False
                db.execute("UPDATE navigation_plans SET payload=? WHERE id=?", (json.dumps(payload), row["id"]))
        for row in db.execute("SELECT id,payload FROM reminder_actions").fetchall():
            payload = json.loads(row["payload"])
            if payload["status"] not in {"cancelled", "invalidated", "completed"}:
                Store.audit_event(db, "action", row["id"], "action_invalidated",
                                  from_status=payload["status"], to_status="invalidated",
                                  revision=payload["revision"], details={"reason": reason})
                payload["status"] = "invalidated"
                payload["invalidation_reason"] = reason
                db.execute("UPDATE reminder_actions SET payload=? WHERE id=?", (json.dumps(payload), row["id"]))
