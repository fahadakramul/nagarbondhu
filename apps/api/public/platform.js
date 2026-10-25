// Additive citizen tracking and planning tools on the existing screens.
const platformEscape=actionEscape;
const TIMELINE_LABELS={REPORT_RECEIVED:'রিপোর্ট গ্রহণ হয়েছে',PLAN_CONFIRMED:'পরিকল্পনা নিশ্চিত হয়েছে',ASSIGNMENT_RECORDED:'দায়িত্ব নথিভুক্ত হয়েছে',DUE_DATE_CHANGED:'লক্ষ্য তারিখ পরিবর্তিত হয়েছে',STATUS_CHANGED:'অবস্থা পরিবর্তিত হয়েছে',RESOLUTION_SUBMITTED:'সমাধানের তথ্য জমা হয়েছে',RESOLUTION_VERIFIED:'সমাধান যাচাই নিশ্চিত হয়েছে',RESOLUTION_VERIFICATION_REJECTED:'সমাধানের প্রমাণ অপর্যাপ্ত',CITIZEN_FEEDBACK_REVIEWED:'নাগরিকের feedback পর্যালোচনা হয়েছে',PROGRESS_UPDATED:'কাজের অগ্রগতি নথিভুক্ত হয়েছে',INFORMATION_REQUESTED:'আরও তথ্য প্রয়োজন'};
let assistantDescription='';
let assistantCategory=null;
let assistantInput='';
let platformSubmitBusy=false;
let mapRecords=[];
let mapRequestSequence=0;
let queueOffset=0;
let feedOffset=0;
let platformLocationSource='MAP_PIN';
let platformLocationSelected=false;
const uuid=()=>crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
async function platformApi(path,body,options={}) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeoutMs||60000);
  const cancel=()=>controller.abort();if(options.signal?.aborted)cancel();else options.signal?.addEventListener('abort',cancel,{once:true});
  try{
    const response=await fetch('/api/v1'+path,{method:body===undefined?'GET':'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const result=await response.json();if(!response.ok || !result.success)throw new Error(result.error || 'অনুরোধ ব্যর্থ হয়েছে।');return result;
  }catch(error){if(error.name==='AbortError')throw new Error('অনুরোধের সময় শেষ হয়েছে বা বাতিল হয়েছে। আবার চেষ্টা করুন।');throw error;}
  finally{clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);}
}
function setPlatformMessage(text){document.getElementById('submission-message').textContent=text;}
function readReceiptTokens(){try{return JSON.parse(localStorage.getItem('nagarbondhu-receipts') || '{}');}catch{return {};}}
function showDeviceReceipts(){const box=document.getElementById('device-receipts');box.innerHTML=Object.keys(readReceiptTokens()).map(id=>`<button class="block underline break-all" data-device-report="${platformEscape(id)}">${platformEscape(id)}</button>`).join('') || 'এই ডিভাইসে কোনো receipt নেই।';box.querySelectorAll('[data-device-report]').forEach(b=>b.onclick=()=>openDetailModal(b.dataset.deviceReport));}
function populateWardDropdown(){const select=document.getElementById('form-ward');select.innerHTML='<option value="">ওয়ার্ড অজানা / নিজে নির্বাচন করুন</option>'+RAJSHAHI_WARDS.map(w=>`<option value="${w.wardNumber}">${platformEscape(w.wardName)}</option>`).join('');}
function onWardSelect(){const selected=RAJSHAHI_WARDS.find(w=>String(w.wardNumber)===document.getElementById('form-ward').value);if(selected&&Number.isFinite(selected.lat)&&Number.isFinite(selected.lng)&&pickerMap)pickerMap.panTo([selected.lat,selected.lng]);platformLocationSelected=false;const checkbox=document.getElementById('location-confirmed');checkbox.checked=false;checkbox.setCustomValidity('মানচিত্রে ঘটনার স্থান নিজে নির্বাচন করুন; ওয়ার্ডের কেন্দ্র ঘটনার স্থান নয়।');document.getElementById('coords-display').textContent='ঘটনার স্থান এখনও নির্বাচন হয়নি';}
function updateLocationFromLatLng(lat,lng,accuracy=null){platformLocationSelected=true;platformLocationSource=accuracy?'GPS':'MAP_PIN';document.getElementById('coords-display').textContent=`${lat.toFixed(5)}, ${lng.toFixed(5)}${accuracy?' (±'+Math.round(accuracy)+'m)':''} · ${accuracy?'GPS':'আপনার নির্বাচিত পিন'}`;const checkbox=document.getElementById('location-confirmed');checkbox.checked=false;checkbox.setCustomValidity('');}
document.getElementById('location-confirmed').setCustomValidity('মানচিত্রে ঘটনার স্থান নিজে নির্বাচন করুন; প্রথম পিন শুধু মানচিত্রের কেন্দ্র।');
async function runAiPreview(allowFallback=false){
  const title=document.getElementById('form-title').value.trim(),text=document.getElementById('form-description').value.trim(),button=document.getElementById('btn-ai-preview');
  if(text.length<5){setPlatformMessage('আগে বিস্তারিত বর্ণনা লিখুন।');return;}
  document.getElementById('ai-preview-feedback').textContent='';document.getElementById('ai-preview-box').classList.add('hidden');assistantInput='';assistantCategory=null;
  button.disabled=true;button.textContent='বিশ্লেষণ চলছে…';
  try{
    const result=await platformApi('/ai/analyze-complaint',{text,title,allowFallback}),d=result.data;
    if(text!==document.getElementById('form-description').value.trim()){setPlatformMessage('বিবরণ বদলেছে; নতুন তথ্যের জন্য আবার Preview নিন।');return;}
    if(title===document.getElementById('form-title').value.trim()&&!title)document.getElementById('form-title').value=d.title_bn || d.summary.slice(0,60);
    setPlatformMessage(result.metadata.isFallback?'নিয়মভিত্তিক সারাংশ তৈরি হয়েছে।':'সারাংশ তৈরি হয়েছে। জমা দেওয়ার আগে দেখে নিন।');
    document.getElementById('ai-preview-box').classList.remove('hidden');
    document.getElementById('ai-preview-category-badge').textContent=CATEGORY_NAMES_BN[d.category];
    document.getElementById('ai-preview-summary').textContent=d.summary;
    document.getElementById('ai-preview-severity').textContent=d.severity;
    document.getElementById('ai-preview-confidence').textContent=d.confidence==null?'অনির্ধারিত':Math.round(d.confidence*100);
    document.getElementById('ai-preview-reasons').innerHTML=(d.reasons||[]).map(r=>`<li>${platformEscape(r)}</li>`).join('');
    assistantDescription=d.clearerDescription || d.summary;assistantCategory=d.category;assistantInput=text;
    document.getElementById('assistant-details').innerHTML=`<p>${result.metadata.isFallback?'নিয়মভিত্তিক সারাংশ; নির্ভরযোগ্যতার অনুমান নেই।':'বিবরণ থেকে তৈরি সারাংশ; মাঠে যাচাই প্রয়োজন।'}</p><p>মূল বিষয়: ${platformEscape((d.keywords||[]).join(', '))}</p><p>মাঠপর্যায়ে যাচাই: ${d.fieldVerificationNecessary?'প্রয়োজন':'প্রয়োজন হতে পারে'}</p><ul>${(d.missing_information||[]).map(t=>`<li>• ${platformEscape(t)}</li>`).join('')}</ul><p>${platformEscape(assistantDescription)}</p><button type="button" class="${buttonClass}" onclick="document.getElementById('form-description').value=assistantDescription">খসড়া বর্ণনা নিন, তারপর সম্পাদনা করুন</button>`;
  }catch(error){setPlatformMessage('');document.getElementById('ai-preview-feedback').innerHTML=`<p role="alert">${platformEscape(error.message)}</p><button type="button" class="${buttonClass}" onclick="runAiPreview()">আবার বিশ্লেষণ করুন</button><button type="button" class="${buttonClass}" onclick="runAiPreview(true)">নিয়মভিত্তিক সারাংশ দেখুন</button>`;}
  finally{button.disabled=false;button.textContent='বিবরণ বিশ্লেষণ করুন';}
}
async function checkDuplicatePreview(){
  const pin=pickerMarker?.getLatLng();if(!pin)throw new Error('মানচিত্রে স্থান নির্বাচন করুন।');
  const input={title:document.getElementById('form-title').value.trim(),description:document.getElementById('form-description').value.trim(),category:userOverrideCategory || (assistantInput===document.getElementById('form-description').value.trim()?assistantCategory:null) || 'OTHER',latitude:pin.lat,longitude:pin.lng};
  if(input.category==='OTHER' && !userOverrideCategory){setPlatformMessage('সম্ভাব্য মিল দেখতে category নির্বাচন করুন, অথবা AI preview পর্যালোচনা করুন।');return [];}
  const result=await platformApi('/reports/duplicate-suggestions',input);
  const container=document.getElementById('duplicate-preview');
  container.innerHTML=result.data.length?`<p class="font-bold">সম্ভাব্য একই সমস্যা — নিশ্চিত duplicate নয়।</p>${result.data.map(r=>`<button type="button" class="block underline text-left my-2" data-existing-report="${platformEscape(r.id)}">${platformEscape(r.title)} • ${platformEscape(ACTION_LABELS[r.status])} ${r.sourceType==='demo_seed'?'• নমুনা':''}</button>`).join('')}<p>বিদ্যমান রিপোর্ট দেখতে পারেন অথবা নতুন রিপোর্ট চালিয়ে যেতে পারেন।</p>`:'কাছাকাছি একই শ্রেণির মিল পাওয়া যায়নি; অসম্পূর্ণ তথ্যের কারণে কিছু মিল বাদ পড়তে পারে।';
  container.querySelectorAll('[data-existing-report]').forEach(b=>b.onclick=()=>openDetailModal(b.dataset.existingReport));
  return result.data;
}
async function handleFormSubmit(event){
  event.preventDefault();if(platformSubmitBusy)return;
  if(!platformLocationSelected||!document.getElementById('location-confirmed').checked){setPlatformMessage('মানচিত্রে ঘটনার স্থান বেছে পিন এবং নির্বাচিত/অজানা ওয়ার্ড নিশ্চিত করুন।');return;}
  platformSubmitBusy=true;const button=document.getElementById('btn-submit-report');button.disabled=true;button.textContent='যাচাই ও সংরক্ষণ হচ্ছে…';
  try{
    const pin=pickerMarker.getLatLng();const ward=document.getElementById('form-ward').value;
    const base={deviceId:typeof civicDevice==='function'?civicDevice():undefined,title:document.getElementById('form-title').value.trim(),description:document.getElementById('form-description').value.trim(),userCategory:userOverrideCategory || undefined,latitude:pin.lat,longitude:pin.lng,addressLabel:document.getElementById('form-address').value.trim(),wardId:ward?'ward-'+ward:undefined,locationConfirmed:true,locationSource:platformLocationSource};
    const signature=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({...base,image:selectedImageDataUrl || document.getElementById('form-image')?.value || ''}))))).map(b=>b.toString(16).padStart(2,'0')).join('');
    let pending;try{pending=JSON.parse(sessionStorage.getItem('nagarbondhu-pending') || 'null');}catch{}
    if(!pending || pending.signature!==signature){
      const matches=await checkDuplicatePreview();
      if(matches.length && !await mvpConfirm('সম্ভাব্য মিল আছে। নতুন রিপোর্ট জমা দেওয়া চালিয়ে যেতে চান?'))return;
      let imageUrl=document.getElementById('form-image')?.value.trim() || null;
      if(selectedImageDataUrl) imageUrl=(await platformApi('/reports/upload-image',{imageBase64:selectedImageDataUrl})).imageUrl;
      pending={signature,payload:{...base,imageUrl,idempotencyKey:uuid()}};sessionStorage.setItem('nagarbondhu-pending',JSON.stringify(pending));
    }
    const result=await platformApi('/reports',pending.payload);
    const tokens=readReceiptTokens();tokens[result.report.id]=result.trackingToken;
    try{localStorage.setItem('nagarbondhu-receipts',JSON.stringify(tokens));}catch{alert('রিপোর্ট সংরক্ষিত হয়েছে, তবে এই browser-এ receipt রাখা যায়নি। রিপোর্ট নম্বর: '+result.report.id);}
    sessionStorage.removeItem('nagarbondhu-pending');
    setPlatformMessage('সার্ভারে সংরক্ষিত হয়েছে। রিপোর্ট নম্বর: '+result.report.id);
    document.getElementById('report-form').reset();platformLocationSelected=false;document.getElementById('location-confirmed').setCustomValidity('মানচিত্রে ঘটনার স্থান নিজে নির্বাচন করুন; প্রথম পিন শুধু মানচিত্রের কেন্দ্র।');document.getElementById('coords-display').textContent='ঘটনার স্থান এখনও নির্বাচন হয়নি';clearSelectedImage();userOverrideCategory=null;document.getElementById('ai-preview-box').classList.add('hidden');
    document.getElementById('stats-source').value=result.report.sourceType==='demo_seed'?'demo_seed':'citizen_report';feedOffset=0;await loadData();switchTab('feed');openDetailModal(result.report.id);
  }catch(error){setPlatformMessage(error.message+' একই তথ্য রেখে আবার চেষ্টা করুন; retry-তে দ্বিতীয় রিপোর্ট তৈরি হবে না।');}
  finally{platformSubmitBusy=false;button.disabled=false;button.textContent='রিপোর্ট জমা দিন';}
}
let detailRequestSequence=0;
const originalOpenDetailModal=openDetailModal;
openDetailModal=async function(id){
  const sequence=++detailRequestSequence;
  try{
    const result=await platformApi('/reports/'+encodeURIComponent(id));if(sequence!==detailRequestSequence)return;const index=allReports.findIndex(r=>r.id===id);if(index>=0)allReports[index]=result.report;else allReports.push(result.report);
    await originalOpenDetailModal(id);if(sequence!==detailRequestSequence||selectedReport?.id!==id)return;const assessment=selectedReport.priorityAssessment;
    const factors=assessment?.explanation?.factors || [];
    document.getElementById('modal-prio-summary').innerHTML='রিপোর্টের তীব্রতা, অপেক্ষার সময় ও যাচাইকৃত মিলের ভিত্তিতে অগ্রাধিকার নির্ধারিত হয়েছে। মাঠে যাচাই করে সিদ্ধান্ত নিন।'+(factors.length?`<details class="mt-2"><summary class="cursor-pointer">হিসাবের বিবরণ</summary>${factors.map((f,i)=>`<p class="mt-1">${(['তীব্রতা','অপেক্ষার সময়','যাচাইকৃত মিল'][i] || platformEscape(f.name))}: ${f.value}/৫ • গুরুত্ব ${Number.isFinite(Number(f.weight))?Math.round(Number(f.weight)*100)+'%':platformEscape(f.weight)} • ${platformEscape(f.note)}</p>`).join('')}</details>`:'');
    document.getElementById('public-tracking').textContent='অগ্রগতি লোড হচ্ছে…';
    const {data:d}=await platformApi('/reports/'+encodeURIComponent(id)+'/tracking');if(selectedReport?.id!==id)return;
    const a=d.assignment,token=readReceiptTokens()[id];
    document.getElementById('public-tracking').innerHTML=`<h4 class="font-bold">রিপোর্টের অগ্রগতি</h4><p class="break-all">রিপোর্ট নম্বর: ${platformEscape(id)}</p><p>${platformEscape(ACTION_LABELS[d.status])} • ${d.sourceType==='demo_seed'?'নমুনা রিপোর্ট':'নাগরিক রিপোর্ট'} • ${actionDate(d.createdAt)}</p><p>দায়িত্ব: ${platformEscape(a?.officer || a?.department || 'এখনও নথিভুক্ত নয়')} ${a?'('+platformEscape(a.officer?a.officerVerification:a.departmentVerification)+')':''}</p><p>লক্ষ্য: ${actionDate(a?.targetDate)}</p>${a?`<p>${platformEscape(a.actionDescription)}</p>`:''}<p>সমাধান যাচাই: ${platformEscape(d.resolution?.verificationStatus || 'প্রযোজ্য নয়')}</p>${d.resolution?.note?`<p>${platformEscape(d.resolution.note)}</p>`:''}<h5 class="font-bold">অগ্রগতি</h5>${d.progress.map(p=>`<p>${actionDate(p.createdAt)} — ${platformEscape(p.note)}</p>`).join('') || '<p>অগ্রগতির নতুন তথ্য নেই।</p>'}<h5 class="font-bold">ঘটনাক্রম</h5>${d.timeline.map(e=>`<p>${actionDate(e.createdAt)} • ${platformEscape(e.status?ACTION_LABELS[e.status]:(TIMELINE_LABELS[e.type]||e.type))} ${platformEscape(e.message||'')}</p>`).join('')}${['RESOLVED','CLOSED'].includes(d.status)?token?`<form onsubmit="submitCitizenFeedback(event)"><label>আপনার পর্যবেক্ষণ<select id="citizen-verdict" class="${inputClass}"><option value="APPEARS_RESOLVED">সমাধান হয়েছে বলে মনে হচ্ছে</option><option value="PERSISTS">সমস্যা রয়ে গেছে</option></select></label><label>মন্তব্য<textarea id="citizen-comment" maxlength="2000" class="${inputClass}"></textarea></label><button class="${buttonClass}">Feedback সংরক্ষণ করুন</button><p>অ্যাডমিন review করবেন; verified status নিজে পরিবর্তন হবে না।</p></form>`:'<p>Feedback দিতে এই ডিভাইসে সংরক্ষিত submission receipt প্রয়োজন।</p>':''}<p id="feedback-message" role="status"></p>`;
    renderResolutionRating(id,d);
  }catch(error){document.getElementById('device-receipts').textContent=error.message;document.getElementById('public-tracking').textContent=error.message;}
};
function ratingSummaryText(rating){return rating.count?`★ ${rating.average}/৫ • ${rating.count}টি নাগরিক রেটিং`:'এখনও রেটিং নেই। প্রথম রেটিং দিন।';}
function renderResolutionRating(id,data){
  if(!data.rating?.available)return;
  const section=document.createElement('section');section.className='border rounded-xl p-4 my-3 bg-indigo-50';section.id='resolution-rating';
  section.innerHTML=`<h4 class="font-bold">সমাধানের ছবি ও নাগরিক রেটিং</h4><img src="${platformEscape(data.resolution.afterPhotoUrl)}" alt="সমস্যা সমাধানের পরের ছবি" class="w-full max-h-80 object-contain rounded-lg my-3" loading="lazy"><p id="rating-summary" class="font-bold">${ratingSummaryText(data.rating)}</p><form id="resolution-rating-form"><fieldset class="my-3"><legend>সমাধানের মান কেমন? ১ = খুব খারাপ, ৫ = খুব ভালো</legend><div class="flex flex-wrap gap-3 my-2">${[1,2,3,4,5].map(score=>`<label class="cursor-pointer"><input type="radio" name="resolution-score" value="${score}" required aria-label="${score} তারকা"> <span class="text-amber-600">${'★'.repeat(score)}</span></label>`).join('')}</div></fieldset><button class="${buttonClass}">রেটিং দিন</button><p class="text-xs mt-2">এই ব্রাউজার থেকে আবার রেটিং দিলে আগেরটি আপডেট হবে। নাগরিক রেটিং অফিসিয়াল যাচাইয়ের অবস্থা বদলায় না।</p><p id="rating-message" role="status" aria-live="polite"></p></form>`;
  document.getElementById('public-tracking').appendChild(section);
  const form=section.querySelector('form');
  form.onsubmit=e=>submitResolutionRating(e,id,data.resolution.afterPhotoUrl);
  try{const saved=JSON.parse(localStorage.getItem('nagarbondhu-rating-'+id)||'null');if(saved?.photo===data.resolution.afterPhotoUrl && [1,2,3,4,5].includes(saved.score)){form.elements['resolution-score'].value=String(saved.score);section.querySelector('button').textContent='রেটিং আপডেট করুন';}}catch{}
}
async function submitResolutionRating(e,id,photo){
  e.preventDefault();const form=e.target,button=form.querySelector('button'),message=form.querySelector('#rating-message');
  if(button.disabled)return;button.disabled=true;message.textContent='রেটিং সংরক্ষণ হচ্ছে…';
  try{
    let voterToken=localStorage.getItem('nagarbondhu-rating-token');
    if(!/^[a-f0-9]{64}$/.test(voterToken||'')){voterToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');localStorage.setItem('nagarbondhu-rating-token',voterToken);}
    const score=Number(form.elements['resolution-score'].value);
    const {data}=await platformApi('/reports/'+encodeURIComponent(id)+'/rating',{voterToken,score,afterPhotoUrl:photo});
    form.closest('section').querySelector('#rating-summary').textContent=ratingSummaryText(data);message.textContent='আপনার রেটিং সংরক্ষিত হয়েছে।';button.textContent='রেটিং আপডেট করুন';
    try{localStorage.setItem('nagarbondhu-rating-'+id,JSON.stringify({score,photo}));}catch{}
  }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
}
async function submitCitizenFeedback(e){e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{await platformApi('/reports/'+encodeURIComponent(selectedReport.id)+'/feedback',{trackingToken:readReceiptTokens()[selectedReport.id],verdict:document.getElementById('citizen-verdict').value,comment:document.getElementById('citizen-comment').value});document.getElementById('feedback-message').textContent='Feedback সংরক্ষিত; অ্যাডমিন review বাকি।';}catch(error){document.getElementById('feedback-message').textContent=error.message;}finally{button.disabled=false;}}
async function loadMapRecords(){const sequence=++mapRequestSequence;try{const result=await platformApi('/map/reports');if(sequence!==mapRequestSequence)return;mapRecords=result.markers;renderMapMarkers();}catch(error){document.getElementById('map-coverage').textContent=error.message+' আবার map tab খুলে চেষ্টা করুন।';}}
function renderMapMarkers(){
  if(!mainMap || !currentMarkerGroup)return;currentMarkerGroup.clearLayers();
  if(!mainMap._platformZoomBound){mainMap.on('zoomend',renderMapMarkers);mainMap._platformZoomBound=true;}
  const value=id=>document.getElementById(id)?.value;
  const records=mapRecords.filter(r=>(!value('twin-ward')||r.wardId===value('twin-ward'))&&(value('map-category-filter')==='ALL'||r.category===value('map-category-filter'))&&(value('map-priority-filter')==='ALL'||r.priorityLevel===value('map-priority-filter'))&&(!value('map-status')||r.status===value('map-status'))&&(!value('map-from')||Date.parse(r.createdAt)>=Date.parse(value('map-from')+'T00:00:00+06:00'))&&(!value('map-to')||Date.parse(r.createdAt)<=Date.parse(value('map-to')+'T23:59:59.999+06:00'))&&(!value('map-source')||r.sourceType===value('map-source')));
  const clusters=[];for(const r of records){const point=mainMap.latLngToLayerPoint([r.latitude,r.longitude]);let group=r.locationConfirmed?clusters.find(g=>g.rows[0].locationConfirmed&&g.point.distanceTo(point)<45):null;if(!group){group={point,rows:[]};clusters.push(group);}group.rows.push(r);}
  for(const group of clusters){const r=group.rows[0],many=group.rows.length>1;const color=group.rows.some(x=>x.priorityLevel==='CRITICAL')?'#B91C1C':group.rows.some(x=>x.priorityLevel==='HIGH')?'#9A3412':group.rows.some(x=>x.priorityLevel==='MEDIUM')?'#F59E0B':'#4338CA';const ring=many?'#fff':r.priorityLevel==='CRITICAL'?'#dc2626':r.priorityLevel==='HIGH'?'#f59e0b':'#cbd5e1';const symbol=['RESOLVED','CLOSED'].includes(r.status)?'✓':r.status==='IN_PROGRESS'?'→':'•';const icon=L.divIcon({className:'custom-pin',html:`<div style="background:${color};width:32px;height:32px;border:3px solid ${ring};border-radius:50%;color:white;text-align:center;line-height:26px;font-weight:bold">${many?group.rows.length:symbol}</div>`,iconSize:[32,32]});const marker=L.marker([r.latitude,r.longitude],{icon,civicReportCount:group.rows.length});
    const wrapper=document.createElement('div');wrapper.className='map-report-popup';for(const item of group.rows.slice(0,30)){const button=document.createElement('button');button.className='map-report-popup-item';button.textContent=item.title+' • '+(ACTION_LABELS[item.status]||item.status)+(item.sourceType==='demo_seed'?' • নমুনা':'')+(item.locationConfirmed?'':' • অবস্থান নিশ্চিত নয়');button.onclick=()=>typeof selectTwinReport==='function'?selectTwinReport(item.id):openDetailModal(item.id);wrapper.appendChild(button);}if(many){const zoom=document.createElement('button');zoom.className='map-report-popup-zoom';zoom.textContent='এলাকায় জুম করুন';zoom.onclick=()=>mainMap.fitBounds(group.rows.map(r=>[r.latitude,r.longitude]),{maxZoom:19,padding:[30,30]});wrapper.appendChild(zoom);}marker.bindPopup(wrapper,{minWidth:230,maxWidth:320,autoPanPadding:[20,20]});currentMarkerGroup.addLayer(marker);
  }
  document.getElementById('map-coverage').textContent=`${records.length}টি রিপোর্ট দেখানো হচ্ছে। ${records.length?'কাছাকাছি চিহ্ন রিপোর্টের ঘনত্ব বোঝায়, নিশ্চিত বিপদ নয়।':'এই ফিল্টারে কোনো রিপোর্ট নেই।'} এটি সব নগর সমস্যা বা সরকারি ওয়ার্ড সীমানা দেখায় না।`;
}
const originalSwitchTab=switchTab;
switchTab=function(tab){originalSwitchTab(tab);if(tab==='map')loadMapRecords();if(tab==='dashboard' && isAdminMode)loadPlanningTools();};
function planningFilters(){const values={};for(const key of ['wardId','category','from','to','source']){const value=document.getElementById('brief-'+key)?.value;if(value)values[key]=value;}return values;}
function factsTable(headers,rows){return rows.length?`<div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr>${headers.map(h=>`<th class="border-b p-2">${platformEscape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td class="border-b p-2 align-top">${platformEscape(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p>তুলনাযোগ্য তথ্য নেই।</p>';}
function wardDisplay(id){return actionDirectory?.wards.find(w=>w.id===id)?.wardName || id || 'ওয়ার্ড অজানা';}
function copilotFacts(d){const facts=d.facts;switch(d.question){
  case 'REVIEW_FIRST':return factsTable(['Reference / সমস্যা','ওয়ার্ড','অবস্থা / priority','লক্ষ্য'],facts.map(r=>[r.id+' • '+r.title,wardDisplay(r.wardId),(ACTION_LABELS[r.status]||r.status)+' • '+(r.priority||'অজানা'),r.overdue?'সময় পেরিয়েছে':actionDate(r.targetDate)]));
  case 'OVERDUE_WARDS':return factsTable(['ওয়ার্ড','Overdue রিপোর্ট'],Object.entries(facts).map(([k,v])=>[wardDisplay(k),v]));
  case 'MONTHLY_CATEGORIES':return factsTable(['মাস','Category','উপলব্ধ রিপোর্ট'],Object.entries(facts.counts).flatMap(([month,categories])=>Object.entries(categories).map(([category,count])=>[month,CATEGORY_NAMES_BN[category],count])))+factsTable(['মাস','Category','পূর্ববর্তী মাস','বর্তমান','পার্থক্য'],facts.changes.map(r=>[r.month,CATEGORY_NAMES_BN[r.category],r.previousCount,r.currentCount,r.change]))+'<p>এটি নির্বাচিত সময়ের রিপোর্টের পরিবর্তন; অসম্পূর্ণ মাস ও reporting coverage সমান করা হয়নি।</p>';
  case 'FIELD_VERIFICATION':return facts.length?`<p>মাঠে অবস্থান/সমস্যা যাচাই প্রয়োজন: ${facts.map(platformEscape).join(', ')}</p>`:'<p>এই সীমার মধ্যে কোনো রিপোর্ট চিহ্নিত হয়নি।</p>';
  case 'RECURRING_LOCATIONS':return factsTable(['Category','কাছাকাছি রিপোর্ট','মাস','Supporting references'],facts.map(c=>[CATEGORY_NAMES_BN[c.category],c.count,c.distinctMonths,c.reportIds.join(', ')]));
  case 'WARD_ACTION_PLAN':return facts.map(r=>`<p class="my-2"><strong>${platformEscape(CATEGORY_NAMES_BN[r.category])}</strong> — ${platformEscape(r.suggestion)}<br>References: ${platformEscape(r.reportIds.join(', '))}</p>`).join('') || '<p>কোনো রিপোর্ট নেই।</p>';
  default:return `<p>অসম্পন্ন রিপোর্ট: ${facts.count}</p><p class="break-all">References: ${platformEscape(facts.reportIds.join(', ') || 'তথ্য নেই')}</p>`;
}}
function briefHtml(d){return `<h4 class="font-bold">Planning brief — ${platformEscape(d.period.from || 'তথ্য নেই')} → ${platformEscape(d.period.to)}</h4><p>মোট ${d.total} • বাস্তব ${d.realCount} • নমুনা ${d.demoCount} • অসম্পন্ন ${d.unresolved} • Overdue ${d.overdue}</p><h5 class="font-bold">Category / status / ward</h5>${[d.byCategory,d.byStatus,d.byWard].map(group=>`<p>${Object.entries(group).map(([k,v])=>platformEscape(CATEGORY_NAMES_BN[k]||ACTION_LABELS[k]||(k.startsWith('ward-')?wardDisplay(k):k))+': '+v).join(' • ') || 'তথ্য নেই'}</p>`).join('')}<h5 class="font-bold">মাসভিত্তিক পর্যবেক্ষণ</h5>${factsTable(['মাস','Category','রিপোর্ট'],Object.entries(d.months).flatMap(([month,categories])=>Object.entries(categories).map(([category,count])=>[month,CATEGORY_NAMES_BN[category],count])))}${factsTable(['মাস','Category','পূর্ববর্তী','বর্তমান','পরিবর্তন'],(d.monthChanges||[]).map(r=>[r.month,CATEGORY_NAMES_BN[r.category],r.previousCount,r.currentCount,r.change]))}<p>অসম্পূর্ণ মাস ও অসম reporting coverage-এর তুলনা সমান করা হয়নি।</p><p>নাগরিকের নির্বাচিত অবস্থান: ${d.locationConfirmedCount}/${d.total}; official boundary verification নয়।</p><h5 class="font-bold">Report-density clusters</h5>${d.clusters.map(c=>`<p>${platformEscape(CATEGORY_NAMES_BN[c.category])}: ${c.count} • ${platformEscape(c.reportIds.join(', '))} • ${c.distinctMonths} reporting month(s)</p>`).join('') || '<p>তুলনাযোগ্য cluster নেই।</p>'}<h5 class="font-bold">পর্যালোচনার প্রস্তাব (official instruction নয়)</h5>${d.suggestedInterventions.map(s=>`<p>${platformEscape(CATEGORY_NAMES_BN[s.category])}: ${platformEscape(s.suggestion)}</p>`).join('')}<h5 class="font-bold">Supporting references</h5><p class="break-all">${platformEscape(d.rows.map(r=>r.id).join(', ') || 'কোনো রিপোর্ট নেই')}</p><h5 class="font-bold">পর্যালোচনার খসড়া</h5><p>${platformEscape(d.aiInterpretation?.provider || 'অতিরিক্ত বিশ্লেষণ পাওয়া যায়নি')}</p>${(d.aiInterpretation?.observations||[]).map(o=>`<p>${platformEscape(o.text)} • ${platformEscape(o.reportIds.join(', '))}</p>`).join('')}<h5 class="font-bold">Data limitations / field validation</h5>${d.limitations.map(t=>`<p>• ${platformEscape(t)}</p>`).join('')}`;}
let currentBrief=null;
async function loadPlanningTools(){
  const container=document.getElementById('planning-tools');container.classList.toggle('hidden',!isAdminMode);if(!isAdminMode||!authToken)return;
  if(!document.getElementById('brief-source')){await ensureActionDirectory();container.innerHTML=`<h3 class="font-bold">পরিকল্পনা ও রিপোর্টের সারাংশ</h3><p class="text-xs">রিপোর্টের তথ্য থেকে পরিসংখ্যান ও করণীয় দেখুন।</p><div class="grid grid-cols-2 sm:grid-cols-5 gap-2"><label>ওয়ার্ড<select id="brief-wardId" class="${inputClass}">${actionOptions(actionDirectory.wards,null,'সব')}</select></label><label>Category<select id="brief-category" class="${inputClass}"><option value="">সব</option>${Object.entries(CATEGORY_NAMES_BN).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>শুরু<input id="brief-from" type="date" class="${inputClass}"></label><label>শেষ<input id="brief-to" type="date" class="${inputClass}"></label><label>Data source<select id="brief-source" class="${inputClass}"><option value="citizen_report">নাগরিক রিপোর্ট</option><option value="demo_seed">নমুনা</option><option value="all">সব (mixed)</option></select></label></div><div class="flex gap-2 flex-wrap"><button class="${buttonClass}" onclick="generateBrief()">Brief তৈরি করুন</button><button class="${buttonClass}" onclick="exportBriefCsv()">CSV export</button><button class="${buttonClass}" onclick="printPlanningBrief()">Print / Save PDF</button></div><div id="planning-brief" class="space-y-2 text-xs" aria-live="polite"></div><label class="block">Copilot প্রশ্ন<select id="copilot-question" class="${inputClass}">${Object.entries({REVIEW_FIRST:'কোন পাঁচটি অসম্পন্ন সমস্যা আগে review করব?',OVERDUE_WARDS:'কোন ওয়ার্ডে overdue বেশি?',MONTHLY_CATEGORIES:'মাসভিত্তিক category counts',FIELD_VERIFICATION:'কোন রিপোর্ট মাঠে যাচাই দরকার?',RECURRING_LOCATIONS:'একই স্থানে পুনরাবৃত্ত রিপোর্ট',WARD_ACTION_PLAN:'নির্বাচিত ওয়ার্ডের করণীয়',UNRESOLVED_SUMMARY:'অসম্পন্ন রিপোর্টের সারাংশ'}).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><button class="${buttonClass}" onclick="askCopilot()">তথ্য দেখুন</button><div id="copilot-result" class="space-y-2 text-xs" aria-live="polite"></div><h4 class="font-bold">নাগরিকের মতামত পর্যালোচনা</h4><div id="admin-feedback"></div>`;}
  await loadFeedbackQueue();
}
async function generateBrief(){const box=document.getElementById('planning-brief');box.textContent='সারাংশ গণনা হচ্ছে…';try{currentBrief=(await actionApi('/planning-brief?'+new URLSearchParams(planningFilters()))).data;box.innerHTML=briefHtml(currentBrief);}catch(e){currentBrief=null;box.textContent=e.message;}}
async function askCopilot(){const box=document.getElementById('copilot-result');box.textContent='তথ্য গণনা হচ্ছে…';try{const {data:d}=await actionApi('/copilot',{question:document.getElementById('copilot-question').value,filters:planningFilters()},'POST');box.innerHTML=`<p>Period ${platformEscape(d.period.from||'তথ্য নেই')} → ${platformEscape(d.period.to)} • ${d.total} রিপোর্ট (${d.demoCount} DEMO)</p><h5 class="font-bold">Observed facts / supporting references</h5>${copilotFacts(d)}<p>${platformEscape(d.interpretation)}</p><p>${platformEscape(d.interpretationProvider)}</p>${(d.aiInterpretation?.observations||[]).map(o=>`<p>${platformEscape(o.text)} • ${platformEscape(o.reportIds.join(", "))}</p>`).join("")}${d.limitations.map(t=>`<p>• ${platformEscape(t)}</p>`).join('')}`;}catch(e){box.textContent=e.message;}}
async function exportBriefCsv(){try{const res=await fetch('/api/v1/admin/export.csv?'+new URLSearchParams(planningFilters()),{headers:{Authorization:'Bearer '+authToken}});if(!res.ok)throw new Error('CSV export failed');const url=URL.createObjectURL(await res.blob());const a=document.createElement('a');a.href=url;a.download='nagarbondhu-reports.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){document.getElementById('planning-brief').textContent=e.message;}}
function printPlanningBrief(){if(!currentBrief){document.getElementById('planning-brief').textContent='আগে brief তৈরি করুন।';return;}const win=window.open('','_blank');if(!win){document.getElementById('planning-brief').textContent='এই browser/WebView-তে print window সমর্থিত নয়। CSV export ব্যবহার করুন।';return;}win.document.write('<!doctype html><html lang="bn"><meta charset="UTF-8"><title>NagarBondhu Planning Brief</title><style>body{font:14px sans-serif;margin:30px;line-height:1.6}pre,p{overflow-wrap:anywhere}h4,h5{margin-bottom:5px}@media print{button{display:none}}</style><body>'+briefHtml(currentBrief)+'<button onclick="window.print()">Print / Save PDF</button></body></html>');win.document.close();}
async function loadFeedbackQueue(){try{const {data}=await actionApi('/feedback');const container=document.getElementById('admin-feedback');container.innerHTML=data.map(f=>`<div class="border rounded p-2 my-2"><p>${platformEscape(f.reportId)} • ${platformEscape(f.verdict)} • ${platformEscape(f.reviewStatus)}</p><p>${platformEscape(f.comment)}</p><button class="${buttonClass}" data-feedback-review="${platformEscape(f.id)}">Review / follow-up</button></div>`).join('') || '<p class="text-xs">কোনো citizen feedback নেই।</p>';container.querySelectorAll('[data-feedback-review]').forEach(b=>b.onclick=()=>reviewFeedback(b.dataset.feedbackReview,data));}catch(e){document.getElementById('admin-feedback').textContent=e.message;}}
function requestAdminNote(title,minLength=10){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='rounded-2xl p-5 w-[90vw] max-w-sm shadow-xl';
    dialog.innerHTML=`<form class="space-y-3"><label class="block text-sm">${platformEscape(title)}<textarea required minlength="${minLength}" maxlength="2000" class="${inputClass}" rows="4"></textarea></label><p class="text-xs">ব্যক্তিগত তথ্য লিখবেন না।</p><div class="flex gap-3"><button type="submit" class="${buttonClass}">পরবর্তী ধাপ</button><button type="button" class="border p-2 rounded" data-cancel>ফিরে যান</button></div></form>`;
    let done=false;const finish=value=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(value);};
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const input=dialog.querySelector('textarea');if(input.value.trim().length<minLength){input.setCustomValidity(`কমপক্ষে ${minLength} অক্ষর লিখুন।`);input.reportValidity();return;}finish(input.value.trim());};
    dialog.querySelector('textarea').oninput=e=>e.target.setCustomValidity('');dialog.querySelector('[data-cancel]').onclick=()=>finish(null);dialog.oncancel=e=>{e.preventDefault();finish(null);};document.body.appendChild(dialog);dialog.showModal();
  });
}
async function reviewFeedback(id,rows){const f=rows.find(r=>r.id===id),note=await requestAdminNote('মতামত পর্যালোচনার কারণ লিখুন');if(!note)return;const reopen=await mvpConfirm('সমস্যাটি আবার পর্যালোচনার জন্য খুলবেন? ফিরে গেলে শুধু মতামত গ্রহণ করা হবে।');try{const {data}=await actionApi('/reports/'+encodeURIComponent(f.reportId)+'/actions');await actionApi('/feedback/'+encodeURIComponent(id)+'/review',{decision:reopen?'REOPEN':'ACKNOWLEDGED',note,revision:data.plan?.revision||0},'POST');await loadFeedbackQueue();await loadActionDashboard();}catch(e){document.getElementById('admin-feedback').textContent=e.message;}}
async function requestMoreInformation(){const reportId=selectedReport?.id;if(!reportId)return;const message=await requestAdminNote('নাগরিকের কাছে কোন তথ্য জানতে চান?');if(!message)return;try{await actionApi('/reports/'+encodeURIComponent(reportId)+'/request-information',{message},'POST');if(selectedReport?.id===reportId)await openDetailModal(reportId);}catch(e){const box=document.getElementById('report-action-workspace');box.insertAdjacentHTML('afterbegin',`<p role="alert" class="text-xs text-rose-700">${platformEscape(e.message)}</p>`);}}
function showOperatorLogin(){const modal=document.getElementById('operator-login-modal');document.body.appendChild(modal);modal.classList.remove('hidden');document.getElementById('operator-email').focus();}
function closeOperatorLogin(){document.getElementById('operator-login-modal').classList.add('hidden');}
async function logoutOperator(){authToken=null;actionDirectory=null;activeActionData=null;sessionStorage.removeItem('nagarbondhu-operator-token');closeOperatorLogin();if(isAdminMode)await toggleUserRole();}
async function activateOperatorSession(e){
  e.preventDefault();const message=document.getElementById('operator-message'),button=e.target.querySelector('button');button.disabled=true;message.textContent='লগইন হচ্ছে…';
  try{
    const result=await platformApi('/auth/login',{email:document.getElementById('operator-email').value.trim(),password:document.getElementById('operator-password').value});
    if(!['ADMIN','URBAN_PLANNER'].includes(result.user.role)||result.user.id==='user-admin-01')throw new Error('নিজের অ্যাডমিন অ্যাকাউন্ট ব্যবহার করুন।');
    document.getElementById('operator-password').value='';authToken=result.token;sessionStorage.setItem('nagarbondhu-operator-token',authToken);actionDirectory=null;mvpDirectory=null;message.textContent='লগইন সফল হয়েছে।';closeOperatorLogin();
    await loadData();await loadPlanningTools();if(selectedReport)await openDetailModal(selectedReport.id);await loadCompetition();
  }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
}

const stabilitySwitch=switchTab;
switchTab=function(tab){stabilitySwitch(tab);if(['home','dashboard','feed'].includes(tab))loadData();};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadData();});
// A saved operator session is checked only after an explicit entry to the authority corner.
setInterval(()=>{if(!document.hidden)loadData();},60000);
