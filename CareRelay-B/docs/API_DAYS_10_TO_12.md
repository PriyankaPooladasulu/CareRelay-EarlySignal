# B Days 10-12: completion, audit, safety and evaluation
Release 0.12.0. User-authorized November 7-9 work. Synthetic local prototype.

## New routes
| Method | Path | Request / result |
| --- | --- | --- |
| POST | /api/actions/{id}/complete | CompletionRequest -> ReminderAction |
| GET | /api/cases/amina/audit?after=0&limit=100 | Ordered AuditPage with next_cursor |

Completion request:
{"confirmed":true,"completed_on":"2026-11-02","reported_by":"patient"}

Use the actual report date, on/after the latest documented instruction and no later than the server's UTC date. reported_by is patient or caregiver. It is a role claim in this synthetic unauthenticated demo, not verified identity.

## Exact completion semantics
- The action must be awaiting_confirmation, with existing approval and a generated calendar, on an active plan tied to the current analysis. Proposed, approved-only, cancelled or invalidated actions cannot complete.
- confirmed must be the boolean true. Strings, numeric truthy values, additional status fields and false are rejected. The console's Not yet button makes no completion request.
- The completed action includes completion.completed_on, reported_by, confirmed_at, basis=explicit_unverified_report and clinically_verified=false.
- status=completed means the administrative workflow has an explicit reported completion. The legacy care_completed=false field remains a conservative clinical-verification indicator. Render the completion object and its basis; never label this verified care.
- This report does NOT fabricate a clinical note, timeline event or evidence quote. The source-derived Missing-Signal finding remains as the supplied records establish it. Display the reported workflow completion separately from that finding.
- The original reminder date need not have arrived: a person may report completing the examination sooner. The completion date is bounded by the latest instruction and today's UTC date, not by a predicted appointment.
- Resource expiry/change alone does not block a historical report tied to unchanged records and the approved plan. Reporting past care is not a new resource recommendation. New proposals/downloads still enforce current registry freshness.
- Repeating an identical confirmation returns the same report without another audit transition. Different confirmation details return 409. Completed reports cannot be cancelled or overwritten through this API.
- Later reanalysis/replanning preserves completed reports as history; incomplete actions are invalidated. Completed action views may therefore refer to an older revision. Show that provenance rather than attaching the report to a new signal.

## State transitions
proposed -> approved -> awaiting_confirmation -> completed (explicit unverified report)
proposed / approved / awaiting_confirmation -> cancelled
replan or changed analysis -> invalidated for nonterminal actions
completed / cancelled / invalidated remain historical terminal states.

No timer, download, voice question, extraction or navigation result can call completion automatically. No generic PATCH status endpoint exists.

## Audit contract
Each event has a monotonic sequence, UTC timestamp, entity type/id, event type, from/to status, analysis revision and server-created details. The log records analysis saves, plan creation, each actual planner check/rejection/selection, plan invalidation, proposals, approval, reminder generation, cancellation, invalidation and explicit completion reports.

Audit insertion and the corresponding change share one SQLite transaction. If logging fails, the change rolls back. Repeated identical approvals, downloads, cancellations and completion confirmations do not duplicate transitions. Download logging records calendar generation; it does not claim import, receipt, notification or completed care.

GET results are ordered by sequence. after is exclusive; limit is 1-200. When next_cursor is non-null, pass it as after for the next page. With concurrent appends, later pages can include newer committed events; there is no immutable export snapshot. No audit mutation API exists. Database triggers prevent ordinary UPDATE/DELETE. An administrator with direct database access can remove triggers or files, so this is NOT cryptographically tamper-proof or authenticated clinical audit. Denied requests/reads have no state transition and are not a security-access log.

On a v0.9 database, additive migration starts the log and imports explicitly labeled legacy_snapshot entries. Previous transitions cannot be reconstructed and are not invented. Database records, approvals and calendars remain intact.

## A integration
Use the updated integration/api.ts: completeReminder(id, body), audit(after, limit).
Show the immutable action and confirmation controls only when awaiting_confirmation. Keep the checkbox separate from approval and call complete only on explicit submission. Render returned completion basis/date/role prominently. Disable approval, cancellation, download and repeat-edit controls when completed. Load the persisted action after refresh. Display source-derived signal status separately.

Use text rendering for audit details, not raw HTML. Append pages by sequence without duplicating earlier pages. A's Next.js/3D/audio app has not been merged; the local B console is the integration example.

## Errors
422: malformed body, false/invalid confirmation, invalid reporter, future/before-instruction date, invalid pagination.
409: wrong state, stale records/plan, or differing second completion report.
404: unknown action. Audit POST/DELETE are unsupported.
Do not automatically retry a changed report as consent; reload and let the user review.

## Evaluation
EVALUATE.cmd runs scripts/evaluate.py against temporary databases and writes docs/EVALUATION_RESULTS.json and .md. Dataset labels live in evaluation/cases.json. Scenario time is fixed to November 9, 2026 so benchmark reruns do not disable production resource expiry gates. No live AI or external service call is made. See SAFETY_AND_EVALUATION.md for measured coverage and limits.
