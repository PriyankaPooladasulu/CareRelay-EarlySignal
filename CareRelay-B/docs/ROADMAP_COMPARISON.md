# Updated roadmap comparison

Historical first-three-day comparison. The user subsequently authorized November 1-3; current scope and delivery are recorded in PROJECT_MEMORY.md and API_DAYS_4_TO_6.md.

Reviewed October 31, 2026.

New reference: P:/New folder/HACKATHONS/Women in AI/Final Project Roadmap.pdf.
Previous reference: the DOCX with the same title in that folder.

## Finding

No wording changes were found in the first-three-day checklist or B's core responsibilities B1-B5 after removing formatting, page breaks and bullet symbols. This is a comparison of the relevant scope, not a claim that every page of the entire roadmap is identical.

The PDF has 68 pages. The relevant checklist is on PDF pages 55-57. B1-B5 appear on pages 34-35. The daily assignments remain:

| Date | B's assignment | Delivery |
| --- | --- | --- |
| October 29 | Backend foundation | FastAPI, SQLite, patient/event/evidence schemas, Amina and three notes, patient API |
| October 30 | Structured AI extraction | Record ingestion, dates, observations, instructions, follow-up information and JSON events |
| October 31 | Evidence validation | Source links, exact quotes, offsets/source IDs, rejection of unsupported claims and evidence API |

The November 1 Missing-Signal Engine still starts after this scope. Education, voice, navigation and actions are later work. The user's latest request supersedes the interrupted request to start the next three days.

## Implementation improvements in this refreshed release

These address existing checklist items; they are not new requirements found in the PDF.

- Date ingestion now recognizes explicit source-date headers and normalizes ISO and unambiguous English named-month formats. It rejects missing, conflicting, invalid and ambiguous numeric dates.
- Every source and accepted event exposes date provenance: supplied metadata, source header, or agreement between both. Header quotes have original offsets.
- A standalone POST /api/cases/amina/validate endpoint validates candidate events against stored originals without changing the saved timeline.
- Reloading a saved timeline preserves rejected-candidate details.
- Expanded regression tests cover dates, evidence checks and malformed provider envelopes.

The optional live extractor still requires the user's own API key and model. Tests use mocked provider responses, not a paid live request. A's actual Next.js project was not supplied; the API handoff and local console demonstrate the integration contract.
