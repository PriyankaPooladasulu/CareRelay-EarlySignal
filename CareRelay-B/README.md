# CareRelay EarlySignal - Member B release 1.0.0

Complete requested Member B implementation through November 12, with November 13 competition preparation. Prepared November 4, 2026. This is the B delivery; joint A-B integration and deployment remain open.

The updated PDF has no wording changes to B's first-three-day checklist or B1-B5 responsibilities after formatting is removed. See docs/ROADMAP_COMPARISON.md for the comparison. This package now contains the complete B delivery. The historical comparison describes the first three days only.

## Start on Windows

1. If using the ZIP, choose **Extract All** first.
2. Open the CareRelay-B folder and double-click **START.cmd**.
3. Keep the terminal open. When it reports the server is running, open http://127.0.0.1:8000.
4. Click **Analyze Amina's records**, then **View evidence** on an event.
5. Expect **3 records and 6 accepted events** in deterministic demo mode.
6. Stop the server with **Ctrl+C**.

The launcher uses Codex's bundled Python on this machine, or an installed Python 3.11+ via the Windows Python launcher. On a new computer, install Python from https://www.python.org/downloads/ if needed. Dependencies are installed only inside this project. A fresh ZIP needs internet for the first installation; demo mode then works without a key or network. Interactive /docs uses externally hosted Swagger assets; the main console works locally.

Double-click **TEST.cmd** to run the automated tests.

## What is included

| Roadmap day | B's deliverable |
| --- | --- |
| October 29 | FastAPI, Pydantic patient/event/evidence schemas, SQLite, patient.json, visit1.txt, visit2.txt, visit3.txt, patient and record APIs |
| October 30 | Synthetic record ingestion, structured extraction, optional live LLM adapter, chronological event JSON |
| October 31 | Exact source quotes, source IDs, character offsets, source hashes, rejected unsupported candidates, original-record/evidence APIs |

The small browser console is a way to inspect B's work. A owns the main frontend.

## Demo mode and live AI

Default **demo** mode uses deterministic language rules. It is not an LLM and is labeled accordingly.

Optional **live** mode sends the supplied synthetic records to the OpenAI Responses API and asks for schema-constrained candidates. Both modes use the same local evidence validator. Configure OPENAI_API_KEY and OPENAI_MODEL as server environment variables before starting the server, then choose Live AI in the console. No model is silently selected, and .env.example is not automatically loaded.

The live adapter has mocked success, failure and malformed-output tests. No paid live API call was performed. API access and billing must be available in your own account.

Official implementation reference: https://developers.openai.com/api/docs/guides/structured-outputs

## Important limits

- Use synthetic records only. This is a local prototype without user authentication.
- Bind to 127.0.0.1; it is not ready for public deployment or real patient data.
- The validator recognizes a small vocabulary. Unsupported phrasing is left unestablished and may require manual review.
- Dates can be supplied as metadata or extracted from an explicit source-date header. ISO dates and unambiguous English named-month dates are normalized. Ambiguous numeric dates, missing dates and metadata/header conflicts are rejected. Dates inside clinical narrative are not inferred.
- A matching quote is checked as a complete sentence, with bounded concept and negation rules. This is not a general semantic-proof system.
- Source-record completion events and explicit unverified workflow completion reports are separate. Reports never rewrite clinical evidence.
- Reanalysis replaces the current case and its evidence atomically. Analyze Amina's records restores the three originals.

## Files

- backend/app/main.py - endpoints and response validation
- backend/app/models.py - Pydantic schemas
- backend/app/dates.py - date-header extraction, normalization and date provenance
- backend/app/extraction.py - demo/live extraction and evidence checks
- backend/app/storage.py - SQLite persistence
- backend/data/ - patient, synthetic notes, local console
- tests/test_backend.py - tests for Days 1 to 3
- integration/api.ts - typed fetch client and evidence highlighting helper for A
- docs/API_HANDOFF.md - request/response contract and examples
- docs/VALIDATION.md - actual verification results
- docs/ROADMAP_COMPARISON.md - what changed in the roadmap and in this build
- examples/ - ready-to-use analysis and candidate-validation JSON
- PROJECT_MEMORY.md - saved scope and continuation context

## Manual setup alternative

From this folder in PowerShell, with Python installed:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

In another terminal, run tests with:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

## Team release gates

Offline reliability, frozen evaluation and technical pitch materials are now supplied. A-B UI/3D/audio integration, live AI verification, clinical review and actual deployment/team rehearsal remain unverified. No external booking/messaging is implemented. A owns 3D rendering and audio playback.

## Try the refreshed features

In the custom-note form, leave the source-date field blank and enter:

```text
Date: October 31, 2026
Retinal examination recommended.
```

Expected: one event dated 2026-10-31, with date source `source_header` and exact supporting text. If you instead supply 2026-10-30 in the date field, the API rejects the conflict and preserves the previous analysis.

