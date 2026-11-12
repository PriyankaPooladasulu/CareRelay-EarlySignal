"""Export a read-only rehearsal from actual local API responses; never label it live AI."""
from pathlib import Path
from datetime import datetime, timezone
from tempfile import TemporaryDirectory
from unittest.mock import patch
from html import escape
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/".runtime-deps"),str(ROOT)]
from fastapi.testclient import TestClient
from backend.app.main import create_app
from backend.app import workflow as wf
NOW=datetime(2026,11,12,12,tzinfo=timezone.utc)

def ok(response):
    response.raise_for_status()
    return response.json()

def export():
    out=ROOT/"offline-demo"
    out.mkdir(exist_ok=True)
    with TemporaryDirectory(prefix="carerelay-export-") as tmp, patch.object(wf,"utc_now",return_value=NOW):
        with TestClient(create_app(Path(tmp)/"demo.sqlite3")) as c:
            data={"release":"1.0.0","generated_at":datetime.now(timezone.utc).isoformat(),
                  "scenario_clock":NOW.isoformat(),"mode":"cached_deterministic_demo",
                  "live_ai_run":False,"read_only":True}
            data["analysis"]=ok(c.post("/api/cases/amina/analyze",json={"mode":"demo"}))
            data["signals"]=ok(c.get("/api/cases/amina/signals"))
            data["education"]=ok(c.get("/api/education/retina"))
            data["voice"]=ok(c.post("/api/cases/amina/voice",json={"topic":"patient_facts"}))
            data["resources"]=ok(c.get("/api/resources"))
            signal=next(s for s in data["signals"]["signals"] if s["rule"]=="unresolved_instruction")
            body={"revision":data["analysis"]["revision"],"signal_id":signal["id"],
                  "constraints":{"existing_referral_confirmed":True}}
            data["planA"]=ok(c.post("/api/cases/amina/plan",json=body))
            body["constraints"]["travel"]="cannot_travel"
            data["planB"]=ok(c.post("/api/cases/amina/plan",json=body))
            data["proposed"]=ok(c.post("/api/cases/amina/actions",json={"plan_id":data["planB"]["id"],"reminder_date":"2026-11-13"}))
            aid=data["proposed"]["id"]
            data["approval_gate_status"]=c.get(f"/api/actions/{aid}/calendar").status_code
            data["approved"]=ok(c.post(f"/api/actions/{aid}/approve",json={"approved":True}))
            calendar=c.get(f"/api/actions/{aid}/calendar");calendar.raise_for_status()
            data["calendar_sha256"]=hashlib.sha256(calendar.content).hexdigest()
            data["awaiting"]=ok(c.get(f"/api/actions/{aid}"))
            data["completed"]=ok(c.post(f"/api/actions/{aid}/complete",
                json={"confirmed":True,"completed_on":"2026-11-12","reported_by":"patient"}))
            data["audit"]=ok(c.get("/api/cases/amina/audit?limit=200"))
            body["constraints"]["accessibility"]="step_free"
            data["no_match"]=ok(c.post("/api/cases/amina/plan",json=body))
            data["diagnosis_refusal"]=ok(c.post("/api/cases/amina/voice",json={"question":"Do I have diabetic retinopathy?"}))
            (ROOT/"docs"/"openapi.json").write_text(json.dumps(c.get("/openapi.json").json(),indent=2),encoding="utf-8")
            (ROOT/"docs"/"VOICE_SCRIPTS.json").write_text(json.dumps(c.get("/api/voice/catalog").json(),indent=2),encoding="utf-8")
    (out/"snapshot.json").write_text(json.dumps(data,indent=2),encoding="utf-8")
    e=lambda text:escape(str(text))
    def details(title,value):
        return f"<details><summary>{e(title)}</summary><pre>{e(json.dumps(value,indent=2))}</pre></details>"
    sections=[]
    sections.append("<section><h2>1. Supplied records and exact evidence</h2><p>Three synthetic records; six accepted events. Deterministic extraction, not a live AI response.</p>")
    for event in data["analysis"]["events"]:
        ev=event["evidence"]
        sections.append(f"<article><strong>{e(event['date'])} · {e(event['kind'])}</strong><p>{e(event['text'])}</p><blockquote>{e(ev['quote'])}</blockquote><small>{e(ev['source_id'])} · Unicode characters {ev['start']}–{ev['end']}</small></article>")
    sections.append(details("Original records",data["analysis"]["records"])+"</section>")
    sections.append("<section><h2>2. Missing signal and general education</h2><p>"+e(signal["summary"])+"</p><p>The record finding remains separate from any later user report.</p>")
    for state in data["education"]["states"]:
        sections.append(f"<article><strong>{e(state['title'])}</strong><p>{e(state['text'])}</p></article>")
    sections.append("<p>"+e(data["education"]["disclaimer"])+"</p>"+details("Source-linked patient narration",data["voice"])+details("Education sources",data["education"]["sources"])+"</section>")
    sections.append("<section><h2>3. Travel rejection and alternative</h2><p>This scenario explicitly assumes an existing referral to the UHN clinic; Amina's notes do not establish it.</p><p>First option: "+e(data["planA"]["selected"]["name"])+". After cannot_travel: "+e(data["planB"]["selected"]["name"])+". Remote navigation does not replace an examination.</p><ol>")
    for step in data["planB"]["steps"]:
        sections.append("<li><strong>"+e(step["stage"].replace("_"," "))+"</strong>: "+e(step["message"])+"</li>")
    sections.append("</ol>"+details("Selected resource and official sources",data["planB"]["selected"])+details("No-match example: unverified step-free access",data["no_match"])+"</section>")
    sections.append("<section><h2>4. Approval and reported completion</h2><p>Recorded rehearsal states: proposed → approved → awaiting_confirmation → completed.</p><p>The pre-approval calendar request returned "+str(data["approval_gate_status"])+". No approval or completion action can be taken on this page.</p><p>Completed means an explicit unverified synthetic report, not clinical verification. The source timeline was not rewritten.</p>"+details("Recorded completion report",data["completed"]["completion"])+"</section>")
    sections.append("<section><h2>5. Recorded action history</h2><ol>")
    for event in data["audit"]["events"]:
        sections.append(f"<li>#{event['sequence']} {e(event['event_type'].replace('_',' '))} · {e(event['to_status'] or 'recorded')}</li>")
    sections.append("</ol><p>Local history is not authenticated or tamper-proof medical audit.</p></section>")
    sections.append("<section><h2>6. Safety and handoff</h2><p>"+e(data["diagnosis_refusal"]["transcript"])+"</p><p>When the backend is available, close this saved view and use START.cmd. Nothing viewed here changes its database. A's separate frontend, 3D and audio are not embedded in this backup.</p></section>")
    document="""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>CareRelay saved rehearsal</title><style>
    :root{font:16px/1.6 system-ui;color:#173441;background:#eef4f5}*{box-sizing:border-box}body{margin:0}header{background:#123e50;color:white;padding:30px max(24px,calc((100vw - 1000px)/2))}h1{font-size:32px}main{max-width:1050px;margin:auto;padding:24px}section{background:white;border:1px solid #cbdde2;border-radius:12px;margin:0 0 24px;padding:24px;overflow-wrap:anywhere}h2{font-size:23px}article{border-left:3px solid #16819a;padding:6px 16px;margin:18px 0}blockquote{margin-left:0;color:#275f70}small{color:#526f7b}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eff4f5;padding:16px;font-size:13px}summary{cursor:pointer;font-weight:600;padding:10px 0}.badge{background:#fff0ba;color:#45350a;padding:12px 18px;border-radius:8px}li{margin:8px 0}details{margin:10px 0}</style></head><body><header><p>MEMBER B · SAVED SYNTHETIC REHEARSAL</p><h1>CareRelay EarlySignal</h1><p class="badge">READ ONLY · Cached deterministic demo · No live AI · No actions are executed</p><p>Scenario: November 12, 2026. This saved example does not establish current resource eligibility or completed care.</p></header><main>"""
    (out/"index.html").write_text(document+"".join(sections)+"</main></body></html>",encoding="utf-8")
    print("Exported read-only deterministic rehearsal and current API contracts.")

if __name__=="__main__":
    export()
