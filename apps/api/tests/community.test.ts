import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../src/app';
import { db } from '../src/db';

describe('Community discussions', () => {
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

  test('publishes citizen suggestions separately from reports and allows the author to remove them', async () => {
    const deviceId = randomUUID(), other = randomUUID();
    const created = await request(app).post('/api/v1/community/posts').send({
      deviceId, topic: 'IDEA', title: 'পাড়ায় ছায়ার ব্যবস্থা',
      body: 'স্কুলের পথে গাছ ও বসার জায়গা করলে সবার সুবিধা হবে।', wardNumber: 12,
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ demo: false, mine: true, topic: 'IDEA', wardNumber: 12 });
    const id = created.body.data.id;
    expect(db.reports.has(id)).toBe(false);
    const feed = await request(app).get('/api/v1/community/posts').set('X-Civic-Device', deviceId);
    expect(feed.body.data[0].id).toBe(id);
    expect(feed.body.data).toHaveLength(4);
    expect(JSON.stringify(feed.body)).not.toContain('deviceHash');
    expect((await request(app).post(`/api/v1/community/posts/${id}/remove`).send({ deviceId: other })).status).toBe(403);
    expect((await request(app).post(`/api/v1/community/posts/${id}/remove`).send({ deviceId })).status).toBe(200);
    expect((await request(app).get('/api/v1/community/posts')).body.data).toHaveLength(3);
  });

  test('comments can be removed by their author and authority reads real suggestions only', async () => {
    const deviceId = randomUUID();
    const created = await request(app).post('/api/v1/community/posts').send({
      deviceId, topic: 'DISCUSSION', title: 'হাঁটার পথ নিয়ে আলোচনা',
      body: 'আমাদের এলাকায় হাঁটার পথ কীভাবে আরও আরামদায়ক করা যায়?',
    });
    const id = created.body.data.id;
    const comment = await request(app).post(`/api/v1/community/posts/${id}/comments`).send({ deviceId, text: 'গাছ লাগানো যেতে পারে।' });
    const commentId = comment.body.data.comments[0].id;
    expect((await request(app).post(`/api/v1/community/comments/${commentId}/remove`).send({ deviceId: randomUUID() })).status).toBe(403);
    expect((await request(app).post(`/api/v1/community/comments/${commentId}/remove`).send({ deviceId })).body.data.commentCount).toBe(0);
    expect((await request(app).get('/api/v1/admin/community/posts')).status).toBe(401);
    const login = await request(app).post('/api/v1/auth/demo').send({});
    expect(login.status).toBe(200);
    const authority = await request(app).get('/api/v1/admin/community/posts').set('Authorization', `Bearer ${login.body.token}`);
    expect(authority.status).toBe(200);
    expect(authority.body.data).toHaveLength(1);
    expect(authority.body.data[0].id).toBe(id);
    expect(authority.body.data[0].demo).toBe(false);
  });
});
