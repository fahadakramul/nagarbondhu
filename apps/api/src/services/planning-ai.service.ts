import { z } from 'zod';
import { CONFIG } from '../config';
import { analytics } from './analytics.service';

// The model receives only controlled aggregates and references, never SQL access or citizen text/identity.
export async function planningInterpretation(data:ReturnType<typeof analytics>,question:string) {
  const fallback={provider:'Controlled backend summary; live AI unavailable',isFallback:true,observations:[],limitations:data.limitations};
  if(!CONFIG.GEMINI_API_KEY || !data.total)return fallback;
  const facts={question,period:data.period,total:data.total,demoCount:data.demoCount,byCategory:data.byCategory,byStatus:data.byStatus,overdue:data.overdue,months:data.months,clusters:data.clusters,reportIds:data.rows.map(r=>r.id)};
  try {
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent`,{method:'POST',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json','x-goog-api-key':CONFIG.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:'Interpret these controlled report aggregates in Bengali. Sample data is not real evidence. No invented numbers, staff, diagnoses, causes, impact or completed work. Suggest field validation. Return JSON {observations:[{text:string,reportIds:string[]}],limitations:string[]}. References must come from supplied reportIds. No official instructions. Facts: '+JSON.stringify(facts)}]}],generationConfig:{responseMimeType:'application/json',temperature:0.1}})});
    if(!response.ok)throw new Error('Provider unavailable');
    const result:any=await response.json();
    const parsed=z.object({observations:z.array(z.object({text:z.string().max(1000),reportIds:z.array(z.string()).max(20)}).strict()).max(6),limitations:z.array(z.string().max(500)).max(10)}).strict().parse(JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || ''));
    const validIds=new Set(data.rows.map(r=>r.id));if(parsed.observations.some(o=>o.reportIds.some(id=>!validIds.has(id))))throw new Error('Invalid reference');
    return {provider:`Google Gemini / ${CONFIG.GEMINI_MODEL} — AI interpretation, not observed fact`,isFallback:false,...parsed};
  }catch{return fallback;}
}
