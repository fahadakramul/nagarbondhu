import {
  assessDuplicate,
  DuplicateAssessmentResult,
  PossibleDuplicateRecord,
  Report,
  ReviewStatus,
} from '@nagarbondhu/shared';
import { db } from '../db';
import { CONFIG } from '../config';

export class DuplicateService {
  /**
   * Scans existing reports for potential duplicates of a given report
   */
  static checkForDuplicates(report: Report): PossibleDuplicateRecord[] {
    const allReports = db.findReports({ limit: 500 }).reports;
    const candidates: PossibleDuplicateRecord[] = [];

    for (const other of allReports) {
      // Don't compare against itself or resolved/rejected reports
      if (other.id === report.id || other.status === 'RESOLVED' || other.status === 'REJECTED') {
        continue;
      }

      const assessment = assessDuplicate(
        {
          latitude: report.latitude,
          longitude: report.longitude,
          category: report.category,
          title: report.title,
          description: report.description,
        },
        {
          latitude: other.latitude,
          longitude: other.longitude,
          category: other.category,
          title: other.title,
          description: other.description,
        },
        CONFIG.DEFAULT_MAX_DUPLICATE_DISTANCE_METERS
      );

      if (assessment.isPossibleDuplicate) {
        const dupRecord: PossibleDuplicateRecord = {
          id: `dup-${report.id}-${other.id}`,
          reportId: report.id,
          candidateReportId: other.id,
          similarityScore: assessment.similarityScore,
          matchingReasons: assessment.matchingReasons,
          reviewStatus: 'PENDING',
          createdAt: new Date().toISOString(),
          candidateReport: {
            id: other.id,
            title: other.title,
            category: other.category,
            status: other.status,
            latitude: other.latitude,
            longitude: other.longitude,
            createdAt: other.createdAt,
          },
        };

        db.saveDuplicate(dupRecord);
        candidates.push(dupRecord);
      }
    }

    return candidates;
  }

  /**
   * Admin confirms or dismisses a duplicate report match
   */
  static reviewDuplicate(
    duplicateId: string,
    reviewStatus: ReviewStatus,
    adminId: string
  ): PossibleDuplicateRecord | null {
    return db.updateDuplicateReview(duplicateId, reviewStatus, adminId);
  }
}
