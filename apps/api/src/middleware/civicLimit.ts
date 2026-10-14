import { RequestHandler } from 'express';
import { createHmac } from 'crypto';
import { CONFIG } from '../config';
export const deviceHash=(device:string)=>createHmac('sha256',CONFIG.JWT_SECRET).update('civic-device:'+device).digest('hex');
const buckets=new Map<string,{count:number;until:number}>();
export const civicLimit:RequestHandler=(req,res,next)=>{
  const now=Date.now();
  for(const [key,b] of buckets)if(b.until<now)buckets.delete(key);
  // Render sits behind one trusted proxy; never trust a client-supplied raw IP in storage.
  const device=req.body?.deviceId||req.body?.voterToken||req.body?.receiptToken;
  const ids=[deviceHash('ip:'+req.ip),...(device?[deviceHash(String(device))]:[])];
  const keys=ids.map(id=>req.path.replace(/\/reports\/[^/]+/,'/reports/:id')+':'+id);
  if(keys.some(key=>(buckets.get(key)?.count||0)>=20))return res.status(429).json({success:false,error:'এক ঘণ্টায় সর্বোচ্চ ২০টি অনুরোধ। পরে আবার চেষ্টা করুন।'});
  keys.forEach(key=>{const b=buckets.get(key)||{count:0,until:now+3600000};b.count++;buckets.set(key,b);});next();
};
