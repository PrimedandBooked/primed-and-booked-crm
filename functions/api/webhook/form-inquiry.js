// Cloudflare Pages Function: /functions/api/webhook/form-inquiry.js

// Public form endpoint. It is called from the marketing site's forms, which run
// in the visitor's browser — so there is no such thing as a secret it can carry.
// (It used to check an `x-webhook-secret` header that was hardcoded in the page
// source, which meant anyone could read it and use this endpoint as an open
// email relay.) Protection is now: an origin allowlist, a honeypot field, a
// per-IP rate limit, and a global daily ceiling on outbound email.
const ALLOWED_ORIGINS = [
  'https://primedandbooked.com',
  'https://www.primedandbooked.com',
  'https://alignmentautomations.com',      // old domain, kept until it only redirects
  'https://www.alignmentautomations.com',
  'http://localhost:5173',   // vite dev
  'http://localhost:8788',   // wrangler pages dev
];

const PER_IP_HOURLY_LIMIT     = 5;    // submissions per IP per hour
const GLOBAL_DAILY_EMAIL_CAP  = 50;   // auto-replies sent per day, across all IPs
const MAX_FIELD_LENGTH        = 2000; // per text field

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function isAllowedOrigin(origin) {
  return Boolean(origin) && ALLOWED_ORIGINS.includes(origin);
}

function uid() {
  return crypto.randomUUID();
}

function delayMs(delay, unit) {
  switch (unit) {
    case 'minutes': return delay * 60 * 1000;
    case 'hours':   return delay * 60 * 60 * 1000;
    case 'days':    return delay * 24 * 60 * 60 * 1000;
    default:        return delay * 60 * 60 * 1000;
  }
}

function applyTemplate(text, vars) {
  if (!text) return text;
  return text
    .replace(/\{\{first_name\}\}/gi, vars.first_name || 'there')
    .replace(/\{\{last_name\}\}/gi,  vars.last_name  || '')
    .replace(/\{\{clinic_name\}\}/gi,   vars.clinic_name   || '')
    .replace(/\{\{business_name\}\}/gi, vars.business_name || vars.clinic_name || '')
    .replace(/\{\{email\}\}/gi,      vars.email       || '')
    .replace(/\{\{phone\}\}/gi,      vars.phone       || '');
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

// Sends through Resend (resend.com) as hello@primedandbooked.com. The domain is
// verified in Resend with DNS records on Cloudflare, so mail is signed for
// primedandbooked.com; replies go to the same address, which Zoho receives.
// RESEND_API_KEY is a secret on the Pages project and on the cron worker.
const FROM_ADDRESS = 'Primed & Booked <hello@primedandbooked.com>';
const REPLY_TO     = 'hello@primedandbooked.com';

async function sendEmail(to, subject, body, env) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      reply_to: REPLY_TO,
      subject: subject || '(no subject)',
      text: body || '',
      html: wrapEmailHtml(body || ''),
    }),
  });
  const raw = await res.text();
  let json = null;
  try { json = JSON.parse(raw); } catch (_) {}
  if (!res.ok || !json?.id) {
    throw new Error(`Resend rejected send (HTTP ${res.status}): ${raw}`);
  }
  return json;
}

