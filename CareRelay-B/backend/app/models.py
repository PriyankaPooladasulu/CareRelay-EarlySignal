from datetime import date as Date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Patient(StrictModel):
    id: str
    slug: str
    name: str
    location: str
    synthetic: Literal[True] = True


class DateProvenance(StrictModel):
    origin: Literal["supplied_metadata", "source_header", "metadata_and_header"] = "supplied_metadata"
    quote: str | None = None
    start: int | None = Field(default=None, ge=0)
    end: int | None = Field(default=None, gt=0)


class Record(StrictModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,50}$")
    date: Date
    title: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1, max_length=12000)
    synthetic: Literal[True] = True
    date_provenance: DateProvenance = Field(default_factory=DateProvenance)


class IngestRecord(StrictModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,50}$")
    date: Date | None = None
    title: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1, max_length=12000)
    synthetic: Literal[True] = True

    @field_validator("date", mode="before")
    @classmethod
    def normalize_supplied_date(cls, value):
        from .dates import normalize_date
        return normalize_date(value) if value is not None else None

    @model_validator(mode="after")
    def check_source_date(self):
        from .dates import resolve_record_date
        resolve_record_date(self.date, self.text)
        return self

    def to_record(self):
        from .dates import resolve_record_date
        resolved, provenance = resolve_record_date(self.date, self.text)
        return Record(id=self.id, date=resolved, title=self.title, text=self.text,
                      synthetic=True, date_provenance=DateProvenance(**provenance))


Kind = Literal["instruction", "observation", "completion", "not_completed", "missing_information"]
Concept = Literal["retinal_exam", "type_2_diabetes", "retinal_referral"]


class Candidate(StrictModel):
    source_id: str
    date: Date
    kind: Kind
    concept: Concept
    quote: str = Field(min_length=1, max_length=2000)


class CandidateBatch(StrictModel):
    events: list[Candidate] = Field(max_length=100)


class Evidence(StrictModel):
    source_id: str
    source_title: str
    quote: str
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    source_sha256: str
    validation: Literal["exact_span_and_bounded_semantic_rule"]


class Event(StrictModel):
    id: str
    date: Date
    kind: Kind
    concept: Concept
    text: str
    evidence: Evidence
    date_provenance: DateProvenance = Field(default_factory=DateProvenance)


class Rejection(StrictModel):
    candidate: Candidate
    reason: str


class Analysis(StrictModel):
    mode: Literal["deterministic_demo", "live_llm_validated"]
    events: list[Event]
    rejected: list[Rejection]
    warnings: list[str]
    records: list[Record]
    revision: str


class AnalyzeRequest(StrictModel):
    records: list[IngestRecord] | None = Field(default=None, min_length=1, max_length=20)
    mode: Literal["demo", "live"] = "demo"

    @field_validator("records")
    @classmethod
    def unique_ids(cls, records):
        if records and len({r.id for r in records}) != len(records):
            raise ValueError("Source IDs must be unique")
        return records


class CandidateValidation(StrictModel):
    events: list[Event]
    rejected: list[Rejection]
    saved: Literal[False] = False


class SignalEvidence(StrictModel):
    event_id: str
    date: Date
    evidence: Evidence


class Signal(StrictModel):
    id: str
    rule: Literal["unresolved_instruction", "repeated_observation", "conflict", "missing_information"]
    concept: Concept
    status: Literal["open", "resolved", "needs_review"]
    title: str
    summary: str
    evidence: list[SignalEvidence]
    education_topic: Literal["retina"]


class SignalReport(StrictModel):
    revision: str
    mode: Literal["deterministic_rules"]
    rule_version: str
    searched_source_ids: list[str]
    signals: list[Signal]
    limitations: list[str]
    extraction_warnings: list[str]


EducationState = Literal["normal", "early", "progressing", "advanced"]
VoiceTopic = Literal["retina", "follow_up", "progression", "next_steps", "patient_facts", "diagnosis", "state"]


class ContentSource(StrictModel):
    id: str
    title: str
    publisher: str
    url: str
    checked_on: Date


class EducationCard(StrictModel):
    id: str
    title: str
    text: str
    source_ids: list[str]
    scope: Literal["general_education"] = "general_education"


class EducationalState(EducationCard):
    id: EducationState
    anatomy_focus: list[str]


class EducationContent(StrictModel):
    topic: Literal["retina"]
    version: str
    review_status: Literal["source_checked_prototype_clinical_review_pending"]
    disclaimer: str
    progression_limit: str
    sources: list[ContentSource]
    anatomy: list[EducationCard]
    follow_up: EducationCard
    states: list[EducationalState]


class VoiceRequest(StrictModel):
    topic: VoiceTopic | None = None
    question: str | None = Field(default=None, min_length=1, max_length=500)
    state: EducationState | None = None

    @model_validator(mode="after")
    def valid_selection(self):
        if (self.topic is None) == (self.question is None):
            raise ValueError("Provide exactly one of topic or question")
        if self.topic == "state" and self.state is None:
            raise ValueError("State narration requires a state")
        if self.topic != "state" and self.state is not None:
            raise ValueError("State is only valid for state narration")
        return self


class VoiceSegment(StrictModel):
    scope: Literal["general_education", "patient_record", "limitation", "safety"]
    text: str
    source_ids: list[str] = Field(default_factory=list)
    event_ids: list[str] = Field(default_factory=list)


class VoiceResponse(StrictModel):
    topic: str
    state: EducationState | None = None
    mode: Literal["allowlisted_scripts"] = "allowlisted_scripts"
    approval: Literal["prototype_allowlist_not_clinical_approval"] = "prototype_allowlist_not_clinical_approval"
    refused: bool
    revision: str | None = None
    segments: list[VoiceSegment]
    transcript: str
    sources: list[ContentSource]
    evidence: list[SignalEvidence]
    audio_available: Literal[False] = False
