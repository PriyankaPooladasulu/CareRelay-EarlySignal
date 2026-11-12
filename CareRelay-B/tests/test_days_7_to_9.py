import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from backend.app.main import create_app
from backend.app import workflow as wf
from backend.app.navigation import registry_snapshot, select_resource
from backend.app.workflow_models import Constraints
from backend.app.calendar_file import escape_text, fold_line

NOW = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(wf, "utc_now", lambda: NOW)
    with TestClient(create_app(tmp_path / "workflow.sqlite3")) as c:
        yield c


def planning(client, constraints=None, analyze=True):
    if analyze:
        client.post("/api/cases/amina/analyze", json={}).raise_for_status()
    report = client.get("/api/cases/amina/signals").json()
    signal = next(s for s in report["signals"] if s["rule"] == "unresolved_instruction")
    return client.post("/api/cases/amina/plan", json={"revision": report["revision"], "signal_id": signal["id"], "constraints": constraints or {}})


def proposal(client, constraints=None):
    plan = planning(client, constraints).json()
    response = client.post("/api/cases/amina/actions", json={"plan_id":plan["id"],"reminder_date":"2026-11-06"})
    response.raise_for_status()
    return response.json(), plan


def test_registry_has_metadata_and_no_unverified_claims(client):
    registry = client.get("/api/resources").json()
    assert len(registry["resources"]) == 3
    for r in registry["resources"]:
        assert r["source_urls"] and all(url.startswith("https://") for url in r["source_urls"])
        assert r["eligibility"] and r["location"] and r["verification_note"]
        assert r["verified_on"] <= r["review_due"]
    assert registry["resources"][0]["languages"] == []
    assert registry["resources"][0]["requires_existing_referral"] is True


def test_default_does_not_invent_referral(client):
    plan = planning(client).json()
    assert plan["selected"]["id"] == "ontario_health811"
    assert "existing_referral_to_this_clinic_not_confirmed" in plan["evaluations"][0]["reasons"]
    assert plan["mode"] == "deterministic_navigation"
    assert [s["stage"] for s in plan["steps"]][:4] == ["checking_resource", "checking_constraints", "rejected", "searching_alternative"]


def test_travel_replanning_invalidates_previous_plan_and_action(client):
    action, first = proposal(client, {"existing_referral_confirmed":True})
    assert first["selected"]["id"] == "uhn_eye_existing_referral"
    client.post(f"/api/actions/{action['id']}/approve",json={"approved":True}).raise_for_status()
    second = planning(client, {"existing_referral_confirmed":True,"travel":"cannot_travel"}, analyze=False).json()
    assert second["selected"]["id"] == "ontario_health811"
    assert "in_person_pathway_conflicts_with_travel_constraint" in second["evaluations"][0]["reasons"]
    assert client.get(f"/api/plans/{first['id']}").json()["active"] is False
    stale = client.get(f"/api/actions/{action['id']}").json()
    assert stale["status"] == "invalidated" and stale["invalidation_reason"] == "replanned"
    assert client.get(f"/api/actions/{action['id']}/calendar").status_code == 409


@pytest.mark.parametrize("constraints,selected", [
    ({"language":"fr"}, "ontario_health811"),
    ({"language":"  EN "}, "ontario_health811"),
    ({"accessibility":"tty"}, "ontario_health811"),
    ({"phone_available":False}, "ontario_optometrist_register"),
    ({"accessibility":"step_free"}, None),
    ({"language":"unknown-language"}, None),
    ({"jurisdiction":"Quebec"}, None),
    ({"phone_available":False,"language":"fr"}, None),
    ({"travel":"cannot_travel","existing_referral_confirmed":True,"accessibility":"step_free"}, None),
])
def test_constraints_fail_closed(client, constraints, selected):
    plan = planning(client, constraints).json()
    assert (plan["selected"]["id"] if plan["selected"] else None) == selected
    assert plan["status"] == ("proposed" if selected else "no_verified_match")
    if selected is None:
        assert plan["steps"][-1]["stage"] == "no_verified_match"
        assert all(not e["eligible"] for e in plan["evaluations"])
        assert client.post("/api/cases/amina/actions",json={"plan_id":plan["id"],"reminder_date":"2026-11-06"}).status_code == 409


def test_expired_and_future_registry_entries_are_rejected():
    registry,_ = registry_snapshot()
    for today in [NOW.date()-timedelta(days=1), NOW.date()+timedelta(days=100)]:
        selected, results, steps = select_resource(registry, Constraints(), today)
        assert selected is None
        assert all("resource_review_out_of_date" in r.reasons for r in results)


