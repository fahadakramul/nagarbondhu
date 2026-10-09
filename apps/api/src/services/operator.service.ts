import { z } from 'zod';
import { db } from '../db';
import { flushDatabase } from '../persistence';

// Deployment-only provisioning, never a public role-change endpoint.
export async function provisionOperator() {
  if(!process.env.OPERATOR_EMAIL && !process.env.OPERATOR_PASSWORD_HASH)return;
  const input=z.object({email:z.string().email(),hash:z.string().regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/),name:z.string().min(2).max(200)}).parse({email:process.env.OPERATOR_EMAIL,hash:process.env.OPERATOR_PASSWORD_HASH,name:process.env.OPERATOR_NAME || 'NagarBondhu Operator'});
  const id='user-provisioned-operator';const existing=db.findUserByEmail(input.email);
  if(existing && existing.id!==id)throw new Error('Operator provisioning email is already used by another account');
  const now=new Date().toISOString();db.users.set(id,{id,email:input.email,phone:null,displayName:input.name,role:'ADMIN',passwordHash:input.hash,createdAt:db.users.get(id)?.createdAt || now,updatedAt:now});
  await flushDatabase();
}
