export type ReportCategory =
  | 'ROAD_DAMAGE'
  | 'WATERLOGGING'
  | 'DRAINAGE'
  | 'WASTE'
  | 'FOOTPATH'
  | 'STREETLIGHT'
  | 'OTHER';

export type ReportStatus =
  | 'SUBMITTED'
  | 'AI_ANALYZED'
  | 'UNDER_REVIEW'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'REJECTED';

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type UserRole = 'CITIZEN' | 'ADMIN' | 'URBAN_PLANNER';

export type ReviewStatus = 'PENDING' | 'CONFIRMED_DUPLICATE' | 'DISMISSED';

export type SourceType = 'citizen_report' | 'demo_seed';

export interface User {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Ward {
  id: string;
  wardNumber: number;
  wardName: string;
  areaDescription?: string | null;
  centerLatitude: number;
  centerLongitude: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiAnalysisData {
  category: ReportCategory;
  summary: string;
  severity: number; // 1 to 5
  confidence?: number | null; // 0.0 to 1.0
  reasons: string[];
  missing_information?: string[];
}

export interface AiAnalysisRecord extends AiAnalysisData {
  id: string;
  reportId: string;
  provider: string;
  modelName: string;
  suggestedCategory?: ReportCategory;
  createdAt: string;
}

export interface PriorityBreakdown {
  severityFactor: number; // 1-5 (weight 0.40)
  impactFactor: number;   // 1-5 (weight 0.30)
  recurrenceFactor: number; // 1-5 (weight 0.20)
  ageFactor: number;      // 1-5 (weight 0.10)
  rawScore: number;       // 20-100
  normalizedScore: number; // 0-100
  priorityLevel: PriorityLevel;
  urgentReviewRequired: boolean;
  explanation: {
    summary: string;
    factors: {
      name: string;
      value: number;
      weight: string;
      contribution: number;
      note: string;
    }[];
    safetyTriggerTriggered?: boolean;
    safetyTriggerReason?: string;
  };
}

export interface PriorityAssessmentRecord {
  id: string;
  reportId: string;
  severityFactor: number;
  impactFactor: number;
  recurrenceFactor: number;
  ageFactor: number;
  score: number;
  priorityLevel: PriorityLevel;
  explanation: PriorityBreakdown['explanation'];
  assessedAt: string;
  overriddenBy?: string | null;
  overrideReason?: string | null;
}

export interface PossibleDuplicateRecord {
  id: string;
  reportId: string;
  candidateReportId: string;
  similarityScore: number;
  matchingReasons: {
    distanceMeters: number;
    distanceExplanation: string;
    categoryMatch: boolean;
    textSimilarityPercentage: number;
    textMatchExplanation: string;
  };
  reviewStatus: ReviewStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  candidateReport?: Partial<Report>;
}

export interface ReportStatusHistoryRecord {
  id: string;
  reportId: string;
  previousStatus: ReportStatus;
  newStatus: ReportStatus;
  changedBy: string;
  note?: string | null;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId?: string | null;
  reporterName?: string | null;
  title: string;
  description: string;
  category: ReportCategory;
  userCategory?: ReportCategory | null;
  latitude: number;
  longitude: number;
  addressLabel?: string | null;
  wardId?: string | null;
  wardName?: string | null;
  imageUrl?: string | null;
  status: ReportStatus;
  sourceType: SourceType;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  aiAnalysis?: AiAnalysisRecord | null;
  priorityAssessment?: PriorityAssessmentRecord | null;
  possibleDuplicates?: PossibleDuplicateRecord[];
  statusHistory?: ReportStatusHistoryRecord[];
}

export interface DashboardSummary {
  totalReports: number;
  openReports: number;
  inProgressReports: number;
  resolvedReports: number;
  highPriorityReports: number;
  criticalPriorityReports: number;
  unresolvedOver7Days: number;
  duplicateReportsFlagged: number;
  byCategory: {
    category: ReportCategory;
    categoryLabelBn: string;
    count: number;
    percentage: number;
  }[];
  byWard: {
    wardId: string;
    wardName: string;
    count: number;
    highPriorityCount: number;
  }[];
  hotspots: {
    areaName: string;
    latitude: number;
    longitude: number;
    reportCount: number;
    primaryCategory: ReportCategory;
    topSeverity: number;
  }[];
  recentActivity: {
    reportId: string;
    title: string;
    category: ReportCategory;
    status: ReportStatus;
    priorityLevel?: PriorityLevel;
    wardName?: string;
    createdAt: string;
  }[];
  recommendedActions: {
    reportId: string;
    title: string;
    category: ReportCategory;
    score: number;
    priorityLevel: PriorityLevel;
    reason: string;
    location: string;
  }[];
}
