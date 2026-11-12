"""Curated, deterministic constraint checks. No live search, generated URLs or clinical ranking."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from .workflow_models import ResourceRegistry, Constraints, Evaluation, PlanStep

REGISTRY_PATH = Path(__file__).resolve().parents[1] / "data" / "resources.json"


def utc_now():
    return datetime.now(timezone.utc)


def registry_snapshot():
    registry = ResourceRegistry.model_validate_json(REGISTRY_PATH.read_text(encoding="utf-8"))
    if len({r.id for r in registry.resources}) != len(registry.resources):
        raise ValueError("Resource IDs must be unique")
    digest = hashlib.sha256(json.dumps(registry.model_dump(mode="json"), sort_keys=True).encode()).hexdigest()
    return registry, digest


def check_resource(resource, constraints: Constraints, today):
    reasons = []
    if not resource.verified_on <= today <= resource.review_due:
        reasons.append("resource_review_out_of_date")
    if constraints.jurisdiction.strip().casefold() not in {j.casefold() for j in resource.jurisdiction}:
        reasons.append("jurisdiction_not_supported")
    if constraints.travel == "cannot_travel" and resource.delivery == "in_person":
        reasons.append("in_person_pathway_conflicts_with_travel_constraint")
    if resource.requires_existing_referral and not constraints.existing_referral_confirmed:
        reasons.append("existing_referral_to_this_clinic_not_confirmed")
    language = constraints.language.strip().casefold()
    if language != "any" and language not in resource.languages:
        reasons.append("requested_language_not_verified")
    if constraints.accessibility != "none" and constraints.accessibility not in resource.accessibility:
        reasons.append("requested_accessibility_not_verified")
    if resource.requires_phone and not constraints.phone_available:
        reasons.append("telephone_access_required")
    return Evaluation(resource_id=resource.id, eligible=not reasons, reasons=reasons)


def select_resource(registry, constraints, today):
    evaluations, steps = [], []
    selected = None
    for resource in registry.resources:
        steps.append(PlanStep(stage="checking_resource", resource_id=resource.id,
                              message="Checking the curated resource and review date."))
        result = check_resource(resource, constraints, today)
        evaluations.append(result)
        steps.append(PlanStep(stage="checking_constraints", resource_id=resource.id,
                              message="Checking jurisdiction, travel, referral, language, accessibility and telephone access."))
        if not result.eligible:
            steps.append(PlanStep(stage="rejected", resource_id=resource.id, message="; ".join(result.reasons)))
            steps.append(PlanStep(stage="searching_alternative", message="Searching the remaining curated options."))
            continue
        selected = resource
        steps.append(PlanStep(stage="selected", resource_id=resource.id,
                              message="Matches the declared navigation constraints; confirm service eligibility directly."))
        break
    if selected is None:
        steps.append(PlanStep(stage="no_verified_match", message="No curated option satisfies every requested constraint. No action is proposed."))
    return selected, evaluations, steps
