import { Router } from 'express';
import { randomUUID, createHash } from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { civicLimit, deviceHash } from '../middleware/civicLimit';
import { authenticate, requireRole } from '../middleware/auth';
import { publicText } from '../services/privacy';

const router = Router();
const demos = [
  { id: 'demo-clean-street', title: 'পাড়ার পরিচ্ছন্নতা নিয়ে একসঙ্গে ভাবি', body: 'ধরা যাক, কয়েকটি পরিবার মিলে নির্দিষ্ট দিনে রাস্তার ময়লা আলাদা করে সংগ্রহের উদ্যোগ নিতে চায়। আপনার এলাকায় এমন উদ্যোগ কীভাবে শুরু করা যায়?', topic: 'IDEA' },
  { id: 'demo-shade-trees', title: 'হাঁটার পথে ছায়া বাড়ানোর ভাবনা', body: 'স্কুল ও বাজারে যাওয়ার পথে কোথায় ছায়া বা বিশ্রামের জায়গা দরকার, তা নিয়ে প্রতিবেশীদের মতামত জড়ো করা যেতে পারে। আপনার পরামর্শ কী?', topic: 'DISCUSSION' },
  { id: 'demo-safe-crossing', title: 'নিরাপদ রাস্তা পারাপার নিয়ে আলোচনা', body: 'ব্যস্ত রাস্তার পাশে হাঁটা ও পারাপার সহজ করতে কী ধরনের ছোট পরিবর্তন কাজে আসতে পারে? আপনার এলাকার অভিজ্ঞতা লিখুন।', topic: 'QUESTION' },
] as const;
const device = z.object({ deviceId: z.string().uuid() }).strict();
const known = (id: string) => demos.some(post => post.id === id) || !!db.communityPosts.get(id) && !db.communityPosts.get(id)?.deletedAt;
const viewerHash = (header?: string) => header ? deviceHash(z.string().uuid().parse(header)) : undefined;
const view = (id: string, viewer?: string) => {
  const likes = Array.from(db.communityLikes.values()).filter(like => like.postId === id);
  const allComments = Array.from(db.communityComments.values()).filter(comment => comment.postId === id && !comment.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    likeCount: likes.length,
    likedByMe: !!viewer && likes.some(like => like.deviceHash === viewer),
    commentCount: allComments.length,
    comments: allComments.slice(0, 20).map(comment => ({ id: comment.id, text: publicText(comment.text), createdAt: comment.createdAt, mine: !!viewer && comment.deviceHash === viewer })),
  };
};
const publicPost = (post: typeof demos[number] | NonNullable<ReturnType<typeof db.communityPosts.get>>, viewer?: string) => ({
  id: post.id,
  title: publicText(post.title),
  body: publicText(post.body),
  topic: post.topic,
  wardNumber: 'wardNumber' in post ? post.wardNumber || null : null,
  createdAt: 'createdAt' in post ? post.createdAt : null,
  demo: !('deviceHash' in post),
  mine: 'deviceHash' in post && !!viewer && post.deviceHash === viewer,
  ...view(post.id, viewer),
});
const realPosts = () => Array.from(db.communityPosts.values()).filter(post => !post.deletedAt);

router.get('/community/posts', (req, res, next) => {
  try {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(50).default(30) }).strict().parse(req.query);
    const viewer = viewerHash(req.header('X-Civic-Device'));
    const real = realPosts().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, query.limit);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: [...real.map(post => publicPost(post, viewer)), ...demos.map(post => publicPost(post, viewer))], realCount: real.length });
  } catch (error) { next(error); }
});

