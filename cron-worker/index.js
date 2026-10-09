function delayMs(delay, unit) {
  switch (unit) {
    case 'minutes': return delay * 60 * 1000;
    case 'hours':   return delay * 60 * 60 * 1000;
    case 'days':    return delay * 24 * 60 * 60 * 1000;
    default:        return delay * 60 * 60 * 1000;
  }
}

function applyTemplate(text, clinic) {
  if (!text) return text;
  const firstName = (clinic.contact_name || '').split(' ')[0] || 'there';
  const lastName  = (clinic.contact_name || '').split(' ').slice(1).join(' ') || '';
  return text
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{last_name\}\}/gi, lastName)
    .replace(/\{\{clinic_name\}\}/gi, clinic.name || '')
    .replace(/\{\{business_name\}\}/gi, clinic.name || '')
    .replace(/\{\{email\}\}/gi, clinic.contact_email || '')
    .replace(/\{\{phone\}\}/gi, clinic.contact_phone || '');
}

// Converts the plain-text template body into the branded HTML shell.
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function textToHtml(text) {
  let out = escapeHtml(text || '');
  out = out.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#B8460F;text-decoration:underline;">$1</a>');
  return out.replace(/\n/g, '<br>');
}
function wrapEmailHtml(bodyText) {
  return `<!doctype html>
<html>
  <head>
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
  </head>
  <body style="margin:0;padding:0;background:#F6F4EF;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F4EF;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E6E2DA;border-radius:14px;overflow:hidden;">
          <tr><td style="padding:22px 28px;border-bottom:1px solid #E6E2DA;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="width:56px;height:56px;background-image:url('https://app.primedandbooked.com/logo-email.png?v=7');background-size:52px 52px;background-repeat:no-repeat;background-position:center;text-align:center;"></td>
              <td style="padding-left:12px;font-family:Arial,sans-serif;font-size:16px;">
                <span style="font-weight:900;color:#1A1A1A;letter-spacing:0.02em;">PRIMED &amp;</span><span style="font-weight:900;color:#FF6B1A;letter-spacing:0.02em;"> BOOKED</span>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:28px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#242A2E;">
            ${textToHtml(bodyText)}
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #E6E2DA;font-family:Arial,sans-serif;font-size:12px;color:#8A929C;">
            Primed &amp; Booked &middot; hello@primedandbooked.com
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

// Sends through the Google Apps Script relay (google-apps-script/mail-relay.gs),
// which calls GmailApp.sendEmail, executing as alignment.automations@gmail.com
// but sending as its verified hello@alignmentautomations.com alias — this
// makes Gmail recognize the sender as a real Google Account and show its
// profile photo as the avatar to recipients viewing in Gmail.
async function sendEmail(to, subject, body, env) {
  if (!env.APPSSCRIPT_URL)    throw new Error('APPSSCRIPT_URL is not set');
  if (!env.APPSSCRIPT_SECRET) throw new Error('APPSSCRIPT_SECRET is not set');
  const res = await fetch(env.APPSSCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: env.APPSSCRIPT_SECRET,
      to,
      from: env.FROM_EMAIL,
      subject: subject || '(no subject)',
      text: body || '',
      html: wrapEmailHtml(body || ''),
    }),
  });
  const raw = await res.text();
  let json = null;
  try { json = JSON.parse(raw); } catch (_) {}
  if (!res.ok || !json?.ok) {
    throw new Error(`Apps Script relay rejected send (HTTP ${res.status}): ${raw}`);
  }
  return json;
}

export default {
  async scheduled(event, env, ctx) {
    const { results: clinics } = await env.DB.prepare(
      'SELECT id, name, contact_name, contact_email, contact_phone, follow_ups FROM clinics'
    ).all();

    for (const clinic of clinics) {
      const followUps = clinic.follow_ups ? JSON.parse(clinic.follow_ups) : [];
      let changed = false;

      for (const fu of followUps) {
        if (fu.status !== 'active') continue;

        for (let i = 0; i < fu.steps.length; i++) {
          const step = fu.steps[i];
          if (step.status !== 'pending') continue;

          const prevSentAt = i === 0 ? fu.triggeredAt : fu.steps[i - 1]?.sentAt;
          if (!prevSentAt) break;

          if (Date.now() < prevSentAt + delayMs(step.delay, step.delayUnit)) break;

          try {
            if (!clinic.contact_email) throw new Error('no email on file');
            await sendEmail(
              clinic.contact_email,
              applyTemplate(step.subject, clinic),
              applyTemplate(step.body, clinic),
              env
            );
            fu.steps[i] = { ...step, status: 'sent', sentAt: Date.now() };
            fu.currentStep = i + 1;
          } catch (err) {
            fu.steps[i] = { ...step, status: 'failed', sentAt: Date.now(), error: err.message };
          }
          changed = true;
          break;
        }

        if (fu.steps.every(s => s.status === 'sent' || s.status === 'failed')) {
          fu.status = 'completed';
          changed = true;
        }
      }

      if (changed) {
        await env.DB.prepare(
          'UPDATE clinics SET follow_ups = ? WHERE id = ?'
        ).bind(JSON.stringify(followUps), clinic.id).run();
      }
    }
  },
};
