import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export const CITY_WEATHER_URL='https://api.open-meteo.com/v1/forecast?latitude=24.3745&longitude=88.6042&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,visibility,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&forecast_days=7&timezone=Asia%2FDhaka';
export const CITY_AIR_URL='https://air-quality-api.open-meteo.com/v1/air-quality?latitude=24.3745&longitude=88.6042&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide,sulphur_dioxide&hourly=us_aqi,pm2_5,pm10&forecast_days=3&timezone=Asia%2FDhaka';
const values=z.record(z.union([z.number().finite(),z.string(),z.null()]));
const series=z.record(z.array(z.union([z.number().finite(),z.string(),z.null()])));
export const environmentSchema=z.object({current:values.refine(c=>typeof c.time==='string','Missing observation time'),hourly:series.refine(h=>Array.isArray(h.time)&&h.time.length>0,'Missing forecast hours'),daily:series.optional()});
type Payload=z.infer<typeof environmentSchema>;
type Entry={data:Payload;fetchedAt:string};
type Kind='weather'|'air';
const cache:Partial<Record<Kind,Entry>>={};
const retryAt:Partial<Record<Kind,number>>={};
const pending:Partial<Record<Kind,Promise<void>>>={};
for(const kind of ['weather','air'] as const){
  try{const file=[resolve(__dirname,'../../data/rajshahi-'+kind+'-full.json'),resolve(__dirname,'../../../data/rajshahi-'+kind+'-full.json')].find(p=>existsSync(p));if(file){const saved=JSON.parse(readFileSync(file,'utf8'));cache[kind]={data:environmentSchema.parse(saved.data),fetchedAt:new Date(saved.fetchedAt).toISOString()};}}catch{/* No invented weather or air-quality readings. */}
}
async function refresh(kind:Kind){
  if(pending[kind])return pending[kind];
  pending[kind]=(async()=>{
    for(let attempt=0;attempt<2;attempt++)try{
      const response=await fetch(kind==='weather'?CITY_WEATHER_URL:CITY_AIR_URL,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=environmentSchema.parse(await response.json());
      const main=kind==='weather'?data.current.temperature_2m:data.current.us_aqi;
      if(typeof main!=='number')throw new Error('Missing current reading');
      cache[kind]={data,fetchedAt:new Date(Date.now()).toISOString()};retryAt[kind]=0;return;
    }catch(error){console.warn('[City environment] '+kind+' attempt '+(attempt+1)+':',error instanceof Error?error.message:String(error));}
    retryAt[kind]=Date.now()+5*60000;
  })().finally(()=>{delete pending[kind];});
  return pending[kind];
}
export async function cityEnvironment(){
  await Promise.all((['weather','air'] as const).map(async kind=>{
    const entry=cache[kind],age=entry?Date.now()-Date.parse(entry.fetchedAt):Infinity;
    if(age>15*60000&&(retryAt[kind]||0)<=Date.now())await refresh(kind);
  }));
  const output=(kind:Kind)=>{const entry=cache[kind];if(!entry)return {available:false,stale:false,fetchedAt:null,data:null};const age=Date.now()-Date.parse(entry.fetchedAt),observationAge=Date.now()-Date.parse(String(entry.data.current.time)+'+06:00');return {available:true,stale:age>15*60000||observationAge>2*3600000||(retryAt[kind]||0)>Date.now(),fetchedAt:entry.fetchedAt,data:entry.data};};
  return {city:'রাজশাহী',timezone:'Asia/Dhaka',weather:output('weather'),air:output('air'),providerUrls:{weather:CITY_WEATHER_URL,air:CITY_AIR_URL}};
}
