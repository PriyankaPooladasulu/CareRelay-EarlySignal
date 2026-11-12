# First-three-day delivery checklist

Reference: Final Project Roadmap.pdf, pages 55-57. Role detail: pages 34-35.
The corresponding DOCX checklist is unchanged after formatting normalization.

| Day | Requirement | Delivered implementation |
| --- | --- | --- |
| October 29 | FastAPI backend | backend/app/main.py; START.cmd |
| October 29 | SQLite database | backend/app/storage.py; automatic local initialization |
| October 29 | Patient/event/evidence schemas | backend/app/models.py |
| October 29 | Amina and three records | backend/data/patient.json and visit1.txt through visit3.txt |
| October 29 | Basic patient API | GET /api/cases/amina and original-record routes |
| October 30 | Record ingestion | Validated synthetic-record request body; custom note console |
| October 30 | Structured AI extraction | Optional structured-output adapter plus a clearly labeled deterministic demo |
| October 30 | Extract and normalize dates | Explicit source-date headers or supplied metadata; backend-derived provenance |
| October 30 | Observations/instructions/follow-up | Bounded supported kinds and concepts with no diagnostic generation |
| October 30 | JSON and timeline | Analyze and timeline endpoints; chronological ordering |
| October 31 | Link to source and exact quote | Source IDs, original text, source hashes, evidence endpoint |
| October 31 | Offsets and evidence verification | Whole-sentence evidence, Unicode offsets, semantic allowlist |
| October 31 | Reject unsupported claims | Rejected-candidate records and standalone validation endpoint |
| Together | Frontend integration | Typed helper, OpenAPI schema, console and handoff docs; A's actual frontend not supplied |

Live AI is implemented and mock-tested; the user's API key/model are required for live verification. The no-key demo is not presented as live AI. The requested work ends at October 31.

## Newly authorized Days 4-6

The user explicitly expanded the scope after the first-three-day delivery. The earlier scope boundary above is historical.

| Day | B deliverable | Implementation |
| --- | --- | --- |
| November 1 | Unresolved Instruction, Repeated Observation, Conflict, Missing Information; Amina signal | backend/app/signals.py, GET signals, console evidence links |
| November 2 | Retina/anatomy/follow-up/general progression, references and limits | backend/data/retina.json, GET education, source-mapped cards |
| November 3 | Approved scripts, safe-response rules, diagnosis refusal, facts/education separation, source links | backend/app/content.py, voice routes, docs/VOICE_SCRIPTS.json |
| Together | 3D and voice connection | Typed client, state IDs, anatomy focus, caption segments and console. A's actual 3D/audio project remains to be connected. |

Source-checked prototype education is delivered; qualified clinical review is pending and not claimed.

## Newly authorized Days 7-9
The user explicitly said "lets move to next 3 days", authorizing November 4-6.

| Day | B deliverable | Implementation |
| --- | --- | --- |
| November 4 | Resource registry, metadata, eligibility and constraint checking | resources.json, navigation.py, GET resources, RESOURCE_SOURCES.md |
| November 5 | Retrieve, evaluate, reject, search alternatives, replan/no match | Persisted revision-bound plans, real decision trace, travel rejection demo, strict unknown-capability checks |
| November 6 | Approval API, server gates, ICS, persisted action states | workflow.py, workflow_models.py, calendar_file.py, SQLite additive tables, action routes and local console |

Days 1-9 are delivered. A owns the main UI, 3D and audio. A's supplied source was reviewed separately and remains unintegrated. Resource matching is navigation only; no clinical ranking or appointment is claimed. Completion/audit and November 7+ remain deferred.

## Newly authorized Days 10-12
The user explicitly requested the next three days after Day 9: November 7-9.

| Day | B deliverable | Implementation |
| --- | --- | --- |
| November 7 | Completion API, confirmation logic, audit transitions, prevent automatic completion | Workflow.complete; CompletionRequest/Report; SQLite audit events, atomic writes, pagination, legacy migration and console |
| November 8 | Diagnosis, unsupported claim, injection, unauthorized action, missing evidence/resource checks | Regression tests and 23 measured safety checks; scoped B feature freeze |
| November 9 | Synthetic cases, extraction/evidence/signals/completion/conflict/action evaluation | 16 labeled cases; EVALUATE.cmd; 76 checks and JSON/Markdown results |

168 automated regression tests pass. Joint A-B UI/3D/audio integration remains unverified; the shared full-MVP freeze is not claimed. Final November 10+ release/offline/pitch work remains deferred.

## Final authorized B remainder
The November 4 request "now give me all remaining" authorizes the remaining B implementation/material work.

| Roadmap day | B responsibility | Delivery |
| --- | --- | --- |
| November 10 | Golden cache, deterministic data, API/network failure handling, freeze | Explicitly deterministic saved rehearsal; offline server and verified wheel bundle; outage tests; frozen result/source manifest |
| November 11 | Technical/AI/safety/evaluation/agent story and Q&A | TECHNICAL_PITCH_AND_QA.md and timed DEMO_RUNBOOK.md |
| November 12 | Final backend/extraction/evidence/signal/action/audit checks | 175 regression tests; 76 evaluation checks; fresh offline install/startup and backup browser checks |
| November 13 | B presentation and fallback preparation | Speaker script, judge Q&A, handoff and failure/offline runbook |

No live AI run is claimed. A's older ZIP is the user-confirmed integration reference. Shared UI/3D/audio integration, clinical review, deployment, live-model verification if needed, team rehearsal and remote release tag remain separate gates. Source co-location does not satisfy them.
