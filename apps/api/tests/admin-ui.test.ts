import fs from 'fs';
import path from 'path';
import vm from 'vm';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app';
import { db, DatabaseRepository } from '../src/db';
import { CONFIG } from '../src/config';
import { confirmPlan, getPlan } from '../src/services/action.service';
import * as rainService from '../src/services/rain.service';
const { JSDOM } = require('jsdom');

describe('Administrator UI connected to the real API',()=>{
  let dom:any,window:any,context:any,oldMode:string,oldKey:string,snapshot:any,reportId:string;
  const run=(code:string)=>vm.runInContext(code,context);
  const el=(id:string)=>window.document.getElementById(id);
  const eventually=async(test:()=>boolean)=>{for(let i=0;i<100;i++){if(test())return;await new Promise(r=>setTimeout(r,10));}expect(test()).toBe(true);};
  beforeEach(async()=>{
    jest.spyOn(rainService,'rainQueue').mockResolvedValue({forecast:{next24hMm:0,peakHour:'2026-10-14T19:00:00+06:00',peakMm:0,maxProbability:0,fetchedAt:new Date().toISOString()},alert:false,threshold:20,reports:[],source:'citizen_report',attribution:'Weather data: Open-Meteo',boostExplanation:'শুধু এই তালিকার প্রভাব'});
    snapshot=db.snapshot();oldMode=CONFIG.NODE_ENV;oldKey=CONFIG.GEMINI_API_KEY;CONFIG.NODE_ENV='production';CONFIG.GEMINI_API_KEY='';
    db.restore(new DatabaseRepository().snapshot());
    const sample=db.users.get('user-admin-01')!;
    db.users.set('private-operator',{...sample,id:'private-operator',email:'operator@example.test',passwordHash:bcrypt.hashSync('PrivatePassword123!',4)});
    reportId=(await request(app).post('/api/v1/reports').send({title:'Blocked drain inspection',description:'The drain is blocked near the crossing and needs inspection.',userCategory:'DRAINAGE',latitude:24.3636,longitude:88.6241,locationConfirmed:true})).body.report.id;
    const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
    dom=new JSDOM(html,{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});window=dom.window;
    await new Promise<void>(resolve=>window.document.addEventListener('DOMContentLoaded',()=>resolve(),{once:true}));
    window.AbortSignal=AbortSignal;window.scrollTo=jest.fn();window.alert=jest.fn();window.confirm=jest.fn(()=>{throw new Error('Native confirmations are unavailable in this WebView');});window.prompt=jest.fn(()=>{throw new Error('Native prompts are unavailable in this WebView');});
    window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
    window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
    window.fetch=async(url:string,options:any={})=>{
      const method=(options.method||'GET').toLowerCase();let call=(request(app) as any)[method](url);
      for(const [key,value]of Object.entries(options.headers||{}))call=call.set(key,value);
      if(options.body)call=call.send(JSON.parse(options.body));
      const response=await call;return {ok:response.status<400,status:response.status,json:async()=>response.body};
    };
    context=dom.getInternalVMContext();for(const name of ['app','actions','platform','competition','features','polish','theme','assistant','experience'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/'+name+'.js'),'utf8'),context);
    window.initMainMap=jest.fn(); // Leaflet's CDN renderer is verified in the browser, not JSDOM.
  });
  afterEach(async()=>{await new Promise(r=>setTimeout(r,40));dom?.window.close();CONFIG.NODE_ENV=oldMode;CONFIG.GEMINI_API_KEY=oldKey;db.restore(snapshot);});
  async function login(){
    await run('toggleUserRole()');el('operator-email').value='operator@example.test';el('operator-password').value='PrivatePassword123!';
    await window.activateOperatorSession({preventDefault(){},target:el('operator-email').closest('form')});
    await eventually(()=>!el('operator-login-modal').classList.contains('hidden')?false:run('!!authToken'));
  }
  test('new navigation keeps the existing IDs and exposes authority login through More',async()=>{
    expect(el('primary-navigation').closest('#civic-sidebar')).not.toBeNull();
    const more=el('civic-bottom-nav').querySelector('[data-nav-tab="more"]');more.click();expect(el('more-sheet').hasAttribute('open')).toBe(true);
    const loginButton=Array.from(el('more-sheet').querySelectorAll('button')).find((b:any)=>b.textContent==='কর্তৃপক্ষ লগইন') as any;
    loginButton.click();expect(el('operator-login-modal').classList.contains('hidden')).toBe(false);expect(el('more-sheet').hasAttribute('open')).toBe(false);
    window.closeOperatorLogin();
    el('civic-bottom-nav').querySelector('[data-nav-tab="report"]').click();expect(run('currentTab')).toBe('report');
    expect(el('civic-bottom-nav').querySelector('[aria-current]').dataset.navTab).toBe('report');
  });
  test('assistant uses honest fallback and its action prefills without submitting',async()=>{
    window.openCivicAssistant();const first=el('assistant-starters').querySelector('button');first.click();
    await eventually(()=>!!el('assistant-turns').querySelector('.assistant-answer'));
    expect(el('assistant-turns').textContent).toContain('এই মুহূর্তে সহায়ক উত্তর দিতে পারছে না');
    const count=db.reports.size;el('assistant-turns').querySelector('.assistant-actions button').click();
    expect(el('form-description').value).toContain('পানি');expect(run('currentTab')).toBe('report');expect(db.reports.size).toBe(count);
  });
  test('filter sheet supports multiple categories while retaining the original select handlers',async()=>{
    const row=el('section-map').querySelector('.filter-chips');row.querySelector('button').click();
    const choices=el('map-filter-sheet').querySelectorAll('.filter-options:first-of-type button');choices[0].click();choices[1].click();
    expect(el('map-category-filter').value).toBe('ALL');expect(el('map-filter-sheet').querySelectorAll('.filter-options:first-of-type [aria-pressed="true"]').length).toBe(2);
    expect(row.querySelector('button').textContent).toContain('২');
    el('map-category-filter').value='DRAINAGE';window.renderMapMarkers();
    expect(row.querySelector('button').textContent).toContain('১');
    expect(el('map-source')).not.toBeNull();expect(el('twin-at')).not.toBeNull();
  });
  test('mobile menu exposes every section, closes on navigation and supports Escape',async()=>{
    expect(el('primary-navigation').dataset.enhanced).toBe('true');
    for(const tab of ['home','report','map','feed','dashboard','scorecard']){
      el('navigation-toggle').click();expect(el('navigation-toggle').getAttribute('aria-expanded')).toBe('true');
      run(`switchTab('${tab}')`);
      expect(el('section-'+tab).classList.contains('hidden')).toBe(false);
      expect(el('tab-'+tab).getAttribute('aria-current')).toBe('page');
      expect(window.document.querySelectorAll('.nav-tab[aria-current]').length).toBe(1);
      expect(el('navigation-toggle').getAttribute('aria-expanded')).toBe('false');
    }
    el('navigation-toggle').click();el('tab-home').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    expect(el('navigation-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(window.document.activeElement).toBe(el('navigation-toggle'));
    expect(window.scrollTo).toHaveBeenCalledWith(0,0);
    await new Promise(r=>setTimeout(r,200));
  });
  test('homepage shortcuts load each existing planning module from the API',async()=>{
    for(const module of ['scenarios','clusters','coverage','missions']){
      window.openPlanningModule(module);
      await eventually(()=>!!el('mvp-content'));
      expect(run('currentTab')).toBe('dashboard');expect(run('mvpTab')).toBe(module);
      const headings:any={scenarios:'What-If Urban Planner',clusters:'Root-Cause Cluster Intelligence',coverage:'Urban Voice',missions:'Smart Field Mission Planner'};
      await eventually(()=>el('mvp-content')?.textContent.includes(headings[module]));
    }
  });
  test('denied microphone permission gives app-specific recovery and preserves the complaint',async()=>{
    window.ReactNativeWebView={};window.MediaRecorder=function(){};
    Object.defineProperty(window.navigator,'mediaDevices',{value:{getUserMedia:jest.fn().mockRejectedValue(new window.DOMException('Denied','NotAllowedError'))},configurable:true});
    el('form-description').value='Keep my existing complaint while microphone access is denied.';
    await window.startVoiceComplaint();
    expect(el('voice-message').textContent).toContain('Settings → Apps');
    expect(el('voice-message').textContent).toContain('নতুন APK');
    expect(el('form-description').value).toContain('Keep my existing complaint');
    expect(el('voice-start').disabled).toBe(false);
    expect(el('voice-stop').classList.contains('hidden')).toBe(true);
    delete window.ReactNativeWebView;await window.startVoiceComplaint();
    expect(el('voice-message').textContent).toContain('site permissions');
  });
  test('recording animation waits for a recording and stops when it ends',async()=>{
    el('voice-start').disabled=true;window.syncVoiceAppearance();expect(el('voice-input-card').classList.contains('is-recording')).toBe(false);
    run("voiceRecorder={state:'recording'}");el('voice-stop').classList.remove('hidden');
    await eventually(()=>el('voice-input-card').classList.contains('is-recording'));
    run("voiceRecorder=null");el('voice-stop').classList.add('hidden');
    await eventually(()=>!el('voice-input-card').classList.contains('is-recording'));
  });
  test('timeline shortcut opens the mobile filter disclosure and shows its actual source',async()=>{
    expect(el('map-filter-sheet').hasAttribute('open')).toBe(false);
    run("mvpSource='demo_seed'");window.openTimelineMap();
    expect(el('map-filters').open).toBe(true);
    await eventually(()=>el('map-filter-source').textContent.includes('নমুনা'));
    expect(el('map-source').value).toBe('demo_seed');
  });
  test('theme displays real status and scores without implying progress for held reports',async()=>{
    await eventually(()=>el('engine-status').classList.contains('is-live'));
    await window.openDetailModal(reportId);
    expect(el('report-stepper').querySelector('[aria-current="step"]').textContent).toBe('রিপোর্ট গ্রহণ');
    await window.openDetailModal('rep-004');
    expect(el('modal-prio-score').dataset.risk).toBe('CRITICAL');
    expect(el('modal-priority-level').textContent).toBe('CRITICAL');
    window.decorateReportPresentation({actionStatus:'RESOLVED',priorityAssessment:{score:90,priorityLevel:'CRITICAL'}});
    expect(el('report-stepper').querySelector('[aria-current="step"]').textContent).toBe('সমাধান রিপোর্ট');
    expect(el('modal-prio-score').dataset.risk).toBe('CRITICAL');expect(el('modal-prio-score').style.getPropertyValue('--score-angle')).toBe('324deg');
    window.decorateReportPresentation({actionStatus:'ON_HOLD'});
    expect(el('report-stepper')).toBeNull();expect(el('modal-prio-score').classList.contains('risk-score')).toBe(false);
  });
  test('public scorecard and ward navigation work with the full feature script, voice failure remains usable',async()=>{
    await window.loadScorecard();expect(el('scorecard-message').textContent).toContain('নাগরিক রিপোর্ট');expect(el('scorecard-cards').querySelectorAll('article').length).toBe(db.wards.size);
    el('scorecard-source').value='demo_seed';await window.loadScorecard();expect(el('scorecard-message').textContent).toContain('নমুনা');
    await window.openScorecardWard('ward-12','feed');expect(el('feed-ward').value).toBe('ward-12');expect(run('allReports.every(r=>r.wardId==="ward-12")')).toBe(true);
    await window.startVoiceComplaint();expect(el('voice-message').textContent).toContain('লিখে অভিযোগ');expect(el('voice-start').disabled).toBe(false);
  });
  test('citizens see the resolution photo and save or update stars without a submission receipt',async()=>{
    const id='rep-001';
    confirmPlan(id,{actionDescription:'Inspect and repair the damaged road.',wardId:db.reports.get(id)!.wardId!,wardVerified:true,wardVerificationNote:'Ward location confirmed during inspection.',departmentId:'roads',assignmentNote:'Repair team assigned',targetDate:'2026-12-01',priority:'HIGH',urgency:'URGENT',revision:0},'private-operator');
    const plan=getPlan(id)!;db.actionPlans.set(plan.id,{...plan,status:'RESOLVED',afterPhotoUrl:'/uploads/resolved.png'});
    window.localStorage.setItem('nagarbondhu-rating-token','c'.repeat(64));
    await window.openDetailModal(id);
    expect(el('resolution-rating').querySelector('img').getAttribute('src')).toBe('/uploads/resolved.png');
    const form=el('resolution-rating-form');form.elements['resolution-score'].value='4';
    await window.submitResolutionRating({preventDefault(){},target:form},id,'/uploads/resolved.png');
    expect(el('rating-summary').textContent).toContain('4/৫');expect(el('rating-message').textContent).toContain('সংরক্ষিত');
    await window.openDetailModal(id);
    expect(el('resolution-rating-form').elements['resolution-score'].value).toBe('4');
    el('resolution-rating-form').elements['resolution-score'].value='2';
    await window.submitResolutionRating({preventDefault(){},target:el('resolution-rating-form')},id,'/uploads/resolved.png');
    expect(el('rating-summary').textContent).toContain('2/৫');expect(db.resolutionRatings.size).toBe(1);
    db.actionPlans.set(plan.id,{...getPlan(id)!,status:'UNDER_REVIEW'});
    await window.openDetailModal(id);expect(el('resolution-rating')).toBeNull();
  });
  test('defaults to citizen data and opens a reachable private login instead of public auto-login',async()=>{
    expect(el('stats-source').value).toBe('citizen_report');expect(run('mvpSource')).toBe('citizen_report');
    await run('toggleUserRole()');expect(run('authToken')).toBeNull();
    expect(el('operator-login-modal').parentElement).toBe(window.document.body);
    expect(el('operator-login-modal').classList.contains('hidden')).toBe(false);
    expect(fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8')).not.toContain('DemoAdmin123!');
  });
  test('login refreshes an already open complaint and draft generation works without native confirm',async()=>{
    await run('toggleUserRole()');await window.openDetailModal(reportId);
    el('operator-email').value='operator@example.test';el('operator-password').value='PrivatePassword123!';
    await window.activateOperatorSession({preventDefault(){},target:el('operator-email').closest('form')});
    await eventually(()=>!!el('generate-action-draft')&&!el('generate-action-draft').disabled);
    await window.generateActionDraft();expect(window.confirm).not.toHaveBeenCalled();
    expect(Array.from(db.recommendations.values()).some(r=>r.reportId===reportId)).toBe(true);
    expect(el('report-action-workspace').textContent).toContain('প্রস্তাবিত করণীয়');
    expect(el('generate-action-draft').disabled).toBe(false);
  });
  test('private session restores on role re-entry, logout clears it and hides planning controls',async()=>{
    await login();const token=window.sessionStorage.getItem('nagarbondhu-operator-token');expect(token).toBeTruthy();
    await run('toggleUserRole()');expect(run('authToken')).toBeNull();await run('toggleUserRole()');expect(run('authToken')).toBe(token);
    await window.logoutOperator();expect(window.sessionStorage.getItem('nagarbondhu-operator-token')).toBeNull();expect(run('authToken')).toBeNull();
    expect(el('planning-tools').classList.contains('hidden')).toBe(true);
  });
  test('expired session gives a login route and clears directory cache',async()=>{
    await login();run("authToken='expired'; actionDirectory={readOnly:false}");
    await expect(window.actionApi('/action-directory')).rejects.toThrow();expect(run('authToken')).toBeNull();expect(run('actionDirectory')).toBeNull();
    expect(el('operator-login-modal').classList.contains('hidden')).toBe(false);
  });
  test('assignment, status and progress buttons persist the workflow through the API',async()=>{
    await login();await window.openDetailModal(reportId);await eventually(()=>!!el('save-action-plan'));
    window.mvpConfirm=async()=>true;
    const values:any={'plan-description':'Inspect the drain and clear the documented obstruction.','plan-ward':'ward-12','plan-department':'drainage','plan-date':new Date(Date.now()+3*86400000).toISOString().slice(0,10),'plan-ward-note':'Location checked on the submitted map pin.','plan-assignment-note':'Assigned for field inspection'};
    for(const [id,value]of Object.entries(values))el(id).value=value;el('plan-ward-verified').checked=true;
    await window.saveActionPlan({preventDefault(){}});expect(run('activeActionData.status')).toBe('ASSIGNED');
    el('action-next-status').value='IN_PROGRESS';el('action-status-note').value='Inspection team has started the visit.';await window.changeActionStatus({preventDefault(){}});
    expect(run('activeActionData.status')).toBe('IN_PROGRESS');el('action-progress-note').value='Inspection recorded the obstruction and its extent.';await window.saveActionProgress({preventDefault(){}});
    expect(Array.from(db.progressUpdates.values()).some(p=>p.note.includes('obstruction'))).toBe(true);
  });
  test('information request uses a WebView-compatible form and appears in citizen tracking',async()=>{
    await login();await window.openDetailModal(reportId);window.mvpConfirm=async()=>true;
    const pending=window.requestMoreInformation();const dialog=window.document.querySelector('dialog[open]');expect(dialog).toBeTruthy();
    dialog.querySelector('textarea').value='Please add a recent photograph and the obstruction location.';
    dialog.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await pending;
    expect(window.prompt).not.toHaveBeenCalled();expect(el('public-tracking').textContent).toContain('Please add a recent photograph');
  });
  test('map timeline keeps the selected data source in its API request',async()=>{
    el('map-source').value='citizen_report';const spy=jest.spyOn(window,'fetch');await window.loadMapRecords();
    expect(spy.mock.calls.some(([url])=>String(url).includes('/twin?source=citizen_report'))).toBe(true);
    expect(el('twin-report-select').textContent).toContain('Blocked drain inspection');
    expect(el('twin-report-select').textContent).not.toContain('mvp-demo');
  });
});
