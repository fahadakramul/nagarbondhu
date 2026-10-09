// Admin workflow extends the existing report modal and planning dashboard.
let actionDirectory = null;
let activeActionData = null;
let actionRequestSequence = 0;
let dashboardRequestSequence = 0;
const ACTION_LABELS = {
  SUBMITTED:'জমা দেওয়া', UNDER_REVIEW:'পর্যালোচনাধীন', AWAITING_FIELD_VERIFICATION:'মাঠপর্যায়ে যাচাই প্রয়োজন',
  READY_FOR_ASSIGNMENT:'দায়িত্ব অর্পণের জন্য প্রস্তুত', ASSIGNED:'দায়িত্ব নথিভুক্ত', IN_PROGRESS:'কাজ চলছে',
  ON_HOLD:'স্থগিত', RESOLVED:'সমাধান জমা দেওয়া', CLOSED:'যাচাই শেষে বন্ধ', REJECTED:'কারণসহ বাতিল',
};
const URGENCY_LABELS = { ROUTINE:'নিয়মিত', SOON:'শীঘ্র', URGENT:'জরুরি', IMMEDIATE:'অবিলম্বে পর্যালোচনা' };
const actionEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const actionDate = value => value ? new Date(value).toLocaleDateString('bn-BD',{timeZone:'Asia/Dhaka'}) : 'নির্ধারিত নয়';
const inputClass = 'w-full rounded-lg border border-slate-300 p-2 text-xs bg-white';
const buttonClass = 'bg-teal-700 text-white px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50';
const directoryLabel = row => `${row.displayName}${row.verificationStatus ? ` (${row.verificationStatus === 'VERIFIED' ? 'অ্যাডমিন-যাচাইকৃত' : row.verificationStatus})` : ''}${row.active === false ? ' — নিষ্ক্রিয়' : ''}`;
function actionOptions(rows, value, placeholder) {
  return `<option value="">${actionEscape(placeholder)}</option>` + rows.map(row => `<option value="${actionEscape(row.id)}" ${row.id===value?'selected':''}>${actionEscape(row.wardName || directoryLabel(row))}</option>`).join('');
}
async function actionApi(path, body, method='GET') {
  if (method!=='GET' && !path.startsWith('/copilot') && !confirm('এই পরিবর্তন সার্ভারে নথিভুক্ত হবে। নিশ্চিত করুন।')) throw new Error('পরিবর্তন বাতিল করেছেন।');
  if (!authToken) throw new Error('অ্যাডমিন demo session পাওয়া যায়নি। আবার role পরিবর্তন করে চেষ্টা করুন।');
  const response=await fetch(`/api/v1/admin${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${authToken}`}, ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const result=await response.json();
  if (!response.ok || !result.success) throw new Error(result.details?.map(d=>`${d.field}: ${d.message}`).join('; ') || result.error || 'অনুরোধ ব্যর্থ হয়েছে।');
  return result;
}
async function ensureActionDirectory() {
  if (!actionDirectory) actionDirectory=(await actionApi('/action-directory')).data;
  return actionDirectory;
}
function storageMessage(state) {
  return state?.provider==='postgres' && state.ready ? 'PostgreSQL-এ নথি সংরক্ষিত হচ্ছে।' : 'Demo memory mode: restart হলে নথি reset হবে; স্থায়ী সংরক্ষণ সক্রিয় নয়।';
}
function listBlock(title, items) {
  return `<div><h5 class="font-semibold text-xs">${actionEscape(title)}</h5><ul class="list-disc pl-4 text-xs space-y-1">${items.map(item=>`<li>${actionEscape(item)}</li>`).join('') || '<li>তথ্য দেওয়া হয়নি।</li>'}</ul></div>`;
}
async function loadReportActions(reportId) {
  const sequence=++actionRequestSequence, container=document.getElementById('report-action-workspace');
  container.textContent='করণীয় নথি লোড হচ্ছে…';
  try {
    const [result,directory]=await Promise.all([actionApi(`/reports/${encodeURIComponent(reportId)}/actions`),ensureActionDirectory()]);
    if (sequence!==actionRequestSequence || selectedReport?.id!==reportId || !isAdminMode) return;
    activeActionData=result.data;
    renderActionWorkspace(result.data,directory);
  } catch(error) {
    if (sequence!==actionRequestSequence || selectedReport?.id!==reportId) return;
    container.innerHTML=`<p class="text-xs text-rose-700">${actionEscape(error.message)}</p><button class="${buttonClass}" onclick="loadReportActions(selectedReport.id)">আবার চেষ্টা করুন</button>`;
  }
}
function renderActionWorkspace(data,directory) {
  document.getElementById('modal-status').textContent = ACTION_LABELS[data.status];
  const plan=data.plan, recommendation=data.recommendations[0], draft=recommendation?.data;
  const terminal=['RESOLVED','CLOSED','REJECTED'].includes(data.status);
  document.getElementById('report-action-workspace').innerHTML=`
    <p class="text-xs text-slate-600">${actionEscape(storageMessage(data.persistence))}</p>
    <p class="text-xs font-bold">${actionEscape(ACTION_LABELS[data.status])}${plan ? ' • অ্যাডমিন নিশ্চিতকৃত পরিকল্পনা' : ' • দায়িত্ব এখনও নিশ্চিত হয়নি'}</p>
    <div class="bg-purple-50 border border-purple-200 p-3 rounded-xl space-y-3">
      <h4 class="font-bold text-sm">AI-এর প্রস্তাবিত করণীয় (AI Recommended Actions)</h4>
      <p class="text-xs">এই খসড়া কারিগরি রোগনির্ণয় বা অনুমোদিত কার্যাদেশ নয়। অ্যাডমিনের পর্যালোচনা প্রয়োজন।</p>
      <button id="generate-action-draft" class="${buttonClass}" onclick="generateActionDraft()">${draft?'নতুন খসড়া তৈরি করুন (Regenerate)':'করণীয় খসড়া তৈরি করুন'}</button>
      <p id="action-ai-message" class="text-xs" role="status"></p>
      ${draft ? `<p class="text-xs font-bold">${recommendation.isFallback?'নিয়ম-ভিত্তিক প্রস্তাব (live AI নয়)':'AI Suggested'} • ${actionEscape(actionDate(recommendation.createdAt))}</p>
        <p class="text-sm font-semibold">${actionEscape(draft.nextAction)}</p><p class="text-xs">কেন: ${actionEscape(draft.rationale)}</p>
        <p class="text-xs">প্রস্তাবিত দল: ${actionEscape(draft.suggestedDepartment)} • জরুরিতা: ${actionEscape(URGENCY_LABELS[draft.urgency])}</p>
        <p class="text-xs">প্রস্তাবিত response target: ${actionEscape(draft.responseTarget)}</p>
        ${listBlock('মাঠপর্যায়ে যাচাই',draft.fieldVerification)}${listBlock('সম্ভাব্য সম্পদ/সরঞ্জাম',draft.resources)}${listBlock('ফলো-আপ',draft.followUp)}${listBlock('Escalation প্রয়োজন হলে',draft.escalationConditions)}${listBlock('সীমাবদ্ধতা',draft.limitations)}
        <p class="text-xs">Confidence: ${draft.confidence===null?'অনির্ধারিত':Math.round(draft.confidence*100)+'%'} • ${actionEscape(recommendation.provider)} / ${actionEscape(recommendation.modelName)}</p>
        <button class="${buttonClass}" onclick="useActionDraft()">পর্যালোচনা করে পরিকল্পনায় নিন / সম্পাদনা করুন</button>` : '<p class="text-xs text-slate-500">এখনও কোনো খসড়া নেই। চাইলে নিচে manual পরিকল্পনা তৈরি করুন।</p>'}
    </div>
    <form id="confirm-action-form" class="space-y-3" onsubmit="saveActionPlan(event)">
      <h4 class="font-bold text-sm">দায়িত্ব অর্পণ ও নিশ্চিত পরিকল্পনা (Assign Responsibility)</h4>
      <label class="block text-xs">অ্যাডমিন-নিশ্চিত করণীয়<textarea id="plan-description" required minlength="10" maxlength="4000" class="${inputClass}" rows="3">${actionEscape(plan?.actionDescription || '')}</textarea></label>
      <input type="hidden" id="plan-recommendation" value="${actionEscape(plan?.recommendationId || '')}">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label class="text-xs">সংশ্লিষ্ট ওয়ার্ড<select id="plan-ward" required onchange="updatePlanOfficerOptions()" class="${inputClass}">${actionOptions(directory.wards,plan?.wardId,'ওয়ার্ড যাচাই করে নির্বাচন করুন')}</select></label>
        <label class="text-xs">সংশ্লিষ্ট বিভাগ<select id="plan-department" required onchange="updatePlanOfficerOptions()" class="${inputClass}">${actionOptions(directory.departments.filter(d=>d.active || d.id===plan?.departmentId),plan?.departmentId,'বিভাগ নির্বাচন করুন')}</select></label>
        <label class="text-xs">দায়িত্বপ্রাপ্ত কর্মকর্তা<select id="plan-officer" class="${inputClass}"></select></label>
        <label class="text-xs">লক্ষ্য তারিখ (Target Date)<input id="plan-date" type="date" required class="${inputClass}" value="${plan?.targetDate?.slice(0,10) || ''}"></label>
        <label class="text-xs">অগ্রাধিকার<select id="plan-priority" class="${inputClass}">${['LOW','MEDIUM','HIGH','CRITICAL'].map(p=>`<option ${p===(plan?.priority || selectedReport.priorityAssessment?.priorityLevel)?'selected':''}>${p}</option>`).join('')}</select></label>
        <label class="text-xs">জরুরিতা<select id="plan-urgency" class="${inputClass}">${Object.entries(URGENCY_LABELS).map(([key,label])=>`<option value="${key}" ${key===(plan?.urgency || 'SOON')?'selected':''}>${label}</option>`).join('')}</select></label>
      </div>
      <p class="text-xs text-amber-800">শুধু আনুমানিক ওয়ার্ড কেন্দ্র আছে; official boundary নেই। রিপোর্টের স্থানাঙ্ক ${actionEscape(selectedReport.latitude)}, ${actionEscape(selectedReport.longitude)} এবং ওয়ার্ডের সীমানা নিজে যাচাই করুন। পূর্বের ওয়ার্ড: ${actionEscape(selectedReport.wardName || 'অজানা')}।</p>
      <label class="flex items-center gap-2 text-xs"><input id="plan-ward-verified" type="checkbox" required> অবস্থান দেখে নির্বাচিত ওয়ার্ড যাচাই করেছি</label>
      <label class="block text-xs">ওয়ার্ড যাচাইয়ের উৎস/পদ্ধতি<textarea id="plan-ward-note" required minlength="10" class="${inputClass}">${actionEscape(plan?.wardVerificationNote || '')}</textarea></label>
      <label class="block text-xs">দূরবর্তী ওয়ার্ড হলে কারণ (Location Override)<input id="plan-location-override" class="${inputClass}" value="${actionEscape(plan?.locationOverrideReason || '')}"></label>
      <label class="block text-xs">দায়িত্ব অর্পণের নোট<textarea id="plan-assignment-note" required minlength="3" class="${inputClass}">${actionEscape(plan?.assignmentNote || '')}</textarea></label>
      <label class="block text-xs">অ্যাডমিন নোট<textarea id="plan-admin-notes" class="${inputClass}">${actionEscape(plan?.adminNotes || '')}</textarea></label>
      <button id="save-action-plan" class="${buttonClass}" ${terminal?'disabled':''}>পরিকল্পনা নিশ্চিত ও দায়িত্ব নথিভুক্ত করুন</button>
      <p id="plan-save-message" class="text-xs" role="status"></p>
    </form>
    <form onsubmit="changeActionStatus(event)" class="space-y-2 border-t pt-3">
      <h4 class="font-bold text-sm">কাজের অবস্থা ও সমাধান</h4>
      <label class="block text-xs">পরবর্তী বৈধ অবস্থা<select id="action-next-status" class="${inputClass}">${data.allowedTransitions.filter(s=>s!=='ASSIGNED').map(s=>`<option value="${s}">${ACTION_LABELS[s]}</option>`).join('')}</select></label>
      <label class="block text-xs">কারণ / পরিবর্তনের নোট<textarea id="action-status-note" required minlength="3" class="${inputClass}"></textarea></label>
      <label class="block text-xs">সমাধানের নোট (Resolved হলে বাধ্যতামূলক)<textarea id="action-resolution-note" class="${inputClass}"></textarea></label>
      <label class="block text-xs">ছবি না থাকলে বিকল্প যাচাই পদ্ধতি<input id="action-verification-method" class="${inputClass}" placeholder="পরিদর্শনের নথি, তারিখ ও যাচাই পদ্ধতি"></label>
      <label class="block text-xs">সমাধান-পরবর্তী ছবি<input id="action-after-photo" type="file" accept="image/png,image/jpeg,image/webp" class="${inputClass}"></label>
      ${plan?.beforePhotoUrl ? `<a class="text-xs text-teal-700 underline" href="${actionEscape(plan.beforePhotoUrl)}" target="_blank" rel="noopener">সমস্যার আগের ছবি</a>` : ''}
      ${plan?.afterPhotoUrl ? `<a class="text-xs text-teal-700 underline" href="${actionEscape(plan.afterPhotoUrl)}" target="_blank" rel="noopener">সমাধান-পরবর্তী ছবি</a>` : ''}
      <button id="save-action-status" class="${buttonClass}" ${!data.allowedTransitions.length?'disabled':''}>অবস্থা পরিবর্তন নথিভুক্ত করুন</button>
      <p id="action-status-message" class="text-xs" role="status"></p>
    </form>
    ${plan ? `<form onsubmit="saveActionProgress(event)" class="space-y-2 border-t pt-3"><h4 class="font-bold text-sm">কাজের অগ্রগতি (Progress)</h4>
      <label class="block text-xs">অগ্রগতির নোট<textarea id="action-progress-note" required minlength="5" class="${inputClass}"></textarea></label>
      <label class="block text-xs">অগ্রগতির ছবি (ঐচ্ছিক)<input id="action-progress-photo" type="file" accept="image/png,image/jpeg,image/webp" class="${inputClass}"></label>
      <button id="save-action-progress" class="${buttonClass}" ${['RESOLVED','CLOSED','REJECTED'].includes(data.status)?'disabled':''}>অগ্রগতি সংরক্ষণ করুন</button><p id="action-progress-message" class="text-xs"></p></form>` : ''}
    ${plan?.status==='RESOLVED' ? `<form onsubmit="saveResolutionVerification(event)" class="space-y-2 border-t pt-3"><h4 class="font-bold text-sm">সমাধান যাচাই (Resolution Verification)</h4>
      <p class="text-xs">${actionEscape(plan.resolutionNotes)} • পদ্ধতি: ${actionEscape(plan.verificationMethod)} • ${actionEscape(plan.verificationStatus)}</p>
      <label class="block text-xs">যাচাইয়ের সিদ্ধান্ত<select id="resolution-verdict" class="${inputClass}"><option value="true">প্রমাণ পর্যালোচনা করে নিশ্চিত</option><option value="false">প্রমাণ অপর্যাপ্ত / পুনরায় কাজ প্রয়োজন</option></select></label>
      <label class="block text-xs">যাচাইয়ের প্রমাণ ও নোট<textarea id="resolution-verification-note" required minlength="10" class="${inputClass}"></textarea></label>
      <button id="save-resolution-verification" class="${buttonClass}">যাচাই নথিভুক্ত করুন</button><p id="resolution-verification-message" class="text-xs"></p>
      <p class="text-xs">যাচাই নিশ্চিত হলে আলাদাভাবে Closed নির্বাচন করুন।</p></form>` : ''}
    <details class="border-t pt-3"><summary class="font-bold text-sm cursor-pointer">অগ্রগতি ও অডিট ইতিহাস</summary><div class="space-y-2 mt-2">
      ${data.progress.map(p=>`<div class="text-xs border-l-2 border-sky-400 pl-2">${actionEscape(p.note)} • ${actionDate(p.createdAt)}${p.photoUrl?` <a href="${actionEscape(p.photoUrl)}" target="_blank" rel="noopener" class="underline">ছবি</a>`:''}</div>`).join('')}
      ${data.history.map(h=>`<div class="text-xs border-l-2 border-teal-500 pl-2"><strong>${actionEscape(h.type)}</strong> • ${actionDate(h.createdAt)}<p>${actionEscape(h.note)}</p>${h.type==='DUE_DATE_CHANGED'?`<p>${actionDate(h.details.previousDate)} → ${actionDate(h.details.targetDate)}</p>`:''}</div>`).join('') || '<p class="text-xs">এখনও কোনো প্রশাসনিক অ্যাকশন নথিভুক্ত হয়নি।</p>'}
      ${data.reportHistory?.map(h=>`<p class="text-xs text-slate-500">রিপোর্ট: ${actionEscape(h.previousStatus)} → ${actionEscape(h.newStatus)} • ${actionDate(h.createdAt)} • ${actionEscape(h.note || '')}</p>`).join('') || ''}
    </div></details>`;
  updatePlanOfficerOptions(plan?.officerId);
  if(directory.readOnly){document.getElementById('report-action-workspace').querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=true);document.getElementById('action-ai-message').textContent='Read-only demo: পরিবর্তন করতে provisioned operator session প্রয়োজন।';}
  document.getElementById('request-information-button').disabled=!!directory.readOnly;
}
function updatePlanOfficerOptions(selected=null) {
  const ward=document.getElementById('plan-ward').value, department=document.getElementById('plan-department').value;
  const rows=(actionDirectory?.officers || []).filter(o=>o.active && o.departmentId===department && (!o.wardId || o.wardId===ward));
  document.getElementById('plan-officer').innerHTML=actionOptions(rows,selected,'কর্মকর্তা নেই / শুধু বিভাগে দায়িত্ব দিন');
}
function useActionDraft() {
  const recommendation=activeActionData?.recommendations[0]; if (!recommendation) return;
  document.getElementById('plan-description').value=recommendation.data.nextAction;
  document.getElementById('plan-recommendation').value=recommendation.id;
  document.getElementById('plan-urgency').value=recommendation.data.urgency;
  const department=actionDirectory.departments.find(d=>d.active && d.displayName===recommendation.data.suggestedDepartment);
  if (department) { document.getElementById('plan-department').value=department.id; updatePlanOfficerOptions(); }
  document.getElementById('plan-save-message').textContent='এখন পর্যালোচনা/সম্পাদনা করে ওয়ার্ড ও লক্ষ্য তারিখ নিশ্চিত করুন।';
}
async function actionCommand(buttonId,messageId,run) {
  const button=document.getElementById(buttonId), message=document.getElementById(messageId), reportId=selectedReport?.id;
  button.disabled=true; message.textContent='সংরক্ষণ/প্রসেসিং হচ্ছে…';
  try { await run(reportId); if (selectedReport?.id===reportId) await loadReportActions(reportId); await loadData(); }
  catch(error) { if (selectedReport?.id===reportId) message.textContent=error.message; }
  finally { if (button.isConnected) button.disabled=false; }
}
async function generateActionDraft() {
  await actionCommand('generate-action-draft','action-ai-message',id=>actionApi(`/reports/${encodeURIComponent(id)}/action-recommendations`,{},'POST'));
}
async function saveActionPlan(event) {
  event.preventDefault();
  const val=id=>document.getElementById(id).value.trim();
  const body={actionDescription:val('plan-description'),recommendationId:val('plan-recommendation')||null,wardId:val('plan-ward'),wardVerified:document.getElementById('plan-ward-verified').checked,wardVerificationNote:val('plan-ward-note'),locationOverrideReason:val('plan-location-override')||null,departmentId:val('plan-department'),officerId:val('plan-officer')||null,targetDate:val('plan-date'),priority:val('plan-priority'),urgency:val('plan-urgency'),assignmentNote:val('plan-assignment-note'),adminNotes:val('plan-admin-notes'),revision:activeActionData.plan?.revision || 0};
  await actionCommand('save-action-plan','plan-save-message',id=>actionApi(`/reports/${encodeURIComponent(id)}/action-plan`,body,'PUT'));
}
async function uploadActionPhoto(id) {
  const file=document.getElementById(id)?.files[0]; if (!file) return null;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>4*1024*1024) throw new Error('PNG/JPEG/WebP ছবি দিন; সর্বোচ্চ 4 MB।');
  const imageBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
  const response=await fetch('/api/v1/reports/upload-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageBase64})});
  const data=await response.json();if (!response.ok || !data.imageUrl) throw new Error(data.error || 'ছবি আপলোড ব্যর্থ'); return data.imageUrl;
}
async function changeActionStatus(event) {
  event.preventDefault();
  await actionCommand('save-action-status','action-status-message',async id=>{
    const val=id=>document.getElementById(id).value.trim(), status=val('action-next-status');
    const body={status,note:val('action-status-note'),revision:activeActionData.plan?.revision || 0};
    if (status==='RESOLVED') { body.resolutionNotes=val('action-resolution-note'); if (val('action-verification-method')) body.verificationMethod=val('action-verification-method'); body.afterPhotoUrl=await uploadActionPhoto('action-after-photo'); }
    await actionApi(`/reports/${encodeURIComponent(id)}/action-status`,body,'PATCH');
  });
}
async function saveActionProgress(event) {
  event.preventDefault(); await actionCommand('save-action-progress','action-progress-message',async id=>actionApi(`/reports/${encodeURIComponent(id)}/progress`,{note:document.getElementById('action-progress-note').value.trim(),photoUrl:await uploadActionPhoto('action-progress-photo'),revision:activeActionData.plan.revision},'POST'));
}
async function saveResolutionVerification(event) {
  event.preventDefault(); await actionCommand('save-resolution-verification','resolution-verification-message',id=>actionApi(`/reports/${encodeURIComponent(id)}/resolution-verification`,{verified:document.getElementById('resolution-verdict').value==='true',note:document.getElementById('resolution-verification-note').value.trim(),revision:activeActionData.plan.revision},'POST'));
}
async function loadActionDashboard() {
  const container=document.getElementById('admin-action-dashboard'); if (!isAdminMode || !authToken) {container.classList.add('hidden');return;}
  container.classList.remove('hidden'); const sequence=++dashboardRequestSequence;
  const list=document.getElementById('action-dashboard-list'); list.textContent='করণীয় লোড হচ্ছে…';
  try {
    await ensureActionDirectory();
    if (!document.getElementById('action-filter-wardId')) renderActionFilters();
    const query=new URLSearchParams(); ['wardId','category','priority','status','departmentId','officerId','overdue','from','to'].forEach(key=>{const value=document.getElementById(`action-filter-${key}`)?.value;if(value)query.set(key,value);});
    query.set('limit','50');query.set('offset',String(queueOffset));
    const result=await actionApi(`/actions/dashboard?${query}`); if(sequence!==dashboardRequestSequence || !isAdminMode)return;
    document.getElementById('action-storage-status').textContent=storageMessage(result.persistence);
    document.getElementById('queue-page').textContent=`${queueOffset+1}–${Math.min(queueOffset+50,result.data.total)} / ${result.data.total}`;
    const labels={totalReports:'মোট রিপোর্ট',closed:'যাচাই শেষে বন্ধ',unassigned:'দায়িত্বহীন রিপোর্ট',awaitingVerification:'মাঠে যাচাই প্রয়োজন',assigned:'দায়িত্ব অর্পিত',inProgress:'কাজ চলছে',overdue:'লক্ষ্য তারিখ পেরিয়েছে',resolvedAwaitingVerification:'সমাধান যাচাই বাকি',highPriorityUnresolved:'উচ্চ অগ্রাধিকারে অসম্পন্ন'};
    document.getElementById('action-dashboard-cards').innerHTML=Object.entries(labels).map(([key,label])=>`<div class="rounded-xl bg-teal-50 p-3"><p class="text-xs">${label}</p><p class="text-xl font-bold text-teal-800">${result.data.summary[key]}</p></div>`).join('');
    list.innerHTML=result.data.rows.map(row=>`<div class="border border-slate-200 rounded-xl p-3 space-y-1 text-xs">
      <button class="font-bold text-left text-teal-800 hover:underline" data-open-action-report="${actionEscape(row.reportId)}">${actionEscape(row.title)}</button><span class="text-slate-500"> • ${actionEscape(row.reportId)}${row.sourceType==='demo_seed'?' • DEMO':''}</span>
      <p>${actionEscape(row.wardName || 'ওয়ার্ড যাচাই প্রয়োজন')} • ${actionEscape(row.location || 'অবস্থান অসম্পূর্ণ')}</p>
      <p><strong>AI/খসড়া:</strong> ${actionEscape(row.recommendedAction || 'এখনও তৈরি হয়নি')}</p>
      ${row.confirmedAction?`<p><strong>অ্যাডমিন নিশ্চিত:</strong> ${actionEscape(row.confirmedAction)}</p>`:''}
      <p>${actionEscape(row.priority)} • ${actionEscape(ACTION_LABELS[row.status])} • ${actionEscape(row.officerName || row.departmentName || 'দায়িত্ব দেওয়া হয়নি')}</p>
      <p>সর্বশেষ update: ${actionEscape(row.latestUpdate || "Progress নেই")} • ${actionDate(row.updatedAt)}</p><p>লক্ষ্য: ${actionDate(row.targetDate)} ${row.overdue?'<strong class="text-rose-700">— সময় পেরিয়েছে: দায়িত্বপ্রাপ্ত দলের follow-up ও escalation review প্রয়োজন; স্বয়ংক্রিয় নির্দেশ নয়</strong>':''}</p></div>`).join('') || '<p class="text-xs">এই filters অনুযায়ী কোনো রিপোর্ট নেই।</p>';
    list.querySelectorAll('[data-open-action-report]').forEach(button=>button.addEventListener('click',async()=>{
      const id=button.dataset.openActionReport;
      if (!allReports.some(r=>r.id===id)) { const response=await fetch(`/api/v1/reports/${encodeURIComponent(id)}`);const result=await response.json();if(result.report)allReports.push(result.report); }
      openDetailModal(id);
    }));
    renderDirectoryEditor();
    if(actionDirectory.readOnly)document.getElementById('dashboard-duplicates-list').querySelectorAll('button').forEach(b=>b.disabled=true);
    loadPlanningTools().catch(error=>document.getElementById('planning-tools').textContent=error.message);
  } catch(error) { if(sequence!==dashboardRequestSequence)return;list.innerHTML=`<p class="text-xs text-rose-700">${actionEscape(error.message)}</p><button class="${buttonClass}" onclick="loadActionDashboard()">আবার চেষ্টা করুন</button>`; document.getElementById('action-dashboard-cards').textContent='তথ্য অনুপলব্ধ'; }
}
function renderActionFilters() {
  const generic=(values)=>values.map(([id,displayName])=>({id,displayName,active:true,verificationStatus:''}));
  const filters=[['wardId','ওয়ার্ড',actionDirectory.wards],['category','সমস্যা',generic(Object.entries(CATEGORY_NAMES_BN))],['priority','অগ্রাধিকার',generic(['LOW','MEDIUM','HIGH','CRITICAL'].map(p=>[p,p]))],['status','অবস্থা',generic(Object.entries(ACTION_LABELS))],['departmentId','বিভাগ',actionDirectory.departments],['officerId','কর্মকর্তা',actionDirectory.officers],['overdue','লক্ষ্য তারিখ',generic([['true','সময় পেরিয়েছে'],['false','সময় পেরোয়নি']])]];
  document.getElementById('action-dashboard-filters').innerHTML=filters.map(([key,label,rows])=>`<label class="text-xs">${label}<select id="action-filter-${key}" onchange="queueOffset=0;loadActionDashboard()" class="${inputClass}">${actionOptions(rows,null,'সব')}</select></label>`).join('')+['from','to'].map((key,i)=>`<label class="text-xs">${i?'শেষ':'শুরু'}<input id="action-filter-${key}" type="date" class="${inputClass}" onchange="queueOffset=0;loadActionDashboard()"></label>`).join('');
}
function renderDirectoryEditor() {
  document.getElementById('action-directory-editor').innerHTML=`<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <form id="directory-department-form" class="space-y-2" onsubmit="saveDirectoryEntry(event,'department')"><h4 class="font-bold text-sm">বিভাগ যোগ/সম্পাদনা</h4>
      <select id="directory-department-edit" onchange="editDirectoryEntry('department',this.value)" class="${inputClass}">${actionOptions(actionDirectory.departments,null,'নতুন বিভাগ')}</select>
      <label class="block text-xs">নাম<input id="directory-department-name" required minlength="3" class="${inputClass}"></label>
      <label class="block text-xs">উৎস/যাচাইয়ের প্রমাণ<textarea id="directory-department-source" required minlength="10" class="${inputClass}"></textarea></label>
      <label class="block text-xs">যাচাই<select id="directory-department-verification" class="${inputClass}"><option>UNVERIFIED</option><option>DEMO</option><option>VERIFIED</option></select></label>
      <label class="text-xs"><input id="directory-department-active" type="checkbox" checked> সক্রিয়</label><button class="${buttonClass}">সংরক্ষণ</button></form>
    <form id="directory-person-form" class="space-y-2" onsubmit="saveDirectoryEntry(event,'person')"><h4 class="font-bold text-sm">কর্মকর্তা যোগ/সম্পাদনা</h4>
      <select id="directory-person-edit" onchange="editDirectoryEntry('person',this.value)" class="${inputClass}">${actionOptions(actionDirectory.officers,null,'নতুন কর্মকর্তা')}</select>
      <label class="block text-xs">নাম<input id="directory-person-name" required minlength="3" class="${inputClass}"></label>
      <label class="block text-xs">পদবি<input id="directory-person-title" required minlength="3" class="${inputClass}"></label>
      <label class="block text-xs">ওয়ার্ড<select id="directory-person-ward" class="${inputClass}">${actionOptions(actionDirectory.wards,null,'ওয়ার্ড প্রযোজ্য নয়')}</select></label>
      <label class="block text-xs">বিভাগ<select id="directory-person-department" required class="${inputClass}">${actionOptions(actionDirectory.departments.filter(d=>d.active),null,'বিভাগ নির্বাচন করুন')}</select></label>
      <label class="block text-xs">যাচাই<select id="directory-person-verification" class="${inputClass}"><option>UNVERIFIED</option><option>DEMO</option><option>VERIFIED</option></select></label>
      <label class="block text-xs">বৈধ উৎস/যাচাইয়ের প্রমাণ<textarea id="directory-person-source" required minlength="10" class="${inputClass}"></textarea></label>
      <label class="block text-xs">প্রদত্ত যোগাযোগ (ঐচ্ছিক; DEMO-তে নয়)<input id="directory-person-contact" class="${inputClass}"></label>
      <label class="text-xs"><input id="directory-person-active" type="checkbox" checked> সক্রিয়</label><button class="${buttonClass}">সংরক্ষণ</button></form>
    </div><p id="directory-save-message" class="text-xs mt-2" role="status"></p>`;
  if(actionDirectory.readOnly){document.getElementById('action-directory-editor').querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=true);document.getElementById('directory-save-message').textContent='Read-only demo directory';}
}
function editDirectoryEntry(type,id) {
  const row=(type==='department'?actionDirectory.departments:actionDirectory.officers).find(r=>r.id===id), prefix=`directory-${type}`;
  document.getElementById(`${prefix}-name`).value=row?.displayName || ''; document.getElementById(`${prefix}-source`).value=row?.source || '';
  document.getElementById(`${prefix}-active`).checked=row?.active ?? true; document.getElementById(`${prefix}-verification`).value=row?.verificationStatus || 'UNVERIFIED';
  if(type==='person'){document.getElementById(`${prefix}-title`).value=row?.title || '';document.getElementById(`${prefix}-ward`).value=row?.wardId || '';document.getElementById(`${prefix}-department`).value=row?.departmentId || '';document.getElementById(`${prefix}-contact`).value=row?.contact || '';}
}
async function saveDirectoryEntry(event,type) {
  event.preventDefault(); const form=event.target, button=form.querySelector('button'), message=document.getElementById('directory-save-message'); button.disabled=true;
  try {
    const prefix=`directory-${type}`,val=key=>document.getElementById(`${prefix}-${key}`).value.trim(),id=val('edit');
    const body={displayName:val('name'),source:val('source'),active:document.getElementById(`${prefix}-active`).checked,verificationStatus:val('verification')};
    if(type==='person')Object.assign(body,{title:val('title'),wardId:val('ward')||null,departmentId:val('department'),contact:val('contact')||null});
    await actionApi(`/${type==='department'?'departments':'officers'}${id?'/'+encodeURIComponent(id):''}`,body,id?'PATCH':'POST');
    actionDirectory=null;await ensureActionDirectory();renderDirectoryEditor();renderActionFilters();await loadActionDashboard();
    document.getElementById('directory-save-message').textContent='ডিরেক্টরি সংরক্ষিত হয়েছে।';
  }catch(error){message.textContent=error.message;}finally{if(button.isConnected)button.disabled=false;}
}
