import { useState, useEffect, useCallback, useRef } from "react";
import { PLAYBOOK_CSS, PLAYBOOK_HTML } from "./playbookContent";
import { VISUAL_AUDIT_CSS, VISUAL_AUDIT_HTML } from "./visualAuditPlaybookContent";

// ─── Pipeline ──────────────────────────────────────────────────────────────────────────────────

const PIPELINE_GROUPS = [
  { id:"prospects", label:"Prospects",      description:"Leads & demos" },
  { id:"clients",   label:"Active Clients", description:"Onboarding & ongoing" },
];

const PIPELINE_STAGES = [
  { id:"lead",              label:"New Lead",         color:"#94a3b8", group:"prospects" },
  { id:"demo_booked",       label:"Demo Scheduled",   color:"#f59e0b", group:"prospects" },
  { id:"demo_done",         label:"Demo Complete",    color:"#a78bfa", group:"prospects" },
  { id:"yes_closed_won",    label:"Won",              color:"#10b981", group:"prospects" },
  // `closed` = finished with, so it drops out of the Businesses working list.
  // Lost still shows ON the Pipeline board, because a lost deal is a real
  // outcome worth seeing there; it just should not sit in the day-to-day list.
  { id:"closed_lost",       label:"Lost",             color:"#ef4444", group:"prospects", closed:true },
  // Screened out before any outreach - a bad rating, too few reviews, a licence
  // flag, or already marketed. NOT the same as "Lost", which means we pitched
  // and they said no.
  //
  // `hidden` keeps it OUT of the Pipeline board while leaving it selectable in
  // the Businesses filter. Adding it here without that flag put a Disqualified
  // ROW inside the Prospects group and counted it in the group total - hiding
  // them from one view and making them louder in another.
  { id:"disqualified",      label:"Disqualified",     color:"#64748b", group:"prospects", hidden:true, closed:true },
  { id:"onboarding_sent",   label:"Onboarding",       color:"#3b82f6", group:"clients"   },
  { id:"build_in_progress", label:"Building",         color:"#8b5cf6", group:"clients"   },
  { id:"testing",           label:"Transfer & Setup", color:"#f97316", group:"clients"   },
  { id:"live",              label:"Live",             color:"#10b981", group:"clients"   },
  { id:"monthly_support",   label:"Monthly Support",  color:"#06b6d4", group:"clients"   },
];

// Stages that mean "finished with". Derived from PIPELINE_STAGES so a new
// closed stage only has to be flagged in one place.
const CLOSED_STAGES = new Set(PIPELINE_STAGES.filter(s => s.closed).map(s => s.id));

const STATUS_COLORS = {
  lead:              { bg:"rgba(148,163,184,0.15)", text:"#94a3b8", border:"rgba(148,163,184,0.4)" },
  demo_booked:       { bg:"rgba(245,158,11,0.15)",  text:"#f59e0b", border:"rgba(245,158,11,0.4)"  },
  demo_done:         { bg:"rgba(167,139,250,0.15)", text:"#a78bfa", border:"rgba(167,139,250,0.4)" },
  yes_closed_won:    { bg:"rgba(16,185,129,0.15)",  text:"#10b981", border:"rgba(16,185,129,0.4)"  },
  onboarding_sent:   { bg:"rgba(59,130,246,0.15)",  text:"#3b82f6", border:"rgba(59,130,246,0.4)"  },
  build_in_progress: { bg:"rgba(139,92,246,0.15)",  text:"#8b5cf6", border:"rgba(139,92,246,0.4)"  },
  testing:           { bg:"rgba(249,115,22,0.15)",  text:"#f97316", border:"rgba(249,115,22,0.4)"  },
  live:              { bg:"rgba(16,185,129,0.15)",  text:"#10b981", border:"rgba(16,185,129,0.4)"  },
  monthly_support:   { bg:"rgba(6,182,212,0.15)",   text:"#06b6d4", border:"rgba(6,182,212,0.4)"   },
  closed_lost:       { bg:"rgba(239,68,68,0.15)",   text:"#ef4444", border:"rgba(239,68,68,0.4)"   },
  disqualified:      { bg:"rgba(100,116,139,0.15)", text:"#64748b", border:"rgba(100,116,139,0.4)" },
};

const STAGE_DOT = {
  lead:"#94a3b8", demo_booked:"#f59e0b", demo_done:"#a78bfa", yes_closed_won:"#10b981",
  onboarding_sent:"#3b82f6", build_in_progress:"#8b5cf6", testing:"#f97316",
  live:"#10b981", monthly_support:"#06b6d4", closed_lost:"#ef4444",
  disqualified:"#64748b",
};

// Client Onboarding doc, hosted for linking from the client_won email.
const ONBOARDING_DOC_URL = "https://app.primedandbooked.com/client-onboarding.pdf";

const STAGE_AUTO_TRIGGER = {
  yes_closed_won:  "client_won",   // auto-fires the onboarding email — no confirmation
  onboarding_sent: "client_won",   // fallback if a business is dropped straight into Onboarding
  closed_lost:     "no_activity",  // suggests (doesn't auto-fire) the long-tail nurture sequence
};

// ─── Checklist Modules ──────────────────────────────────────────────────────────────────

const INTAKE_PACKAGE  = "Done-for-You Intake System";
const STARTER_PACKAGE = "Starter Site";

const MODULES = {
  intake_system: {
    // (Client) — what the business owner provides / does
    clinic: [
      { name:"Confirm phone number type: cell, landline, or VoIP (RingCentral, etc.)", done:false, section:"Phase 0 · Sales Qualification" },
      { name:"Confirm you have an EIN / tax ID (or that you don't)", done:false, section:"Phase 0 · Sales Qualification" },
      { name:"Confirm the number isn't already text-enabled with another provider", done:false, section:"Phase 0 · Sales Qualification" },
      { name:"Attend the 30-minute kickoff call", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Make first payment — $1,797 (setup + first month)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Sign the service agreement", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide legal business name, exactly as registered", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide EIN / tax ID (or confirm none — needed for carrier registration)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide registered business address", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide entity type (LLC, S-corp, or sole prop)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide authorized rep: first name, last name, email, job title", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide authorized rep's mobile number (receives the carrier OTP)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide business phone number + carrier + number type", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide existing website URL, if any", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide services offered + rough price ranges", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide service area and business hours", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide photos of your work (before/afters, job sites, crew)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide your logo, if you have one", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide reviews / testimonials for the site", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide calendar preferences (estimate hours, duration, notice needed)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide where lead notifications should go (your cell / email)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Provide the domain name you want (or say if you already own one)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Respond to the carrier mobile OTP (only if sole-prop registration)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Sign the carrier authorization form / LOA (within 7 days)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Review the preview link and send feedback in one batch", done:false, section:"Phase 3 · Days 9–11 — Review" },
      { name:"Give written sign-off to launch", done:false, section:"Phase 3 · Days 9–11 — Review" },
      { name:"Set conditional call forwarding at your carrier (busy / no-answer / unreachable)", done:false, section:"Phase 5 · SMS Go-Live" },
      { name:"Walk through the full text-back loop together on a call", done:false, section:"Phase 5 · SMS Go-Live" },
    ],
    // (You) — Primed & Booked delivery (from the Internal Ops Manual)
    alignment: [
      { name:"Run phone-number triage — confirm what you can promise", done:false, section:"Phase 0 · Sales Qualification" },
      { name:"Check disqualifiers (already SMS-enabled, outside US/CA, on another Twilio voice account)", done:false, section:"Phase 0 · Sales Qualification" },
      { name:"Confirm EIN path: Standard/Low-Volume (has EIN) vs Sole Prop (none)", done:false, section:"Phase 0 · Sales Qualification" },
      { name:"Run the 30-min kickoff call; collect the full A2P data set + brand assets", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Collect first payment: $1,797 (setup + first month)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Register the domain — registrant = client's name/business", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Deploy a real homepage to the domain immediately (so the A2P URL check passes)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Confirm the Twilio account is paid, not trial", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Create a Trust Hub customer profile using the client's details", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Submit A2P Brand (Standard/Low-Volume if EIN; Sole Prop only if none)", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Submit A2P Campaign — use case Customer Care; keep default STOP/HELP replies", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"If landline/VoIP: submit the Hosted SMS order and send the LOA for signature", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Create the lead-log Sheet in the client's Google Drive; add yourself as Editor", done:false, section:"Phase 1 · Day 1 — Kickoff & Compliance" },
      { name:"Build the full site in the GitHub repo; deploy to Cloudflare Pages", done:false, section:"Phase 2 · Days 2–8 — Build" },
      { name:"Write conversion copy; build pages, forms, and CTAs", done:false, section:"Phase 2 · Days 2–8 — Build" },
      { name:"Deploy the per-client missed-call text-back Worker + D1 binding", done:false, section:"Phase 2 · Days 2–8 — Build" },
      { name:"Configure Cal.com event types; connect the client's calendar", done:false, section:"Phase 2 · Days 2–8 — Build" },
      { name:"Build Make.com scenarios: form → confirmation → booking → Sheet → notify", done:false, section:"Phase 2 · Days 2–8 — Build" },
      { name:"Write the follow-up email sequence", done:false, section:"Phase 2 · Days 2–8 — Build" },
      { name:"Monitor A2P campaign + Hosted SMS status daily; respond fast to info requests", done:false, section:"Phase 2 · Days 2–8 — Build" },
      { name:"Full end-to-end test on staging before the client sees anything", done:false, section:"Phase 2 · Days 2–8 — Build" },
      { name:"Send the preview link; collect feedback in one batch", done:false, section:"Phase 3 · Days 9–11 — Review" },
      { name:"Apply revisions (cap at two rounds; flag scope creep past that)", done:false, section:"Phase 3 · Days 9–11 — Review" },
      { name:"Get written sign-off before launch", done:false, section:"Phase 3 · Days 9–11 — Review" },
      { name:"Point domain nameservers to Cloudflare; add custom domain to Pages", done:false, section:"Phase 4 · Day 12 — Website Launch" },
      { name:"Submit a live test lead — verify the confirmation email fires", done:false, section:"Phase 4 · Day 12 — Website Launch" },
      { name:"Verify the booking lands on the calendar and the lead hits the Sheet", done:false, section:"Phase 4 · Day 12 — Website Launch" },
      { name:"Verify the internal notification reaches the client", done:false, section:"Phase 4 · Day 12 — Website Launch" },
      { name:"Confirm recurring $297/mo billing is active", done:false, section:"Phase 4 · Day 12 — Website Launch" },
      { name:"Confirm A2P campaign status is VERIFIED", done:false, section:"Phase 5 · SMS Go-Live" },
      { name:"Attach the campaign to the Messaging Service; register the phone number to it", done:false, section:"Phase 5 · SMS Go-Live" },
      { name:"Confirm Hosted SMS status is in-use (landline/VoIP path)", done:false, section:"Phase 5 · SMS Go-Live" },
      { name:"Caller-ID passthrough test: place a real missed call from an outside phone", done:false, section:"Phase 5 · SMS Go-Live" },
      { name:"Confirm text-back lands within 60s, from the correct sender number", done:false, section:"Phase 5 · SMS Go-Live" },
      { name:"Test STOP — confirm opt-out works and is honored", done:false, section:"Phase 5 · SMS Go-Live" },
      { name:"Test HELP — confirm the reply names the business", done:false, section:"Phase 5 · SMS Go-Live" },
      { name:"Send handoff summary: domain login, Sheet link, your contact", done:false, section:"Phase 5 · SMS Go-Live" },
      { name:"Daily: check Make.com for failed scenario runs; investigate errors", done:false, section:"Phase 6 · Ongoing Operations" },
      { name:"Weekly: confirm the MCTT Worker responds; scan Twilio logs for delivery/30007 errors", done:false, section:"Phase 6 · Ongoing Operations" },
      { name:"Monthly: verify lead volume vs prior month (catches silent form breakage)", done:false, section:"Phase 6 · Ongoing Operations" },
      { name:"Monthly: reconcile tool spend (incl. A2P fees) against the $297", done:false, section:"Phase 6 · Ongoing Operations" },
      { name:"Monthly: confirm the opt-out list is being honored", done:false, section:"Phase 6 · Ongoing Operations" },
      { name:"Quarterly: check domain renewal dates", done:false, section:"Phase 6 · Ongoing Operations" },
      { name:"Quarterly: confirm the A2P campaign is still VERIFIED", done:false, section:"Phase 6 · Ongoing Operations" },
      { name:"Transfer the domain — issue the EPP/auth code and confirm the transfer", done:false, section:"Phase 7 · Offboarding (if they cancel)" },
      { name:"Hand over the lead log; remove yourself as Editor once confirmed", done:false, section:"Phase 7 · Offboarding (if they cancel)" },
      { name:"Export the site — deliver static files, copy, and photos", done:false, section:"Phase 7 · Offboarding (if they cancel)" },
      { name:"Release the phone number (revoke Hosted SMS auth, or port the Twilio number out)", done:false, section:"Phase 7 · Offboarding (if they cancel)" },
      { name:"Remove call forwarding at their carrier", done:false, section:"Phase 7 · Offboarding (if they cancel)" },
      { name:"Deregister the A2P campaign to stop recurring fees", done:false, section:"Phase 7 · Offboarding (if they cancel)" },
      { name:"Decommission the Worker, D1, and Make scenarios after they confirm receipt", done:false, section:"Phase 7 · Offboarding (if they cancel)" },
      { name:"Cancel billing the same day", done:false, section:"Phase 7 · Offboarding (if they cancel)" },
    ],
  },
  starter_site: {
    // Starter Site: a one-time website build. No EIN, no carrier registration,
    // no missed-call text-back - so none of the A2P/SMS phases apply here.
    clinic: [
      { name:"Pay the 50% deposit to start", done:false, section:"Phase 0 · Sale" },
      { name:"Sign the service agreement", done:false, section:"Phase 0 · Sale" },
      { name:"Attend the kickoff call", done:false, section:"Phase 1 · Day 1 · Kickoff" },
      { name:"Provide business details: legal name, phone, email, service area, hours", done:false, section:"Phase 1 · Day 1 · Kickoff" },
      { name:"Provide services list and rough price ranges", done:false, section:"Phase 1 · Day 1 · Kickoff" },
      { name:"Send photos of real work (phone photos are fine)", done:false, section:"Phase 1 · Day 1 · Kickoff" },
      { name:"Send logo, if you have one", done:false, section:"Phase 1 · Day 1 · Kickoff" },
      { name:"Send reviews or testimonials to feature", done:false, section:"Phase 1 · Day 1 · Kickoff" },
      { name:"Confirm the domain name you want (or hand over the existing one)", done:false, section:"Phase 1 · Day 1 · Kickoff" },
      { name:"Provide CSLB license number + insurance details for the compliance display", done:false, section:"Phase 1 · Day 1 · Kickoff" },
      { name:"All content delivered within 14 days (project pauses past that)", done:false, section:"Phase 1 · Day 1 · Kickoff" },
      { name:"Review the preview link and send one consolidated round of revisions", done:false, section:"Phase 3 · Review" },
      { name:"Approve for launch", done:false, section:"Phase 3 · Review" },
      { name:"Pay the balance before launch", done:false, section:"Phase 4 · Launch" },
      { name:"Complete your Google Business Profile using the setup guide (about an hour)", done:false, section:"Phase 5 · After launch" },
    ],
    alignment: [
      { name:"Confirm scope: 5 pages, fixed count · extra pages quoted separately", done:false, section:"Phase 0 · Sale" },
      { name:"Collect 50% deposit; send agreement + intake form", done:false, section:"Phase 0 · Sale" },
      { name:"Run the kickoff call; collect content, photos, domain, CSLB details", done:false, section:"Phase 1 · Day 1 · Kickoff" },
      { name:"Send the Google Business Profile Setup Guide to the client", done:false, section:"Phase 1 · Day 1 · Kickoff" },
      { name:"Register or delegate the domain; configure DNS", done:false, section:"Phase 2 · Build" },
      { name:"Set up hosting", done:false, section:"Phase 2 · Build" },
      { name:"Build the 5 page mobile-first site", done:false, section:"Phase 2 · Build" },
      { name:"Wire the contact form to the webhook + auto-confirmation email", done:false, section:"Phase 2 · Build" },
      { name:"Connect online booking to the client calendar", done:false, section:"Phase 2 · Build" },
      { name:"Add CSLB-compliant license + insurance display", done:false, section:"Phase 2 · Build" },
      { name:"Email deliverability: SPF, DKIM, DMARC", done:false, section:"Phase 2 · Build" },
      { name:"QA: submit the form as a real customer; confirm it lands and auto-replies", done:false, section:"Phase 2 · Build" },
      { name:"QA: book a test appointment; confirm calendar sync", done:false, section:"Phase 2 · Build" },
      { name:"QA: mobile/responsive + page-speed check", done:false, section:"Phase 2 · Build" },
      { name:"Proofread all copy; verify phone, email, service area, hours", done:false, section:"Phase 2 · Build" },
      { name:"Send preview link", done:false, section:"Phase 3 · Review" },
      { name:"Implement the included revision round (bill hourly beyond it)", done:false, section:"Phase 3 · Review" },
      { name:"Collect balance", done:false, section:"Phase 4 · Launch" },
      { name:"DNS cutover; confirm the site loads on the real domain", done:false, section:"Phase 4 · Launch" },
      { name:"Send the \"you're live\" summary + handover details", done:false, section:"Phase 4 · Launch" },
      { name:"Mark stage – Live", done:false, section:"Phase 4 · Launch" },
      { name:"If on the $49/mo care plan: set up recurring billing + monitoring", done:false, section:"Phase 5 · After launch" },
      { name:"Offer the Intake System upgrade path when it fits (pay the difference, no rebuild)", done:false, section:"Phase 5 · After launch" },
    ],
  },
};

const PACKAGE_MODULES = {
  [INTAKE_PACKAGE]:  ["intake_system"],
  [STARTER_PACKAGE]: ["starter_site"],
};

function getPackageTasks(pkg) {
  const keys = PACKAGE_MODULES[pkg] || ["intake_system"];
  const al = [], cl = [];
  keys.forEach(k => { if (MODULES[k]) { al.push(...MODULES[k].alignment); cl.push(...MODULES[k].clinic); } });
  return { alignment: al, clinic: cl };
}

const PACKAGES = [STARTER_PACKAGE, INTAKE_PACKAGE];

// Accounts / access the client must own, per the onboarding checklist.
const PACKAGE_ACCOUNTS = {
  [INTAKE_PACKAGE]:  ["EIN / tax ID", "Registered business address", "Authorized rep mobile (OTP)", "Business phone + carrier type"],
  // Starter Site is a website build only - no carrier registration, so none of the A2P data is needed.
  [STARTER_PACKAGE]: ["Domain (or authorization to register one)", "CSLB license + insurance details", "Calendar to connect for booking"],
};

// ─── Prospecting (from the outreach playbook) ───────────────────────────────────

// Ideal-prospect trades from the playbook, in fit order.
// ⚠ THREE LISTS MUST STAY IN SYNC when a trade is added or removed:
//   1. INDUSTRIES        — here, the CRM's own industry dropdown
//   2. PROSPECT_TRADES    — below, the Places query values
//   3. INDUSTRY_MAP       — functions/api/_lib/prospecting.js, trade -> industry
// Miss one and a pushed prospect lands with an industry the CRM cannot display.
const INDUSTRIES = [
  "Painting", "HVAC", "Roofing", "Plumbing", "Electrical", "Landscaping / Lawn",
  "General Building", "Remodeling", "Flooring", "Tile & Stone", "Concrete",
  "Cabinetry", "Masonry", "Pools & Spas", "Fencing", "Tree Service",
  "Other",
];

// Where the lead was found (playbook prospecting sources).
const LEAD_SOURCES = ["Google Maps", "Google Business Profile", "Facebook / Groups", "Facebook Ad Library", "Referral", "Website form", "Other"];

// Prospect temperature — maps to the lead scorecard verdict (8+ / 5-7 / <5).
const PRIORITIES = [
  { id:"hot",  label:"Hot",  hint:"Record today",  color:"#ef4444" },
  { id:"warm", label:"Warm", hint:"Warm list",     color:"#f59e0b" },
  { id:"cold", label:"Cold", hint:"Park it",       color:"#64748b" },
];
const getPriority = id => PRIORITIES.find(p => p.id === id);

// Places-query-friendly trade values for the Prospecting page's search form —
// distinct from INDUSTRIES (the CRM's display labels, which include "Other"
// with no Places query equivalent). Matches INDUSTRY_MAP in
// functions/api/_lib/prospecting.js.
// The value is the phrase sent to Google Places ("{trade} in {location}"), or
// the key of a merged group that expands to several phrases (TRADE_GROUPS). It
// is NOT a CSLB classification — the prospector searches Google, not the board.
// The per-trade counts in the comments are why these trades were chosen and
// others were not.
const PROSPECT_TRADES = [
  // Merged 2026-09-27 from sixteen to eleven. The pairs below were not
  // overlapping as LICENCES (tile/flooring share 7% of holders) but as GOOGLE
  // RESULTS: one query returned largely the same businesses as the other. A
  // merged choice runs every query in its group and dedupes -- same reach,
  // fewer picker entries. The groups live in TRADE_GROUPS in
  // functions/api/_lib/prospecting.js; KEEP THE VALUES IN SYNC.
  // Licence counts are ACTIVE licences, SLO / SB / Monterey, from the
  // 2026-09-09 CSLB export.
  { value: "painter", label: "Painter" },                          // C-33, 235 / 333 / 243
  { value: "general contractor & remodeling",
    label: "General contractor & remodeling" },                    // B + C-6 cabinets
  { value: "flooring & tile", label: "Flooring & tile" },          // C-15 + C-54
  { value: "concrete & masonry", label: "Concrete & masonry" },    // C-8 + C-29
  { value: "landscaping & fencing", label: "Landscaping & fencing" }, // C-27 + C-13
  { value: "roofer", label: "Roofer" },                            // C-39, 54 / 81 / 66
  { value: "plumber", label: "Plumber" },                          // C-36, 222 / 282 / 200
  { value: "hvac contractor", label: "HVAC contractor" },           // C-20, 91 / 99 / 78
  { value: "electrician", label: "Electrician" },                   // C-10, 334 / 311 / 300
  { value: "swimming pool contractor", label: "Swimming pools" },   // C-53, 28 / 36 / 6 (thin in Monterey)
  { value: "tree service", label: "Tree service" },                 // D-49, 32 / 50 / 50
];
// DELIBERATELY NOT HERE, and the reasons are worth keeping:
//   Solar (C-46, 20)  — tiny pool, and the trade is dominated by heavy
//                       advertisers. A $950 site is not their gap.
//   B-2 (25)          — too few to be its own category, and nearly all of them
//                       hold a B as well. Covered by "home remodeler".
//   A General Engineering (486), C-9 Drywall (95), C-7 Low Voltage (94),
//   C-12 Earthwork (80), C-16 Fire Protection (51) — sub-to-GC or commercial.
//   Nobody searches Google for them.
//   ⚠ Tree work is mostly D-49 (76), NOT C-49 (13). Confirmed by reading the
//   business names: C-49 returns arborists, D-49 returns tree services.

// Forces an unambiguous "City, ST" query to the Places API — a bare city name
// or a 2-letter fragment (e.g. "sa") can resolve to a same-named place in a
// different country (see prospects with search_location="sa" that matched
// South Africa instead of San Antonio, TX). Requiring a real state selection
// makes that class of mismatch structurally impossible.
const US_STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
  ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
  ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
  ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
  ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
  ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
  ["DC","District of Columbia"],
];

