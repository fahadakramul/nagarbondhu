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
    const originalIds=Array.from(window.document.querySelectorAll('[id]')).map((e:any)=>e.id);
    context=dom.getInternalVMContext();for(const name of ['app','actions','platform','competition','features','polish','theme','assistant','experience','wizard','finish','moderation','authority']){vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/'+name+'.js'),'utf8'),context);if(name==='platform')window.originalSubmitHandler=window.handleFormSubmit;}
    window.originalElementIds=originalIds;
    window.initMainMap=jest.fn(); // Leaflet's CDN renderer is verified in the browser, not JSDOM.
    window.initPickerMap=jest.fn();
  });
  afterEach(async()=>{if(context)await run('loadData()');await new Promise(r=>setTimeout(r,250));dom?.window.close();CONFIG.NODE_ENV=oldMode;CONFIG.GEMINI_API_KEY=oldKey;db.restore(snapshot);});
  async function login(){
    await run('toggleUserRole()');el('operator-email').value='operator@example.test';el('operator-password').value='PrivatePassword123!';
    await window.activateOperatorSession({preventDefault(){},target:el('operator-email').closest('form')});
    await eventually(()=>!el('operator-login-modal').classList.contains('hidden')?false:run('!!authToken'));
  }
  test('nonblocking toast replaces native alerts without changing the message',()=>{
    window.alert('ডিভাইসের লোকেশন পাওয়া যায়নি; লিখে স্থান দিন।');expect(el('civic-toast').hidden).toBe(false);expect(el('civic-toast').textContent).toContain('লোকেশন পাওয়া যায়নি');
    el('civic-toast').querySelector('button').click();expect(el('civic-toast').hidden).toBe(true);
  });
  test('report card preserves its real score, keyboard detail action and affirm workflow',async()=>{
    const response=await request(app).get('/api/v1/reports/rep-004');const report=response.body.report;window.renderReportsFeed([report]);
    const card=el('reports-feed-container').querySelector('.civic-report-card');expect(card).not.toBeNull();expect(card.querySelector('h3 button').textContent).toBe(report.title);expect(card.querySelector('.mini-priority-ring').textContent).toBe(Number(report.priorityAssessment.score).toLocaleString('bn-BD'));
    expect(card.querySelectorAll('i[class*="fa-"]').length).toBe(0);const vote=card.querySelector('.citizen-upvote');vote.click();await eventually(()=>vote.textContent.includes('আপনি যুক্ত হয়েছেন'));
    expect(db.reports.get(report.id)?.affirmations?.count).toBeGreaterThan(0);
  });
  test('wizard preserves every original ID and submit handler; validates steps and creates a real receipt',async()=>{
    expect(window.handleFormSubmit).toBe(window.originalSubmitHandler);
    for(const id of window.originalElementIds){expect(window.document.querySelectorAll('[id="'+id+'"]').length).toBe(1);}
    window.startWizardDraft();el('wizard-next').click();expect(el('wizard-errors').textContent.length).toBeGreaterThan(0);
    expect(window.document.querySelector('[data-wizard-step="0"]').hidden).toBe(false);
    el('form-description').value='An unlit streetlight in the local test area needs inspection.';el('form-title').value='Local wizard streetlight test';el('citizen-category').value='STREETLIGHT';el('citizen-category').dispatchEvent(new window.Event('change'));
    run("pickerMarker={getLatLng(){return {lat:24.36,lng:88.62};}}");
    el('wizard-next').click();expect(window.document.querySelector('[data-wizard-step="1"]').hidden).toBe(false);
    el('wizard-next').click();expect(window.document.querySelector('[data-wizard-step="1"]').hidden).toBe(false);
    el('location-confirmed').checked=true;el('wizard-next').click();expect(window.document.querySelector('[data-wizard-step="2"]').hidden).toBe(false);
    Object.defineProperty(window.crypto,'subtle',{value:require('crypto').webcrypto.subtle,configurable:true});
    window.TextEncoder=require('util').TextEncoder;
    const before=new Set(db.reports.keys());await window.handleFormSubmit({preventDefault(){}});
    const saved=Array.from(db.reports.values()).find(r=>!before.has(r.id));expect(saved).toBeTruthy();
    expect(el('civic-receipt').classList.contains('hidden')).toBe(false);expect(el('civic-receipt').textContent).toContain(saved!.id);expect(el('civic-receipt').textContent).toContain('পরবর্তী ধাপ: পর্যালোচনা');
    expect(window.readReceiptTokens()[saved!.id]).toHaveLength(64);expect(el('report-modal').classList.contains('hidden')).toBe(true);
    const copied=jest.fn().mockResolvedValue(undefined);Object.defineProperty(window.navigator,'clipboard',{value:{writeText:copied},configurable:true});el('receipt-share').click();
    await eventually(()=>copied.mock.calls.length===1);expect(copied.mock.calls[0][0]).toContain('?report='+saved!.id);expect(copied.mock.calls[0][0]).not.toContain(window.readReceiptTokens()[saved!.id]);
  });
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
  test('authority corner demo login, status, delete, restore and citizen return',async()=>{
    await window.openAuthorityCorner();el('authority-demo-login').click();await eventually(()=>window.document.body.classList.contains('authority-mode'));await eventually(()=>!!el('authority-queue-list').querySelector('.authority-row'));expect(el('authority-banner').textContent).toContain('ডেমো মোড');
    const row=el('authority-queue-list').querySelector('.authority-row');row.querySelectorAll('button')[2].click();const dialog=window.document.querySelector('dialog[open]:not(#assistant-panel)');expect(dialog).not.toBeNull();dialog.querySelector('textarea').value='ভুল স্থানের রিপোর্ট সরানো';dialog.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true}));await eventually(()=>!!el('deleted-reports')?.querySelector('button'));el('deleted-reports').querySelector('button').click();await eventually(()=>!el('deleted-reports').querySelector('button'));await window.leaveAuthorityCorner();expect(window.document.body.classList.contains('authority-mode')).toBe(false);expect(run('currentTab')).toBe('home');
  });
  test('assistant threads persist, switch, and delete through a confirmation modal',async()=>{
    window.openCivicAssistant('আমার এলাকার পানি জমে থাকে');await eventually(()=>!!el('assistant-turns').querySelector('.assistant-answer'));
    const saved=JSON.parse(window.localStorage.getItem('nagarbondhu-threads'));expect(saved).toHaveLength(1);expect(saved[0].messages).toHaveLength(2);expect(el('assistant-turns').querySelector('.assistant-time').textContent).toMatch(/[০-৯]/);
    el('assistant-reset').click();expect(el('assistant-turns').children.length).toBe(0);window.openCivicAssistant('রাস্তার বাতি নষ্ট');await eventually(()=>!!el('assistant-turns').querySelector('.assistant-answer'));
    el('assistant-history').click();const rows=el('assistant-thread-drawer').querySelectorAll('div');expect(rows.length).toBe(2);rows[1].querySelector('button').click();expect(el('assistant-turns').textContent).toContain('আমার এলাকার পানি জমে থাকে');
  });
  test('filter sheet supports multiple categories while retaining the original select handlers',async()=>{
    const row=el('section-map').querySelector('.filter-chips');row.querySelector('button').click();
    const choices=el('map-filter-sheet').querySelectorAll('.filter-options:first-of-type button');choices[0].click();choices[1].click();
    expect(el('map-category-filter').value).toBe('ALL');expect(el('map-filter-sheet').querySelectorAll('.filter-options:first-of-type [aria-pressed="true"]').length).toBe(2);
    expect(row.querySelector('button').textContent).toContain('২');
    el('map-category-filter').value='DRAINAGE';window.renderMapMarkers();
    expect(row.querySelector('button').textContent).toContain('১');
    expect(el('map-source')).not.toBeNull();expect(el('twin-at')).not.toBeNull();
    el('map-from').value='2026-10-01';el('twin-at').value='2026-10-05';
    const clear:any=Array.from(el('map-filter-sheet').querySelectorAll('button')).find((b:any)=>b.textContent.startsWith('সব ফিল্টার মুছুন'));clear.click();
    expect(el('map-from').value).toBe('');expect(el('twin-at').value).toBe('');expect(el('map-category-filter').value).toBe('ALL');
    await eventually(()=>!el('twin-summary').textContent.includes('লোড'));
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
      const headings:any={scenarios:'What-If Urban Planner',clusters:'Root-Cause Cluster Intelligence',coverage:'Urban Voice',missions:'স্মার্ট ফিল্ড পরিদর্শন পরিকল্পনা'};
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
    expect(el('rating-summary').textContent).toContain('৪/৫');expect(el('rating-message').textContent).toContain('সংরক্ষিত');
    await window.openDetailModal(id);
    expect(el('resolution-rating-form').elements['resolution-score'].value).toBe('4');
    el('resolution-rating-form').elements['resolution-score'].value='2';
    await window.submitResolutionRating({preventDefault(){},target:el('resolution-rating-form')},id,'/uploads/resolved.png');
    expect(el('rating-summary').textContent).toContain('২/৫');expect(db.resolutionRatings.size).toBe(1);
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
