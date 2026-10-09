import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config';
import { UserRole } from '@nagarbondhu/shared';
import { db } from '../db';

function currentUser(token: string): AuthenticatedUser {
  const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as { id: string };
  const user = db.users.get(decoded.id);
  if (!user) throw new Error('Unknown account');
  return { id: user.id, displayName: user.displayName, email: user.email || undefined, role: user.role };
}

export function protectDemoWrites(req: Request, res: Response, next: NextFunction) {
  if (CONFIG.NODE_ENV === 'production' && !['GET','HEAD','OPTIONS'].includes(req.method) && !req.path.endsWith('/copilot') && req.user?.id === 'user-admin-01') {
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

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Insufficient role permissions for this action',
      });
    }

    next();
  };
}