@pytest.mark.parametrize("constraints", [{"travel":"teleport"},{"existing_referral_confirmed":"yes"},{"phone_available":1},
    {"source_url":"https://evil.invalid"},{"accessibility":"<script>"}])
def test_constraint_schema_prevents_untrusted_capabilities(client, constraints):
    assert planning(client,constraints).status_code == 422


def test_no_analysis_wrong_revision_and_unknown_signal(client):
    body={"revision":"0"*64,"signal_id":"fake"}
    assert client.post("/api/cases/amina/plan",json=body).status_code == 409
    analysis=client.post("/api/cases/amina/analyze",json={}).json()
    assert client.post("/api/cases/amina/plan",json=body).status_code == 409
    body["revision"]=analysis["revision"]
    assert client.post("/api/cases/amina/plan",json=body).status_code == 409


@pytest.mark.parametrize("name", ["resolved_follow_up.json","all_signal_rules.json"])
def test_resolved_or_conflicting_signals_cannot_propose_navigation(client, name):
    data=json.loads((Path(__file__).resolve().parents[1]/"examples"/name).read_text())
    client.post("/api/cases/amina/analyze",json=data).raise_for_status()
    assert planning(client,analyze=False).status_code == 409


@pytest.mark.parametrize("body", [{}, {"approved":False}, {"approved":"true"}, {"approved":1},
    {"approved":True,"status":"completed"}, {"approved":True,"reminder_date":"2026-12-01"}])
def test_explicit_approval_cannot_be_bypassed(client, body):
    action,_=proposal(client)
    aid=action["id"]
    assert client.get(f"/api/actions/{aid}/calendar").status_code == 403
    assert client.post(f"/api/actions/{aid}/approve",json=body).status_code == 422
    assert client.get(f"/api/actions/{aid}").json()["status"] == "proposed"
    assert client.get(f"/api/actions/{aid}/calendar").status_code == 403


def test_approved_ics_is_stable_and_never_marks_care_completed(client):
    action,plan=proposal(client)
    aid=action["id"]
    approved=client.post(f"/api/actions/{aid}/approve",json={"approved":True}).json()
    assert approved["status"] == "approved" and approved["approved_at"]
    assert client.post(f"/api/actions/{aid}/approve",json={"approved":True}).json()==approved
    first=client.get(f"/api/actions/{aid}/calendar")
    assert first.status_code == 200 and first.headers["content-type"].startswith("text/calendar")
    assert first.headers["cache-control"] == "no-store"
    assert "attachment" in first.headers["content-disposition"]
    assert client.get(f"/api/actions/{aid}/calendar").content == first.content
    unfolded=first.content.decode().replace("\r\n ", "")
    assert unfolded.startswith("BEGIN:VCALENDAR\r\n") and unfolded.endswith("END:VCALENDAR\r\n")
    assert unfolded.count("BEGIN:VEVENT") == 1
    assert "DTSTART;VALUE=DATE:20261106" in unfolded
    assert "DTEND;VALUE=DATE:20261107" in unfolded
    assert "not an appointment" in unfolded
    assert "no care completion is established" in unfolded
    assert "ATTENDEE" not in unfolded and "ORGANIZER" not in unfolded and "METHOD:REQUEST" not in unfolded
    assert all(len(line)<=75 for line in first.content.split(b"\r\n"))
    latest=client.get(f"/api/actions/{aid}").json()
    assert latest["status"]=="awaiting_confirmation" and latest["care_completed"] is False and latest["is_appointment"] is False
    assert client.patch(f"/api/actions/{aid}/status",json={"status":"completed"}).status_code==404


@pytest.mark.parametrize("after_download", [False,True])
def test_cancellation_blocks_approval_and_download(client, after_download):
    action,_=proposal(client)
    aid=action["id"]
    if after_download:
        client.post(f"/api/actions/{aid}/approve",json={"approved":True})
        client.get(f"/api/actions/{aid}/calendar")
    assert client.post(f"/api/actions/{aid}/cancel").json()["status"]=="cancelled"
    assert client.post(f"/api/actions/{aid}/cancel").json()["status"]=="cancelled"
    assert client.get(f"/api/actions/{aid}/calendar").status_code==403
    assert client.post(f"/api/actions/{aid}/approve",json={"approved":True}).status_code==409


