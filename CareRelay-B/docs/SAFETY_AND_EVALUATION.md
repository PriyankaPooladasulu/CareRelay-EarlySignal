# November 8-9 safety and evaluation
Release 0.12.0. B backend feature set is frozen through the requested scope; no November 10+ release/pitch work is implied.

## Measured result
168 regression tests passed. Separate repeatable evaluation: 76/76 checks across 16 manually labeled synthetic cases:
- Extraction exact case match: 16/16; 21 true positives, 0 false positives, 0 false negatives.
- Evidence integrity: 21/21 accepted events preserve exact source span, hash, date and source API response.
- Signal expected rule/status sets: 16/16.
- Golden backend journey: 5/5.
- Safety behavior: 23/23.

The resulting precision/recall values are 1.000 on this small known-vocabulary dataset only. They are not real-world clinical accuracy, generalized model performance, a held-out benchmark or an independent validation. Negative controls deliberately expect abstention. Report unknown phrasing limitations alongside scores.

## Safety checklist and evidence
| Concern | Check |
| --- | --- |
| Diagnosis requests | Fixed allowlist refusal; no generated diagnosis |
| Prompt injection / mixed requests | Unknown voice requests refused; command-like source text produces no unsupported event |
| Unsupported claims / missing evidence | Wrong source, date, kind, fabricated quote and partial sentence rejected |
| Missing resources | Empty registry and unknown requested accessibility return no_verified_match; proposal blocked |
| Action without approval | Calendar denied before approval; malformed/truthy/extra-field approvals rejected |
| Automatic completion | Proposed/approved-only/cancelled/invalidated cannot complete; false/unchecked confirmation does not submit a report |
| Conflicting records | Signals remain needs_review; no automatic clinical conclusion |
| History / persistence | Atomic audit, rollback on logging failure, retry/concurrency idempotency, restart and legacy migration tests |

The full regression suite additionally tests provider errors with mocks, Unicode spans, invalid source dates, stale plans, changed registries, expiry, cancellation, voice source separation and calendar escaping.

## Reproduce
Double-click TEST.cmd for regression checks.
Double-click EVALUATE.cmd for the labeled evaluation and machine-readable results.
Fresh packages install pinned local dependencies on first run. Both default workflows are offline after setup. The evaluation uses a temporary database, not the user's current analysis, and a fixed scenario clock. Exit status is nonzero if any measured check fails.

## Full-flow verification boundary
B console: analyze -> evidence -> signal -> education caption -> clinic plan -> travel rejection/alternative -> proposal -> approval -> reminder -> Not yet/explicit confirmation -> reported completion -> paginated audit -> status restored after refresh.
The real console was tested with actual API-generated fixtures; browser-to-localhost access was previously blocked. No JavaScript errors; mobile viewport/content width 390/390. This is separate from the real FastAPI integration tests.

A's latest remote repository may have advanced since the supplied ZIP review. No new A source was supplied for this task and no current A-B integration result is claimed. Joint frontend/3D/audio testing, live extraction evaluation, clinical review and deployment verification remain open. No feature-complete joint MVP or competition readiness is asserted by these results.
