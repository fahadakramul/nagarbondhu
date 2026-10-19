// Citizen navigation and public, privacy-safe discovery.
(function(){
  const home=document.getElementById('section-home');
  const sidebar=document.getElementById('civic-sidebar');
  const toggle=document.createElement('button');
  toggle.id='sidebar-collapse';toggle.type='button';toggle.setAttribute('aria-controls','civic-sidebar');
  const collapsed=()=>document.body.classList.contains('sidebar-collapsed');
  function setSidebar(value){document.body.classList.toggle('sidebar-collapsed',value);toggle.setAttribute('aria-expanded',String(!value));toggle.textContent=value?'☰ বিভাগ খুলুন':'⇤ বিভাগ লুকান';try{localStorage.setItem('nagarbondhu-sidebar-collapsed',String(value));}catch{}}
  toggle.onclick=()=>setSidebar(!collapsed());
  document.body.insertBefore(toggle,document.querySelector('main'));
  try{setSidebar(localStorage.getItem('nagarbondhu-sidebar-collapsed')==='true');}catch{setSidebar(false);}

  // The citizen corner links to the separate planner studio instead of embedding its dashboard.
  for(const button of home.querySelectorAll('[onclick="switchTab(\'dashboard\')"]'))button.remove();
  const directory=home.querySelector('.home-directory');
  directory?.querySelectorAll('button').forEach(button=>{if(/প্ল্যানিং ড্যাশবোর্ড|বিকল্প পরিকল্পনা|মূল কারণ|রিপোর্টিং কভারেজ|ফিল্ড পরিদর্শন/.test(button.textContent))button.remove();});

  const ticker=document.createElement('section');ticker.className='civic-notice';ticker.setAttribute('aria-label','সরকারি নোটিশের উৎস');
  ticker.innerHTML='<strong>📢 নগর বিজ্ঞপ্তি</strong><div class="civic-notice-window"><div class="civic-notice-track"><span>রাজশাহী সিটি কর্পোরেশনের যাচাইকৃত নোটিশ ও নাগরিক পরামর্শ অফিসিয়াল পোর্টালে দেখুন। নগরবন্ধু কোনো নোটিশ জারি করে না।</span><span aria-hidden="true">রাজশাহী সিটি কর্পোরেশনের যাচাইকৃত নোটিশ ও নাগরিক পরামর্শ অফিসিয়াল পোর্টালে দেখুন।</span></div></div><a href="https://erajshahi.portal.gov.bd/" target="_blank" rel="noopener noreferrer">অফিসিয়াল নোটিশ ↗</a>';
  home.querySelector('.task-actions')?.after(ticker);
  async function loadOfficialNotices(){try{
    const response=await fetch('/api/v1/city-notices',{signal:AbortSignal.timeout(10000)});const data=await response.json();if(!response.ok||!data.available||!Array.isArray(data.notices))return;
    const track=ticker.querySelector('.civic-notice-track');track.replaceChildren();
    for(let copy=0;copy<2;copy++)for(const notice of data.notices){
      if(!/^https:\/\/erajshahi\.portal\.gov\.bd\/pages\/notices\//.test(notice.url))continue;
      const a=document.createElement('a');a.href=notice.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=notice.title+(notice.date?' · '+notice.date:'');if(copy)a.setAttribute('aria-hidden','true');track.appendChild(a);
    }
    if(track.children.length){ticker.querySelector('strong').textContent='📢 রাসিকের নোটিশ';const sourceLink=ticker.querySelector(':scope > a');sourceLink.textContent='সব নোটিশ ↗';sourceLink.href='https://erajshahi.portal.gov.bd/pages/notices';}
  }catch{/* Keep the attributed source link when the official portal is unavailable. */}}
  loadOfficialNotices();
  const links=document.createElement('section');links.className='civic-links';links.innerHTML='<div><p>নাগরিক কর্নার</p><h3>জরুরি সরকারি ওয়েবসাইট</h3><small>লিংকগুলো সরকারি সাইটে খুলবে। নগরবন্ধু ওই সেবাগুলোর লগইন বা তথ্য সংগ্রহ করে না।</small></div><div class="civic-links-grid"></div>';
  const destinations=[['রাজশাহী সিটি কর্পোরেশন','https://erajshahi.portal.gov.bd/'],['জাতীয় তথ্য বাতায়ন','https://bangladesh.gov.bd/'],['সরকারি অভিযোগ প্রতিকার','https://www.grs.gov.bd/'],['জন্ম ও মৃত্যু নিবন্ধন','https://www.bdris.gov.bd/'],['ই-পাসপোর্ট','https://www.epassport.gov.bd/'],['সরকারি তথ্যসেবা ৩৩৩','https://333.gov.bd/']];
  for(const [label,url] of destinations){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label+' ↗';links.querySelector('.civic-links-grid').appendChild(a);}
  home.querySelector('.city-environment')?.after(links);

  // Voice is the first reporting action; a transcription stays editable before submission.
  const voice=document.getElementById('voice-input-card'),description=document.getElementById('form-description');
  if(voice&&description){const field=description.closest('div');field.before(voice);voice.insertAdjacentHTML('afterbegin','<h3>প্রথমে বলে জানান</h3><p>কণ্ঠ থেকে লেখা তৈরি হবে। এরপর লেখা ঠিক করুন; সমস্যার ধরন AI বিশ্লেষণ করতে পারে। চাইলে সরাসরি লিখেও জানান।</p>');field.querySelector('label').textContent='অথবা সমস্যাটি লিখুন * (বাংলা বা ইংরেজি)';}
  const category=document.getElementById('citizen-category');if(category){category.querySelector('option[value=""]').textContent='AI দেখে সম্ভাব্য ধরন বলবে';}

  const originalOpen=openDetailModal,originalClose=closeDetailModal;
  let beforeReport='/reports';
  openDetailModal=async function(id){
    if(!location.pathname.startsWith('/reports/'))beforeReport=location.pathname;
    await originalOpen(id);
    if(selectedReport?.id===id&&!document.getElementById('report-modal').classList.contains('hidden')){
      const path='/reports/'+encodeURIComponent(id);
      if(location.pathname!==path&&!window.__civicRestoringRoute)history.pushState(null,'',path);
      let share=document.getElementById('report-share');
      if(!share){share=document.createElement('button');share.id='report-share';share.type='button';share.textContent='রিপোর্টের লিংক কপি করুন';share.onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/reports/'+encodeURIComponent(selectedReport.id));share.textContent='লিংক কপি হয়েছে';}catch{share.textContent=location.origin+'/reports/'+encodeURIComponent(selectedReport.id);}};document.getElementById('modal-title').after(share);}
      share.textContent='রিপোর্টের লিংক কপি করুন';
    }
  };
  closeDetailModal=function(){originalClose();if(location.pathname.startsWith('/reports/'))history.replaceState(null,'',beforeReport);};
  window.__civicHandlePopState=()=>{
    const match=location.pathname.match(/^\/reports\/([^/]+)$/);
    if(match){let id;try{id=decodeURIComponent(match[1]);}catch{return;}openDetailModal(id);}
    else if(!document.getElementById('report-modal').classList.contains('hidden'))originalClose();
    window.__civicRestoreAssistantRoute?.();
  };

  const community=document.getElementById('community-list'),status=document.getElementById('community-status');
  let request=0;
  const demoList=document.getElementById('community-demo-list'),demoStatus=document.getElementById('community-demo-status');
  let demoRequest=0;
  function renderDiscussion(post){
    const article=document.createElement('article');article.className='community-post community-demo-post';
    const heading=document.createElement('div');heading.className='community-post-head';const badge=document.createElement('span');badge.textContent='নমুনা · '+post.topic;heading.appendChild(badge);
    const title=document.createElement('h3');title.textContent=post.title;const body=document.createElement('p');body.textContent=post.body;
    const actions=document.createElement('div');actions.className='community-discussion-actions';
    const like=document.createElement('button');like.type='button';like.textContent=(post.likedByMe?'✓ লাইক দিয়েছেন':'♡ লাইক')+' · '+bn(post.likeCount);like.disabled=post.likedByMe;
    like.onclick=async()=>{like.disabled=true;try{const {data}=await platformApi('/community/posts/'+encodeURIComponent(post.id)+'/like',{deviceId:civicDevice()});post={...post,...data};like.textContent='✓ লাইক দিয়েছেন · '+bn(post.likeCount);}catch(error){like.disabled=false;demoStatus.textContent=error.message;}};
    const comments=document.createElement('div');comments.className='community-comments';const commentTitle=document.createElement('strong');commentTitle.textContent='মন্তব্য · '+bn(post.commentCount);comments.appendChild(commentTitle);
    const commentList=document.createElement('div');commentList.className='community-comment-list';
    function showComments(){commentList.replaceChildren();for(const comment of post.comments){const item=document.createElement('p');item.textContent=comment.text;commentList.appendChild(item);}commentTitle.textContent='মন্তব্য · '+bn(post.commentCount);}
    showComments();comments.appendChild(commentList);
    const form=document.createElement('form');form.className='community-comment-form';const field=document.createElement('input');field.type='text';field.maxLength=500;field.minLength=3;field.required=true;field.setAttribute('aria-label','মন্তব্য লিখুন');field.placeholder='আপনার মতামত লিখুন (নাম বা ফোন নম্বর নয়)';const submit=document.createElement('button');submit.type='submit';submit.textContent='মন্তব্য করুন';form.append(field,submit);
    form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;try{const {data}=await platformApi('/community/posts/'+encodeURIComponent(post.id)+'/comments',{deviceId:civicDevice(),text:field.value.trim()});post={...post,...data};field.value='';showComments();demoStatus.textContent='মন্তব্য প্রকাশিত হয়েছে।';}catch(error){demoStatus.textContent=error.message;}finally{submit.disabled=false;}};
    actions.appendChild(like);comments.appendChild(form);article.append(heading,title,body,actions,comments);return article;
  }
  async function loadDemoDiscussions(){const sequence=++demoRequest;demoStatus.textContent='নমুনা আলোচনা লোড হচ্ছে…';demoList.replaceChildren();try{const response=await fetch('/api/v1/community/posts',{headers:{'X-Civic-Device':civicDevice()},signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'আলোচনা পাওয়া যায়নি');if(sequence!==demoRequest)return;for(const post of result.data)demoList.appendChild(renderDiscussion(post));demoStatus.textContent='নমুনা আলোচনা · '+bn(result.data.length)+'টি';}catch(error){if(sequence===demoRequest)demoStatus.textContent='নমুনা আলোচনা লোড হয়নি: '+error.message;}}
  async function loadCommunity(){const sequence=++request;status.textContent='নাগরিক রিপোর্ট লোড হচ্ছে…';community.replaceChildren();try{
    const response=await fetch('/api/v1/reports?source=citizen_report&limit=30&offset=0',{signal:AbortSignal.timeout(30000)});const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'ফিড পাওয়া যায়নি');if(sequence!==request)return;
    status.textContent=result.reports.length?'প্রকাশ্য নাগরিক রিপোর্ট · সর্বশেষ '+result.reports.length+'টি':'এখনও প্রকাশ্য নাগরিক রিপোর্ট নেই।';
    for(const report of result.reports){const article=document.createElement('article');article.className='community-post';const heading=document.createElement('div');heading.className='community-post-head';heading.innerHTML='<span>নাগরিক রিপোর্ট</span><time></time>';heading.querySelector('time').dateTime=report.createdAt;heading.querySelector('time').textContent=new Date(report.createdAt).toLocaleDateString('bn-BD');const title=document.createElement('h3');title.textContent=report.title;const description=document.createElement('p');description.textContent=report.description;const meta=document.createElement('p');meta.className='community-meta';meta.textContent=(report.addressLabel||'রাজশাহী')+' · '+(ACTION_LABELS[report.actionStatus||report.status]||'অবস্থা অজানা');const action=document.createElement('button');action.type='button';action.textContent='বিস্তারিত ও অগ্রগতি দেখুন';action.onclick=()=>openDetailModal(report.id);article.append(heading,title,description,meta,action);if(typeof affirmButton==='function')article.appendChild(affirmButton(report));community.appendChild(article);}
  }catch(error){if(sequence===request)status.textContent='ফিড লোড হয়নি: '+error.message;}};
  document.getElementById('community-refresh').onclick=()=>{loadDemoDiscussions();loadCommunity();};
  const previousSwitch=switchTab;switchTab=function(tab){previousSwitch(tab);if(tab==='community'){loadDemoDiscussions();loadCommunity();}};
  document.addEventListener('DOMContentLoaded',()=>{
    if(currentTab==='community'){loadDemoDiscussions();loadCommunity();}
    const match=location.pathname.match(/^\/reports\/([^/]+)$/);
    if(match){let id;try{id=decodeURIComponent(match[1]);}catch{return;}beforeReport='/reports';openDetailModal(id);}
  });
})();