Restore Amina's originals, then click **Validate candidates**. The example contains one supported instruction and one invented completion. Expected: one accepted event, one rejection and `saved: false`. This check never changes the saved timeline.

## November 1-3 additions

After analyzing the originals, click **Check missing signals**: expect one open retinal follow-up signal, with exact evidence. A later validated completion can resolve an instruction; missing documentation is not proof that care never happened. The engine also handles repeated observations, contradictory completion statements and explicitly missing referral information.

Use the educational-view selector for four general teaching examples. These are never assigned to Amina as disease stages. The anatomy cards and follow-up explanation carry source references and limitations.

Use **Load narration** to preview fixed captions for the selected topic or educational view. Patient-record narration uses only the current validated events and their evidence. Unknown questions and diagnosis requests return a fixed refusal. Audio assets, recording and playback are A's deliverables; this release provides scripts and text fallback.

- docs/API_DAYS_4_TO_6.md - routes, semantics, integration and examples
- docs/CONTENT_SOURCES.md - checked sources and content mapping
- docs/VOICE_SCRIPTS.json - exported static captions/scripts for A
- examples/all_signal_rules.json - synthetic input exercising all four rules
- examples/resolved_follow_up.json - completion after instruction
- tests/test_days_4_to_6.py - chronology, provenance and voice safety checks

**Validation: 175 tests passed; 76/76 separate synthetic evaluation checks passed.** Content is source-checked for a prototype, with clinical review pending. Read docs/VALIDATION.md for browser-test and live-model limits.

## November 4-6 additions: try the Action Center
1. Analyze originals, then check missing signals.
2. In Action Center, leave the referral checkbox unchecked for the default navigation scenario, and click **Find / replan options**.
3. To demonstrate travel replanning: explicitly check the synthetic existing-UHN-referral scenario, plan once, then choose **Cannot travel in person** and replan. The clinic is rejected and Health811 navigation is selected. It does not replace an examination.
4. Select an administrative date, then **Prepare reminder proposal**. Review the displayed date, resource and wording.
5. Tick the explicit approval checkbox, click **Approve reminder**, then **Download .ics**. Import manually if desired. No appointment, contact or care completion is recorded.
6. **Load last reminder status** restores saved state. Cancel/replan invalidates permission to download; it cannot remove an already imported event.
7. Try **Step-free access must be verified**: no curated option satisfies it, so the app returns no verified match.

The three-resource registry includes provenance and review deadlines. Unknown requirements fail closed. Planning is deterministic; it uses no LLM or live web search. Expired resources stop matching until rechecked.

Read docs/API_DAYS_7_TO_9.md and docs/RESOURCE_SOURCES.md for contracts and source limitations. The typed client compiles with TypeScript strict mode. A's separate frontend is still not integrated.

## November 7-9 additions
- After generating an approved reminder, explicitly report whether the documented examination was completed. Enter the date and reporter, tick the separate confirmation checkbox, then choose **Record reported completion**.
- **Not yet** keeps awaiting_confirmation. Downloads, reminders and timers never mark completion.
- Completed means an explicit unverified report. The original source-derived signal remains separate; no clinical evidence is fabricated.
- **Load / refresh history** shows the actual backend transitions. **Load more** retrieves the next audit page.
- Refresh and **Load last reminder status** to restore persisted completion.
- **EVALUATE.cmd** runs 16 labeled synthetic cases and workflow/safety checks, exporting JSON and Markdown results.

Read docs/API_DAYS_10_TO_12.md, docs/SAFETY_AND_EVALUATION.md and docs/EVALUATION_RESULTS.md. This is B's scoped implementation; A's frontend is not automatically integrated by placing both folders in one repository. Keep CareRelay-B as a separate subfolder beside A's frontend when uploading to GitHub.

## Final release: November 10-13 preparation
- START_OFFLINE.cmd starts the local server with live AI disabled. With installed dependencies it needs no network.
- PREPARE_OFFLINE.cmd downloads pinned wheels for the current Python/OS while online. A separate supplied offline ZIP targets Windows x64 / Python 3.12; Python itself is required and is not bundled.
- OPEN_BACKUP.cmd opens offline-demo/index.html. This self-contained read-only saved rehearsal works without Python/server/network and never performs actions. It is cached deterministic output, not live AI.
- VERIFY_RELEASE.cmd checks frozen file hashes. release/evaluation-final.json preserves the final scores even if EVALUATE.cmd regenerates the working reports.
- docs/TECHNICAL_PITCH_AND_QA.md gives a 90-second story, architecture explanation and judge answers.
- docs/DEMO_RUNBOOK.md gives the four-minute flow, failure/offline switch and A-B handoff.
- docs/FINAL_HANDOFF.md records the checks still required for the combined product.

Use the small source ZIP for GitHub. Keep the separate offline wheel bundle for the demo laptop. All registry freshness and confirmation gates remain active in the running backend; the saved rehearsal is explicitly historical and read-only.
