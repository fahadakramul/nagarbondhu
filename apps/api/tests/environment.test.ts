import { readFileSync } from 'fs';
import path from 'path';
const savedWeather=JSON.parse(readFileSync(path.join(__dirname,'../data/rajshahi-weather-full.json'),'utf8'));
const savedAir=JSON.parse(readFileSync(path.join(__dirname,'../data/rajshahi-air-full.json'),'utf8'));
describe('Rajshahi weather and air quality',()=>{
 beforeEach(()=>jest.resetModules());afterEach(()=>jest.restoreAllMocks());
 test('refreshes independent genuine providers and retains forecast arrays and nullable readings',async()=>{
  jest.spyOn(Date,'now').mockReturnValue(Date.parse(savedWeather.fetchedAt)+3600000);
  const fetcher=jest.spyOn(global,'fetch').mockImplementation(async(url:any)=>({ok:true,json:async()=>String(url).includes('air-quality')?savedAir.data:savedWeather.data} as Response));
  const {cityEnvironment}=await import('../src/services/environment.service');const result=await cityEnvironment();
  expect(fetcher).toHaveBeenCalledTimes(2);expect(result.weather.available).toBe(true);expect(result.air.available).toBe(true);
  expect(result.air.data?.current.us_aqi).toBe(savedAir.data.current.us_aqi);expect(result.weather.data?.daily?.time.length).toBe(7);
  await cityEnvironment();expect(fetcher).toHaveBeenCalledTimes(2);
 });
 test('bad provider output never replaces dated last-good readings and failures are cooled down',async()=>{
  jest.spyOn(Date,'now').mockReturnValue(Date.parse(savedWeather.fetchedAt)+3600000);
  const fetcher=jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>({current:{time:'bad'},hourly:{time:[]}})} as Response);
  const {cityEnvironment}=await import('../src/services/environment.service');const result=await cityEnvironment();
  expect(fetcher).toHaveBeenCalledTimes(4);expect(result.weather).toMatchObject({available:true,stale:true,fetchedAt:savedWeather.fetchedAt});expect(result.air.data?.current.us_aqi).toBe(savedAir.data.current.us_aqi);
  await cityEnvironment();expect(fetcher).toHaveBeenCalledTimes(4);
 });
});
