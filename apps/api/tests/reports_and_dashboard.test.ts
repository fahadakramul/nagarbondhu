import request from 'supertest';
import { app } from '../src/app';

describe('Reports & Planning Dashboard Integration Tests', () => {
  let adminToken: string;

  beforeAll(async () => {
    // Obtain admin token for protected endpoints
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@nagarbondhu.gov.bd',
        password: 'DemoAdmin123!',
      });
    adminToken = res.body.token;
  });

  test('submits a new Bengali civic report end-to-end and computes AI + Priority', async () => {
    const reportData = {
      title: 'বিনোদপুর বাজারে ড্রেন উপচে পড়া',
      description: 'বিনোদপুর রুয়েট গেটের সামনে ড্রেন উপচে নোংরা পানি রাস্তায় ছড়িয়ে গেছে। তীব্র দুর্গন্ধ বের হচ্ছে।',
      latitude: 24.3640,
      longitude: 88.6480,
      addressLabel: 'বিনোদপুর বাজার, মতিহার, রাজশাহী',
    };

    const res = await request(app)
      .post('/api/v1/reports')
      .send(reportData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.report.id).toBeDefined();
    expect(res.body.report.category).toBeDefined();

    // Verify AI analysis was generated
    expect(res.body.report.aiAnalysis).toBeDefined();
    expect(res.body.report.aiAnalysis.severity).toBeGreaterThanOrEqual(1);

    // Verify Priority assessment was calculated
    expect(res.body.report.priorityAssessment).toBeDefined();
    expect(res.body.report.priorityAssessment.score).toBeGreaterThan(0);
    expect(res.body.report.priorityAssessment.priorityLevel).toBeDefined();
  });

  test('retrieves reports list and ensures reporter email is not leaked', async () => {
    const res = await request(app).get('/api/v1/reports');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reports.length).toBeGreaterThan(0);

    // Verify no reporter email or private details exposed
    const sample = res.body.reports[0];
    expect(sample.reporterId).toBeUndefined();
    expect(sample.reporterEmail).toBeUndefined();
  });

  test('fetches real-time dashboard summary calculated from database records', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalReports).toBeGreaterThan(0);
    expect(res.body.data.byCategory.length).toBeGreaterThan(0);
    expect(res.body.data.byWard.length).toBeGreaterThan(0);
    expect(res.body.data.hotspots.length).toBeGreaterThan(0);
    expect(res.body.data.recommendedActions.length).toBeGreaterThan(0);
  });

  test('admin successfully transitions report status with audit note', async () => {
    const updateRes = await request(app)
      .patch('/api/v1/admin/reports/rep-001/action-status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'AWAITING_FIELD_VERIFICATION',
        revision: 0,
        note: 'সিটি কর্পোরেশনের সড়ক টিমকে মাঠ পর্যায়ে পাঠানো হয়েছে।',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.status).toBe('AWAITING_FIELD_VERIFICATION');

    // Verify history audit log
    const fetchRes = await request(app).get('/api/v1/reports/rep-001');
    expect(fetchRes.body.report.statusHistory.length).toBeGreaterThan(0);
  });

  test('admin successfully overrides priority with transparent reason', async () => {
    const overrideRes = await request(app)
      .patch('/api/v1/admin/reports/rep-001/priority')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        priorityLevel: 'CRITICAL',
        reason: 'বাণিজ্যিক কেন্দ্রের প্রধান প্রবেশদ্বারে জরুরি যানজট রোধে অগ্রাধিকার বাড়ানো হলো।',
      });

    expect(overrideRes.status).toBe(200);
    expect(overrideRes.body.success).toBe(true);
    expect(overrideRes.body.priorityAssessment.priorityLevel).toBe('CRITICAL');
    expect(overrideRes.body.priorityAssessment.overriddenBy).toBeDefined();
  });

  test('retrieves map markers endpoint with proper coordinates and categories', async () => {
    const res = await request(app).get('/api/v1/map/reports');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.markers.length).toBeGreaterThan(0);
    expect(res.body.markers[0].latitude).toBeDefined();
    expect(res.body.markers[0].longitude).toBeDefined();
    expect(res.body.markers[0].category).toBeDefined();
  });

  test('serves the NagarBondhu AI web application HTML at root URL', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('নগরবন্ধু');
    expect(res.text).toContain('NagarBondhu AI');
  });
});
