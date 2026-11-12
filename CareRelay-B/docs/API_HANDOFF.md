# API handoff to Member A

Base URL: http://127.0.0.1:8000.
Allowed frontend origins: http://localhost:3000 and http://127.0.0.1:3000.
This local synthetic prototype has no authentication. Do not expose it publicly.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /health | Readiness and current scope |
| GET | /api/cases/amina | Patient, record count, event count and analyzed flag |
| GET | /api/cases/amina/records | Current original records |
| GET | /api/cases/amina/records/{source_id} | One original record |
| POST | /api/cases/amina/analyze | Analyze originals or supplied synthetic records |
| POST | /api/cases/amina/validate | Check candidate events against current originals without saving |
| GET | /api/cases/amina/timeline | Sorted events, mode, warnings and rejected candidates |
| GET | /api/cases/amina/events/{event_id}/evidence | Evidence and original source |
| GET | /openapi.json | Generated machine-readable API contract |

Timeline/evidence return 409 before the first analysis. Missing event/source IDs return 404. Invalid input returns 422. Live extraction failure returns 503 and preserves the previous successful analysis.

## Day 1 patient response

```json
{
  "patient": {"id":"DEMO-001","slug":"amina","name":"Amina","location":"Ontario","synthetic":true},
  "record_count": 3,
  "analyzed": false,
  "event_count": 0
}
```

## Day 2 analysis request

For the original three records:

```json
{"mode":"demo"}
```

For a custom synthetic record:

```json
{
  "mode":"demo",
  "records":[{
    "id":"synthetic-1",
    "date":"2026-10-30",
    "title":"Synthetic note",
    "text":"Retinal examination recommended.",
    "synthetic":true
  }]
}
```

Use "live" instead of "demo" only when the server has OPENAI_API_KEY and OPENAI_MODEL. No credentials belong in frontend code.

The response contains mode, events, rejected, warnings, records and revision. Original Amina demo mode yields six events across three source dates. This release returns no EarlySignal; that is Day 4.

## Day 3 evidence

Every event carries:

```text
id, date, date_provenance, kind, concept, text
evidence:
  source_id, source_title, quote, start, end,
  source_sha256, validation
```

The evidence endpoint returns event_id, evidence, original_record and offset_convention. Evidence is checked against a complete source sentence; partial quotes that remove negation are rejected. Dates must match source metadata. Kind/concept must agree with one of the supported semantic patterns.

Offsets are zero-based Unicode code points, start inclusive and end exclusive. Python uses text[start:end]. JavaScript strings use UTF-16 units, so use Array.from(text).slice(start,end).join("") for correct highlighting, including emoji. The source hash is SHA-256 of the UTF-8 source text.

Do not render source text as HTML. Use React text nodes or textContent.

## Integration example

Copy integration/api.ts into A's frontend codebase. Call createCareRelayClient with the backend URL, then client.analyze(), client.timeline() and client.evidence(eventId). Show the extraction mode and warnings. Keep original source text accessible.

On an evidence click, display original_record.text and highlight evidence.start to evidence.end with splitEvidenceText(). Do not infer diagnoses or missing-follow-up conclusions from these events.

The API is local, single-case and replaces the current analysis. It is not a multi-patient or concurrent collaboration service.

## Release 0.3.1 date input

The request record type is `RecordInput`; response records are `SourceRecord`. Do not post the derived response-only `date_provenance` field back as input.

The input date can be omitted or null when a single explicit source date is present in the first ten non-empty lines of the note. Recognized headers are a bare supported date or a line prefixed by Date:, Encounter date:, Visit date: or Record date:. Supported forms include 2026-10-31, October 31, 2026 and 31 October 2026. Month names may be standard three-letter abbreviations.

The backend does not extract dates from narrative sentences. Numeric formats such as 03/10/2026 are rejected rather than interpreted using a guessed locale. Multiple different headers or a metadata/header disagreement return 422 without overwriting saved data.

Every accepted event and normalized record carries `date_provenance`:

```json
{"origin":"source_header","quote":"October 31, 2026","start":6,"end":22}
```

The example offsets apply to a note beginning exactly `Date: October 31, 2026`. The end index is exclusive; compute highlighting from the returned values, never from this example. Origin is supplied_metadata, source_header or metadata_and_header. Supplied-only dates have null quote and offsets. All offsets refer to the untouched original text.

## Standalone candidate validation

POST /api/cases/amina/validate accepts the same candidate shape used by the structured extractor:

```json
{"events":[{"source_id":"visit1","date":"2026-10-03","kind":"instruction","concept":"retinal_exam","quote":"Retinal examination recommended."}]}
```

Response: `{events: [...], rejected: [...], saved: false}`. Dates on candidates must already be ISO dates and match their source. Validation uses the current stored originals, including before the first analysis when the three demo records are seeded. Unknown sources and unsupported quotes appear in `rejected`; invalid request schemas return 422. Use `client.validate(events)` in integration/api.ts. It does not call an LLM and does not add accepted candidates to the saved timeline.

## November 1-3 extension

Release 0.6.0 adds signals, education and safe voice content. See [API_DAYS_4_TO_6.md](API_DAYS_4_TO_6.md) and the regenerated OpenAPI schema. Existing routes above remain available.

## Days 7-9 extension
See API_DAYS_7_TO_9.md for resources, planning/replanning, explicit approval, cancellation and ICS endpoints. Use the updated integration/api.ts and openapi.json.

## Days 10-12 extension
Release 0.12.0 adds explicit unverified completion reports and append-only local audit history. See API_DAYS_10_TO_12.md for terminal-state semantics, pagination and migration.
