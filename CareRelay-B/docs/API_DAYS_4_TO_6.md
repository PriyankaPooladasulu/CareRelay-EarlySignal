# November 1-3 API handoff (v0.6.0)

B's new endpoints are read-only derivations of the current validated analysis or bundled content. No new tables, actions, external calls or migrations are needed. A owns the main frontend, 3D eye and audio.

| Method and route | Contract |
| --- | --- |
| GET /api/cases/amina/signals | SignalReport; 409 until analysis exists. |
| GET /api/education/retina | EducationContent; available before analysis and offline. |
| GET /api/voice/catalog | Static scripts, question allowlist and narration rules. |
| POST /api/cases/amina/voice | VoiceResponse; topic or question, never both. |

Use docs/openapi.json for full schemas and integration/api.ts for typed helpers. Existing routes retain their contracts.

## Signal semantics

All rules use accepted events from one saved Analysis snapshot. Findings contain deterministic IDs, rule, concept, status, source evidence and education_topic. The report supplies revision, searched_source_ids and extraction warnings. Absence claims are bounded to that snapshot and the supported vocabulary. Education_topic is a general topic link, never a disease-stage assignment.

- unresolved_instruction: inspect the latest instruction date for the concept. A completion strictly later than that date resolves the record finding. Older completion does not. Same-day completion without a strictly later one requires review because time-of-day is unknown. Repeated instructions after completion reopen the finding. Completion/noncompletion conflicts prevent automatic resolution.
- conflict: an explicit noncompletion statement on or after a completion date requires review. Both accounts are retained. Earlier noncompletion followed by later completion is an ordinary transition. A statement that documentation is absent is not treated as explicit noncompletion. No episode IDs exist, so conflicting accounts may concern different episodes; manual reconciliation is required. Historical conflicts remain visible even if a newer note exists.
- repeated_observation: the same concept appears as an observation in at least two distinct source IDs and two different dates. This chosen prototype threshold prevents duplicate sentences or same-day duplicate notes from counting as repeated encounters. It is not a severity measure.
- missing_information: a validated statement explicitly reports a missing retinal referral destination. No inference is made from unrelated absent fields. The limited extractor does not establish later destinations; inspect originals before treating old missing information as current.

Signals are computed on GET, not cached separately. Stable revisions yield stable results. Reanalysis immediately replaces the source snapshot. Compare report.revision to the displayed timeline revision and reload on mismatch. A resolved finding is a statement about records, not an action-state transition or independent confirmation.

## Education contract

Six anatomy cards, one follow-up explanation and four states (normal, early, progressing, advanced) share a source registry. Each card has scope general_education and source_ids; states also expose anatomy_focus for A's hotspots. Display disclaimer and progression_limit at all times. State selection is a user-controlled educational choice. Never infer a state from patient facts or the signal. See CONTENT_SOURCES.md for review limits.

## Voice contract

Examples:

~~~json
{"topic":"state","state":"early"}
{"topic":"patient_facts"}
{"question":"Do I have diabetic retinopathy?"}
~~~

Topics: retina, follow_up, progression, next_steps, patient_facts, diagnosis, state. Only state accepts and requires a state field. Unknown fields/topics/states return 422. Free-text questions normalize case, whitespace and trailing punctuation, then require an exact allowlist match. Mixed or unsupported questions return the same fixed refusal. This is a closed-set content system, not a general chatbot or symptom triage service. No LLM is called by these routes.

Response segments have scope (general_education, patient_record, limitation, safety), text, source_ids and event_ids. Transcript joins their text in order; it is the caption/narration source. Source references and record evidence are separate lists. General content has no patient revision. patient_facts requires analysis (409 otherwise), returns its revision and exact evidence, and never includes general disease staging.

The catalog's nine static scripts can be recorded by A. approval=prototype_allowlist_not_clinical_approval explicitly means software allowlisting, not clinician sign-off. audio_available=false: no audio recording or playback is supplied here. Keep captions available if audio fails. Do not prerecord dynamic patient facts or mix them into general education.

## Manual integration exercise

1. POST {} to analyze; GET signals -> one unresolved_instruction with status open for Amina.
2. Follow a signal evidence event_id to the existing evidence route; exact quote and source offsets match.
3. GET education; select each of four states and POST matching state narration. The first segment equals the selected card text.
4. POST patient_facts; check revision and evidence against the timeline.
5. POST a diagnosis question or arbitrary instruction -> refused=true with fixed content.
6. POST examples/all_signal_rules.json to analyze -> four findings (conflict, unresolved_instruction needing review, repeated_observation, missing_information).
7. POST examples/resolved_follow_up.json -> resolved instruction, no conflict. Restore originals with POST {}.

PowerShell example from the project folder:

~~~powershell
$body = Get-Content -Raw .\examples\all_signal_rules.json
Invoke-RestMethod http://127.0.0.1:8000/api/cases/amina/analyze -Method Post -ContentType 'application/json' -Body $body
Invoke-RestMethod http://127.0.0.1:8000/api/cases/amina/signals
~~~

Use text rendering for record text and captions. Preserve Unicode code-point offsets with Array.from(text). A's actual frontend was not supplied, so full 3D/audio integration remains a joint step.