@pytest.mark.parametrize("date", ["2026-10-31","2028-01-01","11/06/2026","not-a-date",0,"2026-11-06T12:00:00Z"])
def test_bad_reminder_dates(client, date):
    plan=planning(client).json()
    assert client.post("/api/cases/amina/actions",json={"plan_id":plan["id"],"reminder_date":date}).status_code==422


def test_duplicate_proposal_and_date_change(client):
    action,plan=proposal(client)
    same=client.post("/api/cases/amina/actions",json={"plan_id":plan["id"],"reminder_date":"2026-11-06"}).json()
    assert action==same
    assert client.post("/api/cases/amina/actions",json={"plan_id":plan["id"],"reminder_date":"2026-11-07"}).status_code==409
    client.post(f"/api/actions/{action['id']}/cancel")
    assert client.post("/api/cases/amina/actions",json={"plan_id":plan["id"],"reminder_date":"2026-11-07"}).json()["status"]=="proposed"


def test_changed_records_invalidate_approval_even_if_originals_restored(client):
    action,_=proposal(client)
    aid=action["id"]
    client.post(f"/api/actions/{aid}/approve",json={"approved":True})
    client.post("/api/cases/amina/analyze",json={"records":[{"id":"new","date":"2026-10-31","title":"Synthetic","text":"Retinal examination completed.","synthetic":True}]})
    assert client.get(f"/api/actions/{aid}").json()["status"]=="invalidated"
    client.post("/api/cases/amina/analyze",json={})
    assert client.get(f"/api/actions/{aid}/calendar").status_code==409


def test_registry_change_or_expiry_blocks_existing_approval(client,monkeypatch):
    action,_=proposal(client)
    aid=action["id"]
    client.post(f"/api/actions/{aid}/approve",json={"approved":True})
    registry,digest=registry_snapshot()
    monkeypatch.setattr(wf,"registry_snapshot",lambda:(registry,"changed"))
    assert client.get(f"/api/actions/{aid}/calendar").status_code==409
    monkeypatch.setattr(wf,"registry_snapshot",lambda:(registry,digest))
    monkeypatch.setattr(wf,"utc_now",lambda:NOW+timedelta(days=100))
    assert client.get(f"/api/actions/{aid}/calendar").status_code==409


def test_date_passes_before_approval(client,monkeypatch):
    action,_=proposal(client)
    monkeypatch.setattr(wf,"utc_now",lambda:NOW+timedelta(days=6))
    assert client.post(f"/api/actions/{action['id']}/approve",json={"approved":True}).status_code==409


def test_workflow_survives_restart_and_concurrent_downloads(tmp_path,monkeypatch):
    monkeypatch.setattr(wf,"utc_now",lambda:NOW)
    db=tmp_path/"restart.sqlite3"
    with TestClient(create_app(db)) as c:
        action,plan=proposal(c)
        aid=action["id"]
        c.post(f"/api/actions/{aid}/approve",json={"approved":True})
    with TestClient(create_app(db)) as c:
        assert c.get(f"/api/plans/{plan['id']}").json()["selected"]==plan["selected"]
        with ThreadPoolExecutor(max_workers=4) as pool:
            results=list(pool.map(lambda _:c.get(f"/api/actions/{aid}/calendar"),range(4)))
        assert all(r.status_code==200 for r in results)
        assert len({r.content for r in results})==1
        assert c.get(f"/api/actions/{aid}").json()["status"]=="awaiting_confirmation"


def test_calendar_escaping_and_unicode_folding():
    value="Amína 👁, review; notes\\end\r\nBEGIN:VEVENT"
    escaped=escape_text(value)
    assert "\r" not in escaped and "\n" not in escaped
    assert "\\nBEGIN:VEVENT" in escaped and "\\," in escaped and "\\;" in escaped
    line="DESCRIPTION:"+escaped*8
    folded=fold_line(line)
    assert all(len(l.encode())<=75 for l in folded.split("\r\n"))
    assert folded.replace("\r\n ", "")==line


def test_unknown_actions_and_untrusted_proposals(client):
    assert client.get("/api/actions/missing").status_code==404
    assert client.get("/api/plans/missing").status_code==404
    assert client.get("/api/actions/missing/calendar").status_code==404
    action,plan=proposal(client)
    assert client.post("/api/cases/amina/actions",json={"plan_id":plan["id"],"reminder_date":"2026-11-06","status":"approved"}).status_code==422
