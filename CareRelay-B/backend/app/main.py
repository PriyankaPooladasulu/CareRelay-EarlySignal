import hashlib
import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from .extraction import ExtractionUnavailable, analyze, validate_candidates
from .models import Analysis, AnalyzeRequest, Patient, Record, CandidateBatch, CandidateValidation
from .storage import Store
from .signals import detect_signals
from .content import EDUCATION, QUESTIONS, voice_catalog, voice_response
from .models import SignalReport, EducationContent, VoiceRequest, VoiceResponse
from .workflow import Workflow
from .navigation import registry_snapshot
from .workflow_models import ResourceRegistry, PlanRequest, Plan, ProposeReminder, ApproveReminder, ReminderAction, CompletionRequest, AuditPage

DATA = Path(__file__).resolve().parents[1] / "data"


def load_json(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def demo_records():
    return [Record(id=f"visit{i}", date=f"2026-10-{day}", title=f"Synthetic encounter {i}",
                   text=(DATA / f"visit{i}.txt").read_text(encoding="utf-8"))
            for i, day in [(1, "03"), (2, "13"), (3, "24")]]


def create_app(db_path=None):
    patient = Patient.model_validate(load_json("patient.json")).model_dump(mode="json")
    originals = [r.model_dump(mode="json") for r in demo_records()]
    store = Store(db_path or os.getenv("CARERELAY_DB", str(DATA / "carerelay.sqlite3")), patient, originals)
    workflow = Workflow(store)
    app = FastAPI(title="CareRelay EarlySignal - Member B release", version="1.0.0",
                  description="Synthetic-only local prototype: records, structured extraction and evidence. No clinical validation or authentication; bind to 127.0.0.1.")
    app.state.store = store
    app.add_middleware(CORSMiddleware,
                       allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

    def saved_analysis():
        saved = store.analysis()
        if not saved:
            raise HTTPException(409, "Analyze the synthetic records first.")
        return Analysis.model_validate(saved).model_dump(mode="json")

    @app.get("/", include_in_schema=False)
    def console():
        return FileResponse(DATA / "console.html")

    @app.get("/health")
    def health():
        return {"status": "ok", "synthetic_only": True, "scope": "B_days_1_to_15",
                "default_mode": "deterministic_demo"}

    @app.get("/api/cases/amina")
    def get_patient():
        saved = store.analysis()
        return {"patient": store.patient(), "record_count": len(store.records()),
                "analyzed": bool(saved), "event_count": len(saved["events"]) if saved else 0}

    @app.get("/api/cases/amina/records", response_model=list[Record])
    def records():
        return store.records()

    @app.get("/api/cases/amina/records/{source_id}", response_model=Record)
    def source(source_id: str):
        for record in store.records():
            if record["id"] == source_id:
                return record
        raise HTTPException(404, "Source not found.")

    @app.post("/api/cases/amina/analyze", response_model=Analysis)
    def analyze_case(request: AnalyzeRequest = AnalyzeRequest()):
        # With no custom records, deliberately restore the three original demo notes.
        records = [r.to_record() for r in request.records] if request.records else demo_records()
        try:
            result = analyze(records, request.mode)
        except ExtractionUnavailable as exc:
            raise HTTPException(503, str(exc)) from exc
        result["records"] = [r.model_dump(mode="json") for r in records]
        digest_input = {"records": result["records"], "events": result["events"]}
        result["revision"] = hashlib.sha256(json.dumps(digest_input, sort_keys=True).encode()).hexdigest()
        # Validate before persisting or returning any patient facts.
        validated = Analysis.model_validate(result).model_dump(mode="json")
        store.save_analysis(validated)
        return validated

    @app.post("/api/cases/amina/validate", response_model=CandidateValidation)
    def validate(request: CandidateBatch):
        records = [Record.model_validate(r) for r in store.records()]
        accepted, rejected = validate_candidates(records, request.events)
        return {"events": accepted, "rejected": rejected, "saved": False}

    @app.get("/api/cases/amina/timeline")
    def timeline():
        saved = saved_analysis()
        return {"events": saved["events"], "mode": saved["mode"],
                "warnings": saved["warnings"], "rejected": saved["rejected"], "revision": saved["revision"]}

    @app.get("/api/cases/amina/events/{event_id}/evidence")
    def evidence(event_id: str):
        saved = saved_analysis()
        for event in saved["events"]:
            if event["id"] == event_id:
                original = next(r for r in saved["records"] if r["id"] == event["evidence"]["source_id"])
                return {"event_id": event_id, "evidence": event["evidence"], "original_record": original,
                        "offset_convention": "Python Unicode code points; zero-based start inclusive, end exclusive."}
        raise HTTPException(404, "Event not found.")

    @app.get("/api/cases/amina/signals", response_model=SignalReport)
    def signals():
        return detect_signals(Analysis.model_validate(saved_analysis()))

    @app.get("/api/education/retina", response_model=EducationContent)
    def education():
        return EDUCATION

    @app.get("/api/voice/catalog")
    def narration_catalog():
        return voice_catalog()

    @app.post("/api/cases/amina/voice", response_model=VoiceResponse)
    def narration(request: VoiceRequest):
        topic = request.topic
        if request.question is not None:
            topic = QUESTIONS.get(" ".join(request.question.casefold().split()).rstrip("?.!"), "unsupported")
        snapshot = Analysis.model_validate(saved_analysis()) if topic == "patient_facts" else None
        return voice_response(request, snapshot)

    @app.get("/api/resources", response_model=ResourceRegistry)
    def resources():
        return registry_snapshot()[0]

    @app.post("/api/cases/amina/plan", response_model=Plan)
    def navigation_plan(request: PlanRequest):
        return workflow.plan(request)

    @app.get("/api/plans/{plan_id}", response_model=Plan)
    def get_plan(plan_id: str):
        return workflow.get_plan(plan_id)

    @app.post("/api/cases/amina/actions", response_model=ReminderAction)
    def propose_reminder(request: ProposeReminder):
        return workflow.propose(request)

    @app.get("/api/actions/{action_id}", response_model=ReminderAction)
    def get_action(action_id: str):
        return workflow.get_action(action_id)

    @app.post("/api/actions/{action_id}/approve", response_model=ReminderAction)
    def approve_reminder(action_id: str, request: ApproveReminder):
        return workflow.approve(action_id, request)

    @app.post("/api/actions/{action_id}/cancel", response_model=ReminderAction)
    def cancel_reminder(action_id: str):
        return workflow.cancel(action_id)

    @app.get("/api/actions/{action_id}/calendar")
    def reminder_calendar(action_id: str):
        return Response(workflow.calendar(action_id), media_type="text/calendar",
                        headers={"Content-Disposition": 'attachment; filename="carerelay-followup.ics"',
                                 "Cache-Control": "no-store"})

    @app.post("/api/actions/{action_id}/complete", response_model=ReminderAction)
    def complete_action(action_id: str, request: CompletionRequest):
        return workflow.complete(action_id, request)

    @app.get("/api/cases/amina/audit", response_model=AuditPage)
    def audit_history(after: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=200)):
        return store.audit_history(after, limit)

    return app


app = create_app()
