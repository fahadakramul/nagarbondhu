// Local deployment provisioning; never expose account creation through the public API.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const email = process.argv[2];
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Provide a valid operator email.');
const envPath = path.resolve(__dirname, '../.env');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
if (/^OPERATOR_PASSWORD_HASH=.+/m.test(env)) throw new Error('An operator is already configured. Update its settings explicitly.');
const password = crypto.randomBytes(18).toString('base64url');
for (const [key, value] of Object.entries({OPERATOR_EMAIL:email,OPERATOR_NAME:'নগরবন্ধু প্রশাসক',OPERATOR_PASSWORD_HASH:bcrypt.hashSync(password,12)})) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  env = pattern.test(env) ? env.replace(pattern, () => line) : env.trimEnd()+'\n'+line+'\n';
}
fs.writeFileSync(envPath, env);
fs.writeFileSync(path.resolve(__dirname, '../credentials.json'), JSON.stringify({email,password},null,2)+'\n');
console.log('Operator configured. Login details saved locally in apps/api/credentials.json (Git ignored). Restart the API.');
