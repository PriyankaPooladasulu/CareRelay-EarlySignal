export type FollowUpStatus = "open" | "unconfirmed" | "needs-verification" | "resolved";

export type AttentionPriority = "documented-urgent" | "review-needed" | "information-incomplete";

export type ReviewDecision = "confirm" | "correct" | "needs-more-evidence";

export type SignalStatus = "stable" | "watch" | "unconfirmed";

export interface Evidence {
  id: string;
  title: string;
  description: string;
  source: string;
  date: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "visit" | "test" | "treatment" | "follow-up";
}

export interface EarlySignal {
  status: SignalStatus | FollowUpStatus;
  title: string;
  summary: string;
  evidenceIds: string[];
}

export interface PatientRecord {
  id: string;
  title: string;
  date: string;
  provider: string;
  summary: string;
}

export interface PatientCase {
  patientId: string;
  name: string;
  location: string;
  records: PatientRecord[];
  timeline: TimelineEvent[];
  evidence: Evidence[];
  earlySignal: EarlySignal;
}