router.post('/community/posts', civicLimit, (req, res, next) => {
  try {
    const input = z.object({
      deviceId: z.string().uuid(),
      topic: z.enum(['IDEA', 'DISCUSSION', 'QUESTION']),
      title: z.string().trim().min(8).max(120),
      body: z.string().trim().min(20).max(1500),
      wardNumber: z.number().int().min(1).max(30).nullable().optional(),
    }).strict().parse(req.body);
    const hash = deviceHash(input.deviceId), now = new Date().toISOString();
    if (realPosts().filter(post => post.deviceHash === hash && post.createdAt >= new Date(Date.now() - 86400000).toISOString()).length >= 3)
      return res.status(429).json({ success: false, error: '২৪ ঘণ্টায় সর্বোচ্চ তিনটি আলোচনা পোস্ট করা যায়।' });
    const post = { id: randomUUID(), deviceHash: hash, topic: input.topic, title: publicText(input.title), body: publicText(input.body), wardNumber: input.wardNumber || null, createdAt: now, deletedAt: null };
    db.communityPosts.set(post.id, post);
    res.status(201).json({ success: true, data: publicPost(post, hash) });
  } catch (error) { next(error); }
});

router.post('/community/posts/:id/like', civicLimit, (req, res, next) => {
  try {
    const { deviceId } = device.parse(req.body);
    if (!known(req.params.id)) return res.status(404).json({ success: false, error: 'আলোচনা পাওয়া যায়নি।' });
    const hash = deviceHash(deviceId), id = createHash('sha256').update(req.params.id + ':' + hash).digest('hex');
    if (!db.communityLikes.has(id)) db.communityLikes.set(id, { id, postId: req.params.id, deviceHash: hash, createdAt: new Date().toISOString() });
    res.json({ success: true, data: view(req.params.id, hash) });
  } catch (error) { next(error); }
});

router.post('/community/posts/:id/comments', civicLimit, (req, res, next) => {
  try {
    const input = z.object({ deviceId: z.string().uuid(), text: z.string().trim().min(3).max(500) }).strict().parse(req.body);
    if (!known(req.params.id)) return res.status(404).json({ success: false, error: 'আলোচনা পাওয়া যায়নি।' });
    const hash = deviceHash(input.deviceId);
    if (Array.from(db.communityComments.values()).filter(comment => comment.postId === req.params.id && comment.deviceHash === hash && !comment.deletedAt).length >= 5)
      return res.status(429).json({ success: false, error: 'একটি আলোচনায় সর্বোচ্চ পাঁচটি মন্তব্য করা যায়।' });
    const id = randomUUID();
    db.communityComments.set(id, { id, postId: req.params.id, deviceHash: hash, text: publicText(input.text), createdAt: new Date().toISOString(), deletedAt: null });
    res.status(201).json({ success: true, data: view(req.params.id, hash) });
  } catch (error) { next(error); }
});

router.post('/community/posts/:id/remove', civicLimit, (req, res, next) => {
  try {
    const { deviceId } = device.parse(req.body), post = db.communityPosts.get(req.params.id);
    if (!post || post.deletedAt) return res.status(404).json({ success: false, error: 'আলোচনা পাওয়া যায়নি।' });
    if (post.deviceHash !== deviceHash(deviceId)) return res.status(403).json({ success: false, error: 'নিজের আলোচনাই সরাতে পারবেন।' });
    post.deletedAt = new Date().toISOString();
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.post('/community/comments/:id/remove', civicLimit, (req, res, next) => {
  try {
    const { deviceId } = device.parse(req.body), comment = db.communityComments.get(req.params.id);
    if (!comment || comment.deletedAt || !known(comment.postId)) return res.status(404).json({ success: false, error: 'মন্তব্য পাওয়া যায়নি।' });
    const hash = deviceHash(deviceId);
    if (comment.deviceHash !== hash) return res.status(403).json({ success: false, error: 'নিজের মন্তব্যই সরাতে পারবেন।' });
    comment.deletedAt = new Date().toISOString();
    res.json({ success: true, data: view(comment.postId, hash) });
  } catch (error) { next(error); }
});

router.get('/admin/community/posts', authenticate, requireRole(['ADMIN', 'URBAN_PLANNER']), (_req, res) => {
  const data = realPosts().map(post => publicPost(post)).sort((a, b) => b.likeCount - a.likeCount || String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data, note: 'আলোচনার তালিকা; আনুষ্ঠানিক অভিযোগ বা সিদ্ধান্ত নয়।' });
});

export default router;
