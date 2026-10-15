import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { db } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

const demoBuckets=new Map<string,{count:number;until:number}>();
router.post('/demo',(req,res)=>{
 const now=Date.now();for(const [ip,b]of demoBuckets)if(b.until<=now)demoBuckets.delete(ip);
 const ip=req.ip||'unknown',bucket=demoBuckets.get(ip)||{count:0,until:now+3600000};
 if(bucket.count>=10)return res.status(429).json({success:false,error:'এক ঘণ্টায় সর্বোচ্চ ১০ বার ডেমো প্রবেশ।'});
 bucket.count++;demoBuckets.set(ip,bucket);
 const id='user-demo-authority';if(!db.users.has(id))db.users.set(id,{id,displayName:'ডেমো কর্তৃপক্ষ',role:'ADMIN',passwordHash:require('bcryptjs').hashSync(require('crypto').randomUUID(),4),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 const user={id,displayName:'ডেমো কর্তৃপক্ষ',role:'demo_authority'};
 const token=require('jsonwebtoken').sign(user,require('../config').CONFIG.JWT_SECRET,{expiresIn:'2h'});
 res.json({success:true,user,token,expiresIn:7200});
});
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