function tierColor(tier) {
  if (tier === "Record today") return "#ef4444";
  if (tier === "Warm") return "#f59e0b";
  return "#64748b";
}

// ─── Follow-up ─────────────────────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  { id:"website_inquiry",   label:"Website Inquiry",        icon:"◻", color:"#a78bfa" },
  { id:"calculator_lead",   label:"Calculator Lead",        icon:"$", color:"#3a7bfd" },
  { id:"audit_request",     label:"Intake Audit Request",   icon:"◎", color:"#f472b6" },
  { id:"starter_request",   label:"Starter Site Request",   icon:"▢", color:"#22d3ee" },
  { id:"prospect_outreach", label:"Prospect Follow-up",     icon:"\u{1F3A5}", color:"#818cf8" },
  { id:"client_won",        label:"Deal Won / Onboarding",  icon:"✦", color:"#4ade80" },
  { id:"starter_won",       label:"Starter Site Won",       icon:"▲", color:"#2dd4bf" },
  { id:"no_activity",       label:"Gone Quiet",             icon:"◌", color:"#f59e0b" },
  { id:"manual",            label:"Manual Trigger",         icon:"◆", color:"#64748b" },
];

const DEFAULT_SEQUENCES = [
  // Auto-fires when someone submits the contact form on your marketing site
  // (see contact.html — it posts straight to /api/webhook/form-inquiry).
  { id:"seq_0", name:"Website Inquiry Follow-up", trigger:"website_inquiry", active:true, steps:[
    { id:"s0a", delay:0, delayUnit:"minutes", channel:"email",
      subject:"Got your message — here's what's next",
      body:"Hi {{first_name}},\n\nThanks for reaching out to Primed & Booked! We received your inquiry and will be in touch shortly.\n\nIn the meantime, feel free to book a discovery call:\nhttps://cal.com/alignment-automations/20min\n\n— Matthew\nPrimed & Booked" },
    { id:"s0b", delay:1, delayUnit:"days", channel:"email",
      subject:"Quick follow-up",
      body:"Hi {{first_name}},\n\nJust following up on your inquiry. Happy to answer any questions you have about how we can help {{business_name}}.\n\nBook a free 20-minute call:\nhttps://cal.com/alignment-automations/20min\n\n— Matthew\nPrimed & Booked" },
    { id:"s0c", delay:4, delayUnit:"days", channel:"email",
      subject:"Still interested?",
      body:"Hi {{first_name}},\n\nOne last check-in. If timing isn't right or you have questions, just reply — happy to help.\n\nhttps://cal.com/alignment-automations/20min\n\n— Matthew\nPrimed & Booked" },
  ]},
  // Launch manually after you send the first personalized outreach (Day 0) —
  // a video or a visual audit (marked-up screenshot), whichever you used.
  // Cadence matches the playbook's 30-day follow-up exactly: day 3, 7, 14, 21, 30.
  { id:"seq_1", name:"Prospect Follow-up (Day 3–30)", trigger:"prospect_outreach", active:true, steps:[
    { id:"s1", delay:3, delayUnit:"days", channel:"email",
      subject:"Did that come through?",
      body:"Hey {{first_name}},\n\nJust circling back on what I sent over — wanted to make sure it didn't get buried in the inbox.\n\nNo pressure at all. If any of it looked useful, just hit reply and let me know — happy to walk you through it.\n\n— Matthew\nPrimed & Booked" },
    { id:"s2", delay:4, delayUnit:"days", channel:"email",
      subject:"What this looked like for another contractor",
      body:"Hey {{first_name}},\n\nFiguring the timing might just not be right, and that's fair.\n\nFigured I'd share a quick example instead. I set this up for another local contractor who kept losing calls after hours — now every missed call gets an instant text back, and he's booking a handful of extra jobs a month from leads that used to just disappear.\n\nIf you want to see how it'd work for {{business_name}}, just reply and I'll walk you through it.\n\n— Matthew\nPrimed & Booked" },
    { id:"s3", delay:7, delayUnit:"days", channel:"email",
      subject:"One quick thought",
      body:"Hey {{first_name}},\n\nI'll keep this short — the biggest thing I see costing contractors work isn't the website, it's what happens when a lead comes in and nobody's free to grab the phone.\n\nThat's the piece I'd fix first for {{business_name}}. Couple weeks to set up, then it runs on its own.\n\nHappy to show you if you're curious — just reply and I'll send the details.\n\n— Matthew\nPrimed & Booked" },
    { id:"s4", delay:7, delayUnit:"days", channel:"email",
      subject:"Why I actually do this",
      body:"Hey {{first_name}},\n\nQuick bit about me, since we haven't talked yet — I spent 15 years in the trades before this. So when I say most guys are leaving money on the table with missed calls and slow follow-up, it's because I lived it.\n\nThat's the whole reason I build these systems now. If it's ever worth a conversation for {{business_name}}, I'm here:\nhttps://cal.com/alignment-automations/20min\n\n— Matthew\nPrimed & Booked" },
    { id:"s5", delay:9, delayUnit:"days", channel:"email",
      subject:"I'll leave you be",
      body:"Hey {{first_name}},\n\nThis'll be my last one — don't want to be the guy clogging up your inbox.\n\nIf catching more of those leads ever moves up the list, you've got my email. Reach out anytime and we'll pick it right back up.\n\nAppreciate you either way.\n\n— Matthew\nPrimed & Booked" },
  ]},
  // Auto-fires the moment a deal is marked Won or moved to Onboarding.
  { id:"seq_2", name:"Client Onboarding Kickoff", trigger:"client_won", active:true, steps:[
    { id:"s6", delay:0, delayUnit:"minutes", channel:"email",
      subject:"Welcome aboard — here's what happens next",
      body:"Hi {{first_name}},\n\nWelcome to Primed & Booked! Here's exactly what happens from here:\n\n1. Kickoff call (30 min) — we'll cover your services, service area, and the handful of details the phone carriers need before your system can send texts.\n2. Days 2–8 — I build everything: your website, booking calendar, missed-call text-back, and follow-up emails. Nothing needed from you.\n3. Days 9–11 — you review a preview link and tell me what to change.\n4. Day 12 — your website goes live.\n5. Within about a week of launch — missed-call text-back switches on once the carriers approve registration.\n\nYour full onboarding guide, with everything to have ready for the kickoff call:\n" + ONBOARDING_DOC_URL + "\n\nBook the kickoff call here:\nhttps://cal.com/alignment-automations/20min\n\n— Matthew\nPrimed & Booked" },
  ]},
  // Long-tail nurture for prospects who go quiet after a demo, or lost deals worth revisiting later.
  { id:"seq_3", name:"Gone Quiet — Long-term Nurture", trigger:"no_activity", active:false, steps:[
    { id:"s7", delay:30, delayUnit:"days",   channel:"email",
      subject:"Still here if you need us",
      body:"Hi {{first_name}},\n\nJust checking in on {{business_name}} — if you have questions or want to explore what's possible, I'm available for a quick call.\n\nhttps://cal.com/alignment-automations/20min\n\n— Matthew\nPrimed & Booked" },
    { id:"s8", delay:45, delayUnit:"days",   channel:"email",
      subject:"One last check-in",
      body:"Hi {{first_name}},\n\nThis will be my last follow-up for now. If timing is ever right to revisit things for {{business_name}}, I'd love to reconnect.\n\n— Matthew\nPrimed & Booked" },
  ]},
];

// ─── App config ──────────────────────────────────────────────────────────────

const API_BASE = "/api";

// The shared secret is the password the user types at login. It is stored only
// in this browser and sent as a header on every API call — it never ships in the
// bundle. The server (functions/api/_middleware.js) validates it against APP_SECRET.
function getSecret() { return localStorage.getItem("aa_secret") || ""; }

async function apiFetch(path, opts = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "x-app-secret": getSecret(), ...(opts.headers || {}) },
  });
}

// Validate a password by asking the server. The secret is never in the bundle,
// so wrong passwords are rejected server-side with 401.
async function validatePassword(pw) {
  try {
    const res = await fetch(`${API_BASE}/clinics`, { headers: { "x-app-secret": pw } });
    if (res.status === 401) return false;
    if (res.ok) return true;
  } catch (_) { /* network error — fall through */ }
  // Dev fallback (stripped from production builds): allow login when running `vite dev`,
  // where Cloudflare Functions don't execute.
  return import.meta.env.DEV;
}

