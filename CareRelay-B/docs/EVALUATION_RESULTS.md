# Synthetic evaluation results - release 1.0.0

Generated UTC: 2026-11-05T04:36:44.000024+00:00
Dataset: 16 labeled cases; SHA-256 3904356fc21bfb23a30d6c02ef33cbbb57e26b140da096642b0b3a2f67e024bd.
Mode: deterministic_demo. Scenario clock: 2026-11-09T12:00:00+00:00.

| Group | Passed | Total |
| --- | --- | --- |
| extraction | 16 | 16 |
| evidence | 16 | 16 |
| signals | 16 | 16 |
| golden_journey | 5 | 5 |
| safety | 23 | 23 |

Extraction: TP=21, FP=0, FN=0; precision=1.000, recall=1.000.
Evidence integrity: 21/21 accepted events match exact source spans, hashes, dates and evidence API.

## Interpretation
- Small manually labeled synthetic regression corpus, not a representative clinical benchmark.
- Known bounded vocabulary and negative controls; scores do not generalize to arbitrary notes.
- Deterministic demo only. No live LLM, clinical validation, frontend integration or deployment evaluation.
- Completion is an unverified explicit report, not proof of care. Local approval is not authenticated identity.
- Fixed scenario clock allows reruns after resource review expiry without weakening production freshness gates.

Run EVALUATE.cmd (or python scripts/evaluate.py with dependencies installed) to regenerate both reports.
Every measured check, including failures, is preserved in EVALUATION_RESULTS.json. Nonzero exit code means a failed check.
