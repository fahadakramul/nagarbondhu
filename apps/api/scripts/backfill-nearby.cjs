// Uses an existing, normally authenticated operator session token.
// Never prints credentials. Does not write SQL out of band: every enrichment goes through the live API.
const base=process.env.NAGARBONDHU_BASE_URL||'https://nagarbondhu-api.onrender.com';
async function main(){
  let token=process.env.NAGARBONDHU_OPERATOR_TOKEN;
  if(!token)throw new Error('An existing operator session token is required.');
  let offset=0,total=0,unavailable=[];
  do{
    const response=await fetch(base+'/api/v1/admin/backfill-nearby',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({source:'demo_seed',offset,limit:3}),signal:AbortSignal.timeout(45000)});
    const body=await response.json();if(!response.ok||!body.success)throw new Error('Backfill failed: '+(body.error||response.status));
    offset=body.data.nextOffset;total=body.data.total;unavailable.push(...body.data.results.filter(r=>r.unavailable).map(r=>r.id));
    console.log(JSON.stringify({processed:offset,total,results:body.data.results}));
    if(body.data.done)break;
  }while(offset<total);
  console.log(JSON.stringify({complete:true,total,unavailable,source:'demo_seed'}));
}
main().catch(()=>{console.error('Backfill could not complete with the current operator access or provider availability. Verify the live deployment and provide an existing operator session token through NAGARBONDHU_OPERATOR_TOKEN. No credentials printed.');process.exitCode=1;});
