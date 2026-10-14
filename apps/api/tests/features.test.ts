import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/db';
import { nearbySensitive } from '../src/services/nearby.service';
import { PriorityService } from '../src/services/priority.service';
describe('Differentiating civic features',()=>{
  let snapshot:ReturnType<typeof db.snapshot>;
  beforeEach(()=>{snapshot=db.snapshot();});afterEach(()=>{db.restore(snapshot);jest.restoreAllMocks();});
  test('nearby grouping, cap, cache and honest failure preserve explainable priority',async()=>{
    const mock=jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>({elements:[{type:'node',id:1,lat:24.3655,lon:88.5985,tags:{amenity:'school','name:bn':'স্কুল'}},{type:'way',id:2,center:{lat:24.3656,lon:88.5985},tags:{amenity:'hospital'}},{type:'node',id:3,lat:24.3655,lon:88.5985,tags:{amenity:'marketplace'}}]})} as Response);
    const data=await nearbySensitive(24.3655,88.5985);expect(data.bonus).toBe(12);expect(data.groups.health.count).toBe(1);
    await nearbySensitive(24.3655,88.5985);expect(mock).toHaveBeenCalledTimes(1);
    const base=PriorityService.assessReportPriority('rep-001')!;db.updateReport('rep-001',{nearbySensitive:data});const enriched=PriorityService.assessReportPriority('rep-001')!;
    expect(enriched.score).toBe(Math.min(100,base.score+12));expect(enriched.explanation.factors.at(-1)?.note).toContain('২০০');
    mock.mockRejectedValue(new Error('Offline'));expect((await nearbySensitive(24.4,88.7)).unavailable).toBe(true);
    expect((await request(app).get('/api/v1/reports/rep-001/nearby')).body.data.bonus).toBe(12);
    expect((await request(app).post('/api/v1/admin/backfill-nearby').send({})).status).toBe(401);
  });
});
