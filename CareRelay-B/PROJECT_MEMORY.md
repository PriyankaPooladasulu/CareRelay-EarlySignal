# CareRelay EarlySignal project context

Updated November 4, 2026. User: Member B, AI/Backend/Agent Lead. Current B delivery: 1.0.0.

## Authorization and current scope
The user explicitly requested "now give me all remaining" after Days 1-12. Current B scope includes all remaining November 10-12 offline reliability, technical pitch/Q&A and backend release checks, plus November 13 runbook/rehearsal preparation. A still owns the main frontend, 3D and audio. External messages/bookings, public deployment and remote publication are not inferred from the roadmap.

Reference: P:/New folder/HACKATHONS/Women in AI/Final Project Roadmap.pdf. Relevant first-three-day checklist is pages 55-57, next three days around pages 57-59. Normalized comparison to the earlier DOCX found no changes in the first-three-day checklist or B1-B5; see docs/ROADMAP_COMPARISON.md for that historical finding.

## Delivered
- Days 1-3: FastAPI, Pydantic, SQLite, Amina and three synthetic notes, extraction, date headers/provenance, exact evidence validation, standalone candidate validation and source APIs.
- November 1: deterministic unresolved instruction, repeated observation, conflict and missing information rules. Amina's originals yield six accepted events and one open retinal follow-up signal.
- November 2: local source-backed education API with six anatomy cards, follow-up explanation, four general teaching views, disclaimers and NEI/CDC references.
- November 3: nine static voice scripts, question allowlist, fixed diagnosis/unknown-question refusal, dynamic patient-record narration with evidence, source-linked caption segments and state mapping.
- November 4: three curated resources, official-source provenance, freshness gates and explicit jurisdiction/travel/language/accessibility/referral/phone constraints.
- November 5: persisted deterministic plans and real evaluation trace; in-person option rejected for travel, alternative navigation selected, or no_verified_match.
- November 6: immutable reminder proposals, strict explicit approval, cancellation, persisted stable ICS and awaiting_confirmation state.
- November 7: explicit dated patient/caregiver completion reports, persisted terminal completed state, atomic append-only local audit, planner transition logging and legacy snapshots.
- November 8: safety coverage for diagnosis/injection, unsupported claims, missing evidence/resources and unauthorized action/completion. Scoped B feature freeze; joint MVP integration not claimed.
- November 9: 16 labeled synthetic cases; EVALUATE.cmd produces JSON/Markdown results, 76/76 checks passed.
- November 10: explicit offline server mode, pinned offline wheel preparation/checks, cached deterministic read-only rehearsal, preserved analysis/approval on provider failures, frozen evaluation and source hash manifest. No live AI result is fabricated.
- November 11: 90-second technical story, architecture explanation, responsible-AI/evaluation/agent explanation, judge Q&A and timed rehearsal runbook.
- November 12: final 175-test regression, 76/76 evaluation, TypeScript check, offline installation/startup and serverless backup verification. Shared team gates are documented.
- November 13: presenter handoff, failure/offline switch and rehearsal checklist supplied; actual competition presentation is a human/team activity.
- Complete source ZIP, separate Windows x64/Python 3.12 offline bundle and updated PDF guide.

## Run and architecture
Project: outputs/CareRelay-B. START.cmd launches http://127.0.0.1:8000. TEST.cmd runs the regression suite. Fresh ZIP installs pinned dependencies locally; first run needs internet and Python 3.11+ or the bundled runtime.

Default extraction is deterministic_demo, not an LLM. Optional live extraction requires server OPENAI_API_KEY and OPENAI_MODEL. It is mock-tested; no paid live request has been made. New signal and voice endpoints never call an LLM.

SQLite atomically stores the current originals/analysis. Custom analysis replaces the case; analyze without custom records restores the originals. Signals are recomputed from one stored Analysis snapshot, include revision and searched source IDs, and cannot survive as stale independent rows. Patient narration uses that same current snapshot. New workflow tables are added automatically with CREATE TABLE IF NOT EXISTS; existing records are preserved.

