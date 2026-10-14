// Public civic tools. Every number is derived from stored reports or a labelled live API.
const bn=value=>Number(value).toLocaleString('bn-BD');
const civicLabels={education:'🏫 শিক্ষাপ্রতিষ্ঠান',health:'🏥 স্বাস্থ্যসেবা',market:'🛒 বাজার',transport:'🚌 পরিবহন',worship:'🕌 উপাসনালয়'};
function nearbyHtml(data){
  const groups=Object.entries(data?.groups||{}).filter(([,g])=>g.count);
  return `<h4 class="font-bold">আশেপাশে কারা ঝুঁকিতে</h4><p class="text-xs my-2">২০০ মিটারের মধ্যে • +${bn(data?.bonus||0)} স্কোর</p><div class="flex flex-wrap gap-2">${groups.map(([key,g])=>`<span class="bg-teal-100 text-teal-900 rounded-lg p-2 text-xs">${civicLabels[key]} ${bn(g.count)}টি • নিকটতম ${bn(g.items[0]?.distanceMeters||0)} মি</span>`).join('')}</div>${groups.length?'':`<p class="text-xs">${!data||data.unavailable?'তথ্য আনা যায়নি, পরে আবার চেষ্টা হবে':'OSM-এ ২০০ মিটারের মধ্যে কোনো চিহ্নিত স্থাপনা পাওয়া যায়নি'}</p>`}<p class="text-xs mt-2">© OpenStreetMap contributors • মানচিত্রে চিহ্নিত তথ্য; সম্পূর্ণ তালিকা নয়।</p>`;
}
let sensitiveLayer=null;
function drawSensitivePlaces(report){
  if(!mainMap||typeof L==='undefined')return;
  if(sensitiveLayer)mainMap.removeLayer(sensitiveLayer);sensitiveLayer=L.layerGroup().addTo(mainMap);
  L.circle([report.latitude,report.longitude],{radius:200,color:'#0F766E',weight:2,fillOpacity:0.08}).addTo(sensitiveLayer);
  for(const [key,g] of Object.entries(report.nearbySensitive?.groups||{}))for(const item of g.items){const marker=L.circleMarker([item.latitude,item.longitude],{radius:6,color:'#0F766E'}).addTo(sensitiveLayer);const label=document.createElement('span');label.textContent=civicLabels[key]+' • '+item.name+' • '+bn(item.distanceMeters)+' মি';marker.bindPopup(label);}
}
const featureOpenDetail=openDetailModal;
openDetailModal=async function(id){await featureOpenDetail(id);if(selectedReport?.id!==id)return;document.getElementById('nearby-detail')?.remove();const section=document.createElement('section');section.id='nearby-detail';section.className='bg-teal-50 rounded-xl p-3 space-y-2';section.innerHTML=nearbyHtml(selectedReport.nearbySensitive);document.getElementById('public-tracking').appendChild(section);drawSensitivePlaces(selectedReport);};
if(typeof selectTwinReport==='function'){const previous=selectTwinReport;selectTwinReport=async function(id){await previous(id);try{const {report}=await platformApi('/reports/'+encodeURIComponent(id));drawSensitivePlaces(report);}catch{}};}
