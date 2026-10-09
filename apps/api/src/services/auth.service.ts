import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { CONFIG } from '../config';
import { User, UserRole } from '@nagarbondhu/shared';

export class AuthService {
  static generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
      },
      CONFIG.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  static async register(data: {
    displayName: string;
    email?: string;
    phone?: string;
    password: string;
    role?: UserRole;
  }): Promise<{ user: User; token: string }> {
    if (data.email) {
      const existing = db.findUserByEmail(data.email);
      if (existing) {
        throw new Error('Email already registered');
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);
    const userId = `user-${Date.now()}`;

    const newUser: User = {
      id: userId,
      displayName: data.displayName,
      email: data.email || null,
      phone: data.phone || null,
      role: 'CITIZEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.createUser({ ...newUser, passwordHash });
    const token = this.generateToken(newUser);

    return { user: newUser, token };
  }

  static async login(data: {
    email: string;
    password: string;
  }): Promise<{ user: User; token: string }> {
    const userRecord = db.findUserByEmail(data.email);
    if (!userRecord) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(data.password, userRecord.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const { passwordHash, ...safeUser } = userRecord;
    const token = this.generateToken(safeUser);

    return { user: safeUser, token };
  }
}
