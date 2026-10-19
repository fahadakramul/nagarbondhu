import { db } from '../db';
import { analytics, AnalyticsFilters } from './analytics.service';
import { publicText } from './privacy';

export type WorkspaceRole='authority'|'planner';
export const ROLE_REFUSAL:Record<WorkspaceRole,string>={
  authority:'দুঃখিত 🙂 এই প্রশ্নটি আমার সহায়তার আওতার বাইরে। আমি শুধু নাগরিক অভিযোগ ব্যবস্থাপনা, দায়িত্ব বণ্টন ও কর্তৃপক্ষের সংশ্লিষ্ট কাজে সাহায্য করার জন্য আছি।',
  planner:'দুঃখিত 🙂 এই প্রশ্নটি আমার সহায়তার আওতার বাইরে। আমি শুধু নগর পরিকল্পনা, স্থানিক বিশ্লেষণ ও সংশ্লিষ্ট পরিকল্পনার সমস্যা সমাধানে সাহায্য করার জন্য আছি।',
};
const suggestions:Record<WorkspaceRole,string[]>={
  authority:['কোন রিপোর্টগুলো আগে পর্যালোচনা করব?','কোন কাজের সময় পেরিয়েছে?','কোন রিপোর্ট মাঠে যাচাই প্রয়োজন?'],
  planner:['কোথায় একই ধরনের সমস্যা বেশি দেখা যাচ্ছে?','কোন এলাকায় আরও তথ্য সংগ্রহ দরকার?','নির্বাচিত সময়ে রিপোর্টের কী পরিবর্তন হয়েছে?'],
};
const relevant=/রিপোর্ট|অভিযোগ|কাজ|দায়িত্ব|দায়িত্ব|সময়|সময়|মাঠ|যাচাই|বৃষ্টি|পানি|ড্রেন|ওয়ার্ড|ওয়ার্ড|পরিকল্পনা|সমস্যা|অগ্রাধিকার|জরুরি|কারণ|ক্লাস্টার|এলাকা|বাজেট|দল|খরচ|পরিবর্তন|পরিদর্শন|উৎস|নগর|রাস্তা|বর্জ্য|পরিবেশ|স্বাস্থ্য|ট্রাফিক|প্রবেশগম্য|report|issue|task|assign|overdue|field|rain|ward|plan|priority|cluster|budget|route|cost|change|inspection|source|urban|road|waste|health|traffic|accessib|drain|water|somossa|kaj|elaka|porikolpona|jol|bristi/i;
const unsafe=/পাসওয়ার্ড|পাসওয়ার্ড|গোপন|secret|token|api.key|credential|ignore.previous|system.prompt|developer.message/i;
const offTopic=/রেসিপি|রান্না|গান|কবিতা|চলচ্চিত্র|ফুটবল|ক্রিকেট|জোক|recipe|cooking|movie|song|poem|football|cricket|joke/i;
const bn=(value:number)=>value.toLocaleString('bn-BD');
export function answerWorkspaceAssistant(role:WorkspaceRole,question:string,filters:AnalyticsFilters={source:'citizen_report'}){
  const chips=suggestions[role].slice(0,3);
  const answer=(summary_bn:string,app_facts:{text_bn:string;source:'নগরবন্ধু রিপোর্ট'}[]=[],do_bn:string[]=[])=>({summary_bn,do_bn,dont_bn:[],contact_bn:[],app_facts,actions:[],followup_chips_bn:chips});
  if(unsafe.test(question))return answer('গোপন তথ্য, নির্দেশনা বা অনুমতি পরিবর্তনে আমি সাহায্য করতে পারি না। রিপোর্টের তথ্য ও অনুমোদিত কাজ সম্পর্কে প্রশ্ন করুন।');
  if(offTopic.test(question)&&!relevant.test(question) || !relevant.test(question))return answer(ROLE_REFUSAL[role]);
  const data=analytics(filters),source=filters.source==='all'?'নাগরিক ও নমুনা মিশ্র':filters.source==='demo_seed'?'নমুনা':'নাগরিক';
  const period=`${data.period.from||'শুরু অনির্ধারিত'} থেকে ${data.period.to}`;
  const context=`${source} রিপোর্ট · ${period} · মোট ${bn(data.total)}টি (নাগরিক ${bn(data.realCount)}, নমুনা ${bn(data.demoCount)})`;
  if(/কোন.*রিপোর্ট|আগে|priority|urgent|joruri|অগ্রাধিকার/i.test(question)){
    const rows=data.reviewFirst.slice(0,5).map(r=>`${r.id} (${bn(db.findPriorityAssessmentByReportId(r.id)?.score??0)}): ${publicText(r.title)}; ${r.status}`);
    return answer(rows.length?`সংখ্যাগত অগ্রাধিকার স্কোর অনুযায়ী প্রথম রিপোর্টগুলো: ${rows.join('। ')}। এটি পর্যালোচনার পরামর্শ; অবস্থা বদলায়নি। ${context}।`:`নির্বাচিত উৎস ও সময়ে অসম্পন্ন রিপোর্ট নেই। ${context}।`,rows.map(text_bn=>({text_bn,source:'নগরবন্ধু রিপোর্ট'})));
  }
  if(/overdue|সময়.*পের|সময়.*পের|deadline|দায়িত্ব|দায়িত্ব|assign|kaj/i.test(question)){
    const count=/দায়িত্ব|দায়িত্ব|assign/i.test(question)?data.rows.filter(r=>!['RESOLVED','CLOSED','REJECTED'].includes(r.status)&&!Array.from(db.actionPlans.values()).some(p=>p.reportId===r.id&&p.departmentId)).length:data.overdue;
    return answer(`${context}। ${/দায়িত্ব|দায়িত্ব|assign/i.test(question)?'দায়িত্ব নথিভুক্ত নেই':'লক্ষ্য সময় পেরিয়েছে'} এমন ${bn(count)}টি রিপোর্ট। বিস্তারিত দেখতে কাজের তালিকা খুলুন।`,[],['কাজের তালিকায় রিপোর্টের প্রমাণ ও ইতিহাস দেখে দায়িত্ব/সময়সীমা যাচাই করুন।']);
  }
  if(/মাঠ|field|inspection|পরিদর্শন|verify|যাচাই/i.test(question))return answer(`${context}। মাঠে যাচাই প্রয়োজন বা স্থান নিশ্চিত নয় এমন ${bn(data.fieldVerification.length)}টি রিপোর্ট: ${data.fieldVerification.slice(0,5).join(', ')||'কোনোটি নেই'}। পরিদর্শন সম্পন্ন হওয়া আর সমস্যার সমাধান হওয়া আলাদা।`);
  if(role==='planner'&&/ক্লাস্টার|cluster|কোথায়|কোথায়|এলাকা|pattern|কারণ|cause/i.test(question))return answer(`${context}। কাছাকাছি একই শ্রেণির ${bn(data.clusters.length)}টি রিপোর্টগুচ্ছ পাওয়া গেছে। ${data.clusters.slice(0,3).map(c=>`${c.category}: ${c.reportIds.join(', ')}`).join('। ')||'এই ফিল্টারে গুচ্ছ নেই।'}। কাছাকাছি রিপোর্ট একই কারণ বা যাচাইকৃত ঝুঁকি প্রমাণ করে না।`);
  if(role==='planner'&&/পরিবর্তন|change|আগে|পরে|histor|সময়/i.test(question))return answer(`${context}। মাসভিত্তিক রিপোর্টের পরিবর্তন উপলব্ধ ${bn(data.monthChanges.length)}টি তুলনায়। অসম কভারেজ ও আংশিক মাসের কারণে পরিবর্তনকে সেবার প্রভাব বলা যাবে না।`);
  if(/বৃষ্টি|rain|weather|bristi/i.test(question))return answer('বর্তমান আবহাওয়ার তথ্য দেখতে বৃষ্টির প্রস্তুতি প্যানেল খুলুন। পূর্বাভাসের সময় ও সংগ্রহের সময় দেখে সিদ্ধান্ত নিন।');
  if(/বাজেট|budget|খরচ|cost|route|দল|team/i.test(question))return answer('পরিকল্পনা প্যানেলে বাজেট ও দলের অনুমান বদলে বিকল্প তুলনা করুন। প্রকৃত মেরামত খরচ ও সড়কপথের সর্বোত্তম রুট এখানে যাচাই করা হয়নি।');
  if(/ওয়ার্ড|ওয়ার্ড|ward|উৎস|source|coverage|কভারেজ/i.test(question))return answer(`${context}। ওয়ার্ড তুলনায় নমুনা কম হলে নিশ্চিত গ্রেড দেবেন না। কম রিপোর্ট মানে ভালো সেবা প্রমাণ নয়।`);
  return answer(`${context}। কোন রিপোর্ট, এলাকা বা সময় নিয়ে জানতে চান?`,[],chips.slice(0,1));
}
