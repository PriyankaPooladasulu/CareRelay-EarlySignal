import json
from datetime import timedelta
from uuid import uuid4
from fastapi import HTTPException
from .models import Analysis
from .workflow_models import Plan, ReminderAction, CompletionReport
from .signals import detect_signals
from .navigation import registry_snapshot, select_resource, check_resource, utc_now
from .calendar_file import create_calendar


class Workflow:
    """State checks and writes share SQLite's write transaction, including approval/download races."""
    def __init__(self, store):
        self.store = store

    @staticmethod
    def _analysis(db):
        row = db.execute("SELECT payload FROM analysis WHERE id=1").fetchone()
        if not row:
            raise HTTPException(409, "Analyze the synthetic records first.")
        return Analysis.model_validate_json(row[0])

    @staticmethod
    def _plan(db, plan_id):
        row = db.execute("SELECT payload FROM navigation_plans WHERE id=?", (plan_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Plan not found.")
        return Plan.model_validate_json(row[0])

    @staticmethod
    def _action(db, action_id):
        row = db.execute("SELECT payload,calendar FROM reminder_actions WHERE id=?", (action_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Reminder not found.")
        return ReminderAction.model_validate_json(row[0]), row[1]

    @staticmethod
    def _write_action(db, action, calendar=None):
        db.execute("UPDATE reminder_actions SET payload=?,calendar=COALESCE(?,calendar) WHERE id=?",
                   (action.model_dump_json(), calendar, action.id))

    def _current(self, db, plan):
        analysis = self._analysis(db)
        registry, digest = registry_snapshot()
        if not plan.active or plan.revision != analysis.revision or plan.registry_digest != digest:
            raise HTTPException(409, "Plan is stale. Replan and approve the new proposal.")
        signal = next((s for s in detect_signals(analysis)["signals"] if s["id"] == plan.signal_id), None)
        if not signal or signal["rule"] != "unresolved_instruction" or signal["status"] != "open":
            raise HTTPException(409, "An open, unambiguous follow-up signal is required.")
        resource = next((r for r in registry.resources if plan.selected and r.id == plan.selected.id), None)
        if resource is None or not check_resource(resource, plan.constraints, utc_now().date()).eligible:
            raise HTTPException(409, "No currently verified matching resource; replan before proposing an action.")

    def plan(self, request):
        with self.store.connection() as db:
            analysis = self._analysis(db)
            if request.revision != analysis.revision:
                raise HTTPException(409, "Analysis revision changed. Reload the signal.")
            signal = next((s for s in detect_signals(analysis)["signals"] if s["id"] == request.signal_id), None)
            if not signal or signal["rule"] != "unresolved_instruction" or signal["status"] != "open":
                raise HTTPException(409, "Select an open unresolved instruction. Conflicts require manual review.")
            registry, digest = registry_snapshot()
            selected, evaluations, steps = select_resource(registry, request.constraints, utc_now().date())
            plan = Plan(id="plan_" + uuid4().hex, revision=analysis.revision, signal_id=signal["id"],
                        constraints=request.constraints, registry_digest=digest, created_at=utc_now(),
                        status="proposed" if selected else "no_verified_match", selected=selected,
                        evaluations=evaluations, steps=steps,
                        limitations=[registry.disclaimer, "Fixed registry order is a demonstration policy, not clinical ranking.",
                                     "Remote navigation does not replace an in-person examination.",
                                     "Replanning invalidates old approvals. Previously imported calendar files cannot be recalled."])
            self.store.invalidate_workflow(db, "replanned")
            db.execute("INSERT INTO navigation_plans VALUES(?,?)", (plan.id, plan.model_dump_json()))
            self.store.audit_event(db, "plan", plan.id, "plan_created", to_status=plan.status,
                                   revision=plan.revision, details={"signal_id": plan.signal_id,
                                   "constraints": plan.constraints.model_dump(), "registry_digest": digest})
            previous_stage = None
            for step in steps:
                self.store.audit_event(db, "plan", plan.id, "plan_step", from_status=previous_stage,
                                       to_status=step.stage, revision=plan.revision,
                                       details={"resource_id": step.resource_id, "message": step.message})
                previous_stage = step.stage
            return plan

    def get_plan(self, plan_id):
        with self.store.connection() as db:
            return self._plan(db, plan_id)

    def propose(self, request):
        with self.store.connection() as db:
            plan = self._plan(db, request.plan_id)
            self._current(db, plan)
            if not utc_now().date() <= request.reminder_date <= utc_now().date() + timedelta(days=365):
                raise HTTPException(422, "Choose a reminder date from today through the next 365 days (server UTC date).")
            existing = db.execute("SELECT payload FROM reminder_actions WHERE plan_id=?", (plan.id,)).fetchall()
            for row in existing:
                action = ReminderAction.model_validate_json(row[0])
                if action.status not in {"cancelled", "invalidated"}:
                    if action.reminder_date == request.reminder_date:
                        return action
                    raise HTTPException(409, "Cancel the existing proposal before choosing a different date.")
            action = ReminderAction(id="act_" + uuid4().hex, plan_id=plan.id, revision=plan.revision,
                                    registry_digest=plan.registry_digest, resource=plan.selected,
                                    reminder_date=request.reminder_date, created_at=utc_now(),
                                    summary="CareRelay synthetic follow-up reminder - not an appointment",
                                    description="Synthetic demonstration. Review the documented retinal examination recommendation and clarify next steps with an appropriate care team. "
                                    + "Navigation resource: " + plan.selected.name + ". " + plan.selected.purpose
                                    + " Source: " + plan.selected.source_urls[0]
                                    + " This is an administrative reminder only: no appointment is booked and no care completion is established.")
            db.execute("INSERT INTO reminder_actions VALUES(?,?,?,NULL)", (action.id, plan.id, action.model_dump_json()))
            self.store.audit_event(db, "action", action.id, "action_proposed", to_status="proposed",
                                   revision=action.revision, details={"plan_id": plan.id,
                                   "reminder_date": action.reminder_date.isoformat(), "resource_id": action.resource.id})
            return action

    def get_action(self, action_id):
        with self.store.connection() as db:
            action, _ = self._action(db, action_id)
            return action

    def approve(self, action_id, request):
        if request.approved is not True:
            raise HTTPException(422, "Explicit approved=true is required. Use cancel to decline.")
        with self.store.connection() as db:
            action, _ = self._action(db, action_id)
            self._current(db, self._plan(db, action.plan_id))
            if action.status in {"cancelled", "invalidated", "completed"}:
                raise HTTPException(409, "This proposal is no longer approvable.")
            if action.reminder_date < utc_now().date():
                raise HTTPException(409, "Reminder date has passed. Cancel and create a new proposal.")
            if action.status == "proposed":
                action.status = "approved"
                action.approved_at = utc_now()
                self._write_action(db, action)
                self.store.audit_event(db, "action", action.id, "action_approved",
                                       from_status="proposed", to_status="approved", revision=action.revision,
                                       details={"explicit_approval": True})
            return action

    def cancel(self, action_id):
        with self.store.connection() as db:
            action, _ = self._action(db, action_id)
            if action.status in {"invalidated", "completed"}:
                raise HTTPException(409, "A completed or invalidated action cannot be cancelled.")
            if action.status == "cancelled":
                return action
            self.store.audit_event(db, "action", action.id, "action_cancelled",
                                   from_status=action.status, to_status="cancelled", revision=action.revision)
            action.status = "cancelled"
            self._write_action(db, action)
            return action

    def calendar(self, action_id):
        with self.store.connection() as db:
            action, calendar = self._action(db, action_id)
            self._current(db, self._plan(db, action.plan_id))
            if action.status not in {"approved", "awaiting_confirmation"} or not action.approved_at:
                raise HTTPException(403, "Approve the current reminder proposal before generating or downloading a calendar file.")
            if calendar is None:
                if action.reminder_date < utc_now().date():
                    raise HTTPException(409, "Reminder date has passed. Cancel and propose a new date.")
                calendar = create_calendar(action, utc_now())
                action.status = "awaiting_confirmation"
                action.calendar_generated_at = utc_now()
                self._write_action(db, action, calendar)
                self.store.audit_event(db, "action", action.id, "calendar_generated",
                                       from_status="approved", to_status="awaiting_confirmation",
                                       revision=action.revision,
                                       details={"calendar_import_verified": False, "care_completed": False})
            return calendar


    def complete(self, action_id, request):
        if request.confirmed is not True:
            raise HTTPException(422, "Explicit confirmed=true is required. Not yet leaves the action awaiting confirmation.")
        with self.store.connection() as db:
            action, calendar = self._action(db, action_id)
            if action.status == "completed":
                if (action.completion.completed_on == request.completed_on
                        and action.completion.reported_by == request.reported_by):
                    return action
                raise HTTPException(409, "This immutable completion report already exists with different details.")
            if action.status != "awaiting_confirmation" or not action.approved_at or not calendar:
                raise HTTPException(409, "Only an approved reminder awaiting confirmation can receive a completion report.")
            plan = self._plan(db, action.plan_id)
            analysis = self._analysis(db)
            if not plan.active or plan.revision != analysis.revision:
                raise HTTPException(409, "The records or plan changed. Review the current workflow before confirming.")
            signal = next((s for s in detect_signals(analysis)["signals"] if s["id"] == plan.signal_id), None)
            if not signal or signal["status"] != "open":
                raise HTTPException(409, "The current record finding requires review before confirmation.")
            instructions = [e.date for e in analysis.events
                            if e.kind == "instruction" and e.concept == signal["concept"]]
            if not instructions or not max(instructions) <= request.completed_on <= utc_now().date():
                raise HTTPException(422, "Completion date must be on or after the latest documented instruction and no later than today (UTC).")
            # Reporting a past action is not a new resource recommendation: registry expiry
            # does not prevent a report tied to the unchanged approved plan and records.
            action.completion = CompletionReport(completed_on=request.completed_on,
                                                 reported_by=request.reported_by, confirmed_at=utc_now())
            action.status = "completed"
            self._write_action(db, action)
            self.store.audit_event(db, "action", action.id, "completion_reported",
                                   from_status="awaiting_confirmation", to_status="completed",
                                   revision=action.revision, details=action.completion.model_dump(mode="json"))
            return action