// Handle CORS preflight
export async function onRequestOptions({ request }) {
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

// Counts recent submissions for this IP, and auto-replies sent site-wide today.
async function getRecentCounts(env, ip) {
  const [ipRow, emailRow] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(*) AS c FROM form_submissions WHERE ip = ? AND created_at > datetime('now','-1 hour')"
    ).bind(ip).first(),
    env.DB.prepare(
      "SELECT COUNT(*) AS c FROM form_submissions WHERE emailed = 1 AND created_at > datetime('now','-1 day')"
    ).first(),
  ]);
  return { ipCount: ipRow?.c ?? 0, emailedToday: emailRow?.c ?? 0 };
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  const headers = isAllowedOrigin(origin) ? corsHeaders(origin) : {};

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });

  if (!isAllowedOrigin(origin)) {
    return json({ error: 'Forbidden' }, 403);
  }

  try {
    const body = await request.json();

    // Honeypot: a field hidden off-screen that no human ever sees. If it came
    // back filled, it was a bot — return a normal-looking success and drop it.
    if (typeof body.fax_number === 'string' && body.fax_number.trim() !== '') {
      return json({ ok: true }, 201);
    }

    // Reject oversized payloads before anything touches the database.
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string' && value.length > MAX_FIELD_LENGTH) {
        return json({ error: `${key} is too long` }, 413);
      }
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const { ipCount, emailedToday } = await getRecentCounts(env, ip);

    if (ipCount >= PER_IP_HOURLY_LIMIT) {
      return json({ error: 'Too many submissions. Please try again later.' }, 429);
    }

    // Record the attempt now, so everything that gets this far counts toward the
    // limit — including submissions that fail validation below.
    const submissionId = uid();
    await env.DB.prepare(
      'INSERT INTO form_submissions (id, ip, created_at, emailed) VALUES (?, ?, datetime(\'now\'), 0)'
    ).bind(submissionId, ip).run();

    // Occasional cleanup so the table doesn't grow forever. The counts above only
    // ever look back 24 hours, so anything older than a week is dead weight.
    if (Math.random() < 0.05) {
      await env.DB.prepare(
        "DELETE FROM form_submissions WHERE created_at < datetime('now','-7 days')"
      ).run();
    }

    // Accept business_name (current) or clinic_name (legacy) from the inbound form.
    const { first_name, last_name, email, phone, package: pkg } = body;
    const businessName = body.business_name || body.clinic_name;

    if (!email) {
      return json({ error: 'email required' }, 400);
    }

    const clinicId    = uid();
    const contactName = [first_name, last_name].filter(Boolean).join(' ');
    const name        = businessName || contactName || 'New Inquiry';

    await env.DB.prepare(`
      INSERT INTO clinics (
        id, name, contact_name, contact_email, contact_phone, package,
        status, alignment_tasks, clinic_tasks, follow_ups, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'lead', '[]', '[]', '[]', datetime('now'))
    `).bind(clinicId, name, contactName, email || null, phone || null, pkg || null).run();

    // Route to a package-specific sequence where one exists; everything else
    // falls into the generic website inquiry trigger.
    const PACKAGE_TRIGGERS = { 'Calculator Lead Magnet': 'calculator_lead', 'Intake Audit': 'audit_request', 'Starter Site': 'starter_request' };
    const triggerKey = PACKAGE_TRIGGERS[pkg] || 'website_inquiry';

    const { results: seqRows } = await env.DB.prepare(
      "SELECT data FROM sequences WHERE id = 'all'"
    ).all();
    const sequences = seqRows[0]?.data ? JSON.parse(seqRows[0].data) : [];
    const seq = sequences.find(s => s.trigger === triggerKey && s.active);

    if (!seq) {
      return json({ ok: true, clinicId, note: `No active ${triggerKey} sequence found` });
    }

    const templateVars = { first_name, last_name, clinic_name: name, business_name: name, email, phone };

    const now = Date.now();
    const fu = {
      id: uid(),
      seqId: seq.id,
      seqName: seq.name,
      trigger: triggerKey,
      triggeredAt: now,
      status: 'active',
      currentStep: 0,
      totalSteps: seq.steps.length,
      steps: seq.steps.map(s => ({ ...s, sentAt: null, status: 'pending' })),
    };

    // Always send step 0 immediately for form submissions — real-time response is critical
    const step0 = fu.steps[0];
    if (step0) {
      if (emailedToday >= GLOBAL_DAILY_EMAIL_CAP) {
        // Ceiling hit. The lead is still saved and still visible in the CRM —
        // we just don't auto-reply, so a flood can't burn the sending account.
        // Anything held this way needs a manual reply.
        fu.steps[0] = {
          ...step0,
          status: 'held',
          sentAt: null,
          error: `Daily auto-reply cap of ${GLOBAL_DAILY_EMAIL_CAP} reached — send this one by hand.`,
        };
      } else {
        try {
          if (!email) throw new Error('no email on file');
          await sendEmail(email, applyTemplate(step0.subject, templateVars), applyTemplate(step0.body, templateVars), env);
          fu.steps[0] = { ...step0, status: 'sent', sentAt: Date.now() };
          fu.currentStep = 1;
          await env.DB.prepare(
            'UPDATE form_submissions SET emailed = 1 WHERE id = ?'
          ).bind(submissionId).run();
        } catch (err) {
          fu.steps[0] = { ...step0, status: 'failed', sentAt: Date.now(), error: err.message };
        }
      }
    }

    await env.DB.prepare(
      'UPDATE clinics SET follow_ups = ? WHERE id = ?'
    ).bind(JSON.stringify([fu]), clinicId).run();

    return json({ ok: true, clinicId }, 201);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
