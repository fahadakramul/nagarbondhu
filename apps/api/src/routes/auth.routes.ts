import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { authenticate } from '../middleware/auth';

const router = Router();

const RegisterSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['CITIZEN', 'ADMIN', 'URBAN_PLANNER']).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/v1/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const data = RegisterSchema.parse(req.body);
    const result = await AuthService.register(data);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const data = LoginSchema.parse(req.body);
    const result = await AuthService.login(data);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

export default router;
