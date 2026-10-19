import { Router, RequestHandler } from 'express';
import { deviceHash } from '../middleware/civicLimit';
import { AssistantInput, answerAssistant } from '../services/assistant.service';
import { authenticate } from '../middleware/auth';
import { answerWorkspaceAssistant } from '../services/role-assistant.service';
const router=Router();
const buckets=new Map<string,{count:number;until:number}>();
const limit:RequestHandler=(req,res,next)=>{
  const now=Date.now();for(const [key,b] of buckets)if(b.until<=now)buckets.delete(key);
  const keys=[deviceHash('assistant-ip:'+req.ip),deviceHash('assistant-device:'+req.body.deviceId)];
  if(keys.some(k=>(buckets.get(k)?.count||0)>=20))return res.status(429).json({success:false,error:'১০ মিনিটে সর্বোচ্চ ২০টি প্রশ্ন। একটু পরে আবার চেষ্টা করুন।'});
  for(const key of keys){const b=buckets.get(key)||{count:0,until:now+600000};b.count++;buckets.set(key,b);}next();
};
router.post('/assistant',(req,res,next)=>{try{req.body=AssistantInput.parse(req.body);next();}catch(e){next(e);}},(req,res,next)=>{
  if(req.body.role==='citizen')return next();
  authenticate(req,res,()=>{
    if(!['ADMIN','URBAN_PLANNER','demo_authority'].includes(req.user?.role||''))return res.status(403).json({success:false,error:'এই সহায়কের জন্য কর্তৃপক্ষের সেশন প্রয়োজন।'});
    next();
  });
},limit,async(req,res,next)=>{try{
  if(req.body.role==='citizen')return res.json({success:true,...await answerAssistant(req.body)});
  const question=req.body.messages.at(-1).text;
  return res.json({success:true,data:answerWorkspaceAssistant(req.body.role,question,req.body.filters),fallback:false});
}catch(e){next(e);}});
export default router;
