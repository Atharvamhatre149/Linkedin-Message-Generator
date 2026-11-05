import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareGroqGeneration} from '../src/drafts.js';
import {validateInput} from '../server/groq.js';
const link='https://salesforce.wd12.myworkdayjobs.com/en-US/External_Career_Site/job/Full-Stack-Developer---AI-Native-Engineering_JR359537';
const form={company:'Salesforce',position:'Full Stack Developer',msgType:'referral',channel:'message',jobLink:link,jobDescription:'Go and AI',contactName:'Priya'};

test('correcting a link after templates sends current values and refreshes templates',()=>{
  const old={...form,jobLink:'invalid old link',resumeUrl:'https://example.com/old',resumeText:'old resume'};
  let refreshed;
  const payload=prepareGroqGeneration(form,'https://example.com/new','Updated resume text',old,snapshot=>{refreshed=snapshot;});
  assert.equal(payload.jobLink,link);
  assert.equal(payload.resumeText,'Updated resume text');
  assert.equal(payload.resumeUrl,'https://example.com/new');
  assert.deepEqual(refreshed,payload);
  assert.equal(old.jobLink,'invalid old link');
  assert.equal(validateInput(payload).jobLink,link);
});
test('unchanged inputs preserve edited templates when regenerating Groq',()=>{
  const snapshot={...form,resumeUrl:'https://example.com/resume',resumeText:'Resume text'};
  let refreshes=0;
  const result=prepareGroqGeneration(form,snapshot.resumeUrl,snapshot.resumeText,snapshot,()=>refreshes++);
  assert.deepEqual(result,snapshot);
  assert.equal(refreshes,0);
});