## Boundaries that must survive continuation
- Synthetic data only: fictional Amina / DEMO-001 / Ontario; original notes dated October 3, 13 and 24, 2026.
- Evidence uses exact source sentences, hashes and zero-based Unicode code-point offsets. JavaScript slices Array.from(text).
- Date headers/metadata are explicit; ambiguous, invalid or conflicting dates fail. Response-only provenance is backend-derived.
- Unknown wording stays unestablished. Missing completion documentation does not prove care did not occur.
- Explicit noncompletion on/after completion is a conflict; earlier noncompletion then later completion is a normal transition. Same-day order cannot be guessed. Historical conflicts remain reviewable; episode identity is unavailable.
- Repeated observation threshold: at least two source IDs on two dates, never a severity claim. Missing-information rule requires explicit supported text.
- Education is general, never a patient stage or prediction. Four teaching views are not four formal clinical stages or an inevitable sequence.
- Educational content was checked against official NEI/CDC pages. Qualified clinical review is pending. Voice "approval" means prototype allowlisting, not clinical sign-off.
- Voice free text must match an approved question exactly after normalization. Unsupported/mixed/diagnosis requests return fixed refusal. This is not general chat or symptom triage.
- A owns the real frontend, 3D model, recording/audio playback and final UI integration. A frontend was later provided and reviewed (see the A review section below); it is not integrated with B. B supplies content, API contracts and text fallback, not audio assets.

## Validation and artifacts
175 automated tests passed using the Windows launcher. Separate synthetic evaluation passed 76/76 checks: 16 extraction, 16 evidence-case, 16 signal, 5 golden-journey and 23 safety checks. 21 accepted events had exact evidence integrity. The typed client passed strict TypeScript compilation. Console flow checks used actual API-generated response fixtures because direct browser localhost access was blocked. No JS errors; after a long-reason wrapping fix, a 390px viewport had 390px content width. Fresh offline Uvicorn startup is verified. Cross-process localhost TCP/browser access remains sandbox-blocked, so no live browser/server success is claimed. Fresh-wheel TestClient smoke checks passed. The self-contained backup passed in a genuinely offline browser context with zero HTTP requests and 390px content width. See docs/VALIDATION.md for full limits.

Latest artifacts: outputs/CareRelay_B_Final_Source.zip, outputs/CareRelay_B_Offline_Windows_Py312.zip and outputs/CareRelay_B_Final_Run_Guide.pdf. Earlier day-batch ZIPs/PDFs are historical. This file is durable local project context, not an account-wide memory promise.

## Remaining shared/external gates
A-B main UI/3D/audio integration and joint rehearsal, live AI verification if intended, qualified clinical review, public deployment/security and remote repository release. No external booking/messaging or public deployment was performed.

Read README.md, docs/FINAL_HANDOFF.md, docs/DEMO_RUNBOOK.md and docs/VALIDATION.md before continuing. Earlier content/voice handoffs remain available.

## A frontend review (latest request)
The user supplied C:/Users/princ/Downloads/CareRelay-EarlySignal-main.zip and requested roadmap progress, competition-readiness review, integration guide, and whether integration exists. This was a review/guide task, not a request to silently merge projects.

A source is at Day 1 foundation plus partial Day 2. It has Next.js/TypeScript/Tailwind cards and a R3F/Drei sphere with OrbitControls. No GLB eye, timeline, evidence viewer, education states, voice or A-B API connection exists. Counts, patient and signal are hard-coded; the evidence button is inert. Internal frontend composition exists; full A-B integration does not.

Dependencies installed in work/A-review/CareRelay-EarlySignal-main; ESLint and TypeScript passed. Production compilation passed but prerendering failed with environmental EPERM mkdir at /_not-found; full build unverified. Actual generated home HTML/static assets rendered in Playwright with no JS errors, no mobile overflow at 390px, and no requests or changes after clicking the evidence button. This was not a complete production-server run. Original archive files match the review copy exactly; no source edits were made.

Deliverables: outputs/A-Review/CareRelay_A_Review_and_Integration_Guide.pdf (five visually verified pages), A_REVIEW_AND_INTEGRATION.md (source references and copyable steps), desktop/mobile screenshots and browser_check.json. Next priority is A's Days 2-3 API-driven timeline/evidence flow, then eye/education/voice. This historical review preceded the Days 7-9 backend additions; A's frontend remains unintegrated.

