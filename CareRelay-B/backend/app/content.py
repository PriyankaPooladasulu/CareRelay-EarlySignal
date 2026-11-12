"""Source-checked static education and closed-set narration. No generative voice answers."""
import json
from pathlib import Path

from .models import Analysis, EducationContent, VoiceRequest, VoiceResponse

EDUCATION = EducationContent.model_validate_json(
    (Path(__file__).resolve().parents[1] / "data" / "retina.json").read_text(encoding="utf-8"))
QUESTIONS = {
    "what is the retina": "retina",
    "why does this follow-up matter": "follow_up",
    "what can happen generally": "progression",
    "what can i do next": "next_steps",
    "what do my records say": "patient_facts",
    "do i have diabetic retinopathy": "diagnosis",
}
REFUSAL = ("I cannot diagnose an eye condition, assign a disease stage, predict your vision, or recommend personal treatment. "
           "An eye-care professional must assess your eyes. I can explain the approved general topics or show the supplied record evidence.")


def voice_response(request: VoiceRequest, analysis: Analysis | None = None):
    topic = request.topic
    if request.question is not None:
        normalized = " ".join(request.question.casefold().split()).rstrip("?.!")
        topic = QUESTIONS.get(normalized, "unsupported")
    segments, evidence = [], []

    def segment(scope, text, sources=None, events=None):
        segments.append({"scope": scope, "text": text, "source_ids": sources or [], "event_ids": events or []})

    def card(item):
        segment("general_education", item.text, item.source_ids)

    refused = topic in {"diagnosis", "unsupported"}
    revision = None
    if refused:
        segment("safety", REFUSAL)
    elif topic == "patient_facts":
        if analysis is None:
            # Caller normally returns 409; never fabricate a pre-analysis account.
            raise ValueError("Analyze the synthetic records first")
        revision = analysis.revision
        segment("limitation", "These are statements from the supplied synthetic records, not independently verified diagnoses or care status.")
        for e in analysis.events:
            segment("patient_record", f"Record dated {e.date.isoformat()}: {e.text}. Source says: {e.evidence.quote}", events=[e.id])
            evidence.append({"event_id": e.id, "date": e.date.isoformat(), "evidence": e.evidence.model_dump(mode="json")})
        if not analysis.events:
            segment("limitation", "There are no accepted record events. Review the original text and extraction warnings.")
    elif topic == "retina":
        card(EDUCATION.anatomy[0])
    elif topic == "follow_up":
        card(EDUCATION.follow_up)
    elif topic == "progression":
        for item in EDUCATION.states[1:]:
            card(item)
    elif topic == "state":
        card(next(item for item in EDUCATION.states if item.id == request.state))
    elif topic == "next_steps":
        segment("safety", "Review the original follow-up recommendation with your care team and clarify whether completion documentation exists. The Action Center can prepare a local calendar reminder after explicit approval. This prototype does not book appointments or send messages.")
    if topic in {"retina", "follow_up", "progression", "state"}:
        segment("limitation", EDUCATION.disclaimer)
        segment("limitation", EDUCATION.progression_limit)
    used = {sid for s in segments for sid in s["source_ids"]}
    return VoiceResponse(topic=topic, state=request.state, refused=refused, revision=revision,
                         segments=segments, transcript="\n\n".join(s["text"] for s in segments),
                         sources=[s for s in EDUCATION.sources if s.id in used], evidence=evidence)


def voice_catalog():
    # Stable captions for A's prerecorded audio; no clinical-approval claim.
    scripts = [voice_response(VoiceRequest(topic=t)).model_dump(mode="json")
               for t in ["retina", "follow_up", "progression", "next_steps", "diagnosis"]]
    scripts += [voice_response(VoiceRequest(topic="state", state=s.id)).model_dump(mode="json") for s in EDUCATION.states]
    return {"version": "1.0", "questions": [{"question": q + "?", "topic": t} for q, t in QUESTIONS.items()],
            "scripts": scripts, "patient_facts": "Generated only from the current validated analysis; never use prerecorded patient facts.",
            "rules": ["Use the supplied transcript verbatim for narration and captions.",
                      "Keep patient_record and general_education segments visually separate.",
                      "Display source links and evidence for their matching segments.",
                      "Unknown free-text questions return a fixed refusal; no LLM is called.",
                      "A owns audio assets/playback; text remains available when audio fails."]}
