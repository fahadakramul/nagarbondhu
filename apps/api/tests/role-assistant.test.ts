import request from 'supertest';
import { randomUUID } from 'crypto';
import { app } from '../src/app';
import { db } from '../src/db';
import { forecastIsCurrent, summarizeRain } from '../src/services/rain.service';
import { answerWorkspaceAssistant, ROLE_REFUSAL } from '../src/services/role-assistant.service';
import { analytics } from '../src/services/analytics.service';

const message=(role:'authority'|'planner',text:string,source:'citizen_report'|'demo_seed'='demo_seed')=>({role,deviceId:randomUUID(),messages:[{role:'user',text}],context:{tab:'dashboard'},filters:{source}});
describe('Role and freshness contracts',()=>{
  test('expired forecast cannot authorize a current rain conclusion',()=>{
    const old=Date.parse('2026-10-01T00:00:00Z');
    const hourly={time:Array.from({length:48},(_,i)=>new Date(old+i*3600000+6*3600000).toISOString().slice(0,16)),precipitation:Array(48).fill(0),precipitation_probability:Array(48).fill(0)};
    const forecast=summarizeRain({hourly},old);
    expect(forecastIsCurrent(forecast,old+3*86400000)).toBe(false);
    expect(forecastIsCurrent({...forecast,stale:true},old)).toBe(false);
  });
  test('demo session can read its role, while anonymous and citizen tokens cannot impersonate authority',async()=>{
    const unauthorized=await request(app).post('/api/v1/ai/assistant').send(message('authority','কোন রিপোর্টগুলো আগে পর্যালোচনা করব?'));
    expect(unauthorized.status).toBe(401);
    const demo=await request(app).post('/api/v1/auth/demo').send({});expect(demo.status).toBe(200);
    const token=demo.body.token,before=JSON.stringify(db.snapshot());
    const authority=await request(app).post('/api/v1/ai/assistant').set('Authorization','Bearer '+token).send(message('authority','কোন রিপোর্টগুলো আগে পর্যালোচনা করব?'));
    expect(authority.status).toBe(200);expect(authority.body.data.summary_bn).toContain('নমুনা রিপোর্ট');
    const planner=await request(app).post('/api/v1/ai/assistant').set('Authorization','Bearer '+token).send(message('planner','কোথায় একই ধরনের সমস্যা বেশি দেখা যাচ্ছে?'));
    expect(planner.status).toBe(200);expect(planner.body.data.summary_bn).toContain('একই কারণ');
    expect(JSON.stringify(db.snapshot())).toBe(before);
  });
  test('off-topic replies are role-specific and selected source controls factual counts',()=>{
    expect(answerWorkspaceAssistant('authority','একটি রান্নার রেসিপি দাও').summary_bn).toBe(ROLE_REFUSAL.authority);
    expect(answerWorkspaceAssistant('planner','Write a song').summary_bn).toBe(ROLE_REFUSAL.planner);
    const demo=answerWorkspaceAssistant('authority','কোন রিপোর্টগুলো আগে পর্যালোচনা করব?',{source:'demo_seed'});
    const citizen=answerWorkspaceAssistant('authority','কোন রিপোর্টগুলো আগে পর্যালোচনা করব?',{source:'citizen_report'});
    expect(demo.summary_bn).toContain('নমুনা রিপোর্ট');expect(citizen.summary_bn).toContain('নাগরিক রিপোর্ট');
    const scores=analytics({source:'demo_seed'}).reviewFirst.map(r=>db.findPriorityAssessmentByReportId(r.id)?.score??-1);
    expect(scores).toEqual([...scores].sort((a,b)=>b-a));
  });
});
