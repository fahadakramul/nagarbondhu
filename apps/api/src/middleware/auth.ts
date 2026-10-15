import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config';
import { UserRole } from '@nagarbondhu/shared';
import { db } from '../db';

function currentUser(token: string): AuthenticatedUser {
  const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as { id: string; role?: string };
  const user = db.users.get(decoded.id);
  if (!user) throw new Error('Unknown account');
  return { id: user.id, displayName: user.displayName, email: user.email || undefined, role: decoded.id==='user-demo-authority' && decoded.role==='demo_authority' ? 'demo_authority' : user.role };
}

export function protectDemoWrites(req: Request, res: Response, next: NextFunction) {
  // These exact routes additionally enforce the fixed fictional report allowlist in the service.
  // Ordinary report/action/directory writes remain forbidden to the shared demo identity.
  if(req.user?.role==='demo_authority'){
    const path=req.originalUrl.split('?')[0];
    const writes=(req.method==='DELETE'&&/^\/api\/v1\/admin\/reports\/[^/]+$/.test(path)) ||
      (['POST','PATCH','PUT'].includes(req.method)&&/^\/api\/v1\/admin\/reports\/[^/]+\/(restore|status|action-status|action-plan|action-recommendations|progress)$/.test(path)) ||
      (req.method==='POST'&&/^\/api\/v1\/competition\/(admin|demo)\/(missions|missions\/[^/]+\/update|clusters\/[^/]+\/review)$/.test(path)) ||
      (req.method==='POST'&&path==='/api/v1/admin/copilot');
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!writes)return res.status(403).json({success:false,error:'ডেমো কর্তৃপক্ষের এই অনুমতি নেই।'});
    const json=res.json.bind(res);
    const clean=(value:any):any=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!/(phone|mobile|contact|receipt|trackingToken|capability|password|email)/i.test(key)).map(([key,v])=>[key,clean(v)])):typeof value==='string'?require('../services/privacy').publicText(value):value;
    res.json=((body:any)=>json(clean(body))) as typeof res.json;
  }
  const scopedDemo = req.baseUrl === '/api/v1/competition' && req.method === 'POST' && /^\/demo\/(restore|missions|missions\/[^/]+\/update|clusters\/[^/]+\/review)$/.test(req.path);
  const readOnlyCopilot = req.baseUrl === '/api/v1/admin' && req.method === 'POST' && req.path === '/copilot';
  if (CONFIG.NODE_ENV === 'production' && !['GET','HEAD','OPTIONS'].includes(req.method) && !readOnlyCopilot && !scopedDemo && req.user?.id === 'user-admin-01') {
    return res.status(403).json({success:false,error:'Public demo admin is read-only. A provisioned operator account is required.'});
  }
  next();
}

export interface AuthenticatedUser {
  id: string;
  displayName: string;
  email?: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = currentUser(token);
    req.user = decoded;
    protectDemoWrites(req, res, next);
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = currentUser(token);
      req.user = decoded;
    } catch (err) {
      // Ignore token error for optional auth
    }
  }
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role) && !(req.user.role==='demo_authority' && allowedRoles.some(r=>r==='ADMIN'||r==='URBAN_PLANNER'))) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Insufficient role permissions for this action',
      });
    }

    next();
  };
}
