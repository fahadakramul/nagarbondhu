const path=require('path');
require('dotenv').config({path:path.resolve(__dirname,'../.env')});
async function check(){
  const key=process.env.GEMINI_API_KEY;
  if(!key){console.error('Set GEMINI_API_KEY in apps/api/.env using a free-tier key from https://aistudio.google.com/apikey.');process.exitCode=1;return;}
  const model=process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{text:'Reply with JSON only: {"connected":true}'}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:64,temperature:0}})});
  if(!response.ok){console.error(`Gemini connection failed (HTTP ${response.status}). Check the key, model access and free quota in Google AI Studio.`);process.exitCode=1;return;}
  const result=await response.json();const text=result.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('');
  if(JSON.parse(text).connected!==true)throw new Error('Unexpected provider response');
  console.log(`Gemini connected: ${model}. Billing is controlled by your Google project; use a project on the Free tier.`);
}
check().catch(()=>{console.error('Gemini connection could not be verified. Check network access and try again.');process.exitCode=1;});
