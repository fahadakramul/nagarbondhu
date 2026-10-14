import { NearbySensitive, calculateHaversineDistanceMeters } from '@nagarbondhu/shared';
import { z } from 'zod';
import { db } from '../db';
const cache=new Map<string,NearbySensitive>();
const labels:Record<string,string>={education:'শিক্ষাপ্রতিষ্ঠান',health:'স্বাস্থ্যসেবা',market:'বাজার',transport:'বাস স্টপ',worship:'উপাসনালয়'};
export const emptyNearby=(unavailable=false):NearbySensitive=>({fetchedAt:new Date().toISOString(),radius:200,groups:Object.fromEntries(Object.keys(labels).map(k=>[k,{count:0,items:[]}])),bonus:0,source:'OpenStreetMap (Overpass)',unavailable});
const resultSchema=z.object({elements:z.array(z.object({type:z.string(),id:z.number(),lat:z.number().optional(),lon:z.number().optional(),center:z.object({lat:z.number(),lon:z.number()}).optional(),tags:z.record(z.string()).default({})})).max(2000)});
export async function nearbySensitive(lat:number,lon:number,timeout=2800):Promise<NearbySensitive>{
  const key=lat.toFixed(4)+','+lon.toFixed(4),fresh=(r:NearbySensitive)=>Date.now()-Date.parse(r.fetchedAt)<(r.unavailable?60000:86400000);
  const stored=cache.get(key)||Array.from(db.reports.values()).find(r=>r.latitude.toFixed(4)+','+r.longitude.toFixed(4)===key && r.nearbySensitive && fresh(r.nearbySensitive))?.nearbySensitive;
  if(stored&&fresh(stored))return stored;
  try{
    const at=`around:200,${lat},${lon}`;
    const query=`[out:json][timeout:8];(nwr(${at})[amenity~"^(school|college|university|kindergarten|hospital|clinic|doctors|marketplace|bus_station|place_of_worship)$"];nwr(${at})[healthcare];nwr(${at})[shop~"^(mall|supermarket)$"];nwr(${at})[highway=bus_stop];);out center tags 60;`;
    const response=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'NagarBondhu/1.0 (BIP competition)'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(timeout)});
    if(!response.ok)throw new Error('Overpass unavailable');
    const raw=resultSchema.parse(await response.json()),data=emptyNearby(),seen=new Set<string>();
    for(const e of raw.elements){
      const latitude=e.lat??e.center?.lat,longitude=e.lon??e.center?.lon;if(latitude===undefined||longitude===undefined||seen.has(e.type+e.id))continue;seen.add(e.type+e.id);
      const distanceMeters=Math.round(calculateHaversineDistanceMeters(lat,lon,latitude,longitude));if(distanceMeters>200)continue;
      const t=e.tags,a=t.amenity||'';
      const group=/^(school|college|university|kindergarten)$/.test(a)?'education':/^(hospital|clinic|doctors)$/.test(a)||t.healthcare?'health':a==='marketplace'||/^(mall|supermarket)$/.test(t.shop||'')?'market':a==='bus_station'||t.highway==='bus_stop'?'transport':a==='place_of_worship'?'worship':null;
      if(group){data.groups[group].count++;data.groups[group].items.push({name:t['name:bn']||t.name||labels[group],distanceMeters,latitude,longitude});}
    }
    for(const group of Object.values(data.groups))group.items=group.items.sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,3);
    data.bonus=Math.min(15,Math.min(8,data.groups.education.count*4)+Math.min(10,data.groups.health.count*5)+Math.min(6,data.groups.market.count*3)+Math.min(4,data.groups.transport.count*2)+Math.min(2,data.groups.worship.count));
    cache.set(key,data);return data;
  }catch{const data=emptyNearby(true);cache.set(key,data);return data;}
}
export function nearbyNote(data?:NearbySensitive|null){return !data||data.unavailable?'তথ্য আনা যায়নি, পরে আবার চেষ্টা হবে':data.bonus?Object.entries(data.groups).filter(([,g])=>g.count).map(([k,g])=>`${g.count}টি ${labels[k]}`).join(', ')+' — ২০০ মিটারের মধ্যে':'OSM-এ ২০০ মিটারের মধ্যে কোনো চিহ্নিত স্থাপনা পাওয়া যায়নি';}
