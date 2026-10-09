// Cloudflare Pages Function: /functions/api/clinics/[id].js

function parseClinic(c) {
  return {
    ...c,
    alignmentTasks: c.alignment_tasks ? JSON.parse(c.alignment_tasks) : [],
    clinicTasks:    c.clinic_tasks    ? JSON.parse(c.clinic_tasks)    : [],
    followUps:      c.follow_ups      ? JSON.parse(c.follow_ups)      : [],
  };
}

function applyTemplate(text, clinic) {
  if (!text) return text;
  const firstName = (clinic.contact_name || '').split(' ')[0] || 'there';
  const lastName  = (clinic.contact_name || '').split(' ').slice(1).join(' ') || '';
  return text
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{last_name\}\}/gi,  lastName)
    .replace(/\{\{clinic_name\}\}/gi, clinic.name || '')
    .replace(/\{\{business_name\}\}/gi, clinic.name || '')
    .replace(/\{\{email\}\}/gi,      clinic.contact_email || '')
    .replace(/\{\{phone\}\}/gi,      clinic.contact_phone || '');
}

function delayMs(delay, unit) {
  switch (unit) {
    case 'minutes': return delay * 60 * 1000;
    case 'hours':   return delay * 60 * 60 * 1000;
    case 'days':    return delay * 24 * 60 * 60 * 1000;
    default:        return delay * 60 * 60 * 1000;
  }
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

export async function onRequestPatch({ params, request, env }) {
  try {
    const { id } = params;
    const patch = await request.json();

    const updates = [];
    const values  = [];

    if (patch.name          !== undefined) { updates.push('name = ?');            values.push(patch.name); }
    if (patch.contact_name  !== undefined) { updates.push('contact_name = ?');    values.push(patch.contact_name); }
    if (patch.contact_email !== undefined) { updates.push('contact_email = ?');   values.push(patch.contact_email); }
    if (patch.contact_phone !== undefined) { updates.push('contact_phone = ?');   values.push(patch.contact_phone); }
    if (patch.website       !== undefined) { updates.push('website = ?');         values.push(patch.website); }
    if (patch.package       !== undefined) { updates.push('package = ?');         values.push(patch.package); }
    if (patch.status        !== undefined) { updates.push('status = ?');          values.push(patch.status); }
    if (patch.start_date    !== undefined) { updates.push('start_date = ?');      values.push(patch.start_date); }
    if (patch.industry      !== undefined) { updates.push('industry = ?');        values.push(patch.industry); }
    if (patch.source        !== undefined) { updates.push('source = ?');          values.push(patch.source); }
    if (patch.priority      !== undefined) { updates.push('priority = ?');        values.push(patch.priority); }
    if (patch.lead_note     !== undefined) { updates.push('lead_note = ?');       values.push(patch.lead_note); }
    if (patch.channel        !== undefined) { updates.push('channel = ?');         values.push(patch.channel); }
    if (patch.leak_flagged   !== undefined) { updates.push('leak_flagged = ?');    values.push(patch.leak_flagged); }
    if (patch.date_sent      !== undefined) { updates.push('date_sent = ?');       values.push(patch.date_sent); }
    if (patch.next_follow_up !== undefined) { updates.push('next_follow_up = ?');  values.push(patch.next_follow_up); }
    if (patch.watched        !== undefined) { updates.push('watched = ?');         values.push(patch.watched ? 1 : 0); }
    if (patch.replied        !== undefined) { updates.push('replied = ?');         values.push(patch.replied ? 1 : 0); }
    if (patch.outreach_stage !== undefined) { updates.push('outreach_stage = ?');  values.push(patch.outreach_stage); }
    // Archived rows stay in the table - the prospector's duplicate check reads
    // contact_phone straight out of `clinics`, so deleting a disqualified
    // business would make it resurface on the next search. This only hides it
    // from the Businesses list.
    if (patch.archived       !== undefined) { updates.push('archived = ?');        values.push(patch.archived ? 1 : 0); }
    if (patch.alignmentTasks !== undefined) { updates.push('alignment_tasks = ?'); values.push(JSON.stringify(patch.alignmentTasks)); }
    if (patch.clinicTasks   !== undefined) { updates.push('clinic_tasks = ?');    values.push(JSON.stringify(patch.clinicTasks)); }
    if (patch.followUps     !== undefined) { updates.push('follow_ups = ?');      values.push(JSON.stringify(patch.followUps)); }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    await env.DB.prepare(
      `UPDATE clinics SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values, id).run();

    // Immediately send any step 0s with delay=0 that are still pending
    if (patch.followUps !== undefined) {
      const { results: rows } = await env.DB.prepare(
        'SELECT name, contact_name, contact_email, contact_phone, follow_ups FROM clinics WHERE id = ?'
      ).bind(id).all();
      const clinic = rows[0];
      const followUps = clinic.follow_ups ? JSON.parse(clinic.follow_ups) : [];
      let changed = false;

      for (const fu of followUps) {
        if (fu.status !== 'active') continue;
        const step = fu.steps[0];
        if (!step || step.status !== 'pending') continue;
        if (delayMs(step.delay, step.delayUnit) > 0) continue;

        try {
          if (!clinic.contact_email) throw new Error('no email on file');
          await sendEmail(clinic.contact_email, applyTemplate(step.subject, clinic), applyTemplate(step.body, clinic), env);
          fu.steps[0] = { ...step, status: 'sent', sentAt: Date.now() };
          fu.currentStep = 1;
        } catch (err) {
          fu.steps[0] = { ...step, status: 'failed', sentAt: Date.now(), error: err.message };
        }
        changed = true;
      }

      if (changed) {
        await env.DB.prepare(
          'UPDATE clinics SET follow_ups = ? WHERE id = ?'
        ).bind(JSON.stringify(followUps), id).run();
      }
    }

    const { results } = await env.DB.prepare('SELECT * FROM clinics WHERE id = ?').bind(id).all();
    return new Response(JSON.stringify(parseClinic(results[0])), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestDelete({ params, env }) {
  try {
    const { id } = params;
    await env.DB.prepare('DELETE FROM clinics WHERE id = ?').bind(id).run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
