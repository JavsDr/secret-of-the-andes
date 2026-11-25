(() => {
  const panel = document.getElementById('enquiry-builder');
  const month = document.getElementById('month');
  const pace = document.getElementById('pace');
  const question = document.getElementById('question');
  const draft = document.getElementById('email-draft');
  const copy = document.getElementById('copy-enquiry');
  const manualCopy = document.getElementById('manual-copy');
  const status = document.getElementById('copy-status');
  const address = document.getElementById('direct-email').textContent.trim();
  const subject = document.getElementById('mail-subject').textContent.trim();

  function message() {
    const details = ['Hello Secret of the Andes team,', '', 'I’m interested in the eight-day Estancias & Glaciers route.'];
    if (month.value.trim()) details.push('I’m considering ' + month.value.trim() + '.');
    if (pace.value) details.push(pace.value);
    if (question.value.trim()) details.push('', question.value.trim());
    if (!pace.value && !question.value.trim()) details.push('Could you tell me about dates and walking options?');
    return details.join('\r\n');
  }

  function updateDraft() {
    draft.href = 'mailto:' + address + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(message());
    manualCopy.hidden = true;
    status.textContent = '';
  }

  async function copyDetails() {
    const details = ['To: ' + address, 'Subject: ' + subject, '', message()].join('\r\n');
    try {
      await navigator.clipboard.writeText(details);
      status.textContent = 'Email details copied. Paste them into your email app to send your question.';
    } catch {
      manualCopy.value = details;
      manualCopy.hidden = false;
      manualCopy.focus();
      manualCopy.select();
      status.textContent = 'Select and copy the email details below, then paste them into your email app.';
    }
  }

  panel.addEventListener('input', updateDraft);
  panel.addEventListener('change', updateDraft);
  copy.addEventListener('click', copyDetails);
  updateDraft();
  panel.hidden = false;
  copy.hidden = false;
})();
