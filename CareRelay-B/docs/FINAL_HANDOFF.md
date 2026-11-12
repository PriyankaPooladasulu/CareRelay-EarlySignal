# Final B handoff and team release gates
B delivery 1.0.0, prepared November 4, 2026.
This is the final requested B implementation/material package, not a claim that the joint product passed every release gate.

## B supplies
Backend/synthetic data; optional live extraction adapter; deterministic demo; evidence; signals; general education/captions; curated resources; planning/replanning; approved ICS; explicit unverified completion; audit; regression and measured evaluation; offline launch/backup; technical pitch/Q&A and rehearsal runbook.

## Integration against A's supplied ZIP
The user asked us to rely on the older ZIP. Its app/page.tsx composes static PatientSummary, RecordSummary, EarlySignalCard and EyeCanvas. No lib/API client exists there; the evidence button is inert and EyeCanvas is a sphere foundation. A later screenshot showed different commits, but those files were not supplied.

Place CareRelay-B beside A's app/components folders. Run B on 8000 and A on 3000. Use integration/api.ts to connect:
1. Patient/records, analyze and saved timeline.
2. Signals/evidence with current revisions and Unicode offsets.
3. General education/captions and A's own 3D/audio mapping.
4. Constraints/trace, proposal, explicit approval and ICS.
5. Separate explicit completion report and paginated audit.
6. Loading, failure, no-match and stale-plan states.

The typed client compiles and CORS is tested. Actual A UI integration remains a team task; B's files do not overwrite A's work.

## Final verification matrix
| Gate | State |
| --- | --- |
| Backend/demo/evidence/signals | Automated checks passed |
| Planning/replanning/approval/reminder/completion/audit | Automated checks passed |
| Evaluation saved/frozen | docs and release/evaluation-final.json |
| Live extraction | Adapter mock-tested; no paid live run |
| Offline backend / fresh dependency install | Local verification details in VALIDATION.md |
| Read-only backup | Browser checked with networking disabled |
| A UI/3D/audio | Supplied foundation; joint integration pending |
| Clinical review / public deployment | Not performed |
| Joint rehearsal / competition presentation | Runbook supplied; team execution pending |
| Remote publication / final repository tag | Not performed |

## Frozen source and Git handoff
VERIFY_RELEASE.cmd compares frozen file hashes. It excludes regenerated evaluation outputs, databases, caches and optional wheels; the immutable final evaluation copy is included. Checksums detect changes, not publisher identity.

Upload the source ZIP's extracted CareRelay-B folder, not offline wheels or runtime folders. Use a review branch and inspect the diff. After shared integration checks pass, the repository owner can tag the agreed commit. Do not tag the workspace-parent repository or imply standalone B is a tested joint product release.

## Remaining dependencies
A's implementation/integration and visual/audio fallbacks; a configured live AI verification if intended for the demo; qualified clinical review; deployment/security decisions; joint rehearsal/presentation. No hidden setup or live-model success is assumed.
