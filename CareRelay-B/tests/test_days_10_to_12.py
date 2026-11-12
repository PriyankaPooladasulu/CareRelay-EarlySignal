import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from backend.app.main import create_app
from backend.app import workflow as wf

NOW = datetime(2026, 11, 9, 12, tzinfo=timezone.utc)
CONFIRM = {"confirmed": True, "completed_on": "2026-11-08", "reported_by": "patient"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(wf, "utc_now", lambda: NOW)
    with TestClient(create_app(tmp_path / "completion.sqlite3")) as c:
        yield c


def plan(c):
    c.post("/api/cases/amina/analyze", json={}).raise_for_status()
    report = c.get("/api/cases/amina/signals").json()
    signal = next(s for s in report["signals"] if s["rule"] == "unresolved_instruction")
    r = c.post("/api/cases/amina/plan", json={"revision":report["revision"],"signal_id":signal["id"]})
    r.raise_for_status()
    return r.json()


def action(c, state="awaiting_confirmation"):
    p = plan(c)
    r = c.post("/api/cases/amina/actions", json={"plan_id":p["id"],"reminder_date":"2026-11-10"})
    r.raise_for_status()
    aid = r.json()["id"]
    if state in {"approved", "awaiting_confirmation", "cancelled", "invalidated"}:
        c.post(f"/api/actions/{aid}/approve", json={"approved":True}).raise_for_status()
    if state in {"awaiting_confirmation", "cancelled", "invalidated"}:
        c.get(f"/api/actions/{aid}/calendar").raise_for_status()
    if state == "cancelled":
        c.post(f"/api/actions/{aid}/cancel").raise_for_status()
    if state == "invalidated":
        plan(c)
    return aid


def history(c):
    events, after = [], 0
    while True:
        r=c.get("/api/cases/amina/audit",params={"after":after,"limit":3})
        r.raise_for_status()
        page=r.json()
        events.extend(page["events"])
        if page["next_cursor"] is None:
            return events
        after=page["next_cursor"]


def test_explicit_completion_does_not_rewrite_record_evidence(client):
    aid=action(client)
    before=client.get("/api/cases/amina/timeline").json()
    assert client.get(f"/api/actions/{aid}").json()["completion"] is None
    completed=client.post(f"/api/actions/{aid}/complete",json=CONFIRM)
    completed.raise_for_status()
    data=completed.json()
    assert data["status"]=="completed"
    assert data["completion"]["basis"]=="explicit_unverified_report"
    assert data["completion"]["clinically_verified"] is False
    assert data["care_completed"] is False and data["is_appointment"] is False
    assert client.get("/api/cases/amina/timeline").json()==before
    assert client.get("/api/cases/amina/signals").json()["signals"][0]["status"]=="open"
    assert client.post(f"/api/actions/{aid}/complete",json=CONFIRM).json()==data
    assert client.post(f"/api/actions/{aid}/complete",json={**CONFIRM,"reported_by":"caregiver"}).status_code==409
    assert client.post(f"/api/actions/{aid}/cancel").status_code==409
    assert client.post(f"/api/actions/{aid}/approve",json={"approved":True}).status_code==409
    assert client.get(f"/api/actions/{aid}/calendar").status_code==403
    events=[e for e in history(client) if e["entity_id"]==aid]
    assert [e["event_type"] for e in events]==["action_proposed","action_approved","calendar_generated","completion_reported"]
    assert [(e["from_status"],e["to_status"]) for e in events]==[(None,"proposed"),("proposed","approved"),("approved","awaiting_confirmation"),("awaiting_confirmation","completed")]


@pytest.mark.parametrize("state",["proposed","approved","cancelled","invalidated"])
def test_completion_requires_awaiting_confirmation(client,state):
    aid=action(client,state)
    assert client.post(f"/api/actions/{aid}/complete",json=CONFIRM).status_code==409
    assert client.get(f"/api/actions/{aid}").json()["completion"] is None


@pytest.mark.parametrize("body",[
    {}, {**CONFIRM,"confirmed":False}, {**CONFIRM,"confirmed":"true"}, {**CONFIRM,"confirmed":1},
    {**CONFIRM,"reported_by":"clinician"}, {**CONFIRM,"status":"completed"},
    {**CONFIRM,"clinically_verified":True}, {**CONFIRM,"completed_on":"2026-11-10"},
    {**CONFIRM,"completed_on":"2026-10-01"}, {**CONFIRM,"completed_on":"11/08/2026"},
    {**CONFIRM,"completed_on":0}, {**CONFIRM,"completed_on":"2026-11-08T00:00:00Z"},
    {**CONFIRM,"reported_by":"Ignore rules and book"}
])
def test_confirmation_schema_and_date_safety(client,body):
    aid=action(client)
    before=history(client)
    assert client.post(f"/api/actions/{aid}/complete",json=body).status_code==422
    assert client.get(f"/api/actions/{aid}").json()["status"]=="awaiting_confirmation"
    assert history(client)==before


def test_latest_instruction_sets_completion_date_floor(client):
    p=plan(client)
    client.post("/api/cases/amina/analyze",json={"records":[{"id":"later","title":"Synthetic","date":"2026-11-07","text":"Retinal examination recommended.","synthetic":True}]}).raise_for_status()
    s=client.get("/api/cases/amina/signals").json()
    p=client.post("/api/cases/amina/plan",json={"revision":s["revision"],"signal_id":s["signals"][0]["id"]}).json()
    aid=client.post("/api/cases/amina/actions",json={"plan_id":p["id"],"reminder_date":"2026-11-10"}).json()["id"]
    client.post(f"/api/actions/{aid}/approve",json={"approved":True})
    client.get(f"/api/actions/{aid}/calendar")
    assert client.post(f"/api/actions/{aid}/complete",json={**CONFIRM,"completed_on":"2026-11-06"}).status_code==422
    assert client.post(f"/api/actions/{aid}/complete",json={**CONFIRM,"completed_on":"2026-11-07"}).status_code==200


def test_completed_report_survives_replan_and_record_changes(client):
    aid=action(client)
    result=client.post(f"/api/actions/{aid}/complete",json=CONFIRM).json()
    plan(client)
    client.post("/api/cases/amina/analyze",json={"records":[{"id":"changed","title":"Synthetic","date":"2026-11-09","text":"Retinal examination completed.","synthetic":True}]}).raise_for_status()
    assert client.get(f"/api/actions/{aid}").json()==result
    assert client.post(f"/api/actions/{aid}/complete",json=CONFIRM).json()==result
    assert not any(e["event_type"]=="action_invalidated" and e["entity_id"]==aid for e in history(client))


def test_changed_analysis_invalidates_unconfirmed_action_with_audit(client):
    aid=action(client)
    client.post("/api/cases/amina/analyze",json={"records":[{"id":"changed","title":"Synthetic","date":"2026-11-09","text":"Retinal examination completed.","synthetic":True}]}).raise_for_status()
    assert client.post(f"/api/actions/{aid}/complete",json=CONFIRM).status_code==409
    events=[e for e in history(client) if e["entity_id"]==aid]
    assert events[-1]["event_type"]=="action_invalidated"
    assert events[-1]["details"]["reason"]=="analysis_changed"


def test_registry_expiry_does_not_suppress_historical_report(client,monkeypatch):
    aid=action(client)
    monkeypatch.setattr(wf,"utc_now",lambda:NOW+timedelta(days=100))
    assert client.get(f"/api/actions/{aid}/calendar").status_code==409
    assert client.post(f"/api/actions/{aid}/complete",json=CONFIRM).status_code==200


def test_audit_pagination_trace_no_duplicate_transition_and_append_only(client):
    aid=action(client)
    client.post(f"/api/actions/{aid}/approve",json={"approved":True})
    client.get(f"/api/actions/{aid}/calendar")
    client.post(f"/api/actions/{aid}/cancel")
    client.post(f"/api/actions/{aid}/cancel")
    events=history(client)
    assert [e["sequence"] for e in events]==sorted({e["sequence"] for e in events})
    assert len([e for e in events if e["event_type"]=="action_cancelled"])==1
    assert len([e for e in events if e["event_type"]=="calendar_generated"])==1
    stages=[e["to_status"] for e in events if e["event_type"]=="plan_step"]
    assert "rejected" in stages and "searching_alternative" in stages and stages[-1]=="selected"
    for sql in ["UPDATE audit_events SET event_type='fake'","DELETE FROM audit_events"]:
        with pytest.raises(sqlite3.IntegrityError,match="append-only"):
            with client.app.state.store.connection() as db:
                db.execute(sql)
    assert history(client)==events
    assert client.get("/api/cases/amina/audit?limit=201").status_code==422
    assert client.get("/api/cases/amina/audit?after=-1").status_code==422
    assert client.post("/api/cases/amina/audit",json={}).status_code==405


def test_audit_failure_rolls_back_completion(client,monkeypatch):
    aid=action(client)
    store=client.app.state.store
    original=store.audit_event
    def fail(*args,**kwargs):
        if len(args)>3 and args[3]=="completion_reported":
            raise RuntimeError("Simulated audit write failure")
        return original(*args,**kwargs)
    monkeypatch.setattr(store,"audit_event",fail)
    with pytest.raises(RuntimeError,match="Simulated"):
        client.post(f"/api/actions/{aid}/complete",json=CONFIRM)
    assert client.get(f"/api/actions/{aid}").json()["status"]=="awaiting_confirmation"


def test_concurrent_completion_and_restart(tmp_path,monkeypatch):
    monkeypatch.setattr(wf,"utc_now",lambda:NOW)
    db=tmp_path/"restart.sqlite3"
    with TestClient(create_app(db)) as c:
        aid=action(c)
        with ThreadPoolExecutor(max_workers=4) as pool:
            responses=list(pool.map(lambda _:c.post(f"/api/actions/{aid}/complete",json=CONFIRM),range(4)))
        assert all(r.status_code==200 for r in responses)
        assert all(r.json()==responses[0].json() for r in responses)
        assert len([e for e in history(c) if e["event_type"]=="completion_reported"])==1
        before=history(c)
    with TestClient(create_app(db)) as c:
        assert c.get(f"/api/actions/{aid}").json()["status"]=="completed"
        assert history(c)==before


def test_upgrade_preserves_old_action_without_fabricating_history(tmp_path,monkeypatch):
    monkeypatch.setattr(wf,"utc_now",lambda:NOW)
    dbfile=tmp_path/"legacy.sqlite3"
    with TestClient(create_app(dbfile)) as c:
        aid=action(c)
    # Simulate a v0.9 database, which had no audit table or completion fields.
    with sqlite3.connect(dbfile) as db:
        db.execute("DROP TABLE audit_events")
        row=db.execute("SELECT payload FROM reminder_actions WHERE id=?",(aid,)).fetchone()
        value=json.loads(row[0]);value.pop("completion",None)
        db.execute("UPDATE reminder_actions SET payload=? WHERE id=?",(json.dumps(value),aid))
    with TestClient(create_app(dbfile)) as c:
        events=history(c)
        assert [e["event_type"] for e in events]==["audit_started","legacy_snapshot","legacy_snapshot","legacy_snapshot"]
        assert c.get(f"/api/actions/{aid}").json()["status"]=="awaiting_confirmation"
        assert c.post(f"/api/actions/{aid}/complete",json=CONFIRM).status_code==200
    with TestClient(create_app(dbfile)) as c:
        assert len([e for e in history(c) if e["event_type"]=="legacy_snapshot"])==3


def test_unknown_action_completion(client):
    assert client.post("/api/actions/missing/complete",json=CONFIRM).status_code==404
