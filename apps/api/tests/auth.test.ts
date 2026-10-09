import request from 'supertest';
import { app } from '../src/app';

describe('Authentication & Authorization Integration Tests', () => {
  test('logs in with demo admin credentials and returns JWT token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@nagarbondhu.gov.bd',
        password: 'DemoAdmin123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('ADMIN');
  });

  test('registers a new citizen user', async () => {
    const randomEmail = `citizen_${Date.now()}@rajshahi.test`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        displayName: 'নতুন নাগরিক',
        email: randomEmail,
        password: 'Password123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('CITIZEN');
  });

  test('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@nagarbondhu.gov.bd',
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
