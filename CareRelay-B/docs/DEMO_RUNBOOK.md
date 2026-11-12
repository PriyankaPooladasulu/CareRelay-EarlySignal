# Demonstration and rehearsal runbook
Prepared for the November 10-13 roadmap. B release 1.0.0.
A reference: the user's older CareRelay-EarlySignal-main.zip, explicitly confirmed for this task.

## Before rehearsal
1. Extract the source ZIP. Run START.cmd online once to install dependencies; stop with Ctrl+C.
2. Run TEST.cmd, EVALUATE.cmd, then VERIFY_RELEASE.cmd. Frozen scores are also in release/evaluation-final.json.
3. For a fresh offline installation on Windows x64 / Python 3.12, use the separate Offline_Windows_Py312 ZIP. For another Windows Python version, run PREPARE_OFFLINE.cmd on that machine online first. On another OS, use python scripts/prepare_offline.py with the intended Python.
4. Start START_OFFLINE.cmd. It disables live AI even if a key is configured. Open http://127.0.0.1:8000.
5. Open OPEN_BACKUP.cmd and check the saved rehearsal with Wi-Fi off.
6. Confirm A knows which UI parts are connected. The supplied A ZIP has a static dashboard and sphere; its evidence/3D/audio flow is not integrated.

## Four-minute B demonstration
0:00-0:35: Announce fictional Amina, synthetic data and deterministic mode. Analyze originals; show six events and exact evidence.
0:35-1:05: Check missing signals. Explain "unverified in supplied records." Show general education/captions.
1:05-1:55: Explicitly tick the synthetic existing-UHN-referral assumption. Plan, then change travel to cannot_travel and replan. Explain rejection and remote navigation; it does not perform an eye exam.
1:55-2:35: Choose a reminder date, prepare, review and explicitly approve. Download ICS; show awaiting_confirmation. No appointment or import is verified.
2:35-3:15: Choose Not yet, then for the declared synthetic scenario report completion on/after the latest instruction and no later than today UTC. Tick the separate checkbox. Explain the report is unverified.
3:15-3:45: Load audit pages. Show approval, reminder generation and completion-report transitions.
3:45-4:00: State measured evaluation and limits. Hand back to A for the visual/interface story.

Never enter a future completion date because the roadmap date has not arrived. Use the real runtime date. The saved backup deliberately uses a fixed November 12 scenario and is marked as recorded.

## Failure demonstration
- Travel restriction: clinic rejected -> navigation alternative.
- Unknown step-free capability: no_verified_match -> proposal disabled.
- No consent: absent approval/confirmation -> blocked.
- Live outage: 503 preserves saved analysis; switch to demo explicitly.
- Stale records/plan: reload and replan; never automatically approve a replacement.

## Immediate fallback
Internet unavailable, backend running: use deterministic mode. Registry/captions are local; official websites still need internet.
Fresh installation offline: START_OFFLINE.cmd with matching wheels; otherwise use the backup.
Server unavailable: OPEN_BACKUP.cmd. Say "This is our saved read-only deterministic rehearsal." No new action is taken.
A's 3D/audio unavailable: A supplies its visual/audio backup. B can show text captions; no prerecorded A assets are included.
Online Swagger assets fail: use the main console and docs/openapi.json locally.

## Rehearsal log
Record date, laptop/Python, command results, operator, mode, failure tested and follow-up issue. Practice the exact A-B handoff and offline switch. Joint rehearsal and competition presentation require both people and are not claimed as completed by this package.

## Stop and restore
Ctrl+C stops the server. Analyze Amina's originals restores source input and can invalidate unfinished actions when analysis changes. Completed reports/audit remain. For separate practice, select a new CARERELAY_DB file before launching; do not delete someone else's database.
