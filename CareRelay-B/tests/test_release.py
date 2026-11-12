import hashlib,json
from pathlib import Path
import httpx,pytest
from fastapi.testclient import TestClient
from backend.app.main import create_app
from backend.app import workflow as wf
from datetime import datetime, timezone

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setattr(wf,"utc_now",lambda:datetime(2026,11,12,12,tzinfo=timezone.utc))
    with TestClient(create_app(tmp_path/"release.sqlite3")) as c: yield c

def approved(c):
    c.post("/api/cases/amina/analyze",json={}).raise_for_status()
    s=c.get("/api/cases/amina/signals").json()
    plan=c.post("/api/cases/amina/plan",json={"revision":s["revision"],"signal_id":s["signals"][0]["id"]}).json()
    action=c.post("/api/cases/amina/actions",json={"plan_id":plan["id"],"reminder_date":"2026-11-13"}).json()
    c.post(f"/api/actions/{action['id']}/approve",json={"approved":True}).raise_for_status()
    return action["id"]

@pytest.mark.parametrize("failure",["connection","timeout","http_error"])
def test_live_outage_preserves_analysis_approval_and_audit(client,monkeypatch,failure):
    aid=approved(client)
    prior=client.get("/api/cases/amina/timeline").json()
    old_action=client.get(f"/api/actions/{aid}").json()
    old_audit=client.get("/api/cases/amina/audit").json()
    monkeypatch.setenv("OPENAI_API_KEY","not-a-secret-test-value")
    monkeypatch.setenv("OPENAI_MODEL","mock")
    monkeypatch.delenv("CARERELAY_OFFLINE",raising=False)
    def provider(url,**kwargs):
        if failure=="connection": raise httpx.ConnectError("simulated")
        if failure=="timeout": raise httpx.ReadTimeout("simulated")
        return httpx.Response(503,request=httpx.Request("POST",url),text="untrusted provider details")
    monkeypatch.setattr(httpx,"post",provider)
    response=client.post("/api/cases/amina/analyze",json={"mode":"live"})
    assert response.status_code==503
    assert "untrusted provider details" not in response.text
    assert "not-a-secret-test-value" not in response.text
    assert client.get("/api/cases/amina/timeline").json()==prior
    assert client.get(f"/api/actions/{aid}").json()==old_action
    assert client.get("/api/cases/amina/audit").json()==old_audit
    # Switching to demo is an explicit separate request, not silent mode substitution.
    result=client.post("/api/cases/amina/analyze",json={"mode":"demo"})
    assert result.json()["mode"]=="deterministic_demo"

def test_offline_server_never_calls_provider_even_with_keys(client,monkeypatch):
    monkeypatch.setenv("CARERELAY_OFFLINE","1")
    monkeypatch.setenv("OPENAI_API_KEY","test")
    monkeypatch.setenv("OPENAI_MODEL","test")
    def forbidden(*args,**kwargs): raise AssertionError("Network provider was called")
    monkeypatch.setattr(httpx,"post",forbidden)
    prior=client.post("/api/cases/amina/analyze",json={"mode":"demo"}).json()
    result=client.post("/api/cases/amina/analyze",json={"mode":"live"})
    assert result.status_code==503 and "Offline server mode" in result.text
    assert client.get("/api/cases/amina/timeline").json()["revision"]==prior["revision"]

def test_frozen_backup_is_honest_read_only_and_exactly_sourced():
    root=Path(__file__).resolve().parents[1]
    data=json.loads((root/"offline-demo/snapshot.json").read_text(encoding="utf-8"))
    html=(root/"offline-demo/index.html").read_text(encoding="utf-8")
    assert data["live_ai_run"] is False and data["read_only"] is True
    assert data["analysis"]["mode"]=="deterministic_demo" and len(data["analysis"]["events"])==6
    assert "<script" not in html.lower() and "fetch(" not in html and "<form" not in html.lower()
    assert "READ ONLY" in html and "No live AI" in html
    for event in data["analysis"]["events"]:
        ev=event["evidence"]
        text=next(r["text"] for r in data["analysis"]["records"] if r["id"]==ev["source_id"])
        assert text[ev["start"]:ev["end"]]==ev["quote"]
        assert hashlib.sha256(text.encode()).hexdigest()==ev["source_sha256"]
    assert data["approval_gate_status"]==403
    assert data["awaiting"]["completion"] is None
    assert data["completed"]["completion"]["clinically_verified"] is False
    assert data["no_match"]["selected"] is None
    assert data["planA"]["selected"]["id"]=="uhn_eye_existing_referral"
    assert data["planB"]["selected"]["id"]=="ontario_health811"

@pytest.mark.parametrize("origin,allowed",[("http://localhost:3000",True),("https://untrusted.invalid",False)])
def test_final_handoff_cors_boundary(client,origin,allowed):
    r=client.options("/api/cases/amina/analyze",headers={"Origin":origin,"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"content-type"})
    assert (r.status_code==200)==allowed
    assert (r.headers.get("access-control-allow-origin")==origin)==allowed
