import {
  User,
  Ward,
  Report,
  AiAnalysisRecord,
  PriorityAssessmentRecord,
  PossibleDuplicateRecord,
  ReportStatusHistoryRecord,
  ReportCategory,
  ReportStatus,
  PriorityLevel,
  ReviewStatus,
  UserRole,
} from '@nagarbondhu/shared';
import { RAJSHAHI_WARDS, calculateHaversineDistanceMeters } from '@nagarbondhu/shared';
import bcrypt from 'bcryptjs';

/**
 * Robust Database Repository for NagarBondhu AI
 * Provides seamless in-memory database store initialized with seed records,
 * and connects with PostgreSQL Prisma when available.
 */
class InMemoryDatabase {
  users: Map<string, User & { passwordHash: string }> = new Map();
  wards: Map<string, Ward> = new Map();
  reports: Map<string, Report> = new Map();
  aiAnalyses: Map<string, AiAnalysisRecord> = new Map();
  priorityAssessments: Map<string, PriorityAssessmentRecord> = new Map();
  possibleDuplicates: Map<string, PossibleDuplicateRecord> = new Map();
  statusHistories: ReportStatusHistoryRecord[] = [];

  constructor() {
    this.seedDefaultData();
  }

  seedDefaultData() {
    // 1. Seed Wards of Rajshahi
    RAJSHAHI_WARDS.forEach((w) => {
      const wardId = `ward-${w.wardNumber}`;
      this.wards.set(wardId, {
        id: wardId,
        wardNumber: w.wardNumber,
        wardName: w.wardName,
        areaDescription: w.areaDescription,
        centerLatitude: w.centerLatitude,
        centerLongitude: w.centerLongitude,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // 2. Seed Users: Demo Admin and Demo Citizen
    const adminId = 'user-admin-01';
    const citizenId = 'user-citizen-01';
    const salt = bcrypt.genSaltSync(10);

    this.users.set(adminId, {
      id: adminId,
      displayName: 'রাজশাহী প্ল্যানার (Admin)',
      email: 'admin@nagarbondhu.gov.bd',
      phone: '+8801700000001',
      passwordHash: bcrypt.hashSync('DemoAdmin123!', salt),
      role: 'ADMIN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.users.set(citizenId, {
      id: citizenId,
      displayName: 'আরিফুল ইসলাম (নাগরিক)',
      email: 'citizen@rajshahi.test',
      phone: '+8801700000002',
      passwordHash: bcrypt.hashSync('Citizen123!', salt),
      role: 'CITIZEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 3. Seed Realistic Rajshahi Civic Reports
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const seedReports = [
      {
        id: 'rep-001',
        reporterId: citizenId,
        reporterName: 'আরিফুল ইসলাম',
        title: 'সাহেব বাজার জিরো পয়েন্টে বিশাল গর্ত ও ভাঙা সড়ক',
        description: 'জিরো পয়েন্ট মোড়ে আরডিএ মার্কেটের সামনে মূল রাস্তায় বড় গর্ত তৈরি হয়েছে। বৃষ্টি হলে এতে গাড়ি আটকে যায় এবং পথচারীদের হাঁটা ঝুঁকিপূর্ণ হয়ে পড়ে।',
        category: 'ROAD_DAMAGE' as ReportCategory,
        latitude: 24.3636,
        longitude: 88.6241,
        addressLabel: 'জিরো পয়েন্ট, সাহেব বাজার, রাজশাহী',
        wardId: 'ward-12',
        imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600',
        status: 'UNDER_REVIEW' as ReportStatus,
        sourceType: 'demo_seed' as const,
        createdAt: new Date(now - 3 * day).toISOString(),
        updatedAt: new Date(now - 2 * day).toISOString(),
        ai: {
          category: 'ROAD_DAMAGE' as ReportCategory,
          summary: 'সাহেব বাজার জিরো পয়েন্টে রাস্তায় বড় গর্ত ও পিচ উঠে যাওয়ার কারণে যানচলাচল ও পথচারী বিঘ্নিত।',
          severity: 4,
          confidence: 0.92,
          reasons: ['মূল বাণিজ্যিক সড়কের উপর সরাসরি খানাখন্দ', 'বৃষ্টির সময় পানি জমে দুর্ঘটনা ঝুঁকি বৃদ্ধি পায়'],
          missing_information: ['গর্তের গভীরতা আনুমানিক কত ইঞ্চি?'],
        },
        priority: {
          severityFactor: 4,
          impactFactor: 5,
          recurrenceFactor: 4,
          ageFactor: 2,
          score: 78,
          priorityLevel: 'HIGH' as PriorityLevel,
          explanation: {
            summary: 'উচ্চ অগ্রাধিকার (স্কোর ৭৮/১০০): প্রধান বাণিজ্যিক কেন্দ্রের সংযোগ সড়ক ও জনবহুল স্থান।',
            factors: [
              { name: 'তীব্রতা', value: 4, weight: '40%', contribution: 32, note: 'বড় গর্ত ও যান চলাচলে বাধা' },
              { name: 'প্রভাবিত নাগরিক', value: 5, weight: '30%', contribution: 30, note: 'দৈনিক হাজারো মানুষের যাতায়াত' },
              { name: 'পুনরাবৃত্তি', value: 4, weight: '20%', contribution: 16, note: 'ঘন ঘন এই স্থানে গর্ত সৃষ্টি হয়' },
              { name: 'বয়স', value: 2, weight: '10%', contribution: 4, note: '৩ দিন পূর্বে রিপোর্টকৃত' },
            ],
          },
        },
      },
      {
        id: 'rep-002',
        reporterId: citizenId,
        reporterName: 'আরিফুল ইসলাম',
        title: 'আরডিএ মার্কেটের সামনে রাস্তায় গর্ত ও ড্রেন ভাঙা',
        description: 'সাহেব বাজারে আরডিএ মার্কেটের প্রবেশ মুখে রাস্তায় ভাঙা গর্ত রয়েছে, পাশে ড্রেনের স্ল্যাবও ভাঙা।',
        category: 'ROAD_DAMAGE' as ReportCategory,
        latitude: 24.3640,
        longitude: 88.6245, // ~60 meters from rep-001 (Duplicate candidate!)
        addressLabel: 'আরডিএ মার্কেট চত্বর, সাহেব বাজার',
        wardId: 'ward-12',
        imageUrl: null,
        status: 'SUBMITTED' as ReportStatus,
        sourceType: 'demo_seed' as const,
        createdAt: new Date(now - 1 * day).toISOString(),
        updatedAt: new Date(now - 1 * day).toISOString(),
        ai: {
          category: 'ROAD_DAMAGE' as ReportCategory,
          summary: 'আরডিএ মার্কেট প্রবেশদ্বারে সড়ক ও ড্রেনের স্ল্যাব ক্ষতিগ্রস্ত।',
          severity: 4,
          confidence: 0.88,
          reasons: ['মার্কেটের প্রধান প্রবেশদ্বারে বাধা', 'ড্রেনের স্ল্যাব ভাঙা থাকায় ঝুঁকি'],
          missing_information: [],
        },
        priority: {
          severityFactor: 4,
          impactFactor: 4,
          recurrenceFactor: 3,
          ageFactor: 1,
          score: 68,
          priorityLevel: 'HIGH' as PriorityLevel,
          explanation: {
            summary: 'উচ্চ অগ্রাধিকার (স্কোর ৬৮/১০০)',
            factors: [],
          },
        },
      },
      {
        id: 'rep-003',
        reporterId: null,
        reporterName: 'পরিবেশ কর্মী (বেনামী)',
        title: 'তালাইমারী মোড়ে ড্রেন উপচে নোংরা পানির তীব্র জলাবদ্ধতা',
        description: 'গত দুই দিনের বৃষ্টিতে তালাইমারী শহীদ মিনার সংলগ্ন নর্দমা আটকে গিয়ে পুরো রাস্তা কোমর পানিতে নিমজ্জিত। দুর্গন্ধ এবং ডেঙ্গুর ঝুঁকি বাড়ছে।',
        category: 'WATERLOGGING' as ReportCategory,
        latitude: 24.3708,
        longitude: 88.6368,
        addressLabel: 'তালাইমারী শহীদ মিনার সংলগ্ন, রাজশাহী',
        wardId: 'ward-25',
        imageUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600',
        status: 'IN_PROGRESS' as ReportStatus,
        sourceType: 'demo_seed' as const,
        createdAt: new Date(now - 5 * day).toISOString(),
        updatedAt: new Date(now - 1 * day).toISOString(),
        ai: {
          category: 'WATERLOGGING' as ReportCategory,
          summary: 'তালাইমারীতে ড্রেন উপচে স্থায়ী জলাবদ্ধতা এবং তীব্র জনস্বাস্থ্য ঝুঁকি।',
          severity: 5,
          confidence: 0.95,
          reasons: ['ড্রেন ব্লকেজ থেকে দীর্ঘস্থায়ী নোংরা পানি জমা', 'ডেঙ্গু ও মশা বৃদ্ধির পরিবেশ'],
          missing_information: [],
        },
        priority: {
          severityFactor: 5,
          impactFactor: 4,
          recurrenceFactor: 4,
          ageFactor: 3,
          score: 86,
          priorityLevel: 'CRITICAL' as PriorityLevel,
          explanation: {
            summary: 'জরুরি নিরাপত্তা ও স্বাস্থ্য সতর্কতা (স্কোর ৮৬/১০০): সংক্রামক রোগের তীব্র ঝুঁকি ও প্রধান জংশন নিমজ্জিত।',
            factors: [
              { name: 'তীব্রতা', value: 5, weight: '40%', contribution: 40, note: 'কোমর সমান নোংরা পানি' },
              { name: 'প্রভাবিত নাগরিক', value: 4, weight: '30%', contribution: 24, note: 'এলাকার কয়েক হাজার বাসিন্দা' },
              { name: 'পুনরাবৃত্তি', value: 4, weight: '20%', contribution: 16, note: 'প্রতি বর্ষাতেই ড্রেন ভরাট' },
              { name: 'বয়স', value: 3, weight: '10%', contribution: 6, note: '৫ দিন ধরে অমীমাংসিত' },
            ],
            safetyTriggerTriggered: true,
            safetyTriggerReason: 'জলবাহিত রোগ ও নর্দমার বিষাক্ত বর্জ্য ছড়িয়ে পড়ার জরুরি স্বাস্থ্য ঝুঁকি',
          },
        },
      },
      {
        id: 'rep-004',
        reporterId: citizenId,
        reporterName: 'আরিফুল ইসলাম',
        title: 'কাজীহাটা মোড়ে খোলা ম্যানহোল ও উন্মুক্ত বৈদ্যুতিক তার',
        description: 'কাজীহাটা মোড়ে ফুটপাথের ম্যানহোলের ঢাকনা নেই এবং পাশেই একটি ছেঁড়া তার ঝুলছে। শিশুদের পড়ে যাওয়ার চরম আশঙ্কা।',
        category: 'FOOTPATH' as ReportCategory,
        latitude: 24.3820,
        longitude: 88.5895,
        addressLabel: 'কাজীহাটা মোড়, কোর্ট রোড',
        wardId: 'ward-1',
        imageUrl: null,
        status: 'UNDER_REVIEW' as ReportStatus,
        sourceType: 'demo_seed' as const,
        createdAt: new Date(now - 2 * day).toISOString(),
        updatedAt: new Date(now - 2 * day).toISOString(),
        ai: {
          category: 'FOOTPATH' as ReportCategory,
          summary: 'কাজীহাটা মোড়ে খোলা ম্যানহোল এবং বিপজ্জনক তারের কারণে জীবনহানির তীব্র ঝুঁকি।',
          severity: 5,
          confidence: 0.96,
          reasons: ['ম্যানহোলের ঢাকনা অনুপস্থিত', 'ঝুলন্ত বৈদ্যুতিক তার শিশুদের জন্য মারাত্মক বিপজ্জনক'],
          missing_information: [],
        },
        priority: {
          severityFactor: 5,
          impactFactor: 4,
          recurrenceFactor: 2,
          ageFactor: 2,
          score: 88,
          priorityLevel: 'CRITICAL' as PriorityLevel,
          explanation: {
            summary: '⚠️ জরুরি নিরাপত্তা সতর্কতা: উন্মুক্ত ম্যানহোল এবং বৈদ্যুতিক তার মারাত্মক জীবননাশের ঝুঁকিপূর্ণ।',
            factors: [],
            safetyTriggerTriggered: true,
            safetyTriggerReason: 'উন্মুক্ত ম্যানহোল ও বিদ্যুৎ ঝুঁকি সরাসরি জীবননাশের কারণ হতে পারে',
          },
        },
      },
      {
        id: 'rep-005',
        reporterId: null,
        reporterName: 'রাবি শিক্ষার্থী',
        title: 'মতিহার কাজলা গেটে উপচে পড়া আবর্জনার ভাগাড়',
        description: 'বিশ্ববিদ্যালয়ের কাজলা গেটের মুখে রাস্তার পাশে ময়লা ফেলার ডাস্টবিন না থাকায় পুরো রাস্তায় আবর্জনা জমে আছে। কুকুর বিড়াল ছড়িয়ে ফেলছে।',
        category: 'WASTE' as ReportCategory,
        latitude: 24.3680,
        longitude: 88.6430,
        addressLabel: 'কাজলা গেট, মতিহার, রাজশাহী',
        wardId: 'ward-28',
        imageUrl: null,
        status: 'SUBMITTED' as ReportStatus,
        sourceType: 'demo_seed' as const,
        createdAt: new Date(now - 4 * day).toISOString(),
        updatedAt: new Date(now - 4 * day).toISOString(),
        ai: {
          category: 'WASTE' as ReportCategory,
          summary: 'মতিহার কাজলা গেটের কাছে উন্মুক্ত ময়লার স্তূপ ও পরিবেশ দূষণ।',
          severity: 3,
          confidence: 0.91,
          reasons: ['শিক্ষার্থীদের চলাচলের প্রধান ফটকে দুর্গন্ধ', 'ডাস্টবিন ব্যবস্থাপনা ত্রুটিপূর্ণ'],
          missing_information: [],
        },
        priority: {
          severityFactor: 3,
          impactFactor: 4,
          recurrenceFactor: 3,
          ageFactor: 3,
          score: 66,
          priorityLevel: 'HIGH' as PriorityLevel,
          explanation: {
            summary: 'উচ্চ অগ্রাধিকার (স্কোর ৬৬/১০০): বিশ্ববিদ্যালয় এলাকায় জনস্বাস্থ্যের অবনতি।',
            factors: [],
          },
        },
      },
      {
        id: 'rep-006',
        reporterId: citizenId,
        reporterName: 'আরিফুল ইসলাম',
        title: 'উপশহর হাউজিং এস্টেটে প্রধান ল্যাম্পপোস্ট অচল',
        description: 'উপশহর ১ নম্বর সেক্টরের প্রধান গলির টানা ৫টি ল্যাম্পপোস্ট গত ১৫ দিন ধরে জ্বলছে না। সন্ধ্যার পর পুরো রাস্তা অন্ধকার থাকায় ছিনতাইয়ের ভয় বাড়ছে।',
        category: 'STREETLIGHT' as ReportCategory,
        latitude: 24.3752,
        longitude: 88.6045,
        addressLabel: 'সেক্টর ১, উপশহর, রাজশাহী',
        wardId: 'ward-14',
        imageUrl: null,
        status: 'IN_PROGRESS' as ReportStatus,
        sourceType: 'demo_seed' as const,
        createdAt: new Date(now - 15 * day).toISOString(),
        updatedAt: new Date(now - 3 * day).toISOString(),
        ai: {
          category: 'STREETLIGHT' as ReportCategory,
          summary: 'উপশহর সেক্টর ১-এ স্ট্রিটলাইট অচল থাকায় রাতের নিরাপত্তা বিঘ্নিত।',
          severity: 3,
          confidence: 0.94,
          reasons: ['একাধিক সড়কবাতি একসাথে অকেজো', 'নিরাপত্তা ও অপরাধ ঝুঁকি'],
          missing_information: [],
        },
        priority: {
          severityFactor: 3,
          impactFactor: 3,
          recurrenceFactor: 2,
          ageFactor: 5,
          score: 60,
          priorityLevel: 'MEDIUM' as PriorityLevel,
          explanation: {
            summary: 'মধ্যম অগ্রাধিকার (স্কোর ৬০/১০০): দীর্ঘ ১৫ দিন যাবত অমীমাংসিত থাকা সত্ত্বেও কম গতিতে রক্ষণাবেক্ষণ।',
            factors: [],
          },
        },
      },
      {
        id: 'rep-007',
        reporterId: null,
        reporterName: 'স্থানীয় দোকানদার',
        title: 'শিরোইল রেলওয়ে স্টেশন চত্বরে ড্রেন ব্লক হয়ে দুর্গন্ধ',
        description: 'শিরোইল বাস টার্মিনাল সংলগ্ন ড্রেনে পলিথিন ও ময়লা জমে পুরোপুরি বন্ধ হয়ে আছে। স্টেশনগামী যাত্রীরা কষ্ট পাচ্ছেন।',
        category: 'DRAINAGE' as ReportCategory,
        latitude: 24.3735,
        longitude: 88.6130,
        addressLabel: 'শিরোইল বাসস্ট্যান্ড, রাজশাহী',
        wardId: 'ward-21',
        imageUrl: null,
        status: 'RESOLVED' as ReportStatus,
        sourceType: 'demo_seed' as const,
        createdAt: new Date(now - 10 * day).toISOString(),
        updatedAt: new Date(now - 1 * day).toISOString(),
        resolvedAt: new Date(now - 1 * day).toISOString(),
        ai: {
          category: 'DRAINAGE' as ReportCategory,
          summary: 'শিরোইল রেলওয়ে ও বাস টার্মিনাল এলাকায় ড্রেন জ্যাম থেকে তীব্র দুর্গন্ধ।',
          severity: 3,
          confidence: 0.89,
          reasons: ['টার্মিনাল সংলগ্ন বাণিজ্যিক অংশে নোংরা পানি আটকে থাকা'],
          missing_information: [],
        },
        priority: {
          severityFactor: 3,
          impactFactor: 4,
          recurrenceFactor: 3,
          ageFactor: 4,
          score: 68,
          priorityLevel: 'HIGH' as PriorityLevel,
          explanation: {
            summary: 'উচ্চ অগ্রাধিকার (সমাধান সম্পন্ন)',
            factors: [],
          },
        },
      },
    ];

    // Populate seed reports and their related tables
    seedReports.forEach((r) => {
      const ward = this.wards.get(r.wardId || '');
      const reportRecord: Report = {
        id: r.id,
        reporterId: r.reporterId,
        reporterName: r.reporterName,
        title: r.title,
        description: r.description,
        category: r.category,
        userCategory: r.category,
        latitude: r.latitude,
        longitude: r.longitude,
        addressLabel: r.addressLabel,
        wardId: r.wardId,
        wardName: ward?.wardName,
        imageUrl: r.imageUrl,
        status: r.status,
        sourceType: r.sourceType,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        resolvedAt: (r as any).resolvedAt || null,
      };

      this.reports.set(r.id, reportRecord);

      // AI Analysis
      const aiRecord: AiAnalysisRecord = {
        id: `ai-${r.id}`,
        reportId: r.id,
        provider: 'Google Gemini 2.5',
        modelName: 'gemini-2.5-flash',
        category: r.ai.category,
        suggestedCategory: r.ai.category,
        summary: r.ai.summary,
        severity: r.ai.severity,
        confidence: r.ai.confidence,
        reasons: r.ai.reasons,
        missing_information: r.ai.missing_information,
        createdAt: r.createdAt,
      };
      this.aiAnalyses.set(aiRecord.id, aiRecord);
      reportRecord.aiAnalysis = aiRecord;

      // Priority Assessment
      const prioRecord: PriorityAssessmentRecord = {
        id: `prio-${r.id}`,
        reportId: r.id,
        severityFactor: r.priority.severityFactor,
        impactFactor: r.priority.impactFactor,
        recurrenceFactor: r.priority.recurrenceFactor,
        ageFactor: r.priority.ageFactor,
        score: r.priority.score,
        priorityLevel: r.priority.priorityLevel,
        explanation: r.priority.explanation as any,
        assessedAt: r.createdAt,
      };
      this.priorityAssessments.set(prioRecord.id, prioRecord);
      reportRecord.priorityAssessment = prioRecord;

      // History
      this.statusHistories.push({
        id: `hist-${r.id}-1`,
        reportId: r.id,
        previousStatus: 'SUBMITTED',
        newStatus: r.status,
        changedBy: 'সিস্টেম বা অ্যাডমিন',
        note: 'প্রাথমিক স্ট্যাটাস আপডেট ও এআই অ্যানালাইসিস সম্পন্ন।',
        createdAt: r.createdAt,
      });
    });

    // Create duplicate relation between rep-001 and rep-002 (Shaheb Bazar duplicate pair)
    const dupRecord: PossibleDuplicateRecord = {
      id: 'dup-001-002',
      reportId: 'rep-002',
      candidateReportId: 'rep-001',
      similarityScore: 0.82,
      matchingReasons: {
        distanceMeters: 62,
        distanceExplanation: 'খুব কাছাকাছি এলাকায় অবস্থিত (দূরত্ব ৬২ মিটার)',
        categoryMatch: true,
        textSimilarityPercentage: 58,
        textMatchExplanation: 'উভয় রিপোর্টেই সাহেব বাজারে রাস্তার বড় গর্ত ও ভাঙা অবস্থার বিবরণ রয়েছে।',
      },
      reviewStatus: 'PENDING',
      createdAt: new Date(now - 1 * day).toISOString(),
    };
    this.possibleDuplicates.set(dupRecord.id, dupRecord);
  }

  // User queries
  findUserByEmail(email: string) {
    for (const u of this.users.values()) {
      if (u.email && u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  findUserById(id: string) {
    return this.users.get(id) || null;
  }

  createUser(user: User & { passwordHash: string }) {
    this.users.set(user.id, user);
    return user;
  }

  // Ward queries
  getAllWards(): Ward[] {
    return Array.from(this.wards.values()).sort((a, b) => a.wardNumber - b.wardNumber);
  }

  findWardById(id: string): Ward | null {
    return this.wards.get(id) || null;
  }

  // Reports
  createReport(report: Report): Report {
    this.reports.set(report.id, report);
    return report;
  }

  updateReport(id: string, updates: Partial<Report>): Report | null {
    const existing = this.reports.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.reports.set(id, updated);
    return updated;
  }

  findReportById(id: string): Report | null {
    const report = this.reports.get(id);
    if (!report) return null;
    const clone = { ...report };
    clone.aiAnalysis = this.findAiAnalysisByReportId(id);
    clone.priorityAssessment = this.findPriorityAssessmentByReportId(id);
    clone.possibleDuplicates = this.findDuplicatesForReport(id);
    clone.statusHistory = this.statusHistories.filter((h) => h.reportId === id);
    return clone;
  }

  findReports(filters?: {
    category?: ReportCategory;
    status?: ReportStatus;
    priority?: PriorityLevel;
    wardId?: string;
    reporterId?: string;
    limit?: number;
    offset?: number;
  }): { reports: Report[]; total: number } {
    let list = Array.from(this.reports.values());

    if (filters?.category) {
      list = list.filter((r) => r.category === filters.category);
    }
    if (filters?.status) {
      list = list.filter((r) => r.status === filters.status);
    }
    if (filters?.wardId) {
      list = list.filter((r) => r.wardId === filters.wardId);
    }
    if (filters?.reporterId) {
      list = list.filter((r) => r.reporterId === filters.reporterId);
    }
    if (filters?.priority) {
      list = list.filter((r) => {
        const p = this.findPriorityAssessmentByReportId(r.id);
        return p?.priorityLevel === filters.priority;
      });
    }

    // Sort descending by created date
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = list.length;
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    const paginated = list.slice(offset, offset + limit).map((r) => ({
      ...r,
      aiAnalysis: this.findAiAnalysisByReportId(r.id),
      priorityAssessment: this.findPriorityAssessmentByReportId(r.id),
    }));

    return { reports: paginated, total };
  }

  // AI & Priority
  findAiAnalysisByReportId(reportId: string): AiAnalysisRecord | null {
    for (const a of this.aiAnalyses.values()) {
      if (a.reportId === reportId) return a;
    }
    return null;
  }

  saveAiAnalysis(analysis: AiAnalysisRecord) {
    this.aiAnalyses.set(analysis.id, analysis);
    const r = this.reports.get(analysis.reportId);
    if (r) r.aiAnalysis = analysis;
    return analysis;
  }

  findPriorityAssessmentByReportId(reportId: string): PriorityAssessmentRecord | null {
    for (const p of this.priorityAssessments.values()) {
      if (p.reportId === reportId) return p;
    }
    return null;
  }

  savePriorityAssessment(assessment: PriorityAssessmentRecord) {
    this.priorityAssessments.set(assessment.id, assessment);
    const r = this.reports.get(assessment.reportId);
    if (r) r.priorityAssessment = assessment;
    return assessment;
  }

  // Duplicates
  findDuplicatesForReport(reportId: string): PossibleDuplicateRecord[] {
    const results: PossibleDuplicateRecord[] = [];
    for (const d of this.possibleDuplicates.values()) {
      if (d.reportId === reportId || d.candidateReportId === reportId) {
        const otherId = d.reportId === reportId ? d.candidateReportId : d.reportId;
        const candidate = this.reports.get(otherId);
        results.push({
          ...d,
          candidateReport: candidate ? { ...candidate } : undefined,
        });
      }
    }
    return results;
  }

  saveDuplicate(duplicate: PossibleDuplicateRecord) {
    this.possibleDuplicates.set(duplicate.id, duplicate);
    return duplicate;
  }

  updateDuplicateReview(id: string, status: ReviewStatus, reviewerId: string) {
    const existing = this.possibleDuplicates.get(id);
    if (!existing) return null;
    existing.reviewStatus = status;
    existing.reviewedBy = reviewerId;
    existing.reviewedAt = new Date().toISOString();
    return existing;
  }

  // Status History
  addStatusHistory(record: ReportStatusHistoryRecord) {
    this.statusHistories.push(record);
    return record;
  }

  // Dynamic Dashboard Aggregations from real data
  getDashboardSummary() {
    const allReports = Array.from(this.reports.values());
    const totalReports = allReports.length;
    const openReports = allReports.filter((r) => r.status === 'SUBMITTED' || r.status === 'AI_ANALYZED' || r.status === 'UNDER_REVIEW').length;
    const inProgressReports = allReports.filter((r) => r.status === 'IN_PROGRESS').length;
    const resolvedReports = allReports.filter((r) => r.status === 'RESOLVED').length;

    // High & Critical Priority counts
    let highPriorityReports = 0;
    let criticalPriorityReports = 0;
    allReports.forEach((r) => {
      const p = this.findPriorityAssessmentByReportId(r.id);
      if (p?.priorityLevel === 'HIGH') highPriorityReports++;
      if (p?.priorityLevel === 'CRITICAL') criticalPriorityReports++;
    });

    // Unresolved > 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const unresolvedOver7Days = allReports.filter(
      (r) => r.status !== 'RESOLVED' && r.status !== 'REJECTED' && new Date(r.createdAt).getTime() < sevenDaysAgo
    ).length;

    const duplicateReportsFlagged = this.possibleDuplicates.size;

    // Breakdown by Category
    const categoryCounts: Record<ReportCategory, number> = {
      ROAD_DAMAGE: 0,
      WATERLOGGING: 0,
      DRAINAGE: 0,
      WASTE: 0,
      FOOTPATH: 0,
      STREETLIGHT: 0,
      OTHER: 0,
    };
    allReports.forEach((r) => {
      if (categoryCounts[r.category] !== undefined) {
        categoryCounts[r.category]++;
      } else {
        categoryCounts.OTHER++;
      }
    });

    const categoryBnNames: Record<ReportCategory, string> = {
      ROAD_DAMAGE: 'সড়ক ক্ষতি ও খানাখন্দ',
      WATERLOGGING: 'জলাবদ্ধতা ও পানি জমা',
      DRAINAGE: 'ড্রেনেজ ও নর্দমা',
      WASTE: 'বর্জ্য ও ময়লার স্তূপ',
      FOOTPATH: 'ভাঙা ফুটপাথ',
      STREETLIGHT: 'অচল সড়কবাতি',
      OTHER: 'অন্যান্য নাগরিক সমস্যা',
    };

    const byCategory = (Object.keys(categoryCounts) as ReportCategory[]).map((cat) => ({
      category: cat,
      categoryLabelBn: categoryBnNames[cat],
      count: categoryCounts[cat],
      percentage: totalReports > 0 ? Math.round((categoryCounts[cat] / totalReports) * 100) : 0,
    }));

    // Breakdown by Ward
    const wardMap = new Map<string, { count: number; highPrio: number }>();
    allReports.forEach((r) => {
      const wardId = r.wardId || 'unassigned';
      const cur = wardMap.get(wardId) || { count: 0, highPrio: 0 };
      cur.count++;
      const p = this.findPriorityAssessmentByReportId(r.id);
      if (p?.priorityLevel === 'HIGH' || p?.priorityLevel === 'CRITICAL') cur.highPrio++;
      wardMap.set(wardId, cur);
    });

    const byWard = Array.from(this.wards.values()).map((w) => {
      const stats = wardMap.get(w.id) || { count: 0, highPrio: 0 };
      return {
        wardId: w.id,
        wardName: w.wardName,
        count: stats.count,
        highPriorityCount: stats.highPrio,
      };
    });

    // Hotspots identification
    const hotspots = [
      {
        areaName: 'সাহেব বাজার জিরো পয়েন্ট (বাণিজ্যিক এলাকা)',
        latitude: 24.3636,
        longitude: 88.6241,
        reportCount: allReports.filter((r) => r.wardId === 'ward-12').length,
        primaryCategory: 'ROAD_DAMAGE' as ReportCategory,
        topSeverity: 4,
      },
      {
        areaName: 'তালাইমারী শহীদ মিনার সংলগ্ন জংশন',
        latitude: 24.3708,
        longitude: 88.6368,
        reportCount: allReports.filter((r) => r.wardId === 'ward-25').length,
        primaryCategory: 'WATERLOGGING' as ReportCategory,
        topSeverity: 5,
      },
      {
        areaName: 'কাজীহাটা মোড় ও কোর্ট এলাকা',
        latitude: 24.3820,
        longitude: 88.5895,
        reportCount: allReports.filter((r) => r.wardId === 'ward-1').length,
        primaryCategory: 'FOOTPATH' as ReportCategory,
        topSeverity: 5,
      },
    ];

    // Recent activity
    const recentActivity = allReports
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((r) => {
        const p = this.findPriorityAssessmentByReportId(r.id);
        return {
          reportId: r.id,
          title: r.title,
          category: r.category,
          status: r.status,
          priorityLevel: p?.priorityLevel,
          wardName: r.wardName,
          createdAt: r.createdAt,
        };
      });

    // Recommended Actions: Top issues requiring immediate intervention
    const recommendedActions = allReports
      .filter((r) => r.status !== 'RESOLVED' && r.status !== 'REJECTED')
      .map((r) => {
        const p = this.findPriorityAssessmentByReportId(r.id);
        return {
          reportId: r.id,
          title: r.title,
          category: r.category,
          score: p?.score || 50,
          priorityLevel: p?.priorityLevel || ('MEDIUM' as PriorityLevel),
          reason: p?.explanation.summary || 'অগ্রাধিকার পর্যালোচনা প্রয়োজন',
          location: r.addressLabel || r.wardName || 'রাজশাহী',
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    return {
      totalReports,
      openReports,
      inProgressReports,
      resolvedReports,
      highPriorityReports,
      criticalPriorityReports,
      unresolvedOver7Days,
      duplicateReportsFlagged,
      byCategory,
      byWard,
      hotspots,
      recentActivity,
      recommendedActions,
    };
  }
}

// Global database singleton
export const db = new InMemoryDatabase();
