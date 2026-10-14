import { z } from 'zod';
import { db } from '../db';
import { fail, workflowStatus, getPlan } from './action.service';
import { publicText } from './privacy';
export interface RainForecast {next24hMm:number;peakHour:string;peakMm:number;maxProbability:number|null;probabilityAvailableHours?:number;fetchedAt:string}
let cache:RainForecast|null=null,failedUntil=0;
const schema=z.object({hourly:z.object({time:z.array(z.string()).min(24),precipitation:z.array(z.number().min(0).nullable()).min(24),precipitation_probability:z.array(z.number().min(0).max(100).nullable()).min(24)})});
export function summarizeRain(raw:unknown,now=Date.now()):RainForecast{
  const {hourly}=schema.parse(raw);
  if(hourly.time.length!==hourly.precipitation.length||hourly.time.length!==hourly.precipitation_probability.length)throw new Error('Incomplete forecast');
  const next=hourly.time.map((time,i)=>({time,at:Date.parse(time+'+06:00'),mm:hourly.precipitation[i],probability:hourly.precipitation_probability[i]})).filter(h=>h.at>now&&h.at<=now+24*3600000);
  if(next.length<24||next.some(h=>h.mm===null))throw new Error('Incomplete next 24 hours');
  const peak=next.reduce((a,b)=>a.mm!>=b.mm!?a:b),probabilities=next.map(h=>h.probability).filter((p):p is number=>p!==null);
  return {next24hMm:Math.round(next.reduce((s,h)=>s+h.mm!,0)*10)/10,peakHour:peak.time+'+06:00',peakMm:peak.mm!,maxProbability:probabilities.length?Math.max(...probabilities):null,probabilityAvailableHours:probabilities.length,fetchedAt:new Date(now).toISOString()};
}
export async function rainForecast(){
  if(cache&&Date.now()-Date.parse(cache.fetchedAt)<30*60000)return cache;
  if(failedUntil>Date.now())return fail('আবহাওয়ার তথ্য এখন পাওয়া যাচ্ছে না। কিছুক্ষণ পরে চেষ্টা করুন।',503);
  try{const response=await fetch('https://api.open-meteo.com/v1/forecast?latitude=24.3745&longitude=88.6042&hourly=precipitation,precipitation_probability&forecast_days=2&timezone=Asia%2FDhaka',{headers:{'User-Agent':'NagarBondhu/1.0 (BIP competition)',Accept:'application/json'},signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('Open-Meteo HTTP '+response.status);cache=summarizeRain(await response.json());return cache;}catch(error){console.warn('[Weather] Provider unavailable:',error instanceof z.ZodError?'Invalid forecast fields: '+error.issues.slice(0,4).map(i=>i.path.join('.')).join(','):error instanceof Error?error.message:'Unknown error');failedUntil=Date.now()+60000;return fail('আবহাওয়ার তথ্য আনা যায়নি; সাধারণ কাজের তালিকা ব্যবহার করুন।',503);}
}
export async function rainQueue(source='citizen_report'){
  const forecast=await rainForecast(),configured=Number(process.env.RAIN_ALERT_MM||20),threshold=Number.isFinite(configured)&&configured>0?configured:20,alert=forecast.next24hMm>=threshold;
  const reports=Array.from(db.reports.values()).filter(r=>(source==='all'||r.sourceType===source)&&['DRAINAGE','WATERLOGGING','WASTE'].includes(r.category)&&!['RESOLVED','CLOSED','REJECTED'].includes(workflowStatus(r))).map(r=>{const score=db.findPriorityAssessmentByReportId(r.id)?.score||0,rainBoost=alert?(r.category==='WATERLOGGING'?20:r.category==='DRAINAGE'?15:10):0;return {id:r.id,title:publicText(r.title),category:r.category,sourceType:r.sourceType,status:workflowStatus(r),wardId:getPlan(r.id)?.wardId||r.wardId,latitude:r.latitude,longitude:r.longitude,score,rainBoost,queueScore:score+rainBoost};}).sort((a,b)=>b.queueScore-a.queueScore||a.id.localeCompare(b.id));
  return {forecast,alert,threshold,reports,source,attribution:'Weather data: Open-Meteo',boostExplanation:'শুধু এই তালিকায়: জলাবদ্ধতা +২০, ড্রেনেজ +১৫, বর্জ্য +১০; মূল অগ্রাধিকার স্কোর বদলায় না।'};
}
