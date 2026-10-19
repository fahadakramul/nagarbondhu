import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../src/app';
import { db } from '../src/db';

describe('Community demo discussions', () => {
  let snapshot: ReturnType<typeof db.snapshot>;
  beforeEach(() => { snapshot = db.snapshot(); });
  afterEach(() => db.restore(snapshot));

  test('labels fictional posts and stores one like per device', async () => {
    const deviceId = randomUUID();
    const first = await request(app).get('/api/v1/community/posts').set('X-Civic-Device', deviceId);
    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(3);
    expect(first.body.data.every((post: any) => post.demo === true)).toBe(true);
    const id = first.body.data[0].id;
    const liked = await request(app).post(`/api/v1/community/posts/${id}/like`).send({ deviceId });
    expect(liked.body.data).toMatchObject({ likeCount: 1, likedByMe: true });
    const again = await request(app).post(`/api/v1/community/posts/${id}/like`).send({ deviceId });
    expect(again.body.data.likeCount).toBe(1);
    expect((await request(app).post('/api/v1/community/posts/unknown/like').send({ deviceId })).status).toBe(404);
  });

  test('publishes masked comments without device identities', async () => {
    const deviceId = randomUUID();
    const result = await request(app).post('/api/v1/community/posts/demo-clean-street/comments')
      .send({ deviceId, text: 'মতামত জানাতে 01712345678 নম্বরে যোগাযোগ করুন' });
    expect(result.status).toBe(201);
    expect(result.body.data.commentCount).toBe(1);
    expect(result.body.data.comments[0].text).not.toContain('01712345678');
    expect(JSON.stringify(result.body)).not.toContain('deviceHash');
    const invalid = await request(app).post('/api/v1/community/posts/demo-clean-street/comments')
      .send({ deviceId, text: 'x' });
    expect(invalid.status).toBe(400);
  });
});