const db = {
  async getAll() {
    const res = await apiFetch(`/clinics`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },
  async create(clinic) {
    const res = await apiFetch(`/clinics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clinic),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },
  async update(id, patch) {
    const res = await apiFetch(`/clinics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },
  async delete(id) {
    const res = await apiFetch(`/clinics/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    return { success: true };
  },
};

const prospectsDb = {
  async getAll() {
    const res = await apiFetch(`/prospects`);
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },
  // `replace` clears the list first. A single-city search is a run of one and
  // still replaces; a county sweep replaces on its first town only, so results
  // accumulate and can be deduped across the whole county.
  async search(trade, location, opts = {}) {
    const res = await apiFetch(`/prospects/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trade, location, ...opts }),
    });
    const data = await res.json();
    // Errors come back as 200 with an `error` field, not a non-2xx status —
    // Cloudflare's edge overlays its own generic page for 5xx origin
    // responses, which would hide the real message from the user.
    if (!res.ok || data.error) throw new Error(data.error || "Search failed");
    return data;
  },
  // The towns in a county, ranked by how many licensed contractors are in each.
  // Comes from the `licenses` table, so it is CSLB's own list and nobody has to
  // maintain it by hand.
  async cities(county) {
    const res = await apiFetch(`/prospects/cities?county=${encodeURIComponent(county)}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Could not load cities");
    return data.cities || [];
  },
  async counties() {
    const res = await apiFetch(`/prospects/cities`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Could not load counties");
    return data.counties || [];
  },
  async update(id, patch) {
    const res = await apiFetch(`/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },
  async delete(id) {
    const res = await apiFetch(`/prospects/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    return { success: true };
  },
  async pushToPipeline(id) {
    const res = await apiFetch(`/prospects/${id}/push`, { method: "POST" });
    const data = await res.json();
    if (!res.ok && res.status !== 409) throw new Error(data.error || "Push failed");
    return data;
  },
  async exportCsv() {
    const res = await apiFetch(`/prospects/export.csv`);
    if (!res.ok) throw new Error("Export failed");
    return await res.blob();
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function stageLabel(id) {
  return PIPELINE_STAGES.find(s => s.id === id)?.label ?? id;
}

function getTrigger(id) {
  return TRIGGER_TYPES.find(t => t.id === id) ?? { id: id ?? "manual", label: id ?? "Manual", icon: "◆", color: "#64748b" };
}

// Label for a sequence step's timing, e.g. "Immediately" only if it truly has no delay.
function stepDelayLabel(step, idx, short = false) {
  if (idx === 0 && !step.delay) return short ? "Now" : "Immediately";
  return short ? `+${step.delay}${step.delayUnit[0]}` : `+${step.delay} ${step.delayUnit}`;
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.round(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.round(diff / 3600000) + "h ago";
  return Math.round(diff / 86400000) + "d ago";
}

function renderBody(text, clinic) {
  if (!text) return "";
  const first = clinic?.contact_name?.split(" ")[0] || "there";
  const last  = clinic?.contact_name?.split(" ").slice(1).join(" ") || "";
  return text
    .replace(/{{first_name}}/g, first)
    .replace(/{{last_name}}/g, last)
    .replace(/{{clinic_name}}/g, clinic?.name || "")
    .replace(/{{business_name}}/g, clinic?.name || "")
    .replace(/{{email}}/g, clinic?.contact_email || "")
    .replace(/{{phone}}/g, clinic?.contact_phone || "");
}

// Mirrors the branded HTML shell the backend wraps every sent email in
// (functions/api/clinics/[id].js, cron-worker, webhook/form-inquiry.js),
// so the preview modal shows exactly what the recipient will see.
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function textToHtml(text) {
  let out = escapeHtml(text || "");
  out = out.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#B8460F;text-decoration:underline;">$1</a>');
  return out.replace(/\n/g, "<br>");
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

// ─── Styles ───────────────────────────────────────────────────────────────────



// ─── Styles ─────────────────────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Manrope', sans-serif;
    background: #111214;
    color: #f8fafc;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

  /* ── Layout ── */
  .app { display: flex; height: 100vh; overflow: hidden; }

  /* ── Sidebar (desktop) ── */
  .sidebar {
    width: 240px; min-width: 240px;
    background: #1A1C1F;
    border-right: 1px solid rgba(255,255,255,0.07);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .sidebar-brand {
    display: flex; align-items: center; gap: 10px;
    padding: 20px 18px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .brand-icon { width: 32px; height: 32px; flex-shrink: 0; }
  .brand-icon img { width: 100%; height: 100%; object-fit: contain; }
  .brand-text { line-height: 1.2; }
  .brand-name { font-size: 14px; font-weight: 800; letter-spacing: 0.02em; color: #F2EFE9; }
  .sidebar-nav { padding: 12px 10px; flex: 1; }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border-radius: 7px; cursor: pointer;
    font-size: 13px; font-weight: 500; color: #7A7D82;
    transition: all 0.15s; border: none; background: none; width: 100%; text-align: left;
    position: relative; font-family: 'Manrope', sans-serif;
  }
  .nav-item:hover { color: #A0A3A8; background: rgba(255,255,255,0.04); }
  .nav-item.active { color: #f8fafc; background: rgba(255,107,26,0.12); }
  .nav-item.active::before {
    content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    width: 3px; height: 60%; background: #FF6B1A; border-radius: 0 2px 2px 0;
  }
  .nav-icon { opacity: 0.8; display: flex; }
  .nav-section-label {
    padding: 10px 10px 6px; font-size: 10px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; color: #5F6267;
  }

  /* ── Bottom nav (mobile) ── */
  .bottom-nav {
    display: none;
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 60;
    background: #1A1C1F; border-top: 1px solid rgba(255,255,255,0.07);
    padding: 8px 0 max(8px, env(safe-area-inset-bottom));
  }
  .bottom-nav-inner { display: flex; justify-content: space-around; }
  .bottom-nav-item {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 6px 24px; border: none; background: none; cursor: pointer;
    color: #5F6267; font-size: 10px; font-weight: 600; font-family: 'Manrope', sans-serif;
    letter-spacing: 0.04em; text-transform: uppercase; transition: color 0.15s;
  }
  .bottom-nav-item.active { color: #FF8A3D; }
  .bottom-nav-item svg { opacity: 0.9; }

  /* ── Main ── */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
  .main-header {
    padding: 22px 28px 0;
    display: flex; align-items: flex-start; justify-content: space-between;
    flex-shrink: 0;
  }
  .page-title { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; color: #f8fafc; }
  .page-subtitle { font-size: 12px; color: #5F6267; margin-top: 2px; font-weight: 500; }
  .main-content { flex: 1; overflow-y: auto; min-height: 0; padding: 20px 28px 28px; }

  /* ── Toolbar ── */
  .toolbar { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; }
  .search-wrap { position: relative; flex: 1; min-width: 0; }
  .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #5F6267; pointer-events: none; }
  .search-input {
    width: 100%; padding: 9px 12px 9px 36px;
    background: #1A1C1F; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; color: #f8fafc; font-size: 13px; font-family: 'Manrope', sans-serif;
    outline: none; transition: border-color 0.15s;
  }
  .search-input::placeholder { color: #5F6267; }
  .search-input:focus { border-color: rgba(255,107,26,0.5); box-shadow: 0 0 0 3px rgba(255,107,26,0.1); }
  .filter-select {
    padding: 9px 32px 9px 12px;
    background: #1A1C1F; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; color: #f8fafc; font-size: 13px; font-family: 'Manrope', sans-serif;
    outline: none; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237A7D82' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center; min-width: 140px;
  }

  /* ── Buttons ── */
  .btn-primary {
    display: flex; align-items: center; gap: 6px;
    padding: 9px 16px; background: #FF6B1A; color: #111214;
    border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
    font-family: 'Manrope', sans-serif; cursor: pointer; white-space: nowrap; transition: background 0.15s;
  }
  .btn-primary:hover { background: #FF8A3D; }
  .btn-success {
    display: flex; align-items: center; gap: 6px;
    padding: 9px 16px; background: #10b981; color: white;
    border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
    font-family: 'Manrope', sans-serif; cursor: pointer; white-space: nowrap; transition: background 0.15s;
  }
  .btn-success:hover { background: #34d399; }
  .btn-success:disabled { background: #41444A; color: #7A7D82; cursor: not-allowed; }
  .btn-ghost {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 10px; background: transparent; color: #7A7D82;
    border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; font-size: 12px;
    font-family: 'Manrope', sans-serif; cursor: pointer; transition: all 0.15s;
  }
  .btn-ghost:hover { color: #f8fafc; border-color: rgba(255,255,255,0.2); }
  .btn-danger {
    display: flex; align-items: center; padding: 6px 8px; background: transparent;
    color: #7A7D82; border: none; border-radius: 5px; cursor: pointer; transition: all 0.15s;
  }
  .btn-danger:hover { color: #ef4444; background: rgba(239,68,68,0.1); }

  /* ── Desktop Table ── */
  .table-wrap {
    background: #1A1C1F; border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; overflow: hidden;
  }
  /* Prospecting's table has no separate mobile card-list view (unlike the
     Dashboard/clinic-card-list pattern), so it can't use .table-wrap — that
     class is hidden outright on mobile below. Scroll horizontally instead. */
  .prospecting-table-wrap {
    background: #1A1C1F; border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch;
  }
  .prospecting-table-wrap table { min-width: 720px; }
  table { width: 100%; border-collapse: collapse; }
  thead {}
  th {
    padding: 11px 16px; text-align: left;
    font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    color: #5F6267; background: #141517;
    border-bottom: 1px solid rgba(255,255,255,0.06); white-space: nowrap;
  }
  td {
    padding: 13px 16px; font-size: 13px; color: #D2D3D5;
    border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle;
  }
  tr:last-child td { border-bottom: none; }
  tbody tr { transition: background 0.1s; }
  tbody tr:hover td { background: rgba(42,45,50,0.6); }
  .clinic-name-cell { display: flex; align-items: center; gap: 8px; }
  .clinic-name-text { font-weight: 600; color: #f8fafc; }
  .link-icon { color: #5F6267; cursor: pointer; transition: color 0.15s; display: flex; }
  .link-icon:hover { color: #FF8A3D; }
  .contact-name { font-weight: 500; color: #f8fafc; }
  .contact-email { font-size: 11px; color: #5F6267; margin-top: 1px; }
  .actions-cell { display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity 0.15s; }
  tbody tr:hover .actions-cell { opacity: 1; }

  /* ── Mobile Card List ── */
  .clinic-card-list { display: none; flex-direction: column; gap: 8px; }
  .clinic-list-card {
    background: #1A1C1F; border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px; padding: 14px 16px;
    display: flex; align-items: center; gap: 12px;
    cursor: pointer; transition: background 0.1s;
  }
  .clinic-list-card:active { background: rgba(42,45,50,0.8); }
  .clinic-list-card-icon {
    width: 38px; height: 38px; background: rgba(255,107,26,0.15);
    border-radius: 9px; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #FF8A3D; font-size: 16px;
  }
  .clinic-list-card-body { flex: 1; min-width: 0; }
  .clinic-list-card-name { font-size: 14px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clinic-list-card-sub { font-size: 12px; color: #7A7D82; margin-top: 2px; }
  .clinic-list-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }

  /* ── Status badges ── */
  .status-dropdown-wrap { position: relative; display: inline-flex; }
  .status-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
    border: 1px solid; white-space: nowrap; cursor: pointer; transition: opacity 0.15s; user-select: none;
  }
  .status-badge:hover { opacity: 0.8; }
  .status-badge-readonly {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; border: 1px solid; white-space: nowrap;
  }
  .status-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .status-dropdown {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 50;
    background: #24272B; border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    overflow: hidden; min-width: 190px;
    animation: dropIn 0.12s ease;
  }
  @keyframes dropIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .status-option {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; cursor: pointer; font-size: 12px; font-weight: 500;
    color: #D2D3D5; transition: background 0.1s; border: none; background: none;
    width: 100%; text-align: left;
  }
  .status-option:hover { background: rgba(255,255,255,0.06); color: #f8fafc; }
  .status-option.active { color: #f8fafc; background: rgba(255,107,26,0.15); }
  .status-option-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

  /* ── Empty state ── */
  .empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 60px 20px; color: #5F6267; text-align: center;
  }
  .empty-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.4; }
  .empty-title { font-size: 14px; font-weight: 600; color: #7A7D82; }
  .empty-sub { font-size: 12px; margin-top: 4px; }

  /* ── Pipeline ── */
  .pipeline-list { display: flex; flex-direction: column; gap: 2px; }
  .stage-row {
    background: #1A1C1F; border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px; overflow: hidden; transition: border-color 0.15s, background 0.15s;
  }
  .stage-row.drag-over { border-color: #FF6B1A; background: rgba(255,107,26,0.05); }
  .stage-header {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 18px; cursor: pointer; user-select: none; transition: background 0.1s;
  }
  .stage-header:hover { background: rgba(42,45,50,0.5); }
  .stage-chevron { color: #5F6267; transition: transform 0.2s; flex-shrink: 0; display: flex; }
  .stage-chevron.open { transform: rotate(90deg); }
  .stage-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .stage-label { font-size: 13px; font-weight: 600; color: #D2D3D5; flex: 1; }
  .stage-count {
    min-width: 22px; height: 22px; padding: 0 7px;
    background: #FF6B1A; color: #111214; border-radius: 11px;
    font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
  }
  .stage-count.zero { background: rgba(255,255,255,0.06); color: #5F6267; }
  .stage-cards { padding: 4px 12px 12px; display: flex; flex-wrap: wrap; gap: 8px; }
  .stage-drop-hint { padding: 8px 18px 12px; font-size: 11px; color: #41444A; font-style: italic; }

  .clinic-card {
    background: #111214; border: 1px solid rgba(255,255,255,0.08);
    border-left: 3px solid; border-radius: 7px; padding: 12px 14px;
    min-width: 200px; max-width: 260px;
    transition: all 0.15s; display: flex; align-items: flex-start; gap: 10px;
    cursor: grab;
  }
  .clinic-card:active { cursor: grabbing; }
  .clinic-card:hover { border-color: rgba(255,107,26,0.5); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
  .clinic-card.dragging { opacity: 0.35; transform: scale(0.97); }
  .card-icon {
    width: 32px; height: 32px; background: rgba(255,107,26,0.15);
    border-radius: 7px; display: flex; align-items: center; justify-content: center;
    font-size: 14px; flex-shrink: 0; color: #FF8A3D;
  }
  .card-info { flex: 1; min-width: 0; }
  .card-name { font-size: 13px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-contact { font-size: 11px; color: #7A7D82; margin-top: 2px; }
  .card-date { font-size: 10px; color: #5F6267; margin-top: 3px; font-family: 'JetBrains Mono', monospace; }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px); z-index: 100;
    display: flex; align-items: center; justify-content: center; padding: 16px;
  }
  .modal {
    background: #1A1C1F; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
    box-shadow: 0 24px 48px rgba(0,0,0,0.6); animation: modalIn 0.2s ease;
  }
  @keyframes modalIn { from { opacity: 0; transform: translateY(-10px) scale(0.98); } to { opacity: 1; transform: none; } }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.07);
    position: sticky; top: 0; background: #1A1C1F; z-index: 1;
  }
  .modal-title { font-size: 16px; font-weight: 700; color: #f8fafc; }
  .modal-close {
    background: none; border: none; color: #5F6267; cursor: pointer;
    padding: 4px; border-radius: 5px; transition: all 0.15s; font-size: 18px; line-height: 1;
  }
  .modal-close:hover { color: #f8fafc; background: rgba(255,255,255,0.07); }
  .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
  .modal-footer {
    padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.07);
    display: flex; justify-content: flex-end; gap: 10px;
    position: sticky; bottom: 0; background: #1A1C1F;
  }

  /* Launch modal — trigger picker */
  .trigger-grid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px;
  }
  .trigger-btn {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; gap: 4px; min-height: 92px; padding: 16px 12px;
    background: #111214; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
    cursor: pointer; transition: border-color 0.15s, background 0.15s; font-family: 'Manrope', sans-serif;
  }
  .trigger-btn:hover { background: rgba(255,255,255,0.03); }
  @media (min-width: 560px) {
    .trigger-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }

  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #5F6267; }
  .form-input, .form-select, .form-textarea {
    padding: 10px 12px;
    background: #111214; border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px; color: #f8fafc; font-size: 14px; font-family: 'Manrope', sans-serif;
    outline: none; transition: border-color 0.15s, box-shadow 0.15s; width: 100%;
  }
  .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: rgba(255,107,26,0.5); box-shadow: 0 0 0 3px rgba(255,107,26,0.1); }
  .form-select { appearance: none; cursor: pointer; }
  .form-textarea { resize: vertical; line-height: 1.5; }
  .form-input::placeholder, .form-textarea::placeholder { color: #41444A; }

  /* ── Toast ── */
  .toast {
    position: fixed; bottom: 80px; right: 16px; z-index: 200;
    background: #24272B; border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #f8fafc;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4); animation: toastIn 0.2s ease; max-width: 280px;
  }
  @keyframes toastIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

  /* ── Detail Panel ── */
  .detail-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    backdrop-filter: blur(3px); z-index: 80; display: flex; justify-content: flex-end;
  }
  .detail-panel {
    width: 440px; background: #1A1C1F; border-left: 1px solid rgba(255,255,255,0.08);
    height: 100%; overflow-y: auto; display: flex; flex-direction: column; animation: slideIn 0.2s ease;
  }
  @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }
  .detail-header {
    padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    position: sticky; top: 0; background: #1A1C1F; z-index: 1;
  }
  .detail-title { font-size: 17px; font-weight: 700; color: #f8fafc; }
  .detail-meta { font-size: 11px; color: #5F6267; margin-top: 3px; }
  .detail-tabs {
    display: flex; gap: 2px; padding: 0 20px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    position: sticky; top: 61px; background: #1A1C1F; z-index: 1;
  }
  .detail-tab {
    background: none; border: none; cursor: pointer;
    padding: 12px 14px; font-size: 13px; font-weight: 600;
    color: #7A7D82; font-family: 'Manrope', sans-serif;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
    transition: color 0.15s, border-color 0.15s; white-space: nowrap;
  }
  .detail-tab:hover { color: #D2D3D5; }
  .detail-tab.active { color: #f8fafc; border-bottom-color: #FF6B1A; }
  .detail-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
  .detail-section-title { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #5F6267; margin-bottom: 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .info-label { font-size: 10px; color: #5F6267; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
  .info-value { font-size: 13px; color: #f8fafc; margin-top: 2px; font-weight: 500; word-break: break-word; }

  /* ── Outreach tab ── */
  .outreach-panel { display: flex; flex-direction: column; gap: 14px; }
  .outreach-field { display: flex; flex-direction: column; gap: 6px; }
  .outreach-field > span { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #5F6267; }
  .outreach-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #D2D3D5; cursor: pointer; }
  .outreach-check input { width: 16px; height: 16px; accent-color: #FF6B1A; cursor: pointer; }

  /* ── Playbook chooser ── */
  .playbook-choice-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; max-width: 720px; }
  .playbook-choice-card {
    display: flex; flex-direction: column; align-items: flex-start; gap: 10px;
    background: #1A1C1F; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
    padding: 22px; text-align: left; cursor: pointer; transition: border-color 0.15s, transform 0.15s;
  }
  .playbook-choice-card:hover { border-color: rgba(255,107,26,0.5); transform: translateY(-2px); }
  .playbook-choice-icon {
    width: 38px; height: 38px; border-radius: 9px; background: rgba(255,107,26,0.15);
    color: #FF8A3D; display: flex; align-items: center; justify-content: center;
  }
  .playbook-choice-title { font-size: 15px; font-weight: 700; color: #f8fafc; }
  .playbook-choice-sub { font-size: 12px; color: #7A7D82; line-height: 1.5; }

  /* ── Tasks ── */
  .task-list { display: flex; flex-direction: column; gap: 6px; }
  .task-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 12px;
    background: rgba(17,18,20,0.6); border: 1px solid rgba(255,255,255,0.06);
    border-radius: 7px; transition: background 0.1s;
  }
  .task-item:hover { background: rgba(42,45,50,0.5); }
  .task-checkbox {
    width: 20px; height: 20px; border-radius: 5px; border: 1.5px solid rgba(255,255,255,0.2);
    background: transparent; cursor: pointer; flex-shrink: 0; transition: all 0.15s;
    display: flex; align-items: center; justify-content: center;
  }
  .task-checkbox.done { background: #10b981; border-color: #10b981; }
  .task-name { flex: 1; font-size: 13px; color: #D2D3D5; }
  .task-name.done { text-decoration: line-through; color: #5F6267; }
  .task-delete { background: none; border: none; color: #41444A; cursor: pointer; padding: 4px; border-radius: 3px; transition: color 0.1s; font-size: 14px; }
  .task-delete:hover { color: #ef4444; }
  .add-task-row { display: flex; gap: 8px; margin-top: 4px; }
  .add-task-input {
    flex: 1; padding: 10px 12px; background: rgba(17,18,20,0.6);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
    color: #f8fafc; font-size: 14px; font-family: 'Manrope', sans-serif; outline: none;
  }
  .add-task-input:focus { border-color: rgba(255,107,26,0.4); }
  .task-progress { height: 3px; background: rgba(255,255,255,0.07); border-radius: 2px; margin-bottom: 10px; }
  .task-progress-bar { height: 100%; background: #10b981; border-radius: 2px; transition: width 0.3s; }
  .task-progress-label { font-size: 10px; color: #5F6267; margin-bottom: 6px; }

  .loading { display: flex; align-items: center; justify-content: center; height: 100%; color: #5F6267; font-size: 14px; }
  /* ── Simple Login ── */
  .login-page {
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; background: #111214; padding: 20px;
  }
  .login-card {
    background: #1A1C1F; border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 40px; width: 100%; max-width: 380px;
    box-shadow: 0 24px 48px rgba(0,0,0,0.5);
  }
  .login-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  .login-logo img { width: 36px; height: 36px; }
  .login-logo-text { line-height: 1.2; }
  .login-logo-name { font-size: 14px; font-weight: 700; color: #f8fafc; }
  .login-title { font-size: 20px; font-weight: 700; color: #f8fafc; margin-bottom: 24px; }
  .login-form { display: flex; flex-direction: column; gap: 14px; }
  .login-error {
    padding: 10px 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
    border-radius: 7px; font-size: 12px; color: #ef4444; margin-bottom: 8px;
  }
  .btn-login {
    padding: 11px; background: #FF6B1A; color: #111214; border: none;
    border-radius: 8px; font-size: 14px; font-weight: 600;
    font-family: 'Manrope', sans-serif; cursor: pointer; transition: background 0.15s;
  }
  .btn-login:hover { background: #FF8A3D; }
  .btn-login:disabled { opacity: 0.6; cursor: not-allowed; }
  /* ── Logout button ── */
  .logout-btn {
    display: flex; align-items: center; gap: 7px; width: 100%;
    padding: 9px 10px; margin-top: auto; border: none; background: none;
    color: #5F6267; font-size: 12px; font-weight: 500; font-family: 'Manrope', sans-serif;
    cursor: pointer; border-radius: 7px; transition: all 0.15s; text-align: left;
    text-decoration: none;
  }
  .logout-btn:hover { color: #ef4444; background: rgba(239,68,68,0.08); }

  /* ── FAB (mobile add button) ── */
  .fab {
    display: none;
    position: fixed; bottom: 72px; right: 16px; z-index: 55;
    width: 52px; height: 52px; border-radius: 50%;
    background: #FF6B1A; color: #111214; border: none; cursor: pointer;
    font-size: 24px; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(255,107,26,0.5); transition: background 0.15s;
  }
  .fab:active { background: #FF8A3D; }

  /* ── Prospecting ── */
  .prospecting-search-bar { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; }
  /* .form-select/.form-input both set width:100% as a base style, which becomes
     each item's flex-basis in this row — without pinning the selects to a fixed
     basis here, their huge (100%-of-container) basis dominates the shrink
     calculation and squeezes the city input down to almost nothing. */
  .prospecting-search-bar .form-select:first-child { flex: 0 0 180px; width: auto; }
  .prospecting-search-bar .form-select:not(:first-child) { flex: 0 0 130px; width: auto; }
  .prospecting-search-bar .form-input { flex: 1 1 0%; min-width: 120px; }
  .score-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 26px; padding: 2px 8px; border-radius: 12px;
    font-weight: 700; font-size: 12px; color: white;
  }
  .no-site { color: #ef4444; font-weight: 600; font-size: 12px; }
  .has-site { color: #7A7D82; font-size: 12px; }
  .has-site a { color: #FF9A5C; }
  .detail-row td { padding: 0; }
  .detail-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px; padding: 16px 20px; background: rgba(255,255,255,0.02);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .detail-block h4 {
    margin: 0 0 8px; font-size: 11px; color: #5F6267; text-transform: uppercase;
    letter-spacing: 0.06em; font-weight: 600;
  }
  .detail-block label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; margin-bottom: 8px; color: #A0A3A8; }
  .detail-block label input[type="checkbox"] { flex-direction: row; width: auto; }
  .auto-signals { list-style: none; margin: 0; padding: 0; font-size: 12px; color: #A0A3A8; }
  .auto-signals li { padding: 3px 0; }
  .auto-signals li.on { color: #ef4444; }
  .maps-link { display: inline-block; margin-top: 6px; font-size: 12px; color: #FF9A5C; }
  .crm-push-status { margin: 0 0 8px; font-size: 12px; }
  .crm-push-status.pushed { color: #FF6B1A; font-weight: 600; }
  .crm-push-status.muted { color: #5F6267; }
  .push-crm-btn { font-size: 12px; padding: 7px 12px; }

  /* ── Responsive breakpoints ── */

  @media (max-width: 768px) {
    .sidebar { display: none; }
    .bottom-nav { display: block; }
    .fab { display: flex; }

    /* 6 items no longer fit the original padding (sized for 4-5) — tighten
       up and add horizontal scroll as a safety net on narrower phones. */
    .bottom-nav-inner { justify-content: flex-start; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .bottom-nav-item { padding: 6px 14px; flex-shrink: 0; }

    .main-header { padding: 16px 16px 0; }
    .page-title { font-size: 20px; }
    .main-content { padding: 14px 16px 80px; }

    /* Hide desktop table, show card list */
    .table-wrap { display: none; }
    .clinic-card-list { display: flex; }

    /* Toolbar: stack search full width, filter below */
    .toolbar { flex-wrap: wrap; }
    .search-wrap { flex: 1 1 100%; }
    .filter-select { flex: 1; min-width: 0; font-size: 12px; }
    .btn-primary.header-add-btn { display: none; }

    /* Prospecting search bar stacks on mobile */
    .prospecting-search-bar { flex-wrap: wrap; }
    .prospecting-search-bar .form-select,
    .prospecting-search-bar .form-input { flex: 1 1 100%; }

    /* Detail panel full width on mobile */
    .detail-panel { width: 100%; border-left: none; }

    /* Modal full-screen-ish on mobile */
    .modal-overlay { align-items: flex-end; padding: 0; }
    .modal { border-radius: 16px 16px 0 0; max-height: 92vh; }

    /* Form rows become single column */
    .form-row { grid-template-columns: 1fr; }

    /* Pipeline cards full width on mobile */
    .clinic-card { min-width: 0; max-width: 100%; width: 100%; }
    .stage-cards { flex-direction: column; }

    /* Toast above bottom nav */
    .toast { bottom: 72px; right: 12px; left: 12px; max-width: none; text-align: center; }
  }

  @media (min-width: 769px) {
    .toast { bottom: 24px; right: 24px; }
  }
`;;

// ─── Icons ────────────────────────────────────────────────────────────────────

const Ic = {
  Dashboard:    () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Pipeline:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Followup:     () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Book:         () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  Plus:         () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Search:       () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Edit:         () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:        () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  X:            () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check:        () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  ExternalLink: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  ChevronRight: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevronDown:  () => <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Clinic:       () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  Mail:         () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Play:         () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Pause:        () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Stop:         () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
  ArrowLeft:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Zap:          () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Logout:       () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StatusDropdown({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const c = STATUS_COLORS[status] || STATUS_COLORS.lead;
  const dot = STAGE_DOT[status] || "#94a3b8";

  const handleOpen = e => {
    e.stopPropagation();
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const s = () => setOpen(false);
    document.addEventListener("mousedown", h);
    window.addEventListener("scroll", s, true);
    return () => { document.removeEventListener("mousedown", h); window.removeEventListener("scroll", s, true); };
  }, [open]);

  return (
    <div className="status-dropdown-wrap" ref={ref}>
      <span className="status-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}
        onClick={handleOpen}>
        <span className="status-dot" style={{ background: dot }} />
        {stageLabel(status)}
        <span style={{ marginLeft: 2, opacity: 0.5, display: "flex" }}><Ic.ChevronDown /></span>
      </span>
      {open && (
        <div className="status-dropdown" style={{ position:"fixed", top: pos.top, left: pos.left, zIndex: 9999 }}>
          {PIPELINE_STAGES.map(s => (
            <button key={s.id} className={"status-option" + (s.id === status ? " active" : "")}
              onClick={e => { e.stopPropagation(); onChange(s.id); setOpen(false); }}>
              <span className="status-option-dot" style={{ background: s.color }} />{s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.lead;
  const dot = STAGE_DOT[status] || "#94a3b8";
  return (
    <span className="status-badge-ro" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      <span className="status-dot" style={{ background: dot }} />{stageLabel(status)}
    </span>
  );
}

function FuBadge({ fu }) {
  if (!fu) return null;
  const m = { active:"fu-active", paused:"fu-paused", completed:"fu-done", cancelled:"fu-cancelled" };
  const l = { active:"Active", paused:"Paused", completed:"Done", cancelled:"Cancelled" };
  return <span className={`fu-badge ${m[fu.status] || "fu-done"}`}>{l[fu.status] || fu.status}</span>;
}

function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast">&#10003; {message}</div>;
}

// ─── Clinic Form Modal ────────────────────────────────────────────────────────

function ClinicModal({ clinic, onSave, onClose }) {
  const [form, setForm] = useState(clinic
    ? { ...clinic }
    : { name:"", contact_name:"", contact_email:"", contact_phone:"", website:"", status:"lead", start_date:"", package: INTAKE_PACKAGE, industry:"", source:"", priority:"", lead_note:"" }
  );
  const s = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{clinic ? "Edit Business" : "Add Business"}</span>
          <button className="modal-close" onClick={onClose}><Ic.X /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Business Name *</label>
            <input className="form-input" value={form.name} onChange={e => s("name", e.target.value)} placeholder="e.g. Spinal Health Center" />
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Contact Name</label><input className="form-input" value={form.contact_name} onChange={e => s("contact_name", e.target.value)} placeholder="Dr. Smith" /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.contact_phone} onChange={e => s("contact_phone", e.target.value)} placeholder="(555) 000-0000" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={form.contact_email} onChange={e => s("contact_email", e.target.value)} placeholder="owner@business.com" /></div>
            <div className="form-group"><label className="form-label">Website</label><input className="form-input" value={form.website} onChange={e => s("website", e.target.value)} placeholder="https://business.com" /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Package</label>
              <select className="form-select" value={form.package || ""} onChange={e => s("package", e.target.value)}>
                <option value="">Select package...</option>
                {PACKAGES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => s("status", e.target.value)}>
                {PIPELINE_STAGES.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input type="date" className="form-input" value={form.start_date} onChange={e => s("start_date", e.target.value)} />
          </div>

          <div style={{ borderTop:"1px solid rgba(255,255,255,0.07)", margin:"6px 0 2px", paddingTop:14 }}>
            <div className="form-label" style={{ marginBottom:12, color:"#FF9A5C" }}>Prospecting</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Industry / Trade</label>
                <select className="form-select" value={form.industry || ""} onChange={e => s("industry", e.target.value)}>
                  <option value="">Select trade...</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority || ""} onChange={e => s("priority", e.target.value)}>
                  <option value="">Unrated</option>
                  {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label} — {p.hint}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Source</label>
              <select className="form-select" value={form.source || ""} onChange={e => s("source", e.target.value)}>
                <option value="">Where did you find them?</option>
                {LEAD_SOURCES.map(sr => <option key={sr} value={sr}>{sr}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">The Leak / Angle</label>
              <textarea className="form-textarea" rows={2} value={form.lead_note || ""} onChange={e => s("lead_note", e.target.value)}
                placeholder="The one concrete problem you'll show on camera — e.g. no mobile booking, broken contact form, missed-call gap" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => { if (form.name.trim()) onSave(form); }}>{clinic ? "Save Changes" : "Add Business"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Launch Modal ─────────────────────────────────────────────────────────────

function LaunchModal({ clinic, sequences, prefillTrigger, onLaunch, onClose }) {
  const [step, setStep] = useState(prefillTrigger ? 2 : 1);
  const [trigger, setTrigger] = useState(prefillTrigger || null);
  const [seqId, setSeqId] = useState(null);
  const [launched, setLaunched] = useState(false);

  const matched = trigger ? sequences.filter(s => s.trigger === trigger.id && s.active) : [];

  useEffect(() => {
    if (matched.length > 0 && !seqId) setSeqId(matched[0].id);
  }, [trigger]);

  const go = () => {
    const seq = sequences.find(s => s.id === seqId);
    if (!seq) return;
    const fu = {
      id: uid(), seqId: seq.id, seqName: seq.name, trigger: trigger.id,
      triggeredAt: Date.now(), status: "active", currentStep: 0, totalSteps: seq.steps.length,
      steps: seq.steps.map(s => ({ ...s, sentAt: null, status: "pending" })),
    };
    setLaunched(true);
    setTimeout(() => { onLaunch(fu); onClose(); }, 1600);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {launched ? (
          <div style={{ padding:"48px 24px", textAlign:"center" }}>
            <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(74,222,128,0.12)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", color:"#4ade80", fontSize:28 }}>&#10003;</div>
            <div style={{ color:"#f8fafc", fontWeight:700, fontSize:18, marginBottom:6 }}>Sequence Launched</div>
            <div style={{ color:"#64748b", fontSize:13 }}>Linked to {clinic.name}</div>
          </div>
        ) : step === 1 ? (
          <>
            <div className="modal-header">
              <span className="modal-title">Select Trigger</span>
              <button className="modal-close" onClick={onClose}><Ic.X /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize:13, color:"#64748b", marginBottom:4 }}>For <strong style={{ color:"#f8fafc" }}>{clinic.name}</strong></div>
              <div className="trigger-grid">
                {TRIGGER_TYPES.map(t => {
                  const has = sequences.some(s => s.trigger === t.id && s.active);
                  return (
                    <button key={t.id} className="trigger-btn"
                      style={{ opacity: has ? 1 : 0.35, cursor: has ? "pointer" : "not-allowed" }}
                      onClick={() => has && (setTrigger(t), setStep(2))}
                      onMouseEnter={e => has && (e.currentTarget.style.borderColor = t.color)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}>
                      <div style={{ fontSize:18, color:t.color, marginBottom:6 }}>{t.icon}</div>
                      <div style={{ color:"#e2e8f0", fontSize:13, fontWeight:600 }}>{t.label}</div>
                      {!has && <div style={{ fontSize:10, color:"#475569", marginTop:3 }}>No active sequence</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="modal-header">
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                {!prefillTrigger && (
                  <button style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", padding:0, display:"flex" }} onClick={() => setStep(1)}>
                    <Ic.ArrowLeft />
                  </button>
                )}
                <span className="modal-title">Confirm Launch</span>
              </div>
              <button className="modal-close" onClick={onClose}><Ic.X /></button>
            </div>
            <div className="modal-body">
              <div style={{ padding:"12px 14px", background:"rgba(11,17,33,0.6)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8 }}>
                <div style={{ fontSize:11, color:"#475569", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:700, marginBottom:6 }}>Business</div>
                <div style={{ fontWeight:700, color:"#f8fafc", fontSize:14 }}>{clinic.name}</div>
                <div style={{ color:"#64748b", fontSize:12, marginTop:2 }}>{clinic.contact_name || "&#8212;"} &middot; {clinic.contact_email || "no email"}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Sequence</label>
                <select className="form-select" value={seqId || ""} onChange={e => setSeqId(e.target.value)}>
                  {matched.map(s => <option key={s.id} value={s.id}>{s.name} ({s.steps.length} steps)</option>)}
                </select>
              </div>
              {seqId && (() => {
                const seq = sequences.find(s => s.id === seqId);
                return seq ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {seq.steps.map((s, i) => (
                      <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"rgba(11,17,33,0.6)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:7 }}>
                        <span style={{ color:"#475569", fontSize:11, fontFamily:"monospace", minWidth:16 }}>#{i+1}</span>
                        <span style={{ color:"#FF9A5C" }}><Ic.Mail /></span>
                        <span style={{ color:"#94a3b8", fontSize:12, flex:1 }}>
                          {s.subject || "No subject"} &middot; {stepDelayLabel(s, i)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-success" onClick={go} disabled={!seqId}><Ic.Zap /> Launch Sequence</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Message Preview Modal ────────────────────────────────────────────────────

function MsgPreviewModal({ step, clinic, onClose }) {
  const bodyText = renderBody(step.body, clinic);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ color:"#FF9A5C" }}><Ic.Mail /></span>
            <span className="modal-title">Email Preview</span>
          </div>
          <button className="modal-close" onClick={onClose}><Ic.X /></button>
        </div>
        <div className="modal-body">
          {step.subject && (
            <div style={{ padding:"8px 12px", background:"rgba(255,154,92,0.08)", borderRadius:6, fontSize:13, color:"#bfdbfe", fontWeight:600 }}>
              Subject: {renderBody(step.subject, clinic)}
            </div>
          )}
          <div style={{ borderRadius:8, overflow:"hidden", border:"1px solid rgba(255,255,255,0.08)" }}>
            <iframe
              title="Email preview"
              srcDoc={wrapEmailHtml(bodyText)}
              style={{ width:"100%", height:360, border:"none", display:"block", background:"#F4F7FB" }}
            />
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span className={`fu-badge ${step.status === "sent" ? "fu-active" : "fu-paused"}`}>{step.status}</span>
            {step.sentAt && <span style={{ fontSize:11, color:"#475569" }}>Sent {timeAgo(step.sentAt)}</span>}
          </div>
        </div>
        <div className="modal-footer"><button className="btn-ghost" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

// ─── Clinic Picker (for launching from Follow-ups page with no clinic) ────────

function ClinicPickerModal({ clinics, onSelect, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Select Business</span>
          <button className="modal-close" onClick={onClose}><Ic.X /></button>
        </div>
        <div className="modal-body">
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:360, overflowY:"auto" }}>
            {clinics.length === 0 && <div style={{ color:"#475569", fontSize:13, textAlign:"center", padding:"24px 0" }}>No businesses yet. Add one first.</div>}
            {clinics.map(c => (
              <button key={c.id} onClick={() => onSelect(c)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"#111214", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, cursor:"pointer", textAlign:"left", transition:"border-color 0.15s", width:"100%" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#FF6B1A")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}>
                <div style={{ width:34, height:34, borderRadius:8, background:"rgba(255,107,26,0.15)", display:"flex", alignItems:"center", justifyContent:"center", color:"#FF6B1A", flexShrink:0 }}><Ic.Clinic /></div>
                <div>
                  <div style={{ fontWeight:600, color:"#f8fafc", fontSize:13 }}>{c.name}</div>
                  <div style={{ fontSize:11, color:"#475569" }}>{c.contact_name || "&#8212;"} &middot; {stageLabel(c.status)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sequence Editor Modal ────────────────────────────────────────────────────

function SequenceEditorModal({ seq, onSave, onClose }) {
  const [form, setForm] = useState(seq || { id:`seq_${Date.now()}`, name:"", trigger:"prospect_outreach", active:true, steps:[] });
  const [editStep, setEditStep] = useState(null);

  const addStep = () => {
    const s = { id:`step_${Date.now()}`, delay:1, delayUnit:"days", channel:"email", subject:"", body:"" };
    setForm(f => ({ ...f, steps:[...f.steps, s] }));
    setEditStep(s.id);
  };
  const upd = (id, p) => setForm(f => ({ ...f, steps: f.steps.map(s => s.id === id ? { ...s, ...p } : s) }));
  const rem = id => { setForm(f => ({ ...f, steps: f.steps.filter(s => s.id !== id) })); if (editStep === id) setEditStep(null); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{seq ? "Edit Sequence" : "New Sequence"}</span>
          <button className="modal-close" onClick={onClose}><Ic.X /></button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Prospect Follow-up" />
            </div>
            <div className="form-group">
              <label className="form-label">Trigger</label>
              <select className="form-select" value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}>
                {TRIGGER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <label className="form-label" style={{ margin:0 }}>Steps ({form.steps.length})</label>
              <button className="btn-ghost" style={{ fontSize:12, padding:"5px 12px" }} onClick={addStep}><Ic.Plus /> Add Step</button>
            </div>
            {form.steps.length === 0 && (
              <div style={{ border:"1px dashed rgba(255,255,255,0.08)", borderRadius:8, padding:20, textAlign:"center", color:"#475569", fontSize:13 }}>No steps yet</div>
            )}
            {form.steps.map((step, idx) => (
              <div key={step.id} style={{ border:`1px solid ${editStep === step.id ? "#FF6B1A" : "rgba(255,255,255,0.08)"}`, borderRadius:8, marginBottom:8, overflow:"hidden", transition:"border-color 0.2s" }}>
                <div onClick={() => setEditStep(editStep === step.id ? null : step.id)}
                  style={{ padding:"11px 14px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", background:"#111214" }}>
                  <span style={{ color:"#475569", fontSize:11, fontFamily:"monospace", minWidth:18 }}>#{idx+1}</span>
                  <span style={{ color:"#FF9A5C" }}><Ic.Mail /></span>
                  <span style={{ color:"#94a3b8", fontSize:13, flex:1 }}>
                    {step.subject || "No subject"} &middot; {stepDelayLabel(step, idx)}
                  </span>
                  <button onClick={e => { e.stopPropagation(); rem(step.id); }} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", padding:4 }}><Ic.Trash /></button>
                </div>
                {editStep === step.id && (
                  <div style={{ padding:14, borderTop:"1px solid rgba(255,255,255,0.07)", display:"flex", flexDirection:"column", gap:12 }}>
                    <div className="form-row-3">
                      <div className="form-group"><label className="form-label">Wait</label><input type="number" min={0} className="form-input" value={step.delay} onChange={e => upd(step.id,{delay:Number(e.target.value)})}/></div>
                      <div className="form-group"><label className="form-label">Unit</label><select className="form-select" value={step.delayUnit} onChange={e => upd(step.id,{delayUnit:e.target.value})}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></div>
                    </div>
                    <div className="form-group"><label className="form-label">Subject</label><input className="form-input" value={step.subject||""} onChange={e => upd(step.id,{subject:e.target.value})} placeholder="Email subject line"/></div>
                    <div className="form-group">
                      <label className="form-label">Body &mdash; use &#123;&#123;first_name&#125;&#125;, &#123;&#123;business_name&#125;&#125;</label>
                      <textarea className="form-textarea" rows={5} value={step.body} onChange={e => upd(step.id,{body:e.target.value})} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)}>Save Sequence</button>
        </div>
      </div>
    </div>
  );
}


// ─── Detail Panel (3 tabs: Overview / Tasks / Follow-ups) ────────────────────

function DetailPanel({ clinic, sequences, onClose, onUpdate, onPatch, onDelete, onOpenLaunch }) {
  const [tab, setTab] = useState("overview");
  const [newATask, setNewATask] = useState("");
  const [newCTask, setNewCTask] = useState("");
  const [expanded, setExpanded] = useState({});
  const [previewStep, setPreviewStep] = useState(null);

  const aTasks  = clinic.alignmentTasks || [];
  const cTasks  = clinic.clinicTasks    || [];
  const fus     = clinic.followUps      || [];
  const allT    = [...aTasks, ...cTasks];
  const doneT   = allT.filter(t => t.done).length;
  const pct     = allT.length ? Math.round((doneT / allT.length) * 100) : 0;
  const activeFu = fus.filter(f => f.status === "active");
  const histFu   = fus.filter(f => f.status !== "active");

  const toggleExp = k => setExpanded(p => ({ ...p, [k]: !p[k] }));
  const updateFu  = (fuId, patch) => onUpdate({ ...clinic, followUps: fus.map(f => f.id === fuId ? { ...f, ...patch } : f) });

  const sugTrigId    = STAGE_AUTO_TRIGGER[clinic.status];
  const sugTrig      = sugTrigId ? getTrigger(sugTrigId) : null;
  const alreadyRunning = sugTrigId && fus.some(f => f.trigger === sugTrigId && f.status === "active");
  const showSuggest  = sugTrig && !alreadyRunning && sequences.some(s => s.trigger === sugTrigId && s.active);

  const SuggestBanner = () => !showSuggest ? null : (
    <div className="suggest-banner">
      <span style={{ fontSize:20 }}>{sugTrig.icon}</span>
      <div className="suggest-text">
        <div className="suggest-title">Suggested: {sugTrig.label}</div>
        <div className="suggest-body">Stage is <strong>{stageLabel(clinic.status)}</strong> &mdash; launch a follow-up?</div>
      </div>
      <button className="btn-primary" style={{ fontSize:12, padding:"7px 12px" }} onClick={() => onOpenLaunch(clinic, sugTrig)}>
        <Ic.Zap /> Launch
      </button>
    </div>
  );

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="detail-header">
          <div>
            <div className="detail-title">{clinic.name}</div>
            <div className="detail-meta">
              <StatusBadge status={clinic.status} />
              {activeFu.length > 0 && <span className="fu-badge fu-active">{activeFu.length} running</span>}
            </div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
            <button className="btn-success" style={{ padding:"7px 12px", fontSize:12 }} onClick={() => onOpenLaunch(clinic)}>
              <Ic.Zap /> Follow-up
            </button>
            <button className="modal-close" onClick={onClose}><Ic.X /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="detail-tabs">
          {[
            ["overview", "Overview"],
            ["outreach", "Outreach"],
            ["tasks",    "Tasks"],
            ["followups", `Follow-ups${activeFu.length > 0 ? ` (${activeFu.length})` : ""}`],
          ].map(([id, label]) => (
            <button key={id} className={"detail-tab" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        <div className="detail-body">

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <>
              <SuggestBanner />
              <div>
                <div className="detail-section-title">Contact Info</div>
                <div className="info-grid">
                  <div><div className="info-label">Contact</div><div className="info-value">{clinic.contact_name || "&#8212;"}</div></div>
                  <div><div className="info-label">Phone</div><div className="info-value" style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>{clinic.contact_phone || "&#8212;"}</div></div>
                  <div><div className="info-label">Email</div><div className="info-value" style={{ fontSize:12 }}>{clinic.contact_email || "&#8212;"}</div></div>
                  <div><div className="info-label">Start Date</div><div className="info-value">{formatDate(clinic.start_date)}</div></div>
                  {clinic.website && <div style={{ gridColumn:"span 2" }}><div className="info-label">Website</div><div className="info-value" style={{ fontSize:12 }}><a href={/^https?:\/\//i.test(clinic.website) ? clinic.website : `https://${clinic.website}`} target="_blank" rel="noopener noreferrer" style={{ color:"#FF6B1A" }}>{clinic.website}</a></div></div>}
                  {clinic.package && <div style={{ gridColumn:"span 2" }}><div className="info-label">Package</div><div className="info-value" style={{ color:"#FF6B1A", fontWeight:700 }}>{clinic.package}</div></div>}
                </div>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(clinic.name + " " + (clinic.contact_phone || ""))}`}
                  target="_blank" rel="noopener noreferrer" className="btn-ghost"
                  style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, padding:"7px 12px", marginTop:12 }}>
                  <Ic.Search /> Google Business Listing
                </a>
              </div>
              {(clinic.industry || clinic.source || clinic.priority || clinic.lead_note) && (
                <div>
                  <div className="detail-section-title">Prospect</div>
                  <div className="info-grid">
                    {clinic.industry && <div><div className="info-label">Trade</div><div className="info-value">{clinic.industry}</div></div>}
                    {clinic.priority && (() => { const p = getPriority(clinic.priority); return p ? (
                      <div><div className="info-label">Priority</div>
                        <div className="info-value"><span style={{ display:"inline-flex", alignItems:"center", gap:6 }}><span style={{ width:8, height:8, borderRadius:"50%", background:p.color }} />{p.label} <span style={{ color:"#475569", fontSize:11 }}>· {p.hint}</span></span></div>
                      </div>) : null; })()}
                    {clinic.source && <div style={{ gridColumn: clinic.industry && clinic.priority ? "span 2" : "auto" }}><div className="info-label">Source</div><div className="info-value" style={{ fontSize:13 }}>{clinic.source}</div></div>}
                  </div>
                  {clinic.lead_note && (
                    <div style={{ marginTop:10, padding:"10px 12px", background:"rgba(255,154,92,0.08)", border:"1px solid rgba(255,154,92,0.2)", borderRadius:8 }}>
                      <div className="info-label" style={{ marginBottom:4 }}>The Leak / Angle</div>
                      <div style={{ fontSize:13, color:"#cbd5e1", lineHeight:1.5, whiteSpace:"pre-wrap" }}>{clinic.lead_note}</div>
                    </div>
                  )}
                </div>
              )}
              <div>
                <div className="detail-section-title">Compliance Essentials — client must provide</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {(() => {
                    const accounts = PACKAGE_ACCOUNTS[clinic.package] || [];
                    if (!accounts.length) return <span style={{ fontSize:12, color:"#64748b" }}>{clinic.package ? "None required" : "Select a package to see requirements"}</span>;
                    return accounts.map(x => (
                      <span key={x} style={{ padding:"5px 11px", background:"rgba(255,107,26,0.1)", border:"1px solid rgba(255,107,26,0.3)", borderRadius:6, fontSize:11, fontWeight:600, color:"#FF9A5C" }}>{x}</span>
                    ));
                  })()}
                </div>
              </div>
              <div>
                <div className="detail-section-title">Onboarding Progress ({doneT}/{allT.length})</div>
                {allT.length > 0 && (
                  <><div className="task-progress-label">{pct}% complete</div><div className="task-progress"><div className="task-progress-bar" style={{ width: pct + "%" }} /></div></>
                )}
              </div>
              <div>
                <div className="detail-section-title">Danger Zone</div>
                <button className="btn-danger" style={{ padding:"7px 12px", fontSize:12 }}
                  onClick={() => { if (window.confirm(`Remove ${clinic.name}? This can't be undone.`)) onDelete?.(clinic.id); }}>
                  <Ic.Trash /> Remove Business
                </button>
              </div>
            </>
          )}

          {/* ── OUTREACH ── */}
          {tab === "outreach" && (
            <div className="outreach-panel">
              <div className="detail-section-title">Outreach Tracker</div>
              <label className="outreach-field">
                <span>The leak you flagged</span>
                <input className="form-input" type="text" defaultValue={clinic.leak_flagged || ""} key={"leak-" + clinic.id}
                  placeholder="e.g. no mobile quote form, missed-call gap"
                  onBlur={e => onPatch(clinic.id, { leak_flagged: e.target.value })} />
              </label>
              <div className="form-row">
                <label className="outreach-field">
                  <span>Channel</span>
                  <select className="form-select" value={clinic.channel || ""} onChange={e => onPatch(clinic.id, { channel: e.target.value })}>
                    <option value="">&#8212;</option>
                    <option value="email">Email</option>
                    <option value="messenger">Messenger</option>
                    <option value="instagram">Instagram DM</option>
                    <option value="nextdoor">Nextdoor</option>
                    <option value="yelp">Yelp</option>
                    <option value="call">Phone call</option>
                  </select>
                </label>
                <label className="outreach-field">
                  <span>Outreach stage</span>
                  <select className="form-select" value={clinic.outreach_stage || "New"} onChange={e => onPatch(clinic.id, { outreach_stage: e.target.value })}>
                    {OUTREACH_STAGES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label className="outreach-field">
                  <span>Date sent</span>
                  <input className="form-input" type="date" value={clinic.date_sent || ""} onChange={e => onPatch(clinic.id, { date_sent: e.target.value })} />
                </label>
                <label className="outreach-field">
                  <span>Next follow-up</span>
                  <input className="form-input" type="date" value={clinic.next_follow_up || ""} onChange={e => onPatch(clinic.id, { next_follow_up: e.target.value })} />
                </label>
              </div>
              <div style={{ display:"flex", gap:18, marginTop:4 }}>
                <label className="outreach-check">
                  <input type="checkbox" checked={!!clinic.watched} onChange={e => onPatch(clinic.id, { watched: e.target.checked })} /> Watched
                </label>
                <label className="outreach-check">
                  <input type="checkbox" checked={!!clinic.replied} onChange={e => onPatch(clinic.id, { replied: e.target.checked })} /> Replied
                </label>
              </div>
            </div>
          )}

          {/* ── TASKS ── */}
          {tab === "tasks" && (
            <>
              {/* Package badge + progress */}
              {clinic.package ? (
                <div style={{ padding:"12px 16px", background:"rgba(255,107,26,0.1)", border:"1px solid rgba(255,107,26,0.25)", borderRadius:8, marginBottom:18, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <span style={{ fontSize:10, color:"#FF9A5C", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>Package</span>
                    <div style={{ color:"#f8fafc", fontWeight:700, fontSize:14, marginTop:2 }}>{clinic.package}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#64748b", fontSize:11 }}>{doneT} of {allT.length} done</div>
                    <div style={{ width:80, height:4, background:"rgba(255,255,255,0.07)", borderRadius:2, marginTop:5 }}>
                      <div style={{ height:"100%", background:"#FF6B1A", borderRadius:2, width: pct + "%" }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding:"10px 14px", background:"rgba(255,255,255,0.03)", border:"1px dashed rgba(255,255,255,0.1)", borderRadius:8, marginBottom:18, fontSize:12, color:"#64748b" }}>
                  No package selected. Edit this business to assign a package and load the task checklist.
                </div>
              )}

              {/* Task sections: Your Tasks + Client Tasks */}
              {[
                { type:"alignment", tasks:aTasks, key:"alignmentTasks", label:"Your Tasks", sublabel:"Primed & Booked (Matthew)", accent:"#FF6B1A" },
                { type:"business",  tasks:cTasks, key:"clinicTasks",    label:"Client Tasks", sublabel:"What the business owner needs to complete", accent:"#10b981" },
              ].map(({ type, tasks, key, label, sublabel, accent }) => {
                const secs = [...new Set(tasks.map(t => t.section).filter(Boolean))];
                const doneCount = tasks.filter(t => t.done).length;
                return (
                  <div key={type} style={{ marginBottom:24 }}>
                    {/* Section header */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                      <div style={{ width:3, height:36, background:accent, borderRadius:2, flexShrink:0 }} />
                      <div>
                        <div style={{ color:"#f8fafc", fontWeight:700, fontSize:13 }}>{label}</div>
                        <div style={{ color:"#64748b", fontSize:11, marginTop:1 }}>{sublabel} &middot; {doneCount}/{tasks.length}</div>
                      </div>
                    </div>

                    {tasks.length === 0 ? (
                      <div style={{ fontSize:12, color:"#475569", padding:"8px 0 4px 13px" }}>No tasks loaded. Assign a package to populate this list.</div>
                    ) : (
                      secs.map(sec => {
                        const st = tasks.filter(t => t.section === sec);
                        const sd = st.filter(t => t.done).length;
                        const isExp = expanded[type + "-" + sec] !== false; // default expanded
                        return (
                          <div key={sec} style={{ marginBottom:8 }}>
                            <div onClick={() => toggleExp(type + "-" + sec)}
                              style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:"rgba(11,17,33,0.6)", borderRadius:6, cursor:"pointer", userSelect:"none", borderLeft:`3px solid ${sd === st.length && sd > 0 ? accent : "rgba(255,255,255,0.06)"}` }}>
                              <span style={{ transform: isExp ? "rotate(90deg)" : "none", transition:"transform 0.2s", fontSize:10, color:"#64748b" }}>&#9654;</span>
                              <span style={{ fontSize:11, fontWeight:700, color: sd === st.length && sd > 0 ? accent : "#cbd5e1", textTransform:"uppercase", letterSpacing:"0.08em", flex:1 }}>{sec}</span>
                              <span style={{ fontSize:10, color: sd === st.length && sd > 0 ? accent : "#64748b", fontFamily:"'JetBrains Mono',monospace" }}>{sd}/{st.length}</span>
                            </div>
                            {isExp && (
                              <div className="task-list" style={{ marginTop:4 }}>
                                {st.map(t => (
                                  <div key={t.id} className="task-item">
                                    <div className={"task-checkbox" + (t.done ? " done" : "")}
                                      style={t.done ? { borderColor:accent, background:accent+"22" } : {}}
                                      onClick={() => onUpdate({ ...clinic, [key]: tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x) })}>
                                      {t.done && <Ic.Check />}
                                    </div>
                                    <span className={"task-name" + (t.done ? " done" : "")}>{t.name}</span>
                                    <button className="task-delete" onClick={() => onUpdate({ ...clinic, [key]: tasks.filter(x => x.id !== t.id) })}>&#x2715;</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* Add custom task */}
                    <div className="add-task-row" style={{ marginTop:6 }}>
                      <input className="add-task-input"
                        placeholder={`Add ${label.toLowerCase()} task…`}
                        value={type === "alignment" ? newATask : newCTask}
                        onChange={e => type === "alignment" ? setNewATask(e.target.value) : setNewCTask(e.target.value)}
                        onKeyDown={e => {
                          const v = type === "alignment" ? newATask : newCTask;
                          if (e.key === "Enter" && v.trim()) {
                            onUpdate({ ...clinic, [key]: [...tasks, { id: uid(), name: v.trim(), done: false }] });
                            type === "alignment" ? setNewATask("") : setNewCTask("");
                          }
                        }} />
                      <button className="btn-primary" style={{ padding:"8px 12px", fontSize:12 }} onClick={() => {
                        const v = type === "alignment" ? newATask : newCTask;
                        if (v.trim()) {
                          onUpdate({ ...clinic, [key]: [...tasks, { id: uid(), name: v.trim(), done: false }] });
                          type === "alignment" ? setNewATask("") : setNewCTask("");
                        }
                      }}>Add</button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ── FOLLOW-UPS ── */}
          {tab === "followups" && (
            <>
              <SuggestBanner />
              {fus.length === 0 ? (
                <div className="empty-state" style={{ padding:"32px 0" }}>
                  <div className="empty-icon">&#9889;</div>
                  <div className="empty-title">No sequences yet</div>
                  <div className="empty-sub">Launch a follow-up sequence for this business</div>
                  <button className="btn-primary" style={{ marginTop:16 }} onClick={() => onOpenLaunch(clinic)}>
                    <Ic.Zap /> Launch Sequence
                  </button>
                </div>
              ) : (
                <>
                  {activeFu.length > 0 && (
                    <div>
                      <div className="detail-section-title">Active ({activeFu.length})</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                        {activeFu.map(fu => {
                          const trig = getTrigger(fu.trigger);
                          const sent = fu.steps.filter(s => s.status === "sent").length;
                          const p    = fu.totalSteps ? Math.round((sent / fu.totalSteps) * 100) : 0;
                          return (
                            <div key={fu.id} className="fu-row">
                              <div style={{ width:32, height:32, borderRadius:8, background:`${trig.color}18`, display:"flex", alignItems:"center", justifyContent:"center", color:trig.color, fontSize:15, flexShrink:0 }}>{trig.icon}</div>
                              <div className="fu-row-body">
                                <div className="fu-row-name">{fu.seqName}</div>
                                <div className="fu-row-meta">{trig.label} &middot; {timeAgo(fu.triggeredAt)}</div>
                                <div style={{ marginTop:6 }}>
                                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                                    <span style={{ fontSize:10, color:"#475569" }}>Step {sent}/{fu.totalSteps}</span>
                                    <span style={{ fontSize:10, color:"#475569" }}>{p}%</span>
                                  </div>
                                  <div className="task-progress" style={{ marginBottom:0 }}>
                                    <div className="task-progress-bar" style={{ width: p + "%" }} />
                                  </div>
                                </div>
                                <div style={{ display:"flex", gap:5, marginTop:8, flexWrap:"wrap" }}>
                                  {fu.steps.map((s, i) => (
                                    <button key={s.id} onClick={() => setPreviewStep(s)}
                                      style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 8px", borderRadius:5, background: s.status === "sent" ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)", border:`1px solid ${s.status === "sent" ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)"}`, cursor:"pointer", fontSize:11, color: s.status === "sent" ? "#4ade80" : "#64748b" }}>
                                      <Ic.Mail /> #{i+1}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="fu-row-actions">
                                <button className="btn-danger" title="Pause"  onClick={() => updateFu(fu.id, { status:"paused"    })}><Ic.Pause /></button>
                                <button className="btn-danger" title="Cancel" onClick={() => updateFu(fu.id, { status:"cancelled" })}><Ic.Stop /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {histFu.length > 0 && (
                    <div>
                      <div className="detail-section-title">History ({histFu.length})</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {histFu.map(fu => {
                          const trig = getTrigger(fu.trigger);
                          return (
                            <div key={fu.id} className="fu-row" style={{ opacity:0.65 }}>
                              <div style={{ width:32, height:32, borderRadius:8, background:`${trig.color}12`, display:"flex", alignItems:"center", justifyContent:"center", color:trig.color, fontSize:15, flexShrink:0 }}>{trig.icon}</div>
                              <div className="fu-row-body">
                                <div className="fu-row-name">{fu.seqName}</div>
                                <div className="fu-row-meta">{trig.label} &middot; {timeAgo(fu.triggeredAt)}</div>
                              </div>
                              <FuBadge fu={fu} />
                              {fu.status === "paused" && (
                                <button className="btn-ghost" style={{ fontSize:11, padding:"4px 8px", marginLeft:6 }}
                                  onClick={() => updateFu(fu.id, { status:"active" })}>
                                  <Ic.Play /> Resume
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

        </div>
      </div>

      {previewStep && <MsgPreviewModal step={previewStep} clinic={clinic} onClose={() => setPreviewStep(null)} />}
    </div>
  );
}


// ─── Dashboard View ───────────────────────────────────────────────────────────

function DashboardView({ clinics, sequences, onAdd, onEdit, onDelete, onSelect, onStatusChange, onOpenLaunch }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = clinics.filter(c => c.archived).length;

  const filtered = clinics.filter(c => {
    // Archived means dead or disqualified. The rows stay in the table on
    // purpose - the prospector's duplicate check reads contact_phone out of
    // `clinics`, so removing them would make every business we already ruled
    // out resurface on the next search. They are hidden here instead, and the
    // count is shown so they are not forgotten.
    if (c.archived && !showArchived) return false;
    const q = search.toLowerCase();
    const ms = !q || c.name.toLowerCase().includes(q) || (c.contact_name||"").toLowerCase().includes(q) || (c.contact_email||"").toLowerCase().includes(q);
    // "All" means all ACTIVE businesses. Anything on a `closed` stage is
    // finished with - screened out, or pitched and lost - and would otherwise
    // sit in this list forever. Pick that stage from the filter to see them.
    return ms && (filter === "all" ? !CLOSED_STAGES.has(c.status) : c.status === filter);
  });

  return (
    <>
      <div className="main-header">
        <div>
          <div className="page-title">Businesses</div>
          <div className="page-subtitle">
            {/* Every count here excludes archived rows, so active + closed out +
                archived adds up to the whole table. Counting by status alone read
                9 taken-down businesses as "active" because they keep status=lead
                and only their outreach_stage is Dead - the list hid them and the
                counter did not, which is how the CRM came to disagree with both
                Workers & Pages and Web Analytics. */}
            {clinics.filter(c => !c.archived && !CLOSED_STAGES.has(c.status)).length} active &middot; {clinics.filter(c => !c.archived && (c.followUps||[]).some(f => f.status === "active")).length} with active follow-ups
            {clinics.filter(c => !c.archived && CLOSED_STAGES.has(c.status)).length > 0 &&
              <> &middot; {clinics.filter(c => !c.archived && CLOSED_STAGES.has(c.status)).length} closed out</>}
            {archivedCount > 0 && <> &middot; {archivedCount} archived</>}
          </div>
        </div>
        <button className="btn-primary header-add-btn" onClick={onAdd}><Ic.Plus /> Add Business</button>
      </div>
      <div className="main-content">
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon"><Ic.Search /></span>
            <input className="search-input" placeholder="Search businesses&#8230;" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {PIPELINE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {archivedCount > 0 && (
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:"#475569", whiteSpace:"nowrap", cursor:"pointer" }}>
              <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
              Show archived ({archivedCount})
            </label>
          )}
        </div>

        {/* Desktop table */}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Business</th><th>Contact</th><th>Package</th><th>Status</th><th>Follow-ups</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-icon">&#129520;</div>
                    <div className="empty-title">{clinics.length === 0 ? "No businesses yet" : "No results"}</div>
                    <div className="empty-sub">{clinics.length === 0 ? "Click 'Add Business' to get started" : "Adjust search or filter"}</div>
                  </div>
                </td></tr>
              ) : filtered.map(c => {
                const activeFuCount = (c.followUps||[]).filter(f => f.status === "active").length;
                const hasSuggest    = !activeFuCount && STAGE_AUTO_TRIGGER[c.status] && sequences.some(s => s.trigger === STAGE_AUTO_TRIGGER[c.status] && s.active);
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="clinic-name-cell">
                        {c.priority && (() => { const p = getPriority(c.priority); return p ? <span title={`${p.label} · ${p.hint}`} style={{ width:8, height:8, borderRadius:"50%", background:p.color, flexShrink:0 }} /> : null; })()}
                        <span className="clinic-name-text">{c.name}</span>
                        {c.industry && <span style={{ fontSize:10, color:"#475569", background:"rgba(255,255,255,0.05)", padding:"2px 6px", borderRadius:4 }}>{c.industry}</span>}
                        <span className="link-icon" onClick={() => onSelect(c)}><Ic.ExternalLink /></span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight:500, color:"#f8fafc" }}>{c.contact_name || "&#8212;"}</div>
                      {c.contact_email && <div style={{ fontSize:11, color:"#475569", marginTop:1 }}>{c.contact_email}</div>}
                    </td>
                    <td style={{ fontSize:12, color:"#64748b" }}>{c.package || "&#8212;"}</td>
                    <td>
                      <StatusDropdown status={c.status} onChange={s => onStatusChange(c.id, s)} />
                      {c.outreach_stage && c.outreach_stage !== "New" && (
                        <div style={{ marginTop:4 }}>
                          <span style={{ fontSize:10, color:"#FF9A5C" }}>&#9679; {c.outreach_stage}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {activeFuCount > 0 ? (
                        <span className="fu-badge fu-active" style={{ cursor:"pointer" }} onClick={() => onSelect(c)}>{activeFuCount} active</span>
                      ) : hasSuggest ? (
                        <button className="btn-ghost" style={{ fontSize:11, padding:"4px 8px", borderColor:"rgba(255,107,26,0.3)", color:"#FF9A5C" }} onClick={() => onOpenLaunch(c)}>
                          <Ic.Zap /> Suggested
                        </button>
                      ) : (
                        <button className="btn-ghost" style={{ fontSize:11, padding:"4px 8px" }} onClick={() => onOpenLaunch(c)}>
                          <Ic.Zap /> Launch
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="btn-ghost" onClick={() => onEdit(c)} style={{ padding:"5px 8px" }}><Ic.Edit /></button>
                        <button className="btn-danger" onClick={() => onDelete(c.id)}><Ic.Trash /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="clinic-card-list">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">&#129520;</div>
              <div className="empty-title">{clinics.length === 0 ? "No businesses yet" : "No results"}</div>
              <div className="empty-sub">{clinics.length === 0 ? "Tap + to add" : "Adjust search"}</div>
            </div>
          ) : filtered.map(c => {
            const activeFuCount = (c.followUps||[]).filter(f => f.status === "active").length;
            return (
              <div key={c.id} className="clinic-list-card" onClick={() => onSelect(c)}>
                <div className="clinic-list-card-icon"><Ic.Clinic /></div>
                <div className="clinic-list-card-body">
                  <div className="clinic-list-card-name">{c.name}</div>
                  <div className="clinic-list-card-sub">{c.contact_name || "&#8212;"}</div>
                </div>
                <div className="clinic-list-card-right">
                  <div onClick={e => e.stopPropagation()}><StatusDropdown status={c.status} onChange={s => onStatusChange(c.id, s)} /></div>
                  {c.outreach_stage && c.outreach_stage !== "New" && (
                    <span style={{ fontSize:10, color:"#FF9A5C" }}>&#9679; {c.outreach_stage}</span>
                  )}
                  {activeFuCount > 0 && <span className="fu-badge fu-active">{activeFuCount} active</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Pipeline View ────────────────────────────────────────────────────────────

function PipelineView({ clinics, sequences, onSelect, onStatusChange, onOpenLaunch }) {
  const [open, setOpen] = useState(() => { const m = {}; PIPELINE_STAGES.forEach(s => { m[s.id] = true; }); return m; });
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(null);
  const dragId = useRef(null);

  return (
    <>
      <div className="main-header">
        <div>
          <div className="page-title">Pipeline</div>
          <div className="page-subtitle">Drag cards between stages &middot; click to view details</div>
        </div>
      </div>
      <div className="main-content">
        <div className="pipeline-list">
          {PIPELINE_GROUPS.map((group, gi) => {
            // `!s.hidden` keeps screened-out businesses off the board entirely -
            // no row, and not counted in the group total either.
            const groupStages = PIPELINE_STAGES.filter(s => s.group === group.id && !s.hidden);
            const groupTotal  = clinics.filter(c => groupStages.some(s => s.id === c.status)).length;
            return (
              <div key={group.id} style={{ marginBottom: gi < PIPELINE_GROUPS.length - 1 ? 28 : 0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, paddingBottom:8, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ fontWeight:700, fontSize:13, color:"#f8fafc", letterSpacing:"0.02em" }}>{group.label}</span>
                  <span style={{ fontSize:11, color:"#475569" }}>{group.description}</span>
                  <span style={{ marginLeft:"auto", fontSize:11, color:"#475569" }}>{groupTotal} business{groupTotal !== 1 ? "es" : ""}</span>
                </div>
                {groupStages.map(stage => {
                  const stageClinics = clinics.filter(c => c.status === stage.id);
                  const isOpen = open[stage.id];
                  const isOver = dragOver === stage.id;
                  return (
                    <div key={stage.id} className={"stage-row" + (isOver ? " drag-over" : "")}
                      onDragOver={e => { e.preventDefault(); setDragOver(stage.id); }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
                      onDrop={e => { e.preventDefault(); if (dragId.current) { onStatusChange(dragId.current, stage.id); dragId.current = null; } setDragOver(null); setDragging(null); }}>
                      <div className="stage-header" onClick={() => setOpen(o => ({ ...o, [stage.id]: !o[stage.id] }))}>
                        <span className={"stage-chevron" + (isOpen ? " open" : "")}><Ic.ChevronRight /></span>
                        <span className="stage-dot-lg" style={{ background: stage.color }} />
                        <span className="stage-label">{stage.label}</span>
                        <span className={"stage-count" + (stageClinics.length === 0 ? " zero" : "")}>{stageClinics.length}</span>
                      </div>
                      {isOpen && (stageClinics.length > 0 ? (
                        <div className="stage-cards">
                          {stageClinics.map(c => {
                            const activeFu  = (c.followUps||[]).filter(f => f.status === "active");
                            const hasSuggest = !activeFu.length && STAGE_AUTO_TRIGGER[c.status] && sequences.some(s => s.trigger === STAGE_AUTO_TRIGGER[c.status] && s.active);
                            return (
                              <div key={c.id} className={"clinic-card" + (dragging === c.id ? " dragging" : "")}
                                style={{ borderLeftColor: stage.color }}
                                draggable
                                onDragStart={e => { dragId.current = c.id; setDragging(c.id); e.dataTransfer.effectAllowed = "move"; }}
                                onDragEnd={() => { dragId.current = null; setDragging(null); setDragOver(null); }}
                                onClick={() => onSelect(c)}>
                                <div className="card-icon"><Ic.Clinic /></div>
                                <div className="card-info">
                                  <div className="card-name">{c.name}</div>
                                  <div className="card-contact">{c.contact_name || "&#8212;"}</div>
                                  <div className="card-date">{formatDate(c.start_date)}</div>
                                  {c.outreach_stage && c.outreach_stage !== "New" && (
                                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:5 }}>
                                      <span style={{ width:6, height:6, borderRadius:"50%", background:"#FF9A5C", display:"inline-block" }} />
                                      <span style={{ fontSize:10, color:"#FF9A5C" }}>{c.outreach_stage}</span>
                                    </div>
                                  )}
                                  {activeFu.length > 0 && (
                                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:5 }}>
                                      <span style={{ width:6, height:6, borderRadius:"50%", background:"#4ade80", display:"inline-block" }} />
                                      <span style={{ fontSize:10, color:"#4ade80" }}>{activeFu.length} sequence{activeFu.length > 1 ? "s" : ""} running</span>
                                    </div>
                                  )}
                                  {hasSuggest && (
                                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:5 }}
                                      onClick={e => { e.stopPropagation(); onOpenLaunch(c); }}>
                                      <span style={{ width:6, height:6, borderRadius:"50%", background:"#FF6B1A", display:"inline-block" }} />
                                      <span style={{ fontSize:10, color:"#FF9A5C", cursor:"pointer" }}>Follow-up suggested &#8599;</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : <div className="stage-drop-hint">Drop a business here</div>)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Follow-up View ───────────────────────────────────────────────────────────

function FollowupView({ clinics, sequences, setSequences, onOpenLaunch, onSelectClinic }) {
  const [fuTab, setFuTab] = useState("activity");
  const [editingSeq, setEditingSeq] = useState(null);
  const [showNewSeq, setShowNewSeq] = useState(false);
  const [previewSeq, setPreviewSeq] = useState(null);
  const [seqSaving, setSeqSaving] = useState(false);

  const allFu       = clinics.flatMap(c => (c.followUps||[]).map(f => ({ ...f, clinic: c })));
  const activeFu    = allFu.filter(f => f.status === "active");
  const completedFu = allFu.filter(f => f.status === "completed");
  const pausedFu    = allFu.filter(f => f.status === "paused");

  // Persist sequences to D1 via /api/sequences
  const persistSequences = async (next) => {
    setSeqSaving(true);
    try {
      await apiFetch(`/sequences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch (_) {}
    setSeqSaving(false);
  };

  const saveSeq = seq => {
    const next = sequences.find(s => s.id === seq.id)
      ? sequences.map(s => s.id === seq.id ? seq : s)
      : [...sequences, seq];
    setSequences(next);
    persistSequences(next);
    setEditingSeq(null);
    setShowNewSeq(false);
  };

  const toggleActive = (seqId) => {
    const next = sequences.map(s => s.id === seqId ? { ...s, active: !s.active } : s);
    setSequences(next);
    persistSequences(next);
  };

  const deleteSeq = (seqId) => {
    const next = sequences.filter(s => s.id !== seqId);
    setSequences(next);
    persistSequences(next);
  };

  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setFuTab(id)}
      style={{ background:"none", border:"none", cursor:"pointer", padding:"10px 16px", fontSize:13, fontWeight:600,
        color: fuTab===id ? "#f8fafc" : "#475569",
        borderBottom: fuTab===id ? "2px solid #FF6B1A" : "2px solid transparent",
        marginBottom:-1, transition:"all 0.15s", fontFamily:"Manrope,sans-serif" }}>
      {label}
    </button>
  );

  return (
    <>
      <div className="main-header">
        <div>
          <div className="page-title">Follow-ups</div>
          <div className="page-subtitle">{activeFu.length} active &middot; {sequences.filter(s => s.active).length} sequences enabled</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {seqSaving && <span style={{ fontSize:11, color:"#475569" }}>Saving&hellip;</span>}
          <button className="btn-ghost" onClick={() => setShowNewSeq(true)}><Ic.Plus /> Sequence</button>
          <button className="btn-primary" onClick={() => onOpenLaunch(null)}><Ic.Zap /> Launch</button>
        </div>
      </div>
      <div className="main-content">

        {/* Sub-tabs */}
        <div style={{ display:"flex", gap:2, marginBottom:20, borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          {tabBtn("activity", "Activity")}
          {tabBtn("sequences", "Sequences")}
        </div>

        {/* ── Activity ── */}
        {fuTab === "activity" && (
          <>
            {/* Stats */}
            <div className="stats-grid">
              {[
                { label:"Active",    value: activeFu.length,                         color:"#4ade80" },
                { label:"Paused",    value: pausedFu.length,                         color:"#f59e0b" },
                { label:"Completed", value: completedFu.length,                      color:"#94a3b8" },
                { label:"Sequences", value: sequences.filter(s => s.active).length,  color:"#FF9A5C" },
              ].map((st, i) => (
                <div key={i} className="stat-card">
                  <div className="stat-label" style={{ color: st.color }}>{st.label}</div>
                  <div className="stat-value">{st.value}</div>
                </div>
              ))}
            </div>

            {/* Active sequence cards grouped by sequence name */}
            {activeFu.length === 0 && pausedFu.length === 0 && completedFu.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">&#9889;</div>
                <div className="empty-title">No follow-ups yet</div>
                <div className="empty-sub">Launch a sequence from a business, or click Launch above</div>
              </div>
            ) : (
              <>
                {/* Group active+paused by sequence for a cleaner view */}
                {sequences.map(seq => {
                  const seqFu = allFu.filter(f => f.seqId === seq.id && (f.status === "active" || f.status === "paused"));
                  if (seqFu.length === 0) return null;
                  const trig = getTrigger(seq.trigger);
                  return (
                    <div key={seq.id} className="table-wrap" style={{ marginBottom:16 }}>
                      {/* Sequence header */}
                      <div style={{ padding:"12px 18px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:28, height:28, borderRadius:6, background:`${trig.color}18`, display:"flex", alignItems:"center", justifyContent:"center", color:trig.color, fontSize:14, flexShrink:0 }}>{trig.icon}</div>
                        <div style={{ flex:1 }}>
                          <span style={{ color:"#f8fafc", fontWeight:700, fontSize:13 }}>{seq.name}</span>
                          <span style={{ color:"#475569", fontSize:11, marginLeft:8 }}>{trig.label} &middot; {seq.steps.length} steps</span>
                        </div>
                        <span style={{ color:"#475569", fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{seqFu.length} business{seqFu.length > 1 ? "es" : ""}</span>
                      </div>
                      {/* Clinic rows */}
                      <table>
                        <thead>
                          <tr><th>Business</th><th>Progress</th><th>Status</th><th>Launched</th><th></th></tr>
                        </thead>
                        <tbody>
                          {seqFu.sort((a,b) => b.triggeredAt - a.triggeredAt).map(fu => {
                            const sent = fu.steps.filter(s => s.status === "sent").length;
                            const p    = fu.totalSteps ? Math.round((sent / fu.totalSteps) * 100) : 0;
                            return (
                              <tr key={fu.id}>
                                <td style={{ cursor:"pointer" }} onClick={() => onSelectClinic(fu.clinic)}>
                                  <div style={{ fontWeight:600, color:"#f8fafc" }}>{fu.clinic.name}</div>
                                  <div style={{ fontSize:11, color:"#475569", marginTop:1 }}>{fu.clinic.contact_name || "&#8212;"}</div>
                                </td>
                                <td>
                                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                    <div style={{ flex:1, height:4, background:"rgba(255,255,255,0.07)", borderRadius:2, minWidth:80 }}>
                                      <div style={{ height:"100%", background: fu.status==="active" ? "#4ade80" : "#64748b", borderRadius:2, width: p+"%" }} />
                                    </div>
                                    <span style={{ fontSize:11, color:"#475569", fontFamily:"monospace", whiteSpace:"nowrap" }}>
                                      Step {sent}/{fu.totalSteps}
                                    </span>
                                  </div>
                                </td>
                                <td><FuBadge fu={fu} /></td>
                                <td style={{ fontSize:12, color:"#475569" }}>{timeAgo(fu.triggeredAt)}</td>
                                <td>
                                  <button className="btn-ghost" style={{ fontSize:11, padding:"4px 8px" }} onClick={() => onSelectClinic(fu.clinic)}>
                                    View
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {/* Completed history (collapsed) */}
                {completedFu.length > 0 && (
                  <div className="table-wrap">
                    <div style={{ padding:"12px 18px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ color:"#94a3b8", fontWeight:600, fontSize:13 }}>Completed</span>
                      <span style={{ color:"#475569", fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{completedFu.length}</span>
                    </div>
                    <table>
                      <thead><tr><th>Business</th><th>Sequence</th><th>Launched</th></tr></thead>
                      <tbody>
                        {completedFu.slice(0,5).map(fu => (
                          <tr key={fu.id} style={{ cursor:"pointer" }} onClick={() => onSelectClinic(fu.clinic)}>
                            <td style={{ color:"#64748b" }}>{fu.clinic.name}</td>
                            <td style={{ color:"#64748b", fontSize:12 }}>{fu.seqName}</td>
                            <td style={{ fontSize:12, color:"#475569" }}>{timeAgo(fu.triggeredAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Sequences ── */}
        {fuTab === "sequences" && (
          <>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
              <button className="btn-primary" onClick={() => setShowNewSeq(true)}><Ic.Plus /> New Sequence</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {sequences.map(seq => {
                const trig     = getTrigger(seq.trigger);
                const expanded = previewSeq === seq.id;
                const usage    = clinics.filter(c => (c.followUps||[]).some(f => f.seqId === seq.id)).length;
                const activeCount = clinics.reduce((n,c) => n + (c.followUps||[]).filter(f => f.seqId===seq.id && f.status==="active").length, 0);
                return (
                  <div key={seq.id} className="seq-card">
                    {/* Row 1: icon + name + badges */}
                    <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"16px 18px 12px" }}>
                      <div className="seq-trigger-icon" style={{ background:`${trig.color}18`, color:trig.color, flexShrink:0 }}>{trig.icon}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                          <span style={{ color:"#f8fafc", fontWeight:700, fontSize:14 }}>{seq.name}</span>
                          <span className={`fu-badge ${seq.active ? "fu-active" : "fu-paused"}`}>{seq.active ? "Active" : "Paused"}</span>
                          {activeCount > 0 && <span className="fu-badge fu-active">{activeCount} running</span>}
                          {usage > 0 && !activeCount && <span style={{ fontSize:11, color:"#64748b" }}>{usage} business{usage !== 1 ? "es" : ""}</span>}
                        </div>
                        <div style={{ color:"#475569", fontSize:12 }}>
                          {trig.label} &middot; {seq.steps.length} email step{seq.steps.length !== 1 ? "s" : ""}
                        </div>
                        {/* Step pills */}
                        <div style={{ display:"flex", alignItems:"center", gap:3, marginTop:8, flexWrap:"wrap" }}>
                          {seq.steps.map((s,i) => (
                            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:3 }}>
                              {i > 0 && <div className="seq-connector" />}
                              <div className="seq-step-pill" style={{ background:"rgba(255,154,92,0.15)", color:"#FF9A5C" }}>
                                <Ic.Mail />
                              </div>
                              <span style={{ fontSize:10, color:"#475569", marginRight:2 }}>
                                {stepDelayLabel(s, i, true)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Action buttons — vertical stack on right */}
                      <div style={{ display:"flex", flexDirection:"column", gap:5, flexShrink:0 }}>
                        <button className="btn-ghost" style={{ padding:"5px 10px", fontSize:12, justifyContent:"center" }} onClick={() => setPreviewSeq(expanded ? null : seq.id)}>
                          {expanded ? "Hide" : "Preview"}
                        </button>
                        <div style={{ display:"flex", gap:5 }}>
                          <button className="btn-ghost" style={{ padding:"5px 8px", flex:1, justifyContent:"center" }} title={seq.active ? "Pause" : "Activate"} onClick={() => toggleActive(seq.id)}>
                            {seq.active ? <Ic.Pause /> : <Ic.Play />}
                          </button>
                          <button className="btn-ghost" style={{ padding:"5px 8px", flex:1, justifyContent:"center" }} title="Edit" onClick={() => setEditingSeq(seq)}><Ic.Edit /></button>
                          <button className="btn-danger" style={{ padding:"5px 8px", flex:1, justifyContent:"center" }} title="Delete" onClick={() => deleteSeq(seq.id)}><Ic.Trash /></button>
                        </div>
                      </div>
                    </div>

                    {/* Preview pane */}
                    {expanded && (
                      <div className="seq-preview">
                        {seq.steps.map((s,i) => (
                          <div key={s.id} className="seq-step-preview">
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: s.body ? 6 : 0 }}>
                              <span style={{ color:"#475569", fontSize:11, fontFamily:"monospace", minWidth:46 }}>Step {i+1}</span>
                              <span style={{ color:"#FF9A5C" }}><Ic.Mail /></span>
                              <span style={{ color:"#94a3b8", fontSize:12 }}>
                                {i===0 && !s.delay ? "Immediately" : `After ${s.delay} ${s.delayUnit}`}
                                {s.channel==="email" && s.subject ? ` \u2014 "${s.subject}"` : ""}
                              </span>
                            </div>
                            {s.body && (
                              <div style={{ color:"#64748b", fontSize:12, lineHeight:1.6, fontFamily:"monospace", whiteSpace:"pre-wrap", maxHeight:64, overflow:"hidden", marginTop:2 }}>
                                {s.body.slice(0,200)}{s.body.length > 200 ? "\u2026" : ""}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {(editingSeq || showNewSeq) && (
        <SequenceEditorModal seq={editingSeq} onSave={saveSeq} onClose={() => { setEditingSeq(null); setShowNewSeq(false); }} />
      )}
    </>
  );
}


// ─── Login ────────────────────────────────────────────────────────────────────

function SimpleLogin({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);
  const submit = async e => {
    e.preventDefault();
    if (checking) return;
    setChecking(true); setErr("");
    const ok = await validatePassword(pw);
    if (ok) {
      localStorage.setItem("aa_secret", pw);
      localStorage.setItem("aa_auth", "1");
      onLogin();
    } else {
      setErr("Incorrect password"); setPw(""); setChecking(false);
    }
  };
  return (
    <>
      <style>{css}</style>
      <div className="login-page">
        <div className="login-card">
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14, marginBottom:28 }}>
            <svg width="72" height="72" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <polygon points="50,5 89,27.5 89,72.5 50,95 11,72.5 11,27.5" fill="none" stroke="#FF6B1A" strokeWidth="6" strokeLinejoin="round"/>
              <g transform="translate(-2.5 4)">
                <path d="M28 54 L41 66 L60 45" stroke="#FF6B1A" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <g transform="translate(60 45) rotate(-47)">
                  <path d="M14.5 -3 C17 -2.6 19 -2.4 21 -2.8 C24 -3.4 27 -3.6 28 -2.4 Q29.5 0 28 2.4 C27 3.6 24 3.4 21 2.8 C19 2.4 17 2.6 14.5 3 Z" fill="#F2EFE9"/>
                  <circle cx="26" cy="0" r="0.9" fill="#1A1C1F"/>
                  <rect x="8" y="-5.8" width="6.5" height="11.6" rx="0.8" fill="#C9CCD1"/>
                  <path d="M10.5 -5.8 V5.8 M12.4 -5.8 V5.8" stroke="#8E939A" strokeWidth="0.7"/>
                  <path d="M0 -5 L8 -5.5 L8 5.5 L0 5 Q-1 0 0 -5 Z" fill="#E8C48A"/>
                  <path d="M0 -5 L4 -5.2 Q3.2 -2 4.3 0 Q5.2 2.4 4 5.2 L0 5 Q-1 0 0 -5 Z" fill="#FF6B1A"/>
                </g>
              </g>
            </svg>
            <div className="brand-name" style={{ fontSize:22 }}>PRIMED &amp; <span style={{ color:"#FF6B1A" }}>BOOKED</span></div>
          </div>
          <div className="login-title">Enter Password</div>
          <form style={{ display:"flex", flexDirection:"column", gap:14 }} onSubmit={submit}>
            {err && <div className="login-error">{err}</div>}
            <div className="form-group">
              <input className="form-input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" required autoFocus />
            </div>
            <button className="btn-login" type="submit" disabled={checking}>{checking ? "Signing in…" : "Sign in"}</button>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Playbook View ────────────────────────────────────────────────────────────

const PLAYBOOKS = {
  video: {
    title: "Video Outreach Playbook",
    subtitle: "Video outreach system for finding & closing home-service clients",
    blurb: "Personalized 60-second videos that call out the one leak on their site.",
    icon: "Zap",
    css: PLAYBOOK_CSS,
    html: PLAYBOOK_HTML,
    fullPageUrl: "/playbook.html",
    storagePrefix: "aa_chk_video_",
  },
  visual: {
    title: "Visual Audit Playbook",
    subtitle: "Screenshot-and-markup outreach — no camera, no recording",
    blurb: "A marked-up screenshot and a two-line caption, sent instead of a video.",
    icon: "Search",
    css: VISUAL_AUDIT_CSS,
    html: VISUAL_AUDIT_HTML,
    fullPageUrl: "/visual-audit-playbook.html",
    storagePrefix: "aa_chk_visual_",
  },
};

function PlaybookView() {
  const [variant, setVariant] = useState(null); // null | "video" | "visual"
  const ref = useRef(null);
  const active = variant ? PLAYBOOKS[variant] : null;

  // Re-wire the playbook's interactivity natively: persistent checklist + TOC scroll.
  useEffect(() => {
    const root = ref.current;
    if (!root || !active) return;

    // Persistent daily checklist (mirrors the standalone doc's localStorage behavior).
    // Keys are namespaced per playbook variant so the two documents' checklists
    // don't share (or clobber) each other's checked state.
    const boxes = [...root.querySelectorAll(".chk")];
    const handlers = [];
    boxes.forEach((el, i) => {
      const key = active.storagePrefix + i;
      try { if (localStorage.getItem(key) === "1") el.classList.add("on"); } catch (_) {}
      const h = () => {
        el.classList.toggle("on");
        try { localStorage.setItem(key, el.classList.contains("on") ? "1" : "0"); } catch (_) {}
      };
      el.addEventListener("click", h);
      handlers.push([el, h]);
    });

    const resetBtn = root.querySelector('[id^="chk-reset"]');
    const onReset = () => boxes.forEach((el, i) => {
      el.classList.remove("on");
      try { localStorage.setItem(active.storagePrefix + i, "0"); } catch (_) {}
    });
    if (resetBtn) resetBtn.addEventListener("click", onReset);

    // Smooth in-container scrolling for TOC + "back to contents" links.
    const anchors = [...root.querySelectorAll('a[href^="#"]')];
    const onAnchor = e => {
      const id = e.currentTarget.getAttribute("href").slice(1);
      const target = root.querySelector("#" + CSS.escape(id));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: "smooth", block: "start" }); }
    };
    anchors.forEach(a => a.addEventListener("click", onAnchor));

    return () => {
      handlers.forEach(([el, h]) => el.removeEventListener("click", h));
      if (resetBtn) resetBtn.removeEventListener("click", onReset);
      anchors.forEach(a => a.removeEventListener("click", onAnchor));
    };
  }, [variant]);

  if (!active) {
    return (
      <>
        <div className="main-header">
          <div>
            <div className="page-title">Sales Playbook</div>
            <div className="page-subtitle">Choose an outreach system</div>
          </div>
        </div>
        <div className="main-content">
          <div className="playbook-choice-grid">
            {Object.entries(PLAYBOOKS).map(([key, pb]) => {
              const Icon = Ic[pb.icon];
              return (
                <button key={key} className="playbook-choice-card" onClick={() => setVariant(key)}>
                  <div className="playbook-choice-icon"><Icon /></div>
                  <div className="playbook-choice-title">{pb.title}</div>
                  <div className="playbook-choice-sub">{pb.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{active.css}</style>
      <div className="main-header">
        <div>
          <button className="btn-ghost" style={{ marginBottom:10, fontSize:12, padding:"6px 10px" }} onClick={() => setVariant(null)}>
            <Ic.ArrowLeft /> All playbooks
          </button>
          <div className="page-title">{active.title}</div>
          <div className="page-subtitle">{active.subtitle}</div>
        </div>
        <a className="btn-ghost" href={active.fullPageUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
          <Ic.ExternalLink /> Open full page
        </a>
      </div>
      <div className="main-content">
        <div
          key={variant}
          ref={ref}
          className="pbdoc"
          data-theme="dark"
          dangerouslySetInnerHTML={{ __html: active.html }}
        />
      </div>
    </>
  );
}

// ─── Prospecting View ──────────────────────────────────────────────────────

function websiteCell(p) {
  const check = p.website_check || {};
  if (!p.website) return <span className="no-site">No website</span>;
  const bits = [];
  if (check.reachable === false) bits.push("unreachable");
  // "no viewport tag", not "not mobile-friendly". The check tests for the
  // presence of one meta tag; it cannot see horizontal overflow, so the old
  // label claimed more than the evidence supports. Four properly responsive
  // sites carried it on 2026-09-15. Verify with tools/probe-mobile.py before
  // this reaches a prospect. Keep in sync with buildLeadNote in
  // functions/api/_lib/prospecting.js.
  if (check.mobileFriendly === false) bits.push("no viewport tag — verify");
  if (check.listingLinkBroken) bits.push("listing link 404s, site OK");
  if (check.challenged) bits.push("bot-challenged, could not read");
  if (check.builderPlatform) bits.push(check.builderPlatform);
  return (
    <span className="has-site">
      <a href={p.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>site</a>
      {bits.length > 0 && <span className="no-site"> ({bits.join(", ")})</span>}
    </span>
  );
}

// Added 2026-09-16. The three signals a full day of by-hand screening died on,
// surfaced so the next screen is a glance instead of nine browser sessions.
//
// ⚠ ownerPhotoLikely is a LEAD, not a verdict — the author-name match is
// deliberately crude (see summarizePhotos). photo_authors carries the raw names
// so "0 owner photos" can always be checked by eye against a list of ordinary
// people's names. Same discipline as the viewport-tag rename.
// ⚠⚠ photoAuthorsOf EXISTS BECAUSE THIS CELL TOOK THE WHOLE PROSPECTOR PAGE
// WHITE ON 2026-09-18. photo_authors is a JSON STRING in D1 and the API
// serializer was not parsing it, so `p.photo_authors || []` handed back the
// string '[]' — truthy, length 2 — which fell into the branch below and called
// .join() on a string. Every row threw, so the page rendered nothing at all.
// The serializer is fixed; this stays so a shape change can never blank the
// page again. A cell should degrade, not crash.
function photoAuthorsOf(p) {
  const raw = p.photo_authors;
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string" || !raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function ownerPhotoCell(p) {
  const n = p.owner_photo_likely ?? 0;
  const authors = photoAuthorsOf(p);
  if (n > 0) return <span title={authors.join(", ")}>{n} owner photo{n === 1 ? "" : "s"}</span>;
  if (authors.length > 0) {
    return <span className="no-site" title={"Photo authors: " + authors.join(", ")}>
      no owner photos ({authors.length} by others)
    </span>;
  }
  return <span className="no-site">no photos at all</span>;
}

// ⚠ A LOWER BOUND. Places returns at most five reviews and cannot be asked for
// newest-first, so the real newest can only be more recent than this.
function reviewAgeCell(p) {
  const d = p.newest_review_sampled;
  if (!d) return <span className="no-site">no review dates</span>;
  const years = (Date.now() - new Date(d + "T00:00:00Z").getTime()) / (365.25 * 24 * 3600 * 1000);
  const label = years >= 1 ? `${years.toFixed(1)}y ago` : `${Math.max(1, Math.round(years * 12))}mo ago`;
  const sampled = p.review_sample_size ?? 0;
  const total = p.review_count ?? 0;
  const partial = sampled > 0 && total > sampled ? ` (newest of ${sampled} of ${total} sampled)` : "";
  return <span className={years >= 3 ? "no-site" : undefined} title={d + partial}>{label}</span>;
}

const GBP_STATUS_COLOR = { "Complete": "#10b981", "Incomplete": "#f59e0b", "Unclaimed / bare": "#ef4444" };

function gbpCell(p) {
  if (!p.gbp_status) return <span className="no-site">&#8212;</span>;
  const color = GBP_STATUS_COLOR[p.gbp_status] || "#64748b";
  return <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, color }}><span style={{ width:7, height:7, borderRadius:"50%", background:color, flexShrink:0 }} />{p.gbp_status}</span>;
}

// CSLB licence, from the `licenses` table (tools/build-license-import.py).
// That export is ACTIVE LICENCES ONLY, so "NOT ACTIVE" means no active licence
// carries this name -- Step 0 failed and the prospect is disqualified.
// "UNMATCHED"/"AMBIGUOUS" mean the lookup would not guess: expand the row.
const LICENSE_COLOR = {
  CLEAR: "#10b981",
  "NOT ACTIVE": "#ef4444",
  UNMATCHED: "#64748b",
  AMBIGUOUS: "#64748b",
};

function licenseCandidates(p) {
  const raw = p.license_candidates;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) || []; } catch { return []; }
}

function licenseCell(p) {
  const st = p.license_status;
  if (!st) return <span className="no-site">&#8212;</span>;
  // Any suspension reason that is not CLEAR is a hard red.
  const color = LICENSE_COLOR[st] || "#ef4444";
  // A pending secondary status means the licence is active TODAY but queued to
  // be suspended -- the case a date-based recheck reminder misses entirely.
  const pending = p.license_secondary ? " ⚠" : "";
  const label = st === "CLEAR" ? (p.license_no || "active") : st;
  return (
    <span
      title={[p.license_name, p.license_classes, p.license_secondary,
              p.license_expiration && "expires " + p.license_expiration,
              p.license_bond_cancel && "bond cancels " + p.license_bond_cancel]
             .filter(Boolean).join(" · ")}
      style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, color }}
    >
      <span style={{ width:7, height:7, borderRadius:"50%", background:color, flexShrink:0 }} />
      {label}{pending}
    </span>
  );
}

const SOCIAL_LABELS = { facebook: "FB", instagram: "IG", twitter: "X", linkedin: "in" };
const SOCIAL_FULL_LABELS = { facebook: "Facebook", instagram: "Instagram", twitter: "Twitter/X", linkedin: "LinkedIn" };

function socialCell(p) {
  const social = (p.website_check && p.website_check.social) || {};
  const links = Object.keys(SOCIAL_LABELS).filter(k => social[k]);
  if (!links.length) return <span className="no-site">&#8212;</span>;
  return (
    <>
      {links.map((k, i) => (
        <span key={k}>
          {i > 0 && " "}
          <a href={social[k]} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{SOCIAL_LABELS[k]}</a>
        </span>
      ))}
    </>
  );
}

const AUTO_SIGNAL_LABELS = {
  visibleProblem: "Visible problem (no site / broken / not mobile) +3",
  hasAgency: "Already has an agency − 3",
  reachable: "Reachable (phone, email, or site) +1",
  noWayToReach: "No way to reach − 2",
  inTargetTrade: "In target trade +1",
};

// "Disqualified" and "Declined" were MISSING here while 20 rows already held
// those values, so the select rendered with no matching option and a Save could
// silently reassign the stage. Same class as the stale-save bug. Added 2026-09-11.
const OUTREACH_STAGES = ["New", "Sent", "Watched", "Replied", "Call booked", "Proposal sent", "Closed", "Dead", "Disqualified", "Declined"];

// Auto-signal display only — mirrors deriveAutoSignals in
// functions/api/_lib/prospecting.js for the read-only signal chips.
// Score/tier themselves are always server-computed and just displayed here.
function autoSignalsFor(p) {
  const check = p.website_check || {};
  return {
    visibleProblem: !p.website || check.reachable === false || check.mobileFriendly === false || check.listingLinkBroken === true,
    hasAgency: Boolean(check.agencyDetected),
    reachable: Boolean(p.phone || p.email || p.website),
    noWayToReach: !p.phone && !p.email && !p.website,
    inTargetTrade: true,
  };
}

function ProspectRow({ p, expanded, onToggle, onUpdate, onDelete, onPush }) {
  const signals = p.manual_signals || { runsAds: false, growthIntent: false, ownerOperated: false };
  const auto = autoSignalsFor(p);

  return (
    <>
      <tr className="main-row" onClick={onToggle} style={{ cursor: "pointer" }}>
        <td>{expanded ? "▾" : "▸"}</td>
        <td><span className="score-badge" style={{ background: tierColor(p.tier) }}>{p.score}</span></td>
        <td>{p.business_name}</td>
        {/* Google's own category, not our search term. "Suppliers" here would
            have killed Negranti on sight instead of after a browser session. */}
        <td>{p.primary_type || p.trade}</td>
        <td>{websiteCell(p)}</td>
        <td>{ownerPhotoCell(p)}</td>
        <td>{reviewAgeCell(p)}</td>
        <td>{gbpCell(p)}</td>
        <td>{licenseCell(p)}</td>
        <td>{p.phone}{p.phone && p.email && <br />}{p.email}</td>
        <td>{p.outreach_stage}</td>
      </tr>
      {expanded && (
        <tr className="detail-row">
          <td colSpan={11}>
            <div className="detail-grid">
              <div className="detail-block">
                <h4>Signals (auto)</h4>
                <ul className="auto-signals">
                  {Object.entries(AUTO_SIGNAL_LABELS).map(([key, label]) => (
                    <li key={key} className={auto[key] ? "on" : ""}>{auto[key] ? "✓" : "—"} {label}</li>
                  ))}
                </ul>
              </div>
              <div className="detail-block">
                <h4>Photos &amp; social</h4>
                {/* Photo authorship in full. "0 owner photos" is only
                    trustworthy next to the list of who DID take them. */}
                <div style={{ fontSize: 12, marginBottom: 6 }}>{ownerPhotoCell(p)}</div>
                {/* ⚠ photoAuthorsOf, not p.photo_authors — the raw column is a
                    JSON string. This was the second crash site of the same bug
                    on 2026-09-18; the first was in ownerPhotoCell above. */}
                {photoAuthorsOf(p).length > 0 && (
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                    by: {photoAuthorsOf(p).join(", ")}
                  </div>
                )}
                <div>{socialCell(p)}</div>
              </div>
              <div className="detail-block">
                <h4>Signals (your call)</h4>
                <label><input type="checkbox" checked={!!signals.runsAds} onChange={e => onUpdate(p.id, { manualSignals: { runsAds: e.target.checked } })} /> Runs Google/Facebook ads (+3)</label>
                <label><input type="checkbox" checked={!!signals.growthIntent} onChange={e => onUpdate(p.id, { manualSignals: { growthIntent: e.target.checked } })} /> Growth intent — fresh reviews/photos/hiring (+2)</label>
                <label><input type="checkbox" checked={!!signals.ownerOperated} onChange={e => onUpdate(p.id, { manualSignals: { ownerOperated: e.target.checked } })} /> Owner-operated, small team (+2)</label>
              </div>
              <div className="detail-block">
                <h4>CSLB licence</h4>
                {p.license_status === "CLEAR" ? (
                  <ul className="auto-signals">
                    <li className="on">✓ {p.license_no} — {p.license_name}</li>
                    <li className="on">✓ {p.license_classes}, expires {p.license_expiration}</li>
                    {p.license_secondary && <li>⚠ {p.license_secondary} — active today, queued to suspend</li>}
                    {p.license_bond_cancel && <li>⚠ bond cancels {p.license_bond_cancel} — auto-suspends that day</li>}
                  </ul>
                ) : p.license_status === "NOT ACTIVE" ? (
                  <div style={{ fontSize: 12, color: "#ef4444" }}>
                    No active CSLB licence found under this name.
                    <strong> Step 0 fails — do not build.</strong>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    {p.license_status === "AMBIGUOUS"
                      ? "That phone number is on more than one licence, so it was not guessed."
                      : "No licence matched this phone number — CSLB often holds a different one."}
                    {licenseCandidates(p).length > 0 && (
                      <ul className="auto-signals" style={{ marginTop: 6 }}>
                        {licenseCandidates(p).map(c => (
                          <li key={c.licenseNo}>
                            {c.licenseNo} — {c.name}{c.city ? ", " + c.city : ""} · {c.classes} · {c.status}
                            {c.secondary ? " · " + c.secondary : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div style={{ marginTop: 6 }}>
                      Candidates only — confirm on{" "}
                      <a href="https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx"
                         target="_blank" rel="noopener noreferrer">cslb.ca.gov</a> before building.
                    </div>
                  </div>
                )}
              </div>
              <div className="detail-block">
                <h4>Contact</h4>
                <label>Email <input className="form-input" type="text" defaultValue={p.email || ""} placeholder="none found" onBlur={e => onUpdate(p.id, { email: e.target.value })} /></label>
                <label>Phone <input className="form-input" type="text" defaultValue={p.phone || ""} onBlur={e => onUpdate(p.id, { phone: e.target.value })} /></label>
                {p.google_maps_url && <a href={p.google_maps_url} target="_blank" rel="noopener noreferrer" className="maps-link">Open Google Maps listing</a>}
                {p.gbp_status && <div style={{ marginTop:4 }}>{gbpCell(p)}</div>}
                <div className="social-links" style={{ marginTop: 8 }}>
                  {Object.keys(SOCIAL_FULL_LABELS).filter(k => (p.website_check?.social || {})[k]).length === 0 ? (
                    <div style={{ fontSize: 12, color: "#475569" }}>No social profiles found on their site</div>
                  ) : (
                    Object.keys(SOCIAL_FULL_LABELS).filter(k => (p.website_check?.social || {})[k]).map(k => (
                      <div key={k} style={{ fontSize: 12 }}>
                        <a href={p.website_check.social[k]} target="_blank" rel="noopener noreferrer">{SOCIAL_FULL_LABELS[k]}</a>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="detail-block">
                <h4>Pipeline</h4>
                {p.pushed_clinic_id ? (
                  <p className="crm-push-status pushed">Pushed to pipeline{p.pushed_at ? ` ${new Date(p.pushed_at).toLocaleString()}` : ""}</p>
                ) : (
                  <>
                    <p className="crm-push-status muted">Not pushed yet</p>
                    <p style={{ fontSize:12, color:"#475569", margin:"2px 0 8px" }}>Push to the pipeline, then track outreach on the business itself (Outreach tab).</p>
                    <button className="btn-primary push-crm-btn" type="button" onClick={() => onPush(p.id)}>Push to Pipeline</button>
                  </>
                )}
              </div>
            </div>
            <button className="btn-danger" type="button" onClick={() => onDelete(p.id)} style={{ margin: "0 20px 16px" }}>Remove prospect</button>
          </td>
        </tr>
      )}
    </>
  );
}

function ProspectingView({ onToast, onPushed }) {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trade, setTrade] = useState(PROSPECT_TRADES[0].value);
  const [city, setCity] = useState("");
  const [usState, setUsState] = useState("");
  const [scope, setScope] = useState("city");        // "city" | "county"
  const [county, setCounty] = useState("");
  const [counties, setCounties] = useState([]);
  const [searching, setSearching] = useState(false);
  // Set while a county sweep is running so the loop can be stopped between
  // towns. A sweep is ~18 Places searches; being unable to stop it would be
  // the difference between a useful feature and an expensive one.
  const stopRef = useRef(false);
  const [searchStatus, setSearchStatus] = useState("");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [showPushed, setShowPushed] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [bulkPushing, setBulkPushing] = useState(false);

  useEffect(() => {
    prospectsDb.getAll().then(setProspects).catch(() => {}).finally(() => setLoading(false));
    // Only counties the licence table actually holds are offered, so the UI
    // can never present one with no data behind it.
    prospectsDb.counties().then(setCounties).catch(() => {});
  }, []);

  // A county sweep is the same search run once per town, driven from here
  // rather than from the server. One server-side sweep would be ~18 Places
  // calls plus two fetches per result -- 350+ subrequests inside a single Pages
  // Function, against the ceiling search.js already warns about. Looping in the
  // browser keeps every request exactly the size it is today, shows progress
  // town by town, and can be stopped part-way.
  const handleCountySweep = async () => {
    if (!trade || !county) return;
    setSearching(true);
    stopRef.current = false;
    setSearchStatus(`Loading towns in ${county}…`);
    try {
      const towns = await prospectsDb.cities(county);
      if (!towns.length) {
        setSearchStatus(`No towns on file for ${county}.`);
        return;
      }
      let added = 0, dupes = 0, contacted = 0, done = 0, outOfArea = 0, offScope = 0;
      for (const t of towns) {
        if (stopRef.current) break;
        const location = `${t.city}, CA`;
        setSearchStatus(
          `${county}: ${t.city} (${done + 1} of ${towns.length}) — ` +
          `${added} new so far. Click Stop to end the sweep.`
        );
        try {
          // Replace on the first town only; accumulate across the rest.
          const data = await prospectsDb.search(trade, location, { replace: done === 0 });
          added += data.added || 0;
          dupes += data.alreadyListed || 0;
          contacted += data.alreadyContacted || 0;
          outOfArea += data.droppedOutOfArea || 0;
          offScope += data.droppedOffScope || 0;
        } catch (err) {
          // One bad town must not end the sweep -- a Places hiccup on Cayucos
          // should not cost the other seventeen.
          console.error("sweep failed for", location, err.message);
        }
        done++;
        const fresh = await prospectsDb.getAll();
        setProspects(fresh);
      }
      const stopped = stopRef.current ? " (stopped early)" : "";
      const skipNote = [
        dupes > 0 ? `${dupes} already on the list` : "",
        contacted > 0 ? `${contacted} already contacted` : "",
      ].filter(Boolean).join(", ");
      // The sweep is where the out-of-area filter earns its keep -- it visits
      // the small towns, which are exactly the ones Places pads out with
      // statewide results. Reporting the total makes that visible.
      const areaNote = outOfArea > 0 ? ` Dropped ${outOfArea} outside the service area.` : "";
      // Same reasoning for off-scope: the sweep's small towns are where Places
      // pads the page out with art galleries, restaurants and hardware stores.
      const scopeNote = offScope > 0 ? ` Dropped ${offScope} off-scope.` : "";
      setSearchStatus(
        `${county}: ${added} prospect(s) from ${done} town(s)${stopped}.` +
        (skipNote ? ` Skipped ${skipNote}.` : "") + areaNote + scopeNote
      );
      setExpandedId(null);
    } catch (err) {
      setSearchStatus(`Error: ${err.message}`);
    } finally {
      setSearching(false);
      stopRef.current = false;
    }
  };

  const handleSearch = async e => {
    e.preventDefault();
    if (scope === "county") return handleCountySweep();
    if (!trade || !city.trim() || !usState) return;
    const location = `${city.trim()}, ${usState}`;
    setSearching(true);
    setSearchStatus(`Searching for ${trade} in ${location}…`);
    try {
      const data = await prospectsDb.search(trade, location);
      const thinNote = data.thinReviewCount > 0 ? ` (${data.thinReviewCount} with under 10 reviews, ranked lower but kept)` : "";
      // Out-of-area drops are reported, never silent. A small town's search can
      // legitimately come back almost empty once Places' statewide filler is
      // removed, and "No results" with no explanation looks like a broken
      // search rather than a working filter.
      const areaNote = data.droppedOutOfArea > 0 ? ` Dropped ${data.droppedOutOfArea} outside the service area.` : "";
      // Off-scope means a category a contractor cannot be - an art gallery,
      // a restaurant, a hardware store. Reported rather than hidden, so
      // over-filtering would be visible instead of silent.
      const scopeNote = data.droppedOffScope > 0 ? ` Dropped ${data.droppedOffScope} off-scope.` : "";
      if (data.added === 0) {
        setSearchStatus(`No results for "${trade} in ${location}"${thinNote}.${areaNote}${scopeNote} Double-check the city spelling and try again.`);
      } else if (data.skipped > 0) {
        setSearchStatus(`Found ${data.added} prospect(s) — top ${data.added} of ${data.added + data.skipped} matches${thinNote}.${areaNote}${scopeNote}`);
      } else {
        const skipNote = [
          data.alreadyListed > 0 ? `${data.alreadyListed} already on the list` : "",
          data.alreadyContacted > 0 ? `${data.alreadyContacted} already contacted` : "",
        ].filter(Boolean).join(", ");
        setSearchStatus(
          `Found ${data.added} prospect(s)${thinNote}.` +
          (skipNote ? ` Skipped ${skipNote}.` : "") + areaNote
        );
      }
      const fresh = await prospectsDb.getAll();
      setProspects(fresh);
      setExpandedId(null);
    } catch (err) {
      setSearchStatus(`Error: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const updateProspect = async (id, patch) => {
    try {
      const updated = await prospectsDb.update(id, patch);
      setProspects(prev => prev.map(p => (p.id === id ? updated : p)));
    } catch (err) {
      onToast?.(`Error: ${err.message}`);
    }
  };

  const deleteProspect = async id => {
    if (!window.confirm("Remove this prospect from your list?")) return;
    await prospectsDb.delete(id);
    setProspects(prev => prev.filter(p => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const pushOne = async id => {
    try {
      const data = await prospectsDb.pushToPipeline(id);
      if (data.clinicId) {
        setProspects(prev => prev.map(p => (p.id === id ? { ...p, pushed_clinic_id: data.clinicId, pushed_at: data.pushedAt } : p)));
        onToast?.("Pushed to the pipeline");
        onPushed?.();
      }
    } catch (err) {
      onToast?.(`Error: ${err.message}`);
    }
  };

  const handleBulkPush = async () => {
    const targets = prospects.filter(p => (p.tier === "Record today" || p.tier === "Warm") && !p.pushed_clinic_id);
    if (!targets.length) {
      onToast?.("Nothing to push — every Hot/Warm prospect is already in the pipeline.");
      return;
    }
    setBulkPushing(true);
    let done = 0;
    for (const p of targets) {
      try {
        const data = await prospectsDb.pushToPipeline(p.id);
        if (data.clinicId) {
          setProspects(prev => prev.map(x => (x.id === p.id ? { ...x, pushed_clinic_id: data.clinicId, pushed_at: data.pushedAt } : x)));
          done++;
        }
      } catch (_) { /* keep going */ }
    }
    setBulkPushing(false);
    onToast?.(`Pushed ${done} of ${targets.length} to the pipeline.`);
    if (done > 0) onPushed?.();
  };

  const handleExportCsv = async () => {
    try {
      const blob = await prospectsDb.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "prospects.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      onToast?.(`Error: ${err.message}`);
    }
  };

  // Already-pushed prospects live in the pipeline now, so leaving them here
  // shows the same business in two lists and reads as duplication. Hidden by
  // default; the toggle below brings them back.
  const pushedCount = prospects.filter(p => p.pushed_clinic_id).length;

  const filtered = prospects.filter(p => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.business_name.toLowerCase().includes(q);
    const matchesTier = tierFilter === "all" || p.tier === tierFilter;
    const matchesPushed = showPushed || !p.pushed_clinic_id;
    return matchesSearch && matchesTier && matchesPushed;
  });

  const hotCount = prospects.filter(p => !p.pushed_clinic_id && p.tier === "Record today").length;
  const warmCount = prospects.filter(p => !p.pushed_clinic_id && p.tier === "Warm").length;

  return (
    <>
      <div className="main-header">
        <div>
          <div className="page-title">Prospecting</div>
          <div className="page-subtitle">
            {loading ? "Loading…" : `${prospects.length - pushedCount} not yet pushed · ${hotCount} record today · ${warmCount} warm${pushedCount ? ` · ${pushedCount} already in the pipeline` : ""}`}
          </div>
        </div>
        <button className="btn-primary header-add-btn" onClick={handleBulkPush} disabled={bulkPushing || loading}>
          <Ic.Zap /> {bulkPushing ? "Pushing…" : "Push Hot + Warm"}
        </button>
      </div>
      <div className="main-content">
        <form className="prospecting-search-bar" onSubmit={handleSearch}>
          <select className="form-select" value={trade} onChange={e => setTrade(e.target.value)}>
            {PROSPECT_TRADES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="form-select" value={scope} onChange={e => setScope(e.target.value)}>
            <option value="city">One city</option>
            <option value="county">Whole county</option>
          </select>
          {scope === "city" ? (
            <>
              <input className="form-input" placeholder="City, e.g. San Luis Obispo" value={city} onChange={e => setCity(e.target.value)} />
              <select className="form-select" value={usState} onChange={e => setUsState(e.target.value)}>
                <option value="">State…</option>
                {US_STATES.map(([abbr, name]) => <option key={abbr} value={abbr}>{name}</option>)}
              </select>
            </>
          ) : (
            // Only counties present in the `licenses` table are offered, and the
            // town list behind each one is CSLB's, not a hand-kept list.
            <select className="form-select" value={county} onChange={e => setCounty(e.target.value)}>
              <option value="">County…</option>
              {counties.map(c => (
                <option key={c.county} value={c.county}>
                  {c.county} ({c.cities} towns)
                </option>
              ))}
            </select>
          )}
          <button
            className="btn-primary"
            type="submit"
            disabled={searching || (scope === "city" ? (!city.trim() || !usState) : !county)}
          >
            {searching ? "Searching…" : scope === "county" ? "Sweep county" : "Search"}
          </button>
          {searching && scope === "county" && (
            <button className="btn-ghost" type="button" onClick={() => { stopRef.current = true; }}>
              Stop
            </button>
          )}
        </form>
        {scope === "county" && !searching && (
          <div className="page-subtitle" style={{ marginBottom: 12 }}>
            One Places search per town, so a county costs roughly 18&times; a single
            city search. Results accumulate and are deduped; anything already in
            the pipeline is skipped.
          </div>
        )}
        {searchStatus && <div className="page-subtitle" style={{ marginBottom: 12 }}>{searchStatus}</div>}

        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon"><Ic.Search /></span>
            <input className="search-input" placeholder="Filter by name…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="filter-select" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
            <option value="all">All tiers</option>
            <option value="Record today">Record today</option>
            <option value="Warm">Warm</option>
            <option value="Park it">Park it</option>
          </select>
          {pushedCount > 0 && (
            <button className="btn-ghost" type="button" onClick={() => setShowPushed(v => !v)}>
              {showPushed ? `Hide ${pushedCount} already pushed` : `Show ${pushedCount} already pushed`}
            </button>
          )}
          <button className="btn-ghost" type="button" onClick={handleExportCsv}>Export CSV</button>
        </div>

        <div className="prospecting-table-wrap">
          <table>
            <thead><tr><th></th><th>Score</th><th>Business</th><th>Type</th><th>Website</th><th>Own photos</th><th>Newest rev</th><th>GBP</th><th>Licence</th><th>Contact</th><th>Stage</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}><div className="loading">Loading…</div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="empty-state">
                    <div className="empty-icon">&#128269;</div>
                    <div className="empty-title">{prospects.length === 0 ? "No prospects yet" : "No results"}</div>
                    <div className="empty-sub">{prospects.length === 0 ? "Search a trade + city above to get started" : "Adjust search or filter"}</div>
                  </div>
                </td></tr>
              ) : filtered.map(p => (
                <ProspectRow key={p.id} p={p} expanded={expandedId === p.id}
                  onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  onUpdate={updateProspect} onDelete={deleteProspect} onPush={pushOne} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [authed,    setAuthed]    = useState(() => localStorage.getItem("aa_auth") === "1" && !!localStorage.getItem("aa_secret"));
  const [clinics,   setClinics]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [page,      setPage]      = useState("dashboard");
  const [modal,     setModal]     = useState(null);       // null | "add" | clinic obj
  const [selected,  setSelected]  = useState(null);      // clinic obj for detail panel
  const [toast,     setToast]     = useState(null);
  const [sequences, setSequences] = useState(DEFAULT_SEQUENCES);
  const [launchTarget, setLaunchTarget] = useState(null); // { clinic, prefillTrigger }
  const [showPicker,   setShowPicker]   = useState(false);

  useEffect(() => {
    if (!authed) { setLoading(false); return; }
    Promise.all([
      db.getAll().catch(() => []),
      apiFetch(`/sequences`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([clinicData, seqData]) => {
      setClinics(clinicData || []);
      if (Array.isArray(seqData) && seqData.length > 0) setSequences(seqData);
      setLoading(false);
    });
  }, [authed]);

  const showToast = msg => setToast(msg);

  const refreshClinics = useCallback(async () => {
    try { setClinics(await db.getAll()); } catch (_) {}
  }, []);

  // Open launch modal. If clinic=null, show clinic picker first.
  const openLaunch = useCallback((clinic, prefillTrigger = null) => {
    if (!clinic) { setShowPicker(true); return; }
    setLaunchTarget({ clinic, prefillTrigger });
  }, []);

  // Called when a sequence is successfully launched — writes followUp entry back to clinic
  const handleLaunch = useCallback(async (clinic, fu, opts = {}) => {
    const updated = { ...clinic, followUps: [...(clinic.followUps || []), fu] };
    setClinics(prev => prev.map(c => c.id === clinic.id ? updated : c));
    if (selected?.id === clinic.id) setSelected(updated);
    try { await db.update(clinic.id, { followUps: updated.followUps }); } catch (_) {}
    if (!opts.silent) showToast(`Sequence launched for ${clinic.name}`);
  }, [selected]);

  const handleStatusChange = useCallback(async (id, newStatus) => {
    const clinic = clinics.find(c => c.id === id);
    const updatedClinic = clinic ? { ...clinic, status: newStatus } : null;
    // Screening a business out takes it off the Businesses list in the same
    // move, and putting it back on an active stage brings it back. The row is
    // never deleted: the prospector dedupes against clinics.contact_phone.
    const archived = newStatus === "disqualified" ? 1 : 0;
    setClinics(prev => prev.map(c => c.id === id ? { ...c, status: newStatus, archived } : c));
    setSelected(sel => sel?.id === id ? { ...sel, status: newStatus, archived } : sel);
    try { await db.update(id, { status: newStatus, archived }); } catch (_) {}

    // A won deal fires a different onboarding sequence depending on which plan
    // they bought - a Starter Site client has no carrier step and a much
    // shorter build, so the Intake System onboarding email would be wrong.
    let trigId      = STAGE_AUTO_TRIGGER[newStatus];
    if (trigId === "client_won" && (updatedClinic?.package === STARTER_PACKAGE)) trigId = "starter_won";
    const activeSeq = trigId && sequences.find(s => s.trigger === trigId && s.active);
    const alreadyRan = trigId && clinic && (clinic.followUps||[]).some(f => f.trigger === trigId && (f.status === "active" || f.status === "completed"));

    if ((trigId === "client_won" || trigId === "starter_won") && activeSeq && updatedClinic && !alreadyRan) {
      // Deal just closed — auto-send the onboarding email immediately, no confirmation needed.
      const fu = {
        id: uid(), seqId: activeSeq.id, seqName: activeSeq.name, trigger: trigId,
        triggeredAt: Date.now(), status: "active", currentStep: 0, totalSteps: activeSeq.steps.length,
        steps: activeSeq.steps.map(s => ({ ...s, sentAt: null, status: "pending" })),
      };
      await handleLaunch(updatedClinic, fu, { silent: true });
      showToast(`Moved to ${stageLabel(newStatus)} — onboarding email sent`);
    } else {
      showToast(`Moved to ${stageLabel(newStatus)}`);
      // For non-auto-fire triggers (e.g. "Gone Quiet"), surface the suggestion instead of sending.
      if (trigId && activeSeq && !alreadyRan) {
        setTimeout(() => setSelected(prev => prev?.id === id ? { ...prev, status: newStatus } : updatedClinic), 350);
      }
    }
  }, [clinics, sequences, handleLaunch]);

  const handleSave = useCallback(async form => {
    if (modal === "add") {
      const pt = getPackageTasks(form.package);
      const newClinic = {
        ...form, id: uid(), created_at: new Date().toISOString(), followUps: [],
        alignmentTasks: pt.alignment.map(t => ({ ...t, id: uid() })),
        clinicTasks:    pt.clinic.map(t    => ({ ...t, id: uid() })),
      };
      setClinics(prev => [newClinic, ...prev]);
      try { await db.create(newClinic); } catch (_) {}
      showToast("Business added");
    } else {
      setClinics(prev => prev.map(c => c.id === form.id ? { ...c, ...form } : c));
      if (selected?.id === form.id) setSelected(s => ({ ...s, ...form }));
      try { await db.update(form.id, form); } catch (_) {}
      showToast("Changes saved");
    }
    setModal(null);
  }, [modal, selected]);

  const handleDelete = useCallback(async id => {
    setClinics(prev => prev.filter(c => c.id !== id));
    if (selected?.id === id) setSelected(null);
    try { await db.delete(id); } catch (_) {}
    showToast("Business removed");
  }, [selected]);

  const handleUpdate = useCallback(async updated => {
    setClinics(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelected(updated);
    try {
      await db.update(updated.id, {
        alignmentTasks: updated.alignmentTasks || [],
        clinicTasks:    updated.clinicTasks    || [],
        followUps:      updated.followUps      || [],
      });
    } catch (_) {}
  }, []);

  // Partial update: merges `patch` into state and persists only those fields.
  // Used by the Outreach tab so each field edit is independent (no clobbering
  // from rapid successive edits, unlike the full-object handleUpdate above).
  const handlePatch = useCallback(async (id, patch) => {
    setClinics(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    setSelected(sel => sel?.id === id ? { ...sel, ...patch } : sel);
    try { await db.update(id, patch); } catch (_) {}
  }, []);

  if (!authed) return <SimpleLogin onLogin={() => setAuthed(true)} />;
  if (loading)  return <><style>{css}</style><div className="app"><div className="loading">Loading&#8230;</div></div></>;

  const handleLogout = () => { localStorage.removeItem("aa_auth"); localStorage.removeItem("aa_secret"); setAuthed(false); setClinics([]); };
  const activeFuTotal = clinics.reduce((n, c) => n + (c.followUps||[]).filter(f => f.status === "active").length, 0);

  return (
    <>
      <style>{css}</style>
      <div className="app">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <svg width="36" height="36" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink:0 }}>
              <polygon points="50,5 89,27.5 89,72.5 50,95 11,72.5 11,27.5" fill="none" stroke="#FF6B1A" strokeWidth="6" strokeLinejoin="round"/>
              <g transform="translate(-2.5 4)">
                <path d="M28 54 L41 66 L60 45" stroke="#FF6B1A" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <g transform="translate(60 45) rotate(-47)">
                  <path d="M14.5 -3 C17 -2.6 19 -2.4 21 -2.8 C24 -3.4 27 -3.6 28 -2.4 Q29.5 0 28 2.4 C27 3.6 24 3.4 21 2.8 C19 2.4 17 2.6 14.5 3 Z" fill="#F2EFE9"/>
                  <rect x="8" y="-5.8" width="6.5" height="11.6" rx="0.8" fill="#C9CCD1"/>
                  <path d="M0 -5 L8 -5.5 L8 5.5 L0 5 Q-1 0 0 -5 Z" fill="#E8C48A"/>
                  <path d="M0 -5 L4 -5.2 Q3.2 -2 4.3 0 Q5.2 2.4 4 5.2 L0 5 Q-1 0 0 -5 Z" fill="#FF6B1A"/>
                </g>
              </g>
            </svg>
            <div className="brand-text">
              <div className="brand-name">PRIMED &amp;</div>
              <div className="brand-name" style={{ color:"#FF6B1A" }}>BOOKED</div>
            </div>
          </div>
          <nav className="sidebar-nav">
            <div className="nav-section-label">CRM</div>
            <button className={"nav-item" + (page === "dashboard" ? " active" : "")} onClick={() => setPage("dashboard")}>
              <span className="nav-icon"><Ic.Dashboard /></span>Dashboard
            </button>
            <button className={"nav-item" + (page === "pipeline" ? " active" : "")} onClick={() => setPage("pipeline")}>
              <span className="nav-icon"><Ic.Pipeline /></span>Pipeline
            </button>
            <div className="nav-section-label" style={{ marginTop:8 }}>Automation</div>
            <button className={"nav-item" + (page === "followup" ? " active" : "")} onClick={() => setPage("followup")}>
              <span className="nav-icon"><Ic.Followup /></span>Follow-ups
              {activeFuTotal > 0 && <span className="nav-badge">{activeFuTotal}</span>}
            </button>
            <div className="nav-section-label" style={{ marginTop:8 }}>Sales</div>
            <button className={"nav-item" + (page === "prospecting" ? " active" : "")} onClick={() => setPage("prospecting")}>
              <span className="nav-icon"><Ic.Search /></span>Prospecting
            </button>
            <button className={"nav-item" + (page === "playbook" ? " active" : "")} onClick={() => setPage("playbook")}>
              <span className="nav-icon"><Ic.Book /></span>Playbook
            </button>
            <button className="logout-btn" style={{ marginTop:"auto" }} onClick={handleLogout}>
              <Ic.Logout /> Sign out
            </button>
          </nav>
        </aside>

        {/* ── Main ── */}
        <main className="main">
          {page === "dashboard" && (
            <DashboardView
              clinics={clinics} sequences={sequences}
              onAdd={() => setModal("add")} onEdit={c => setModal(c)} onDelete={handleDelete}
              onSelect={setSelected} onStatusChange={handleStatusChange} onOpenLaunch={openLaunch}
            />
          )}
          {page === "pipeline" && (
            <PipelineView
              clinics={clinics} sequences={sequences}
              onSelect={setSelected} onStatusChange={handleStatusChange} onOpenLaunch={openLaunch}
            />
          )}
          {page === "followup" && (
            <FollowupView
              clinics={clinics} sequences={sequences} setSequences={setSequences}
              onOpenLaunch={openLaunch}
              onSelectClinic={c => setSelected(c)}
            />
          )}
          {page === "prospecting" && <ProspectingView onToast={showToast} onPushed={refreshClinics} />}
          {page === "playbook" && <PlaybookView />}
        </main>

        {/* ── Mobile bottom nav ── */}
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            <button className={"bottom-nav-item" + (page === "dashboard" ? " active" : "")} onClick={() => setPage("dashboard")}><Ic.Dashboard /><span>Businesses</span></button>
            <button className={"bottom-nav-item" + (page === "pipeline"  ? " active" : "")} onClick={() => setPage("pipeline")} ><Ic.Pipeline /><span>Pipeline</span></button>
            <button className={"bottom-nav-item" + (page === "followup"  ? " active" : "")} onClick={() => setPage("followup")} ><Ic.Followup /><span>Follow-ups</span></button>
            <button className={"bottom-nav-item" + (page === "prospecting" ? " active" : "")} onClick={() => setPage("prospecting")} ><Ic.Search /><span>Prospecting</span></button>
            <button className={"bottom-nav-item" + (page === "playbook"  ? " active" : "")} onClick={() => setPage("playbook")} ><Ic.Book /><span>Playbook</span></button>
            <button className="bottom-nav-item" onClick={handleLogout}><Ic.Logout /><span>Sign out</span></button>
          </div>
        </nav>

        <button className="fab" onClick={() => setModal("add")}>&#65291;</button>

        {/* Clinic form */}
        {modal && <ClinicModal clinic={modal === "add" ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />}

        {/* Clinic picker (launched from Follow-ups page with no pre-selected clinic) */}
        {showPicker && (
          <ClinicPickerModal
            clinics={clinics}
            onSelect={c => { setShowPicker(false); setLaunchTarget({ clinic: c, prefillTrigger: null }); }}
            onClose={() => setShowPicker(false)}
          />
        )}

        {/* Launch modal */}
        {launchTarget && (
          <LaunchModal
            clinic={launchTarget.clinic}
            sequences={sequences}
            prefillTrigger={launchTarget.prefillTrigger}
            onLaunch={fu => handleLaunch(launchTarget.clinic, fu)}
            onClose={() => setLaunchTarget(null)}
          />
        )}

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            clinic={selected}
            sequences={sequences}
            onClose={() => setSelected(null)}
            onUpdate={handleUpdate}
            onPatch={handlePatch}
            onDelete={id => { handleDelete(id); }}
            onOpenLaunch={(c, trig) => {
              setSelected(null);
              setTimeout(() => setLaunchTarget({ clinic: c, prefillTrigger: trig || null }), 100);
            }}
          />
        )}

        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </div>
    </>
  );
}
