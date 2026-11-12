"""Deterministic record-review findings, never disease or risk predictions."""
import hashlib

from .models import Analysis

EXPLICIT_NEGATIVES = {
    "patient reports that the recommended retinal examination has not yet been arranged",
    "retinal examination not completed",
    "retinal examination has not been completed",
}


def detect_signals(analysis: Analysis):
    events = sorted(analysis.events, key=lambda e: (e.date, e.id))
    findings = []
    source_ids = [r.id for r in analysis.records]

    def add(rule, concept, status, title, summary, supporting):
        supporting = sorted({e.id: e for e in supporting}.values(), key=lambda e: (e.date, e.id))
        identity = ":".join([rule, concept, status, analysis.revision])
        findings.append({
            "id": "sig_" + hashlib.sha256(identity.encode()).hexdigest()[:16],
            "rule": rule, "concept": concept, "status": status,
            "title": title, "summary": summary,
            "evidence": [{"event_id": e.id, "date": e.date.isoformat(),
                          "evidence": e.evidence.model_dump(mode="json")} for e in supporting],
            "education_topic": "retina",
        })

    for concept in sorted({e.concept for e in events}):
        group = [e for e in events if e.concept == concept]
        instructions = [e for e in group if e.kind == "instruction"]
        completions = [e for e in group if e.kind == "completion"]
        negatives = [e for e in group if e.kind == "not_completed" and
                     " ".join(e.evidence.quote.lower().split()).rstrip(".") in EXPLICIT_NEGATIVES]
        # Earlier noncompletion followed by later completion is a normal transition.
        # Day-only dates cannot establish ordering within a single day.
        conflicts = [(done, no) for done in completions for no in negatives if no.date >= done.date]
        if conflicts:
            add("conflict", concept, "needs_review", "Completion statements need reconciliation",
                "A completion statement and a same-day or later explicit noncompletion statement coexist. "
                "The supplied dates and notes cannot establish which account applies; neither is discarded.",
                [e for pair in conflicts for e in pair])
        if instructions:
            latest = max(e.date for e in instructions)
            later_done = [e for e in completions if e.date > latest]
            same_day = [e for e in completions if e.date == latest]
            if conflicts or (same_day and not later_done):
                status, title = "needs_review", "Follow-up status needs review"
                summary = "Conflicting statements or day-only ordering prevent automatic resolution of the instruction."
            elif later_done:
                status, title = "resolved", "Later completion documented"
                summary = "A later supplied record documents completion after the latest instruction. This is a record finding, not independent confirmation."
            else:
                status, title = "open", "Retinal follow-up remains unverified"
                summary = "No validated later completion was found after the latest instruction in the supplied records. Missing documentation does not prove care did not occur."
            add("unresolved_instruction", concept, status, title, summary,
                instructions + completions + [e for e in group if e.kind == "not_completed"])
        observations = [e for e in group if e.kind == "observation"]
        # Require two distinct dated encounters, not duplicate phrases in one note.
        if len({e.evidence.source_id for e in observations}) >= 2 and len({e.date for e in observations}) >= 2:
            add("repeated_observation", concept, "needs_review", "Observation repeated across encounters",
                "The same supported observation appears on at least two distinct source dates. Repetition is not evidence of worsening disease.", observations)
        missing = [e for e in group if e.kind == "missing_information"]
        if missing:
            add("missing_information", concept, "needs_review", "Referral destination not provided",
                "A supplied record explicitly reports missing referral-destination information. Verify it with the original care team; no destination is inferred.", missing)

    return {"revision": analysis.revision, "mode": "deterministic_rules", "rule_version": "1.0",
            "searched_source_ids": source_ids, "signals": findings,
            "limitations": ["Only validated events in the current supplied records are searched.",
                            "Unrecognized language can hide relevant information; review extraction warnings.",
                            "No diagnosis, urgency score, care action, or patient disease stage is inferred."],
            "extraction_warnings": analysis.warnings}
