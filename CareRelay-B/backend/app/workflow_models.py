from datetime import date, datetime
from typing import Literal
from pydantic import Field, StrictBool, field_validator
from .models import StrictModel


class Resource(StrictModel):
    id: str
    name: str
    kind: Literal["clinic", "navigation", "directory"]
    jurisdiction: list[str]
    location: str
    delivery: Literal["in_person", "remote"]
    purpose: str
    eligibility: str
    requires_existing_referral: bool
    languages: list[str]
    accessibility: list[str]
    requires_phone: bool
    source_urls: list[str]
    verified_on: date
    review_due: date
    verification_note: str
    limitations: list[str]


class ResourceRegistry(StrictModel):
    version: str
    resources: list[Resource]
    disclaimer: str


class Constraints(StrictModel):
    jurisdiction: str = Field(default="Ontario", min_length=1, max_length=50)
    travel: Literal["any", "cannot_travel"] = "any"
    language: str = Field(default="any", min_length=1, max_length=30)
    accessibility: Literal["none", "tty", "step_free"] = "none"
    phone_available: StrictBool = True
    existing_referral_confirmed: StrictBool = False


class PlanRequest(StrictModel):
    revision: str = Field(pattern=r"^[0-9a-f]{64}$")
    signal_id: str = Field(min_length=1, max_length=80)
    constraints: Constraints = Field(default_factory=Constraints)


class Evaluation(StrictModel):
    resource_id: str
    eligible: bool
    reasons: list[str]


class PlanStep(StrictModel):
    stage: Literal["checking_resource", "checking_constraints", "rejected", "searching_alternative", "selected", "no_verified_match"]
    resource_id: str | None = None
    message: str


class Plan(StrictModel):
    id: str
    revision: str
    signal_id: str
    constraints: Constraints
    registry_digest: str
    created_at: datetime
    active: bool = True
    mode: Literal["deterministic_navigation"] = "deterministic_navigation"
    status: Literal["proposed", "no_verified_match"]
    selected: Resource | None
    evaluations: list[Evaluation]
    steps: list[PlanStep]
    limitations: list[str]


class ProposeReminder(StrictModel):
    plan_id: str
    reminder_date: date

    @field_validator("reminder_date", mode="before")
    @classmethod
    def explicit_date(cls, value):
        from .dates import normalize_date
        return normalize_date(value)


class ApproveReminder(StrictModel):
    approved: StrictBool


ActionStatus = Literal["proposed", "approved", "awaiting_confirmation", "cancelled", "invalidated", "completed"]


class CompletionRequest(StrictModel):
    confirmed: StrictBool
    completed_on: date
    reported_by: Literal["patient", "caregiver"]

    @field_validator("completed_on", mode="before")
    @classmethod
    def explicit_date(cls, value):
        from .dates import normalize_date
        return normalize_date(value)


class CompletionReport(StrictModel):
    completed_on: date
    reported_by: Literal["patient", "caregiver"]
    confirmed_at: datetime
    basis: Literal["explicit_unverified_report"] = "explicit_unverified_report"
    clinically_verified: Literal[False] = False


class ReminderAction(StrictModel):
    id: str
    plan_id: str
    revision: str
    registry_digest: str
    resource: Resource
    reminder_date: date
    summary: str
    description: str
    status: ActionStatus = "proposed"
    created_at: datetime
    approved_at: datetime | None = None
    calendar_generated_at: datetime | None = None
    invalidation_reason: str | None = None
    is_appointment: Literal[False] = False
    care_completed: Literal[False] = False
    completion: CompletionReport | None = None


class AuditEvent(StrictModel):
    sequence: int
    created_at: datetime
    entity_type: Literal["system", "analysis", "plan", "action"]
    entity_id: str
    event_type: str
    from_status: str | None
    to_status: str | None
    revision: str | None
    details: dict


class AuditPage(StrictModel):
    events: list[AuditEvent]
    next_cursor: int | None
    limitation: str = ("Local append-only history of successful changes, not an authenticated or tamper-proof medical audit. "
                       "Legacy snapshots do not reconstruct events before audit logging was installed.")
