import { Router } from 'express';
import { randomUUID, createHash } from 'crypto';
import { z } from 'zod';
import { db } from '../db';
import { civicLimit, deviceHash } from '../middleware/civicLimit';
import { publicText } from '../services/privacy';

const router = Router();
const posts = [
  { id: 'demo-clean-street', title: 'পাড়ার পরিচ্ছন্নতা নিয়ে একসঙ্গে ভাবি', body: 'ধরা যাক, কয়েকটি পরিবার মিলে নির্দিষ্ট দিনে রাস্তার ময়লা আলাদা করে সংগ্রহের উদ্যোগ নিতে চায়। আপনার এলাকায় এমন উদ্যোগ কীভাবে শুরু করা যায়?', topic: 'পরিচ্ছন্নতা' },
  { id: 'demo-shade-trees', title: 'হাঁটার পথে ছায়া বাড়ানোর ভাবনা', body: 'স্কুল ও বাজারে যাওয়ার পথে কোথায় ছায়া বা বিশ্রামের জায়গা দরকার, তা নিয়ে প্রতিবেশীদের মতামত জড়ো করা যেতে পারে। আপনার পরামর্শ কী?', topic: 'নগর পরিবেশ' },
  { id: 'demo-safe-crossing', title: 'নিরাপদ রাস্তা পারাপার নিয়ে আলোচনা', body: 'ব্যস্ত রাস্তার পাশে হাঁটা ও পারাপার সহজ করতে কী ধরনের ছোট পরিবর্তন কাজে আসতে পারে? আপনার এলাকার অভিজ্ঞতা লিখুন।', topic: 'পথচারী নিরাপত্তা' },
] as const;
const known = (id: string) => posts.some(post => post.id === id);
const device = z.object({ deviceId: z.string().uuid() }).strict();
const view = (id: string, viewer?: string) => {
  const likes = Array.from(db.communityLikes.values()).filter(like => like.postId === id);
  const comments = Array.from(db.communityComments.values()).filter(comment => comment.postId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20)
    .map(({ id: commentId, text, createdAt }) => ({ id: commentId, text: publicText(text), createdAt }));
  return { likeCount: likes.length, likedByMe: !!viewer && likes.some(like => like.deviceHash === viewer), commentCount: Array.from(db.communityComments.values()).filter(comment => comment.postId === id).length, comments };
};

router.get('/community/posts', (req, res, next) => {
  try {
    const deviceId = req.header('X-Civic-Device');
    const viewer = deviceId ? deviceHash(z.string().uuid().parse(deviceId)) : undefined;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: posts.map(post => ({ ...post, demo: true, ...view(post.id, viewer) })) });
  } catch (error) { next(error); }
});

router.post('/community/posts/:id/like', civicLimit, (req, res, next) => {
  try {
    const { deviceId } = device.parse(req.body);
    if (!known(req.params.id)) return res.status(404).json({ success: false, error: 'আলোচনা পাওয়া যায়নি।' });
    const hash = deviceHash(deviceId);
    const id = createHash('sha256').update(req.params.id + ':' + hash).digest('hex');
    if (!db.communityLikes.has(id)) db.communityLikes.set(id, { id, postId: req.params.id, deviceHash: hash, createdAt: new Date().toISOString() });
    res.json({ success: true, data: view(req.params.id, hash) });
  } catch (error) { next(error); }
});

router.post('/community/posts/:id/comments', civicLimit, (req, res, next) => {
  try {
    const input = z.object({ deviceId: z.string().uuid(), text: z.string().trim().min(3).max(500) }).strict().parse(req.body);
    if (!known(req.params.id)) return res.status(404).json({ success: false, error: 'আলোচনা পাওয়া যায়নি।' });
    const hash = deviceHash(input.deviceId);
    if (Array.from(db.communityComments.values()).filter(comment => comment.postId === req.params.id && comment.deviceHash === hash).length >= 5)
      return res.status(429).json({ success: false, error: 'একটি আলোচনায় সর্বোচ্চ পাঁচটি মন্তব্য করা যায়।' });
    const id = randomUUID();
    db.communityComments.set(id, { id, postId: req.params.id, deviceHash: hash, text: publicText(input.text), createdAt: new Date().toISOString() });
    res.status(201).json({ success: true, data: view(req.params.id, hash) });
  } catch (error) { next(error); }
});

export default router;
