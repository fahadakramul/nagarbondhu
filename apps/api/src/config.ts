import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nagarbondhu?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'nagarbondhu_ai_super_secret_jwt_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Google Gemini AI Configuration
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

  // Image Upload / Storage
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local', // 'local' or 'supabase'
  UPLOAD_DIR: path.resolve(__dirname, '../uploads'),
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || 'http://localhost:5000',

  // Civic Analytics & Priority Configuration
  DEFAULT_MAX_DUPLICATE_DISTANCE_METERS: parseInt(
    process.env.MAX_DUPLICATE_DISTANCE_METERS || '300',
    10
  ),
};