## Navigation/reminder boundaries for continuation
- Registry verification date 2026-11-01; local review deadline 2027-01-30. UHN and College pages read; Health811 checked through official indexed excerpts because direct page fetch returned 403. See RESOURCE_SOURCES.md.
- No live resource search. Fixed order is a demo policy, not clinical ranking. Unknown required capabilities reject a resource.
- UHN requires an explicitly confirmed existing referral as a conservative prototype gate, not as a claimed universal provider policy. Amina's notes do not establish it. Default unchecked -> Health811 navigation.
- Travel demo: explicitly assume existing UHN referral, plan clinic A; cannot_travel -> reject A and choose remote navigation B. Navigation is not an equivalent examination.
- Plan binds current open unambiguous instruction, analysis revision and registry digest. Changes/replans invalidate old actions; registry/date changes block writes/downloads even when GET returns an old saved snapshot.
- SQLite transactions protect the server gates. Only strict approved=true approves. Existing .ics bytes and UID remain stable across retries/restart.
- Download produces an all-day reminder with no VALARM, no invitation and no external contact. awaiting_confirmation does not prove import, notification or completed care. Already imported files cannot be recalled by cancel/replan.
- No authenticated identity is attached to the local approval; do not expose publicly. Completion now has its own explicit-report endpoint; it is never triggered by approval or calendar generation.

## Completion, audit and evaluation decisions
- POST /api/actions/{id}/complete requires strict confirmed=true, a patient/caregiver role claim and a nonfuture date on/after the latest instruction. Only awaiting_confirmation with approval/calendar/current plan+analysis can complete.
- status=completed means an explicit_unverified_report. completion.clinically_verified and legacy care_completed remain false. Source records/timeline/signals are unchanged; a record-based open signal can coexist with a separately displayed reported completion.
- Identical completion retries are idempotent. Differing reports cannot overwrite history. Completed reports survive later replan/record changes; incomplete actions invalidate. Registry expiry does not block historical reports on unchanged active plans; it still blocks new navigation/downloads.
- Audit logs analysis saves, actual planner steps, action transitions and invalidations in the same SQLite transactions. If logging fails the write rolls back. Monotonic sequence pagination; ordinary SQL update/delete is blocked. It is not authenticated or tamper-proof clinical audit, and rejected requests are not an access log.
- Upgrades add audit storage and explicitly labeled legacy snapshots; earlier history is not invented.
- EVALUATE.cmd uses 16 manually labeled cases and isolated temporary databases, fixed 2026-11-09 scenario clock, no live LLM/network calls. Dataset hash and all check outcomes are exported. Measured 21 TP/0 FP/0 FN applies only to this bounded synthetic vocabulary, not clinical accuracy or general model performance.
- Browser checks use API-generated fixtures: complete B console journey, Not yet and unchecked confirmation send no request, completion persists on refresh, four audit pages, no JS errors, 390px content width. Direct current browser-server/actual A integration is not claimed.
- User was advised to upload a clean extracted CareRelay-B folder beside A's frontend in one GitHub repository. No upload or merge was performed here. A's screenshot indicates newer commits may exist; the old supplied ZIP review cannot establish the current remote implementation.

## Final offline/release choices
- Source/API version is 1.0.0 for B; it is not a verified joint CareRelay product release. No remote commit, push or tag was made.
- The user explicitly told us to rely on A's older ZIP because no other upload was supplied. It remains the integration reference; its static cards/sphere and lack of API wiring are confirmed from files. We did not alter A's ownership or invent completed 3D/audio integration.
- CARERELAY_OFFLINE=1 blocks live extraction before a provider call even if keys exist. Failed live requests preserve previous analysis, approved actions and audit; fallback is an explicit choice.
- offline-demo/index.html and snapshot.json cache actual deterministic API responses using fixed 2026-11-12 scenario time. They are read-only, clearly labeled, use no scripts/network and cannot issue approvals/completion. No cached live AI output exists because no live call was made.
- START_OFFLINE.cmd can install with pip --no-index from verified wheelhouse when dependencies are absent. Shipped offline bundle: 23 wheels, Windows AMD64, Python 3.12. PREPARE_OFFLINE.cmd builds for another actual machine while online; Python itself is not shipped.
- VERIFY_RELEASE.cmd uses the standard library and detects changed frozen files. It excludes working evaluation outputs/dependencies/databases/wheels; release/evaluation-final.json is frozen. Hashes are not signatures.
- docs/TECHNICAL_PITCH_AND_QA.md and DEMO_RUNBOOK.md cover B's technical explanation and competition preparation. Actual team rehearsal/deployment cannot be certified from this standalone environment.
