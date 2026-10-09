import { app } from './app';
import { CONFIG } from './config';
import fs from 'fs';

// Ensure uploads folder exists
if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
  fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
}

const server = app.listen(CONFIG.PORT, () => {
  console.log(`====================================================`);
  console.log(`  NagarBondhu AI Backend Server Running!`);
  console.log(`  City: Rajshahi, Bangladesh (BIP Apps4Solutions)`);
  console.log(`  Port: ${CONFIG.PORT}`);
  console.log(`  Health: http://localhost:${CONFIG.PORT}/api/v1/health`);
  console.log(`  AI Engine: ${CONFIG.GEMINI_API_KEY ? 'Live Google Gemini (' + CONFIG.GEMINI_MODEL + ')' : 'Smart Heuristic Rule Fallback'}`);
  console.log(`====================================================`);
});

export default server;
