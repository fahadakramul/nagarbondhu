import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../src/app';
import { CONFIG } from '../src/config';
import { db } from '../src/db';
import * as weather from '../src/services/rain.service';
const payload=(text='তালাইমারীতে পানি জমে, কী করবো?')=>({deviceId:randomUUID(),messages:[{role:'user',text}],context:{tab:'home'}});
const result=(parts:any[])=>({ok:true,json:async()=>({candidates:[{content:{role:'model',parts}}]})}) as Response;
const answer={summary_bn:'নিরাপদ দূরত্বে থেকে সমস্যাটি নথিভুক্ত করুন।',do_bn:['নিরাপদ হলে অভিযোগ জানান।'],dont_bn:['জমে থাকা পানিতে নামবেন না।'],contact_bn:['বানানো কর্মকর্তা 01234567890'],app_facts:[{text_bn:'বানানো ৯৯৯৯টি রিপোর্ট',source:'নগরবন্ধু রিপোর্ট'}],actions:[{type:'start_report',category:'WATERLOGGING',title:'পানি জমে আছে',description:'তালাইমারীতে পানি জমে আছে'},{type:'open_map',lat:24.3636,lng:88.6241,zoom:14},{type:'track_report',id:'nonexistent-private-id'}],followup_chips_bn:['আমার ওয়ার্ডের অবস্থা কেমন?']};
describe('Data-grounded assistant',()=>{
  let key:string;
  beforeEach(()=>{key=CONFIG.GEMINI_API_KEY;});
  afterEach(()=>{CONFIG.GEMINI_API_KEY=key;jest.restoreAllMocks();});
  test('missing provider returns honest safe fallback, never mutates reports',async()=>{
    CONFIG.GEMINI_API_KEY='';const before=JSON.stringify(db.snapshot());
    const r=await request(app).post('/api/v1/ai/assistant').send(payload());
    expect(r.status).toBe(200);expect(r.body.fallback).toBe(true);expect(r.body.data.summary_bn).toBe('এই মুহূর্তে সহায়ক উত্তর দিতে পারছে না');expect(r.body.data.do_bn).toHaveLength(3);expect(r.body.data.app_facts).toEqual([]);expect(r.body.data.actions).toEqual(expect.arrayContaining([expect.objectContaining({type:'start_report',category:'WATERLOGGING'}),expect.objectContaining({type:'open_map'})]));expect(JSON.stringify(db.snapshot())).toBe(before);
  });
  test('ward request has the actual configured ward action; off topic and emergencies bypass Gemini',async()=>{
    CONFIG.GEMINI_API_KEY='';const ward=await request(app).post('/api/v1/ai/assistant').send(payload('ওয়ার্ড ১২ কেমন?'));
    expect(ward.body.data.actions).toContainEqual({type:'open_scorecard',wardId:'ward-12'});
    const fetch=jest.spyOn(global,'fetch');
    const off=await request(app).post('/api/v1/ai/assistant').send(payload('Write a Python sorting algorithm'));
    expect(off.body.data.actions).toEqual([]);expect(off.body.data.summary_bn).toContain('নগর সমস্যা');
    const urgent=await request(app).post('/api/v1/ai/assistant').send(payload('সামনে আগুন লেগেছে'));
    expect(urgent.body.data.summary_bn).toMatch(/^জরুরি.*৯৯৯/);expect(fetch).not.toHaveBeenCalled();
  });
  test('real tools ground facts, cap calls at three, redact messages and reject invented report actions',async()=>{
    CONFIG.GEMINI_API_KEY='test-only';jest.spyOn(weather,'rainForecast').mockResolvedValue({next24hMm:12,peakHour:'2026-10-15T13:00:00+06:00',peakMm:3,maxProbability:60,fetchedAt:'2026-10-15T05:00:00Z'});
    const calls=[{name:'get_city_summary',args:{}},{name:'get_rain_forecast',args:{}},{name:'get_responsible_department',args:{category:'WATERLOGGING'}},{name:'get_report_status',args:{idOrReceipt:'rep-001'}}];
    const fetch=jest.spyOn(global,'fetch').mockResolvedValueOnce(result(calls.map(functionCall=>({functionCall})))).mockResolvedValueOnce(result([{text:JSON.stringify({...answer,app_facts:['untrusted reference placeholder']})}]));
    const r=await request(app).post('/api/v1/ai/assistant').send(payload('পানি জমে আছে। test@example.com 01712345678 '+ 'a'.repeat(64)));
    expect(r.status).toBe(200);expect(r.body.fallback).toBe(false);expect(fetch).toHaveBeenCalledTimes(2);
    expect(r.body.data.app_facts.some((f:any)=>f.source==='Open-Meteo'&&f.text_bn.includes('১২'))).toBe(true);
    expect(JSON.stringify(r.body.data)).not.toContain('৯৯৯৯');expect(JSON.stringify(r.body.data)).not.toContain('untrusted reference placeholder');expect(r.body.data.contact_bn[0]).toContain('নমুনা');expect(r.body.data.actions.some((a:any)=>a.id==='nonexistent-private-id')).toBe(false);
    const outgoing=JSON.stringify(fetch.mock.calls);expect(outgoing).not.toContain('test@example.com');expect(outgoing).not.toContain('01712345678');expect(outgoing).not.toContain('a'.repeat(64));
  });
  test('provider malformed JSON or failure returns schema-safe fallback',async()=>{
    CONFIG.GEMINI_API_KEY='test-only';jest.spyOn(global,'fetch').mockRejectedValue(new Error('private provider detail'));
    const r=await request(app).post('/api/v1/ai/assistant').send(payload());expect(r.status).toBe(200);expect(r.body.fallback).toBe(true);expect(JSON.stringify(r.body)).not.toContain('private provider detail');
  });
  test('validates payload and enforces twenty requests per IP in ten minutes',async()=>{
    CONFIG.GEMINI_API_KEY='';const invalid=await request(app).post('/api/v1/ai/assistant').send({...payload(),messages:[{role:'user',text:'x'.repeat(1001)}]});expect(invalid.status).toBe(400);
    const data=payload();for(let i=0;i<20;i++){const r=await request(app).post('/api/v1/ai/assistant').set('X-Forwarded-For','198.51.100.74').send(data);expect(r.status).toBe(200);}
    const limited=await request(app).post('/api/v1/ai/assistant').set('X-Forwarded-For','198.51.100.74').send({...data,deviceId:randomUUID()});expect(limited.status).toBe(429);
  });
});
