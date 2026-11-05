export function emailSubject({ company, position, msgType }) {
  const action = ['referral', 'generic-employee'].includes(msgType) ? 'Referral request' : 'Interest';
  return `${action}: ${position || 'Software engineering opportunities'} at ${company}`.replace(/[\r\n]/g, ' ');
}

export function buildMailtoUrl({ to = '', subject = '', message = '' }) {
  const recipient = to.trim();
  if (recipient && !/^[A-Za-z0-9.!#$%&'*+/=_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(recipient)) throw new Error('Enter a valid recipient email address.');
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject.replace(/[\r\n]/g, ' '))}&body=${encodeURIComponent(message)}`;
}
