export const ACTION_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'AWAITING_FIELD_VERIFICATION', 'READY_FOR_ASSIGNMENT', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'REJECTED'] as const;
export type ActionStatus = typeof ACTION_STATUSES[number];
export type Urgency = 'ROUTINE' | 'SOON' | 'URGENT' | 'IMMEDIATE';
export interface Department {
  id: string; displayName: string; active: boolean; source: string; verificationStatus: 'DEMO' | 'UNVERIFIED' | 'VERIFIED';
}
export interface ResponsiblePerson {
  id: string; displayName: string; title: string; wardId: string | null; departmentId: string;
  active: boolean; source: string; verificationStatus: 'DEMO' | 'UNVERIFIED' | 'VERIFIED'; contact: string | null;
}
export interface ActionRecommendationData {
  nextAction: string; rationale: string; suggestedDepartment: string; urgency: Urgency;
  responseTarget: string; fieldVerification: string[]; resources: string[]; followUp: string[];
  escalationConditions: string[]; confidence: number | null; limitations: string[];
}
export interface ActionRecommendation {
  id: string; reportId: string; data: ActionRecommendationData; provider: string; modelName: string;
  isFallback: boolean; createdAt: string; createdBy: string;
}
export interface ActionPlan {
  id: string; reportId: string; recommendationId: string | null; actionDescription: string;
  wardId: string; officerId: string | null; departmentId: string; assignmentNote: string;
  wardVerificationNote: string; locationOverrideReason: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; urgency: Urgency;
  targetDate: string; adminNotes: string; status: ActionStatus; revision: number;
  resolutionNotes: string | null; verificationMethod: string | null; verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationNote: string | null; verifiedBy: string | null; verifiedAt: string | null;
  beforePhotoUrl: string | null; afterPhotoUrl: string | null; createdBy: string; updatedBy: string;
  createdAt: string; updatedAt: string;
}
export interface ActionEvent {
  id: string; reportId: string; planId: string | null; actorId: string; type: string;
  note: string; details: Record<string, unknown>; createdAt: string;
}
export interface ProgressUpdate {
  id: string; planId: string; note: string; photoUrl: string | null; createdBy: string; createdAt: string;
}
