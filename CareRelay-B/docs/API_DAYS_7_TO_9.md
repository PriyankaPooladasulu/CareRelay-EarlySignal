# B Days 7-9: resources, planning and approved reminders
Original release 0.9.0, November 4-6 work. Extended by release 0.12.0: see API_DAYS_10_TO_12.md for completion/audit and terminal completed-state behavior.

## Routes
| Method | Route | Contract |
| --- | --- | --- |
| GET | /api/resources | Curated resource metadata, evidence URLs, review dates and limitations |
| POST | /api/cases/amina/plan | revision, signal_id, constraints -> persisted plan and actual decision trace |
| GET | /api/plans/{id} | Persisted plan snapshot; active=false after replan/changed analysis |
| POST | /api/cases/amina/actions | plan_id, reminder_date -> immutable reminder proposal |
| GET | /api/actions/{id} | Persisted reminder state |
| POST | /api/actions/{id}/approve | Exactly {"approved":true}; strict boolean |
| POST | /api/actions/{id}/cancel | Cancel proposal/download permission |
| GET | /api/actions/{id}/calendar | Approved-only text/calendar attachment; no-store |

Use integration/api.ts. Dates are ISO YYYY-MM-DD, accepted from today through 365 days using the server UTC date. Full request/response types are in docs/openapi.json. Unknown request fields are rejected.

## A's integration sequence
1. Analyze or load the saved timeline; GET signals. Use a current open unresolved_instruction and its revision. Resolved/needs_review signals cannot start this workflow.
2. Collect explicit constraints, then POST plan. Defaults: Ontario, no travel/language/accessibility requirement, telephone available, existing clinic referral NOT confirmed.
3. Render plan.steps in order, selected resource, source URLs, verification dates and limitations. The trace reports real deterministic checks; it is not an LLM thought stream or a claim of live web search.
4. If no_verified_match, show manual review and keep proposal disabled. No substitute is invented.
5. Ask for an administrative reminder date; POST actions. Show the returned date, resource and exact wording. Approval is a separate explicit user action.
6. POST approve only after consent to that displayed proposal. Download the calendar Blob only afterwards. Create/revoke an object URL in the browser and let the user import the file manually.
7. Reload action status after download. It is awaiting_confirmation, never completed. Store the action ID locally if desired; GET restores persisted status.
8. When records or constraints change, clear displayed approval and replan. Never reuse an old approval for a new proposal.

The shipped console demonstrates this sequence. A's supplied Next.js frontend has NOT been merged or wired to these endpoints.

## Concrete replan demo
Analyze originals. Confirm the synthetic scenario checkbox for an existing referral to the specific UHN clinic; this is an explicit test assumption, not a fact extracted from Amina's notes. With other defaults, plan A is the in-person UHN pathway. Change travel to cannot_travel and replan: A fails the travel check; the planner searches the remaining registry and selects Health811 navigation. This does NOT replace the retinal examination.

Without the referral checkbox, the default is already remote navigation. Set accessibility=step_free to demonstrate no_verified_match: none of the three records has verified step-free capability. With phone_available=false and no other requirement the public register remains a possible directory, not a booked provider.

## Server gates and persistence
proposed -> approved -> awaiting_confirmation
proposed / approved / awaiting_confirmation -> cancelled
replan or changed analysis -> invalidated (for all non-cancelled old actions)

Approval, proposal creation, calendar generation and analysis changes share SQLite write transactions. A current plan must still match the analysis revision and registry digest and have an eligible, unexpired resource. Replanning invalidates old plans/approvals even when no alternative is found. Reanalysis with identical content preserves validity; changing away and restoring originals does not revive old approvals.

Repeated approval and duplicate same-date proposal are idempotent. Changing the date requires cancellation or a new plan. Repeated/concurrent downloads return the same saved ICS with the same UID and DTSTAMP. Cancel/replan blocks further downloads but cannot recall an already imported file. An expired/changed registry blocks mutations/downloads; GET can still show the historical saved snapshot, not a new eligibility assessment.

No generic status setter exists. Release 0.12.0 adds a strictly gated explicit completion-report endpoint. approval=true is an explicit local API gate, not authenticated identity verification. Do not expose this unauthenticated prototype publicly.

## Error handling
422: invalid body/strict boolean/date or extra fields. 409: analyze first, stale revision/plan, unresolved ambiguity, expired resource, no selected match or changed proposal date. 403: calendar requested before approval or after cancellation. 404: unknown IDs. After 409, reload the current timeline/signal and replan; never automatically approve.

## Calendar semantics
RFC 5545 all-day VEVENT: stable UID, UTC DTSTAMP, DTSTART on chosen date and exclusive next-day DTEND. Text is escaped and UTF-8 lines fold at 75 octets using CRLF. It is a transparent administrative reminder, with no invite, attendee, organizer or appointment. No VALARM is included: notifications depend on the user's calendar settings. File generation does not prove download/import, a notification firing, contact with a provider, or care completion.

Completion reports and action history are now implemented in the Days 10-12 extension. External booking/messaging remain outside scope.
