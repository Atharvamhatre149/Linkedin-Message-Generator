import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMessage, generateConnectionNote, connectionNoteMeta, RESUME_URL } from '../src/messages.js';
const params = { company: 'Amazon', position: 'Backend Engineer', contactName: 'Priya', jobId: '123', jobLink: 'https://amazon.jobs/jobs/123' };

test('all audiences and tones use the updated resume and personal greeting', () => {
  assert.match(RESUME_URL, /1eXCID_ci0ZdCDhY3jv9mKl8-eye1Lw_U/);
  for (const msgType of ['referral', 'recruiter', 'generic-hr', 'generic-employee']) {
    for (const tone of ['standard', 'short', 'follow-up']) {
      const message = generateMessage({ ...params, msgType, tone });
      assert.ok(message.startsWith('Hi Priya,'));
      assert.ok(message.includes(RESUME_URL));
      assert.doesNotMatch(message, /10M\+|Web Application Developer 2|atharvamhatre149@gmail/);
      if (tone !== 'follow-up') assert.match(message, /Backend Software Engineer/);
      if (tone === 'follow-up') assert.match(message, /following up/i);
    }
  }
});
test('focus uses verified achievements and overrides the resume link', () => {
  const message = generateMessage({ ...params, msgType: 'recruiter', focus: 'search', resumeUrl: 'https://example.com/resume' });
  assert.match(message, /Redis Vector Search/);
  assert.match(message, /40%/);
  assert.match(message, /https:\/\/example.com\/resume/);
  assert.ok(!message.includes(RESUME_URL));
});
test('standard backend intro describes platform scale without inflating ownership', () => {
  const message = generateMessage({ ...params, msgType: 'recruiter' });
  assert.match(message, /100M\+/);
  assert.match(message, /atharvamhatre1492@gmail.com/);
  assert.match(message, /Job ID: 123/);
});
test('connection notes respect selected limits even with long unicode names', () => {
  for (const limit of [200, 300]) {
    const note = generateConnectionNote({ company: 'Amazon'.repeat(70), position: 'Engineer'.repeat(80), contactName: 'Priya', limit });
    assert.ok(note.length <= limit);
    assert.equal(connectionNoteMeta(note, limit).limit, limit);
  }
});

test('email drafts provide a subject and safely encoded mailto body', async () => {
  const { emailSubject, buildMailtoUrl } = await import('../src/email.js');
  const subject=emailSubject({company:'Amazon',position:'Backend Engineer',msgType:'referral'});
  const url=buildMailtoUrl({to:'recruiter@example.com',subject,message:'Hi & hello\nResume: https://example.com/a?x=1&y=2'});
  assert.equal(new URL(url).searchParams.get('body'),'Hi & hello\nResume: https://example.com/a?x=1&y=2');
  assert.match(subject,/Amazon/);
  assert.throws(()=>buildMailtoUrl({to:'victim@example.com?bcc=other@example.com',subject,message:'test'}),/email/i);
});
