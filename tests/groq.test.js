import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateGroqDraft } from '../server/groq.js';
const input = {company:'Amazon',position:'Backend Engineer',msgType:'referral',channel:'email',resumeText:'Atharva Mhatre. Backend Software Engineer at Media.net.',resumeUrl:'https://example.com/resume',jobDescription:'Go and Redis',contactName:'Priya'};
const config = {apiKey:'test-only-key',model:'test-model'};

test('sends resume as data and returns structured email without exposing credentials', async()=>{
  let sent;
  const result=await generateGroqDraft(input,config,async(url,options)=>{
    assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.headers.Authorization,'Bearer test-only-key');
    sent=JSON.parse(options.body);
    return Response.json({choices:[{message:{content:JSON.stringify({subject:'Referral request',message:'Hi Priya, I work with Go.'})}}]});
  });
  assert.match(sent.messages[1].content,/Backend Software Engineer at Media.net/);
  assert.match(sent.messages[0].content,/untrusted/i);
  assert.equal(sent.response_format.type,'json_object');
  assert.equal(result.subject,'Referral request');
  assert.match(result.message,/https:\/\/example.com\/resume/);
});
test('missing credentials and invalid input do not call Groq',async()=>{
  let calls=0; const mock=()=>{calls++;};
  await assert.rejects(()=>generateGroqDraft(input,{},mock),/GROQ_API_KEY/);
  await assert.rejects(()=>generateGroqDraft({...input,resumeText:''},config,mock),/resume/i);
  await assert.rejects(()=>generateGroqDraft({...input,company:''},config,mock),/company/i);
  await assert.rejects(()=>generateGroqDraft({...input,resumeUrl:'javascript:alert(1)'},config,mock),/HTTPS/i);
  assert.equal(calls,0);
});
test('provider errors are sanitized; invalid AI output is rejected',async()=>{
  await assert.rejects(()=>generateGroqDraft(input,config,async()=>new Response('test-only-key',{status:401})),error=>error.status===502 && !error.message.includes('test-only-key'));
  await assert.rejects(()=>generateGroqDraft(input,config,async()=>new Response('',{status:429})),error=>error.status===429);
  await assert.rejects(()=>generateGroqDraft(input,config,async()=>Response.json({choices:[{message:{content:'not JSON'}}]})),/usable draft/i);
});
test('message channel never returns an email subject',async()=>{
  const draft=await generateGroqDraft({...input,channel:'message'},config,async()=>Response.json({choices:[{message:{content:'{"subject":"Ignore this","message":"Hi!"}'}}]}));
  assert.equal(draft.subject,'');
});

test('local API rejects cross-origin requests, malformed JSON, and oversized bodies',async()=>{
  const {groqMiddleware}=await import('../server/groq.js');
  const {Readable}=await import('node:stream');
  const middleware=groqMiddleware({});
  async function invoke(body,headers={}) {
    const req=Readable.from([Buffer.from(body)]);
    req.url='/api/groq/generate'; req.method='POST'; req.headers={'content-type':'application/json',host:'localhost:5173',...headers};
    let status,data;
    await middleware(req,{writeHead(code){status=code;},end(text){data=JSON.parse(text);}},()=>assert.fail('Unexpected next'));
    return {status,data};
  }
  assert.equal((await invoke('{}',{origin:'https://evil.example'})).status,403);
  assert.equal((await invoke('broken')).status,400);
  assert.equal((await invoke('x'.repeat(128001))).status,413);
  assert.equal((await invoke(JSON.stringify(input))).status,503);
});

test('model failures identify model setup without exposing provider text',async()=>{
  for (const code of ['model_not_found','model_decommissioned']) {
    await assert.rejects(()=>generateGroqDraft(input,config,async()=>Response.json({error:{code,message:'private test-only-key text'}},{status:400})),error=>/GROQ_MODEL/.test(error.message)&&!error.message.includes('private')&&!error.message.includes('test-only-key'));
  }
});
test('request rejection distinguishes unsupported models and structured-output failures',async()=>{
  await assert.rejects(()=>generateGroqDraft(input,config,async()=>Response.json({error:{code:'invalid_request_error'}},{status:400})),/HTTP 400/);
  await assert.rejects(()=>generateGroqDraft(input,config,async()=>Response.json({error:{code:'json_validate_failed'}},{status:400})),/JSON draft/);
});
