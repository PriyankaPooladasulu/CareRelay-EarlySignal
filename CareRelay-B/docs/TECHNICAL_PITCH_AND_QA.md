# Member B: technical pitch and judge Q&A
B delivery 1.0.0. Prepared November 4, 2026 for the remaining roadmap and November 13 presentation.
Use the actual demo mode label. Do not describe the saved rehearsal as a live AI run.

## 90-second technical story
"CareRelay EarlySignal helps a person inspect a documented follow-up that is still unverified in the supplied records. Our demonstration uses fictional Amina and three synthetic encounters.

We extract a small set of event types, then validate every accepted claim against its source sentence, date and character span. Unsupported candidates are rejected. The timeline keeps evidence accessible, and a deterministic Missing-Signal Engine checks chronology rather than diagnosing disease.

An open follow-up can lead to a curated navigation resource. The controller checks jurisdiction, travel and explicitly declared requirements, rejects an unsuitable option and evaluates an alternative. Unknown capabilities fail closed. The trace records those actual checks.

The person must approve a specific reminder before a calendar file can be generated. Downloading a file never marks care complete. A separate explicit dated report closes that workflow, while source-record evidence remains unchanged. The transition history is persisted alongside the state changes.

Our measured result is 76 out of 76 checks on 16 manually labeled synthetic cases, with 21 accepted events preserving exact evidence. This is bounded regression evidence, not clinical validation. The live extraction adapter is implemented and mock-tested; today's dependable demonstration can run deterministically and offline."

## Architecture explanation
Synthetic records -> demo rules or optional live extraction -> exact evidence and bounded meaning validation -> SQLite timeline -> Missing-Signal rules -> curated resource and constraint checks -> persisted proposal -> explicit approval -> local ICS -> explicit unverified completion report.
Analysis, planning and action transitions also feed the transactional local audit. Source-backed education and fixed captions connect to A's separate visual/audio interface.

The backend is FastAPI/Pydantic with SQLite. Exact spans are Unicode code points. Analysis revisions and registry digests prevent old approvals authorizing changed plans. State and audit writes share transactions. The local console exercises the API contracts; A's supplied frontend is still a separate foundation.

## What is AI, and what is deterministic?
Optional live extraction uses an explicitly configured OpenAI model to propose structured candidates, then the local validator checks them. No paid live call was made in this build. Demo extraction, signal rules, resource selection, narration and authorization are deterministic. The navigation controller is a bounded multi-step workflow, not an LLM planner or autonomous booking agent.

## Measured claims you can make
- 175 regression tests passed.
- 76/76 evaluation checks: 16 extraction cases, 16 evidence-case checks, 16 signal cases, 5 golden-journey checks and 23 safety checks.
- 21 TP, 0 FP, 0 FN in that bounded corpus; 21/21 accepted events pass exact span/hash/date/source checks.
- Failure handling preserves previous records and approvals; offline mode explicitly blocks live-provider calls.
- Explicit approval and completion are enforced by backend state checks.
- The saved backup is a read-only deterministic rehearsal with no executable action controls.

Show docs/EVALUATION_RESULTS.md and its machine-readable JSON. Mention the small known-vocabulary corpus before quoting precision/recall.

## Judge questions and candid answers
**Does missing documentation mean care was missed?** No. Later completion is unverified in these supplied records. We do not infer that care never occurred.

**Do you diagnose retinopathy or stage Amina's eye?** No. Educational views are general examples, separate from patient records. Diagnosis/unknown questions return fixed refusal.

**How do you stop hallucinations?** Exact sentence/date/source validation plus bounded meaning rules reject unsupported candidates. This reduces specific failure modes; it is not proof against arbitrary language.

**Is this agentic?** It has explicit checking, rejection, alternative selection and approval-controlled actions. The shipped navigation policy is deterministic, and no service is contacted. If judging rules require an LLM-driven agent, do not represent this implementation as satisfying that requirement without further work.

**Are the resource options clinically equivalent?** No. Remote navigation can clarify next steps; it does not replace an examination. Eligibility, capacity and individual suitability are not guaranteed.

**What if a language or accessibility requirement is unknown?** No match is returned. The system does not invent capability or silently remove a requirement.

**Why is the default not the UHN clinic?** Amina's notes do not establish a referral there. That branch requires a deliberately confirmed synthetic scenario assumption.

**Can the system act without consent?** The local calendar endpoint requires persisted explicit approval of the current proposal. There is no booking/message action. The prototype has no identity authentication and must stay local and synthetic.

**What does completed mean?** An explicit dated patient/caregiver role claim was recorded. It is unverified and does not rewrite source evidence. The source-based signal can remain open.

**What changes when records change?** Unfinished plans/actions become invalid, requiring new review and approval. Completed reports remain historical with their original revision.

**Can audit history be altered?** Normal API writes append and triggers reject ordinary updates/deletes. An administrator could remove safeguards. It is not tamper-proof clinical audit.

**What if the model/network fails?** Previous analysis remains. Use deterministic mode explicitly, START_OFFLINE.cmd, or the read-only OPEN_BACKUP.cmd rehearsal.

**Have you clinically validated it?** No. Content is source-checked prototype material with qualified review pending. Evaluation is synthetic regression testing.

**Can it handle any medical record?** No. It supports a small vocabulary, explicit dates and limited concepts. Unknown phrasing can hide information and needs manual review.

**What remains before deployment?** Joint frontend integration, authentication/access controls, representative evaluation, clinical/content/resource review, privacy/governance work and operational testing.

**What is the next highest-value improvement?** Finish A-B evidence/timeline integration, verify a deliberately configured live extraction run, and broaden independently labeled synthetic examples before expanding clinical scope.
