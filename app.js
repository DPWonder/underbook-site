// Underbook landing — page and install-click instrumentation (+ legacy waitlist/intake handlers,
// inert when their forms are absent). Funnel: page_view → install_click (a real store link since 2026-09-23).
// Every event is tagged with ?s= (channel source) and ?o= (offer variant) so failures
// are attributable to OFFER vs CHANNEL vs DEMAND (see docs/CONSUMER_DEMAND_TEST.md).

// Firestore writes go straight to Firestore's REST API (2026-10-02, docs/PERF_2026-10-02.md). Until now this file
// imported the Firebase SDK from www.gstatic.com on every page (firebase-app.js and firebase-firestore.js: 132 KB over
// the wire, 530 KB of JavaScript to parse) only to add one document per page view and per store click. fsAdd() sends
// the write the SDK's addDoc() sent, as the SDK's own lite build does (POST .../documents:commit, JSON as text/plain,
// no key and no token): the same collection and fields, createdAt set by Firestore to the request time (what
// serverTimestamp() asked for), "create, never overwrite", and a random 20-character id drawn like the SDK's. So the
// stored documents, and what firestore.rules accept or refuse, are unchanged; engine/firestore-rest-e2e.mjs compares
// them with the SDK's on the Firestore emulator. A text/plain body with no custom header needs no CORS preflight,
// keepalive lets the write finish if the visitor moves on at once (as the worker beacons do), and priority 'low' keeps
// the one request out of the way of the page's own files. Nothing loads from gstatic.com.
const FS_DB = 'projects/underbook-prod/databases/(default)';
const FS_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const fsAutoId = () => {
  let id = '';
  while (id.length < 20) {
    for (const b of crypto.getRandomValues(new Uint8Array(40))) if (id.length < 20 && b < 248) id += FS_ID_CHARS[b % 62];
  }
  return id;
};
async function fsAdd(collection, data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) fields[k] = { stringValue: v };
  const res = await fetch(`https://firestore.googleapis.com/v1/${FS_DB}/documents:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    keepalive: true,
    priority: 'low',
    body: JSON.stringify({
      writes: [{
        update: { name: `${FS_DB}/documents/${collection}/${fsAutoId()}`, fields },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      }],
    }),
  });
  if (!res.ok) throw new Error(`Firestore answered ${res.status}`);
}

// ---- source / offer attribution (the diagnostic key) ----
const params = new URLSearchParams(location.search);
// 2026-11-13: a browser that blocks site data throws on any sessionStorage read, and these two bare reads stopped all of
// app.js there (store routing, phone cards, counts). A read that throws is "nothing stored".
const ubSessGet = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const SOURCE = (params.get('s') || ubSessGet('ub_s') || document.referrer || 'direct').slice(0, 59);
const OFFER = (params.get('o') || ubSessGet('ub_o') || 'none').slice(0, 19);
try { sessionStorage.setItem('ub_s', SOURCE); sessionStorage.setItem('ub_o', OFFER); } catch {}

// Crawlers render pages too: after an IndexNow ping, Bingbot rendered every page and logged about 50
// 'direct' page views in one minute (2026-09-26 19:55Z). Same pattern the worker uses for site:bot.
// 2026-10-01: plus the named crawlers and link-preview fetchers whose user agent has no bot word (Naver's Yeti, Daum,
// Meta, WhatsApp, Google's InspectionTool / Read-Aloud / GoogleOther, WebPageTest's PTST and others; the sources are
// cited at NAMED_CRAWLER_UA in backend/cloudflare/worker.js, and scripts/worker-ladder-test.mjs TCG8 keeps the lists in step).
const UB_BOT = /bot|crawl|spider|slurp|headless|lighthouse|phantom|puppeteer|playwright|selenium|preview|scan|monitor|python|curl|wget|httpclient|^$|inspectiontool|\bYeti\/|\bDaum\/\d|\bDaumoa|\bia_archiver|facebookexternalhit|\bmeta-(webindexer|external)|^WhatsApp\/\d|\bEmbedly\b|\bIframely\/|\bGoogle-(InspectionTool|Read-Aloud|Site-Verification|CWS)\b|\bGoogleOther\b|\bPTST\//i;
const UB_IS_BOT = (() => { try { return UB_BOT.test(navigator.userAgent || '') || navigator.webdriver === true; } catch { return false; } })();

// Person-started checks (2026-10-01, docs/CHECKER_CRAWLER_GUARD_2026-10-01.md). The web checker runs a check by itself
// on load only when a person asked for it; a crawler that renders a hotel page and opens its check form's URL never did.
// A person's submit of a check form that goes to the checker (the ~6,000 hotel and city pages' "Check today's price"),
// or click on a link to the checker that carries a hotel, leaves the time of the click in this tab's sessionStorage
// (ub_ck). The checker reads and clears it on load and trusts it for two minutes. Nothing leaves the browser.
// Listening here, on the document, covers every page that loads app.js without regenerating the hotel pages.
// A submit event is trusted even when a script calls form.requestSubmit(), so a form counts only within 5 seconds of
// a person's own input (a trusted tap, click or key press: the tap on the button, or Enter in a field).
const UB_CHECKER = /^\/hotel-price-checker(\.html)?\/?$/;
let ubLastInput = 0;
['pointerdown', 'touchstart', 'keydown', 'click'].forEach((t) => document.addEventListener(t, (e) => { if (e.isTrusted) ubLastInput = Date.now(); }, { capture: true, passive: true }));
const ubMarkCheck = (e) => {
  if (UB_IS_BOT || (e && e.isTrusted === false) || Date.now() - ubLastInput > 5000) return;
  try { sessionStorage.setItem('ub_ck', String(Date.now())); } catch { /* storage blocked: the checker asks for one tap */ }
};
document.addEventListener('submit', (e) => {
  const f = e.target;
  const act = f && f.tagName === 'FORM' ? f.getAttribute('action') : '';
  if (!act) return; // forms that stay on their page (the checker's own, which sets the flag itself; the price-drop box)
  try { if (UB_CHECKER.test(new URL(act, location.href).pathname)) ubMarkCheck(e); } catch { /* not ours */ }
}, true);
document.addEventListener('click', (e) => {
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a) return;
  try {
    const u = new URL(a.getAttribute('href'), location.href);
    if (u.origin === location.origin && UB_CHECKER.test(u.pathname) && u.searchParams.get('hotel')) ubMarkCheck(e);
  } catch { /* not a link we know */ }
}, true);

// Watch your booking entry points (2026-10-01, docs/WATCH_PROMOTION_2026-10-01.md), as anonymous daily totals in the
// worker's /stats: only {"ev": <name>} is sent, never the page, a referrer or anything typed. A person's click on a link
// marked data-wmb (the homepage section's and the five rebooking guides' Watch my booking links, /watch-my-booking's
// own button) counts home_watch_click, guide_watch_click or wmb_click, once per page view. /watch-my-booking counts its
// own opening as wmb_view_search or wmb_view_other: _search when this tab's visit began on a search engine, kept as a
// category only (sessionStorage ub_lr, the same key and rule as the hotel pages). Crawlers send nothing (UB_IS_BOT), and
// the worker files crawler user agents under site:bot.
const UB_EVENT_URL = 'https://underbook-backend.underbook.workers.dev/event';
const ubSiteEvent = (ev) => {
  if (UB_IS_BOT) return;
  try {
    const body = JSON.stringify({ ev });
    if (!(navigator.sendBeacon && navigator.sendBeacon(UB_EVENT_URL, body))) fetch(UB_EVENT_URL, { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch { /* measurement never blocks the page */ }
};
const UB_WMB_EVENTS = { home: 'home_watch_click', guide: 'guide_watch_click', page: 'wmb_click' };
let ubWmbSent = false;
document.addEventListener('click', (e) => {
  const a = e.target && e.target.closest ? e.target.closest('a[data-wmb]') : null;
  const ev = a && UB_WMB_EVENTS[a.getAttribute('data-wmb')];
  if (!ev || ubWmbSent || e.isTrusted === false) return;
  ubWmbSent = true;
  ubSiteEvent(ev);
}, true);
if (/^\/watch-my-booking(\.html)?\/?$/.test(location.pathname)) {
  let land = '';
  try { land = sessionStorage.getItem('ub_lr') || ''; } catch { land = ''; }
  if (!land) {
    // The visit's first referrer (SOURCE: an earlier page's, else this page's), as a category, like the hotel pages.
    let h = '';
    try { h = SOURCE && SOURCE !== 'direct' ? new URL(SOURCE).hostname.toLowerCase() : ''; } catch { h = '-'; }
    land = !h ? 'direct' : /(^|\.)underbook\.co$/.test(h) ? 'ours'
      : /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|baidu|brave|startpage|qwant|naver)\./.test(h) ? 'search' : 'other';
    try { sessionStorage.setItem('ub_lr', land); } catch { /* storage blocked: counted as other next time too */ }
  }
  ubSiteEvent(land === 'search' ? 'wmb_view_search' : 'wmb_view_other');
}

// Landings from AI assistants (2026-10-03, docs/AI_VISIBILITY_2026-10-02.md move 7, docs/INSTALL_GROWTH_PLAN.md D5), as
// one anonymous daily total per assistant in the worker's /stats: only {"ev": "ai_landing:<assistant>"} is sent, the name
// taken from the fixed lists below, never the address, the referrer or the query. ChatGPT tags the links it cites with
// utm_source=chatgpt.com (the largest tagged source of our Chrome Web Store listing's views), and https://chatgpt.com/ is
// the one assistant referrer in the Firestore event log (12 page views and 4 store clicks, read 2026-10-03; Kagi's
// assistant shares its search engine's referrer, so kagi.com is not on the list). Other assistants are known by the site
// that sent the visitor, or by their Android app's package name (android-app://<package>/) when the link opened there.
// Counted once, on the visit's first page only: not when the referrer is one of our own pages (a later page of the
// visit), and not on a reload or a back/forward return to the page. Crawlers and automated browsers send nothing
// (UB_IS_BOT, in ubSiteEvent). The names must be the worker's AI_ASSISTANTS (scripts/worker-ladder-test.mjs TAI3).
const UB_AI_UTM = new Map([
  ['chatgpt.com', 'chatgpt'], ['chatgpt', 'chatgpt'], ['chat.openai.com', 'chatgpt'],
  ['perplexity', 'perplexity'], ['perplexity.ai', 'perplexity'], ['www.perplexity.ai', 'perplexity'],
  ['claude.ai', 'claude'], ['claude', 'claude'],
  ['copilot', 'copilot'], ['copilot.microsoft.com', 'copilot'], ['copilot.com', 'copilot'],
  ['gemini', 'gemini'], ['gemini.google.com', 'gemini'],
  ['you.com', 'you'], ['phind', 'phind'], ['phind.com', 'phind'], ['meta.ai', 'meta'],
  ['deepseek', 'deepseek'], ['chat.deepseek.com', 'deepseek'], ['grok', 'grok'], ['grok.com', 'grok'],
  ['mistral', 'mistral'], ['chat.mistral.ai', 'mistral'],
]);
const UB_AI_HOST = new Map([
  ['chatgpt.com', 'chatgpt'], ['chat.openai.com', 'chatgpt'], ['com.openai.chatgpt', 'chatgpt'],
  ['perplexity.ai', 'perplexity'], ['www.perplexity.ai', 'perplexity'], ['ai.perplexity.app.android', 'perplexity'],
  ['claude.ai', 'claude'], ['com.anthropic.claude', 'claude'],
  // Copilot: its site, the sidebar in Edge (edgeservices.bing.com), Microsoft 365 Copilot Chat, the Android app.
  ['copilot.microsoft.com', 'copilot'], ['copilot.com', 'copilot'], ['www.copilot.com', 'copilot'], ['edgeservices.bing.com', 'copilot'],
  ['m365.cloud.microsoft', 'copilot'], ['com.microsoft.copilot', 'copilot'],
  ['gemini.google.com', 'gemini'], ['bard.google.com', 'gemini'], ['com.google.android.apps.bard', 'gemini'],
  ['you.com', 'you'], ['phind.com', 'phind'], ['www.phind.com', 'phind'], ['meta.ai', 'meta'], ['www.meta.ai', 'meta'],
  ['chat.deepseek.com', 'deepseek'], ['grok.com', 'grok'], ['chat.mistral.ai', 'mistral'],
]);
const ubAiLanding = () => {
  try {
    const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    if (nav && (nav.type === 'reload' || nav.type === 'back_forward')) return '';
    let ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : ''; } catch { ref = ''; }
    if (ref && (ref === location.hostname || /(^|\.)underbook\.co$/.test(ref))) return '';
    return UB_AI_UTM.get((params.get('utm_source') || '').trim().toLowerCase()) || UB_AI_HOST.get(ref) || '';
  } catch { return ''; }
};
// Which of our pages such a landing reached (2026-10-05, docs/AI_LANDINGS_2026-10-05.md): with the assistant's name, a
// second anonymous daily total, {"ev": "ai_landing_page:<key>"}, the key one short word for the kind of page of
// underbook.co the visitor landed on, from the fixed list below (the worker's AI_LANDING_PAGES; scripts/worker-ladder-test.mjs
// TAP3 keeps the two in step). It reads this page's own path only (location.pathname, never the query, the tags, the full
// address or the referrer), and the two totals are not linked: the worker counts each on its own.
const UB_AI_PAGE = new Map([
  ['/', 'home'], ['/index', 'home'], ['/hotel-price-checker', 'checker'], ['/hotel-price-comparison-extension', 'extension'],
  ['/how-underbook-works', 'how'], ['/hotel-price-dispersion-study', 'study'], ['/hotel-prices-this-week', 'study'],
  ['/hotels', 'hotels'], ['/help', 'help'], ['/refundable-vs-non-refundable-hotel-rates', 'guide'],
  ['/watch-my-booking', 'other'], ['/corrections', 'other'], ['/welcome', 'other'], ['/privacy', 'other'],
  ['/uninstall', 'other'], ['/rate', 'other'], ['/get', 'other'],
]);
const ubAiPage = (path) => {
  try {
    const p = String(path || '/').toLowerCase().replace(/\.html$/, '').replace(/\/+$/, '') || '/';
    if (UB_AI_PAGE.has(p)) return UB_AI_PAGE.get(p);
    if (/^\/hotels\/[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(p)) return 'hotels'; // hotel, city and hub pages (experiment X2's)
    if (/^\/help-[a-z0-9-]+$/.test(p)) return 'help';
    if (/^\/is-[a-z0-9-]+-legit$/.test(p)) return 'legit';
    if (/^\/[a-z0-9-]+-vs-[a-z0-9-]+$/.test(p)) return 'compare';
    if (/^\/[a-z0-9-]+$/.test(p) || /^\/hotel-prices\/[a-z0-9-]+$/.test(p)) return 'guide'; // the guides, destination guides too
    return 'other';
  } catch { return 'other'; }
};
{ const ai = ubAiLanding(); if (ai) { ubSiteEvent(`ai_landing:${ai}`); ubSiteEvent(`ai_landing_page:${ubAiPage(location.pathname)}`); } }

// Where this visit came from, for the web checker's count of checks by source (2026-10-26, docs/ATTRIBUTION_2026-10-26.md).
// One word from a fixed list (the worker's WEB_LANDS), worked out from a page's own campaign tags (utm_source, utm_medium)
// and the site that sent the visitor, and kept in this tab's sessionStorage (ub_ls) for the visit only:
//   outreach  our outreach emails: their links carry one short code, ?o=<code> (scripts/outreach_links.py; any o= counts,
//             and this word never carries the code; OFFER above has long logged ?o= as its Firestore events' offer), or a
//             link tagged utm_source=outreach or utm_medium=email
//   ai        an AI assistant: the assistants of UB_AI_UTM and UB_AI_HOST above, by tag, site or Android app
//   youtube   YouTube: utm_source=youtube (the Shorts' underbook.co/get link passes it on), youtube.com, youtu.be, the app
//   store     a browser add-on store's listing (Chrome Web Store, Firefox Add-ons, Edge Add-ons, App Store), or the
//             extension's install page (its checker link carries src=welcome)
//   search    a search engine (the same list as the checker's referrer kinds), or a paid search tag (utm_medium=cpc)
//   direct    no site and no tag (typed, a bookmark, an app that sends no referrer)
//   other     anything else (social sites, other sites, other tags), or not known
// As in web analytics' usual rule, a later page of the visit, a reload, a back or forward step and an untagged load with
// no referrer keep the visit's word; a new arrival from another site or with a tag replaces it. Nothing is sent from here:
// the checker sends the word with each check (ls=) and a person's store click sends site_install_land:<word>, each counted
// by the worker as an anonymous daily total. Never the address, its tags, the referrer or anything about who. ubLandOf is
// the checker's copy word for word (hotel-price-checker.html, which can check before this file runs: a shared link checks
// on load); scripts/worker-ladder-test.mjs TLS3 holds the two copies identical and to UB_AI_UTM and UB_AI_HOST.
const UB_LANDS = ['outreach', 'ai', 'youtube', 'store', 'search', 'direct', 'other'];
function ubLandOf(search, referrer, host) {
  var q = null, src = '', med = '', h = '';
  try { q = new URLSearchParams(search || ''); src = (q.get('utm_source') || '').trim().toLowerCase(); med = (q.get('utm_medium') || '').trim().toLowerCase(); } catch (e) { q = null; }
  try { h = referrer ? new URL(referrer).hostname.toLowerCase() : ''; } catch (e) { h = '-'; }
  var AI = /^(chatgpt(\.com)?|chat\.openai\.com|com\.openai\.chatgpt|perplexity|(www\.)?perplexity\.ai|ai\.perplexity\.app\.android|claude(\.ai)?|com\.anthropic\.claude|copilot|(www\.)?copilot\.com|copilot\.microsoft\.com|edgeservices\.bing\.com|m365\.cloud\.microsoft|com\.microsoft\.copilot|gemini|gemini\.google\.com|bard\.google\.com|com\.google\.android\.apps\.bard|you\.com|phind|(www\.)?phind\.com|(www\.)?meta\.ai|deepseek|chat\.deepseek\.com|grok(\.com)?|mistral|chat\.mistral\.ai)$/;
  var YT = /^(youtube|(www\.|m\.)?youtube\.com|youtu\.be|com\.google\.android\.youtube)$/;
  var STORE = /^(chromewebstore\.google\.com|chrome\.google\.com|addons\.mozilla\.org|microsoftedge\.microsoft\.com|apps\.apple\.com)$/;
  var SEARCH = /^(google|bing|duckduckgo|yahoo|ecosia|yandex|baidu|brave|startpage|qwant|naver)$|(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|baidu|brave|startpage|qwant|naver)\.|^com\.google\.android\.googlequicksearchbox$/;
  if (src === 'underbook.co') src = ''; // our own tags (the send-to-self link) say nothing about how the visit began
  if ((q && q.get('o')) || src === 'outreach' || med === 'email') return 'outreach'; // ?o=<code>: our outreach emails
  if (src) return AI.test(src) ? 'ai' : YT.test(src) ? 'youtube' : STORE.test(src) ? 'store' : SEARCH.test(src) || med === 'cpc' ? 'search' : 'other';
  if (q && q.get('src') === 'welcome') return 'store';
  if (!h) return 'direct';
  if (h === String(host || '').toLowerCase() || /(^|\.)underbook\.co$/.test(h)) return ''; // a later page of the visit
  return AI.test(h) ? 'ai' : YT.test(h) ? 'youtube' : STORE.test(h) ? 'store' : SEARCH.test(h) ? 'search' : 'other';
}
const ubLand = (() => {
  let kept = '', nav = '';
  try { kept = sessionStorage.getItem('ub_ls') || ''; } catch { kept = ''; }
  try { const n = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null; nav = n ? n.type : ''; } catch { nav = ''; }
  const now = ubLandOf(location.search, document.referrer, location.hostname);
  const word = UB_LANDS.includes(kept) && (!now || now === 'direct' || nav === 'reload' || nav === 'back_forward') ? kept : (now || 'other');
  try { sessionStorage.setItem('ub_ls', word); } catch { /* storage blocked: the checker works it out from its own page */ }
  return word;
})();

async function logEvent(type) {
  if (UB_IS_BOT) return;
  try { await fsAdd('events', { type, source: SOURCE, offer: OFFER }); } // + createdAt, set by Firestore
  catch (err) { console.warn('[underbook] event log failed', err); }
}

// CARE: one page_view per session (de-duped) so refreshes don't inflate the funnel
try {
  if (!sessionStorage.getItem('ub_viewed')) { sessionStorage.setItem('ub_viewed', '1'); logEvent('page_view'); }
} catch { logEvent('page_view'); }

// ---- email waitlist (carries source) ----
function bindForm(form, msgId) {
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim().toLowerCase();
    const msgEl = document.getElementById(msgId);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { if (msgEl) msgEl.textContent = 'Please enter a valid email address.'; return; }
    form.classList.add('form-loading');
    try {
      await fsAdd('waitlist', { email, source: `${form.id}|${SOURCE}|${OFFER}`, referrer: document.referrer || 'direct' });
      form.classList.remove('form-loading');
      form.classList.add('form-success');
      if (msgEl) msgEl.innerHTML = "✨ You're in. We'll email when Underbook is ready.";
      form.email.value = '';
    } catch (err) {
      console.error('[underbook] waitlist error:', err);
      form.classList.remove('form-loading');
      if (msgEl) msgEl.textContent = 'Something went wrong. Try again in a moment.';
    }
  });
}
bindForm(document.getElementById('waitlist-form-hero'), 'hero-form-msg');
bindForm(document.getElementById('waitlist-form-footer'), 'footer-form-msg');

// ---- INSTALL clicks (2026-09-23) ----
// Until today these buttons were the June pre-launch fake door: preventDefault(), then a panel
// saying "Underbook isn't in the Chrome store yet". The extension has been live for weeks, and
// 35 homepage visitors since Aug 1 clicked "Add to Chrome" and were turned away. They are now
// real links to the store (target=_blank, so this page stays open and the log completes).
// Measurement only: one install_click per session in Firestore (as before) and a per-day
// total in the worker's /stats (events.site_install). No id, no cookie.
// Phones and tablets (2026-09-23): a Chrome extension cannot be installed there, so an
// "Add to Chrome" BUTTON on a phone leads to a store page that cannot help. On those devices
// every store button (the accent-colored ones, not inline text links) becomes a link to the
// web checker, which runs the same comparison with no install, and the now-duplicate
// "or check ... without installing" link beside it is hidden. The checker page keeps its own
// layout (it already hides install on small screens). Desktop is unchanged.
const isHandheld = (() => {
  try {
    if (navigator.userAgentData && navigator.userAgentData.mobile) return true;
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; // iPadOS desktop mode
  } catch { return false; }
})();
// Firefox for Android (2026-10-06, docs/FIREFOX_ANDROID_LISTING_2026-10-06.md). From 0.5.45 the Firefox package carries
// gecko_android (strict_min_version 142.0), so Firefox Add-ons offers Underbook on Firefox for Android 142 and newer. A
// switch, off by default: UB_FIREFOX_ANDROID.live stays false until the operator has read that Firefox Add-ons serves an
// Android-compatible version (`python3 scripts/amo_api.py android` ends STATUS=OK). While it is false nothing changes.
// Set to true, a visitor in Firefox for Android 142 or newer (user agent: Android and Firefox/<major>) is treated like a
// desktop Firefox visitor for the store buttons in the page (they open the Firefox Add-ons listing, say Firefox, and
// count as site_install; the nav keeps the phones' "Check a price"), and the phone cards below first offer the listing
// (counted as site_install too). Older Firefox for
// Android, other phone browsers and every computer are unchanged. The same switch, mirrored: get.html UB_FX_ANDROID_LIVE
// (engine/fx-android-site-e2e.mjs fails if the two differ) and the help answers (scripts/help_pages.py reads it here).
const UB_FIREFOX_ANDROID = { live: true, minVersion: 142 };
const ubFxAndroid = (() => {
  try {
    if (UB_FIREFOX_ANDROID.live !== true) return false;
    const ua = navigator.userAgent || '', m = ua.match(/\bFirefox\/(\d+)/);
    return /\bAndroid\b/.test(ua) && !!m && Number(m[1]) >= UB_FIREFOX_ANDROID.minVersion;
  } catch { return false; }
})();
// X76 (2026-11-09, daily-users owner, docs/EXPERIMENTS.md): an Android visitor in any other browser (Chrome, Samsung Internet,
// Edge, an older Firefox) is told the one way Underbook runs on an Android phone, Firefox for Android, with the Firefox Add-ons
// listing. Only in the phone card below; the page's store buttons stay checker links. Nothing new is sent or counted (a tap is
// a site_install, as every store tap).
const ubAndroidOther = (() => {
  try { return UB_FIREFOX_ANDROID.live === true && !ubFxAndroid && /\bAndroid\b/.test(navigator.userAgent || ''); } catch { return false; }
})();
// X70 (2026-11-08, docs/EXPERIMENTS.md): Safari on a Mac cannot add a Chrome, Edge or Firefox extension, and there is no Mac
// Safari version, so a store button there opens a page it cannot install from. /get and the checker already treat it so. On
// English pages its store buttons become checker links, as on phones. The test is index.html's <head> test: change the two
// together. Language pages keep their own words (X27, X59). It stays a computer for every count (home_view_computer).
// ubSafariMac: Safari on a Mac on any page (the App Store's Mac test, ubAppStore below); ubMacSafari: on an English page.
const ubSafariMac = (() => {
  try {
    const u = navigator.userAgent || '';
    return !isHandheld && /\bMacintosh\b/.test(u) && /\bVersion\/[\d.]+.*\bSafari\//.test(u)
      && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(u);
  } catch { return false; }
})();
const ubMacSafari = (() => {
  try { return ubSafariMac && /^en\b/i.test(document.documentElement.lang || ''); } catch { return false; }
})();
// App Store (2026-11-09, branch site-appstore, docs/owners/SHIP_QUEUE.md): Underbook for Safari, "Underbook: Hotel Price
// Checker", App Store id 6818661903. One listing: the iPhone build (it also runs on an iPad; docs/APP_STORE_SUBMISSION_
// 2026-10-05.md test 6) and, once Apple approves it, the Mac version (the same bundle, a universal purchase). Free.
// ONE switch, UB_APP_STORE.live, for the whole site (scripts/help_pages.py and scripts/phone_page_20261109.py read it here):
//   false      as committed: nothing about the app is shown anywhere; every page is as before.
//   'ios'      the iPhone listing is live. An iPhone or iPad visitor, in any browser, on an English page, gets the App
//              Store line in the phone card (under the homepage's check form, under a checker result, in the /get note: the
//              web check stays the first step) and on the help and phone pages. Safari on a Mac is unchanged. A page in
//              one of the 16 languages (the checker translated by i18n.js, or a language page) gets the same in its own
//              words (UB_AS_L10N below; 2026-11-13): the checker's cards as in English, a language page's App Store line
//              under each check (engine/checker-e2e.mjs L11: no English left on a translated page).
//   'ios+mac'  the Mac version is live too. Safari on a Mac (ubSafariMac; a language page too) also gets the App Store button in
//              place of every Chrome, Edge or Firefox store button, the checker's nav and result offer included, and the
//              homepage card offers it instead of the copy-link line. Every other visitor is unchanged.
// Each link carries ct=<place> (App Store Connect's campaign token; no pt, it is not ours) and counts as every store click
// does: site_install and site_install_land:<word> (ub-install, a person's click), home_install on the homepage; and, once
// per page view, the worker's existing phone_appstore_click (any click on this listing's link). No new event, no worker
// change. Flip: docs/owners/SHIP_QUEUE.md.
const UB_APP_STORE = { live: 'ios+mac', url: 'https://apps.apple.com/app/id6818661903' };
const ubIPad = (() => {
  try { return /\biPad\b/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); } catch { return false; }
})();
const ubIOS = (() => { try { return ubIPad || /\b(iPhone|iPod)\b/.test(navigator.userAgent || ''); } catch { return false; } })();
// An English page: i18n.js's language when it runs on the page (it sets <html lang> only once the dictionary is in), else
// the page's own <html lang>.
const ubEnglishPage = (() => {
  try { return /^en\b/i.test((window.UBI18N && window.UBI18N.lang) || document.documentElement.lang || 'en'); } catch { return true; }
})();
// App Store in the page's language (2026-11-13, branch appstore-l10n): the 16 languages of the language pages and of the
// checker translated by i18n.js. The page's language is ubEnglishPage's source (i18n.js's, else <html lang>), lower case.
// label: the page button (Apple's badge wording in that language); nav: the checker's nav button; iphone, ipad, mac: the
// lead of the App Store line; body: the line; getIOS: the /get note on an iPhone or iPad (COPY.getIOS below); eu: the EU
// hold's note; parts (Japanese, Chinese, Korean): the label in pieces that each wrap whole (ubAsLabelHtml), so a phone
// never breaks it inside a word (ダウンロ|ード). No dash, no savings or "best" words (scripts/i18n_check.mjs's lists, engine/app-store-e2e.mjs L-checks);
// the name stays "Underbook for Safari" and "App Store" is written as Apple writes it (docs/appstore/l10n/). A language
// not here keeps its page as before (no App Store line), as English words on a translated page would be.
const UB_AS_L10N = {
  de: { label: 'Underbook for Safari im App Store laden', nav: 'Laden im App Store', iphone: 'Auf diesem iPhone:', ipad: 'Auf diesem iPad:', mac: 'In Safari auf diesem Mac:',
    body: 'Underbook for Safari führt denselben Vergleich auf den Hotelseiten durch, die Sie in Safari öffnen. Die App ist kostenlos im App Store und zeigt Ihnen, wie Sie sie einschalten.',
    getIOS: '<strong class="text-ink">Underbook läuft auf dem Computer in Chrome, Edge oder Firefox und auf iPhone und iPad in Safari.</strong> Öffnen Sie auf Ihrem Computer {get}. Hier können Sie unten den Preis eines Hotels prüfen.',
    eu: ' (im App Store in EU-Ländern noch nicht verfügbar)' },
  es: { label: 'Descarga Underbook for Safari en el App Store', nav: 'Descárgalo en el App Store', iphone: 'En este iPhone:', ipad: 'En este iPad:', mac: 'En Safari en este Mac:',
    body: 'Underbook for Safari hace la misma comprobación en las páginas de hoteles que abres en Safari. Es gratis en el App Store, y la app te muestra cómo activarla.',
    getIOS: '<strong class="text-ink">Underbook funciona en Chrome, Edge o Firefox en un ordenador, y en Safari en iPhone y iPad.</strong> En tu ordenador, abre {get}. Aquí, consulta abajo el precio de un hotel.',
    eu: ' (aún no disponible en el App Store en los países de la UE)' },
  fr: { label: 'Télécharger Underbook for Safari dans l’App Store', nav: 'Télécharger dans l’App Store', iphone: 'Sur cet iPhone :', ipad: 'Sur cet iPad :', mac: 'Dans Safari sur ce Mac :',
    body: 'Underbook for Safari fait la même vérification sur les pages d’hôtels que vous ouvrez dans Safari. L’app est gratuite sur l’App Store et vous montre comment l’activer.',
    getIOS: '<strong class="text-ink">Underbook fonctionne dans Chrome, Edge ou Firefox sur un ordinateur, et dans Safari sur iPhone et iPad.</strong> Sur votre ordinateur, ouvrez {get}. Ici, vérifiez le prix d’un hôtel ci-dessous.',
    eu: ' (pas encore sur l’App Store dans les pays de l’UE)' },
  it: { label: 'Scarica Underbook for Safari su App Store', nav: 'Scarica su App Store', iphone: 'Su questo iPhone:', ipad: 'Su questo iPad:', mac: 'In Safari su questo Mac:',
    body: 'Underbook for Safari esegue lo stesso controllo sulle pagine degli hotel che apri in Safari. È gratis su App Store e l’app ti mostra come attivarla.',
    getIOS: '<strong class="text-ink">Underbook funziona in Chrome, Edge o Firefox su un computer, e in Safari su iPhone e iPad.</strong> Sul tuo computer, apri {get}. Qui sotto puoi controllare il prezzo di un hotel.',
    eu: ' (non ancora su App Store nei Paesi dell’UE)' },
  ja: { label: 'Underbook for SafariをApp Storeからダウンロード', parts: ['Underbook for Safariを', 'App Storeからダウンロード'], sep: '', nav: 'App Storeからダウンロード', iphone: 'このiPhoneで：', ipad: 'このiPadで：', mac: 'このMacのSafariで：',
    body: 'Underbook for Safariは、Safariでひらいたホテルのページで同じ比較を行います。App Storeで無料で入手でき、オンにする方法はアプリが案内します。',
    getIOS: '<strong class="text-ink">Underbookは、パソコンではChrome、Edge、Firefoxで、iPhoneとiPadではSafariで動きます。</strong>パソコンで{get}をひらいてください。ここでは、下でホテルの料金を確認できます。',
    eu: '（EU加盟国のApp Storeではまだ配信されていません）' },
  ko: { label: 'App Store에서 Underbook for Safari 다운로드', parts: ['App Store에서', 'Underbook for Safari 다운로드'], sep: ' ', nav: 'App Store에서 다운로드', iphone: '이 iPhone에서:', ipad: '이 iPad에서:', mac: '이 Mac의 Safari에서:',
    body: 'Underbook for Safari는 Safari에서 여는 호텔 페이지에서 같은 비교를 해 줍니다. App Store에서 무료로 받을 수 있으며, 켜는 방법은 앱에서 안내합니다.',
    getIOS: '<strong class="text-ink">Underbook은 컴퓨터의 Chrome, Edge, Firefox와 iPhone 및 iPad의 Safari에서 작동합니다.</strong> 컴퓨터에서 {get}을 여세요. 여기서는 아래에서 호텔 가격을 확인할 수 있습니다.',
    eu: ' (EU 국가의 App Store에서는 아직 제공되지 않음)' },
  nl: { label: 'Download Underbook for Safari in de App Store', nav: 'Download in de App Store', iphone: 'Op deze iPhone:', ipad: 'Op deze iPad:', mac: 'In Safari op deze Mac:',
    body: 'Underbook for Safari doet dezelfde vergelijking op de hotelpagina’s die je in Safari opent. De app is gratis in de App Store en laat zien hoe je hem aanzet.',
    getIOS: '<strong class="text-ink">Underbook werkt in Chrome, Edge of Firefox op een computer, en in Safari op iPhone en iPad.</strong> Open op je computer {get}. Hieronder kun je de prijs van een hotel controleren.',
    eu: ' (nog niet in de App Store in EU-landen)' },
  pl: { label: 'Pobierz Underbook for Safari z App Store', nav: 'Pobierz z App Store', iphone: 'Na tym iPhonie:', ipad: 'Na tym iPadzie:', mac: 'W Safari na tym Macu:',
    body: 'Underbook for Safari wykonuje to samo porównanie na stronach hoteli, które otwierasz w Safari. Aplikacja jest bezpłatna w App Store i pokazuje, jak ją włączyć.',
    getIOS: '<strong class="text-ink">Underbook działa w Chrome, Edge lub Firefoksie na komputerze oraz w Safari na iPhonie i iPadzie.</strong> Na komputerze otwórz {get}. Tutaj, poniżej, sprawdzisz cenę hotelu.',
    eu: ' (jeszcze niedostępne w App Store w krajach UE)' },
  'pt-br': { label: 'Baixe o Underbook for Safari na App Store', nav: 'Baixar na App Store', iphone: 'Neste iPhone:', ipad: 'Neste iPad:', mac: 'No Safari deste Mac:',
    body: 'O Underbook for Safari faz a mesma verificação nas páginas de hotéis que você abre no Safari. É grátis na App Store, e o app mostra como ativá-lo.',
    getIOS: '<strong class="text-ink">O Underbook funciona no Chrome, Edge ou Firefox no computador, e no Safari no iPhone e iPad.</strong> No seu computador, abra {get}. Aqui, confira abaixo o preço de um hotel.',
    eu: ' (ainda não disponível na App Store nos países da UE)' },
  'pt-pt': { label: 'Descarregue o Underbook for Safari na App Store', nav: 'Descarregar na App Store', iphone: 'Neste iPhone:', ipad: 'Neste iPad:', mac: 'No Safari deste Mac:',
    body: 'O Underbook for Safari faz a mesma verificação nas páginas de hotéis que abre no Safari. É gratuito na App Store, e a app mostra como o ativar.',
    getIOS: '<strong class="text-ink">O Underbook funciona no Chrome, Edge ou Firefox num computador, e no Safari no iPhone e iPad.</strong> No seu computador, abra {get}. Aqui, verifique abaixo o preço de um hotel.',
    eu: ' (ainda não disponível na App Store nos países da UE)' },
  sv: { label: 'Hämta Underbook for Safari i App Store', nav: 'Hämta i App Store', iphone: 'På den här iPhonen:', ipad: 'På den här iPaden:', mac: 'I Safari på den här Macen:',
    body: 'Underbook for Safari gör samma jämförelse på hotellsidorna du öppnar i Safari. Appen är gratis i App Store och visar hur du slår på den.',
    getIOS: '<strong class="text-ink">Underbook fungerar i Chrome, Edge eller Firefox på en dator, och i Safari på iPhone och iPad.</strong> Öppna {get} på din dator. Här nedanför kan du kolla ett hotells pris.',
    eu: ' (ännu inte i App Store i EU-länder)' },
  tr: { label: 'Underbook for Safari’yi App Store’dan indirin', nav: 'App Store’dan indirin', iphone: 'Bu iPhone’da:', ipad: 'Bu iPad’de:', mac: 'Bu Mac’te Safari’de:',
    body: 'Underbook for Safari, Safari’de açtığınız otel sayfalarında aynı karşılaştırmayı yapar. App Store’da ücretsizdir ve nasıl açacağınızı uygulama gösterir.',
    getIOS: '<strong class="text-ink">Underbook, bilgisayarda Chrome, Edge veya Firefox’ta, iPhone ve iPad’de ise Safari’de çalışır.</strong> Bilgisayarınızda {get} adresini açın. Burada, aşağıda bir otelin fiyatını kontrol edebilirsiniz.',
    eu: ' (AB ülkelerinde henüz App Store’da yok)' },
  vi: { label: 'Tải Underbook for Safari trên App Store', nav: 'Tải về trên App Store', iphone: 'Trên iPhone này:', ipad: 'Trên iPad này:', mac: 'Trong Safari trên máy Mac này:',
    body: 'Underbook for Safari thực hiện cùng phép so sánh trên các trang khách sạn bạn mở trong Safari. Ứng dụng miễn phí trên App Store và sẽ hướng dẫn bạn cách bật.',
    getIOS: '<strong class="text-ink">Underbook chạy trong Chrome, Edge hoặc Firefox trên máy tính, và trong Safari trên iPhone và iPad.</strong> Trên máy tính, hãy mở {get}. Tại đây, bạn có thể kiểm tra giá một khách sạn ở bên dưới.',
    eu: ' (chưa có trên App Store tại các nước EU)' },
  id: { label: 'Unduh Underbook for Safari di App Store', nav: 'Unduh di App Store', iphone: 'Di iPhone ini:', ipad: 'Di iPad ini:', mac: 'Di Safari pada Mac ini:',
    body: 'Underbook for Safari menjalankan pemeriksaan yang sama di halaman hotel yang Anda buka di Safari. Gratis di App Store, dan aplikasinya menunjukkan cara mengaktifkannya.',
    getIOS: '<strong class="text-ink">Underbook berjalan di Chrome, Edge, atau Firefox di komputer, dan di Safari di iPhone dan iPad.</strong> Di komputer Anda, buka {get}. Di sini, periksa harga hotel di bawah.',
    eu: ' (belum tersedia di App Store di negara-negara UE)' },
  'zh-cn': { label: '在 App Store 下载 Underbook for Safari', parts: ['在 App Store 下载', 'Underbook for Safari'], sep: ' ', nav: '在 App Store 下载', iphone: '在这台 iPhone 上：', ipad: '在这台 iPad 上：', mac: '在这台 Mac 的 Safari 中：',
    body: 'Underbook for Safari 会在您用 Safari 打开的酒店页面上进行同样的比价。它在 App Store 免费提供，App 会告诉您如何启用。',
    getIOS: '<strong class="text-ink">Underbook 可在电脑上的 Chrome、Edge 或 Firefox 中运行，也可在 iPhone 和 iPad 上的 Safari 中运行。</strong>请在电脑上打开 {get}。在这里，您可以在下方查询酒店价格。',
    eu: '（在欧盟国家的 App Store 尚未上架）' },
  'zh-tw': { label: '在 App Store 下載 Underbook for Safari', parts: ['在 App Store 下載', 'Underbook for Safari'], sep: ' ', nav: '在 App Store 下載', iphone: '在這台 iPhone 上：', ipad: '在這台 iPad 上：', mac: '在這台 Mac 的 Safari 中：',
    body: 'Underbook for Safari 會在您用 Safari 開啟的飯店頁面上進行同樣的比價。它在 App Store 免費提供，App 會告訴您如何啟用。',
    getIOS: '<strong class="text-ink">Underbook 可在電腦上的 Chrome、Edge 或 Firefox 中執行，也可在 iPhone 和 iPad 上的 Safari 中執行。</strong>請在電腦上開啟 {get}。在這裡，您可以在下方查詢飯店價格。',
    eu: '（在歐盟國家的 App Store 尚未上架）' },
};
// ubLang: 'de', 'pt-br', 'zh-tw'...; ubAsL: this page's App Store words, or null on an English page or a language not above.
const ubLang = (() => {
  try { return String((window.UBI18N && window.UBI18N.lang) || document.documentElement.lang || 'en').toLowerCase(); } catch { return 'en'; }
})();
const ubAsL = ubEnglishPage ? null : (UB_AS_L10N[ubLang] || UB_AS_L10N[ubLang.split('-')[0]] || null);
// EU hold (2026-11-13, docs/owners/web-checks.md B11): Apple does not offer the listing in the 27 EU countries until the
// developer account's trader status is declared (itunes.apple.com/lookup?id=6818661903&country=de returned 0 results on
// 2026-11-13, as for each of the 27; apps.apple.com/de/app/id6818661903 answered 404). A visitor whose device clock is set
// to one of those countries' time zones (read here, sent nowhere, counted nowhere) is offered no App Store button: the
// site is as it was before the switch (the check first, the phone card's send line). App Store links written into a
// page's own text stay, with a few words beside them (the loop under ubAppStoreHref). Set UB_APP_STORE_EU_HOLD to false
// the day that lookup returns 1 result; nothing else changes. Not part of the switch above (engine/app-store-e2e.mjs S1).
// OFF since 2026-11-16 18:4xZ: Apple's record shows the 27 countries open (the app was set to non-trader that day) and
// apps.apple.com/de, /fr, /es, /it, /nl, /ie and /pl show the listing (the lookup still returned 0, as it did for hours on 11/10).
const UB_APP_STORE_EU_HOLD = false;
const UB_EU_TZ = /^(Europe\/(Vienna|Brussels|Sofia|Zagreb|Nicosia|Prague|Copenhagen|Tallinn|Helsinki|Mariehamn|Paris|Berlin|Busingen|Athens|Budapest|Dublin|Rome|Riga|Vilnius|Luxembourg|Malta|Amsterdam|Warsaw|Lisbon|Bucharest|Bratislava|Ljubljana|Madrid|Stockholm)|Asia\/(Nicosia|Famagusta)|Atlantic\/(Madeira|Azores|Canary)|Africa\/Ceuta)$/;
const ubEuHeld = (() => {
  if (!UB_APP_STORE_EU_HOLD) return false;
  try { return UB_EU_TZ.test(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch { return false; }
})();
// 'ios', 'mac' or '': the App Store is offered to this visitor.
const ubAppStore = (() => {
  const v = UB_APP_STORE.live;
  if (ubEuHeld) return '';
  if (ubIOS) return (v === 'ios' || v === 'ios+mac') && (ubEnglishPage || ubAsL) ? 'ios' : '';
  if (ubSafariMac) return v === 'ios+mac' && (ubEnglishPage || ubAsL) ? 'mac' : '';
  return '';
})();
// The ct= prefix: ios or mac, and the language on a translated page (ios_de_result, mac_pt_br_lang_hero_pt_br).
const ubAsTag = ubAsL ? `${ubAppStore}_${ubLang}` : ubAppStore;
try { window.ubAppStore = ubAppStore; } catch { /* the checker's offer then names the browser as before */ }
const ubAppStoreHref = (place) => `${UB_APP_STORE.url}?ct=${String(place || 'site').replace(/[^A-Za-z0-9_]+/g, '_').slice(0, 40)}`;
const UB_APP_STORE_LABEL = (ubAsL && ubAsL.label) || 'Get Underbook for Safari on the App Store';
// The label as a button's HTML: the pieces in inline-block spans inside one span (one flex item in an inline-flex button);
// the text stays UB_APP_STORE_LABEL.
const ubAsLabelHtml = ubAsL && ubAsL.parts ? `<span>${ubAsL.parts.map((x) => `<span class="inline-block">${x}</span>`).join(ubAsL.sep || '')}</span>` : UB_APP_STORE_LABEL;
// EU hold: beside each link to the listing that a page's own text carries, on an iPhone, an iPad or a Mac (the devices the
// listing is for), so nobody there follows it to a page Apple does not serve.
if (ubEuHeld && UB_APP_STORE.live && (ubIOS || /\bMacintosh\b/.test(navigator.userAgent || ''))) {
  try {
    document.querySelectorAll('a[href*="/id6818661903"]').forEach((a) => {
      const n = document.createElement('span');
      n.className = 'ub-eu-hold';
      n.textContent = (ubAsL && ubAsL.eu) || ' (not yet on the App Store in EU countries)';
      a.insertAdjacentElement('afterend', n);
    });
  } catch { /* the links stay as written */ }
}
// X78: the pages where an iPhone's store button stays a link to the check (see the loop below).
const ubIosKeepCheck = (() => {
  try {
    const p = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
    return p === '/' || p === '/index' || /^\/(hotel-price-checker|how-underbook-works|does-booking-com-have-the-lowest-prices|which-sites-does-google-hotels-show|lesser-known-hotel-booking-sites|compare-one-hotel-no-install|compare-hotel-prices-on-your-phone)$/.test(p);
  } catch { return true; }
})();
if ((isHandheld || ubMacSafari || ubAppStore === 'mac') && (ubAppStore === 'mac' || !location.pathname.startsWith('/hotel-price-checker'))) {
  document.querySelectorAll('a[href^="https://chromewebstore.google.com/detail/"]').forEach((a) => {
    // Inline text links stay as they are. X70: Safari on a Mac is wider than a phone, so it also sees the outline store
    // button that md:block hides on phones; links naming one store on purpose (data-store) stay.
    if (!/\bbg-accent\b/.test(a.className) && !(ubMacSafari && a.classList.contains('ub-install') && !a.dataset.store)) return;
    const inNav = !!a.closest('nav');
    // App Store, Safari on a Mac (UB_APP_STORE.live 'ios+mac'): the button opens the App Store listing, on every English
    // page and the checker (its nav and its result offer); the link beside it to the web checker stays. ct=mac_<the
    // button's utm_medium>_<its utm_campaign>, so App Store Connect splits them as the stores split the utm tags.
    // X78 (2026-11-11, docs/owners/web-checks.md B9): an iPhone or iPad on an English guide or answer page gets the App
    // Store button in place of the page's store button (ct=ios_<utm_medium>_<utm_campaign>), and the check link beside it
    // stays. Not the nav (one "Check a price" button), not the homepage (X54) or the checker (their cards carry the App
    // Store line), not X62's four phone-form guides, X66's page or X75's page (its own App Store lines).
    const iosPage = ubAppStore === 'ios' && !inNav && !ubIosKeepCheck;
    if (ubAppStore === 'mac' || iosPage) {
      let med = '', camp = '';
      try { const q = new URL(a.href).searchParams; med = q.get('utm_medium') || ''; camp = q.get('utm_campaign') || ''; } catch { /* untagged */ }
      a.href = ubAppStoreHref([ubAsTag, med || 'page', camp].filter(Boolean).join('_'));
      if (inNav) a.textContent = (ubAsL && ubAsL.nav) || 'Get it on the App Store';
      else a.innerHTML = ubAsLabelHtml;
      a.target = '_blank';
      a.rel = 'noopener';
      a.dataset.ubAppstore = 'page';
      return;
    }
    // Firefox for Android with the switch on: the page's store buttons open Firefox Add-ons (the Firefox block below);
    // the nav keeps the phone's one "Check a price" button, so the nav stays one row as on every phone.
    if (ubFxAndroid && !inNav) return;
    a.textContent = inNav ? 'Check a price' : 'Check a hotel\u2019s price, free \u2192';
    a.href = '/hotel-price-checker';
    a.removeAttribute('target');
    a.classList.remove('ub-install');
    a.dataset.handheld = '1';
    const parent = a.parentElement;
    if (parent && !inNav) parent.querySelectorAll('a[href="/hotel-price-checker"]:not([data-handheld])').forEach((s) => { s.style.display = 'none'; });
    if (inNav && parent) parent.querySelectorAll('a[href="/hotel-price-checker"]:not([data-handheld])').forEach((s) => { s.style.display = 'none'; });
  });
}

// App Store on the language pages (2026-11-13, branch appstore-l10n): a page written in one of the 16 languages above
// (scripts/lang_landing.py's pages, the answer pages; <html lang>, no i18n.js) has no store button the loop above swaps: its
// store buttons (data-store) sit in .ub-desk-only, and a phone or tablet sees .ub-hh-only, the check. An iPhone or iPad there
// gets the App Store line under each check in <main> (the first with its sentence, a later one the button only), so the
// check stays the first step, as on an English page; Safari on a Mac gets the App Store button in place of each Chrome
// button (the Firefox and Edge buttons stay, for those browsers). ct=<ios|mac>_<lang>_<utm_medium>_<utm_campaign> of the
// section's Chrome button (ios_de_guide_answer_de_end). Counted as every store click (.ub-install: site_install, drawn
// before the listener below is attached; phone_appstore_click).
if (ubAsL && !window.UBI18N && ubAppStore) {
  try {
    const tagOf = (a) => {
      let med = '', camp = '';
      try { const q = new URL(a.href).searchParams; med = q.get('utm_medium') || ''; camp = q.get('utm_campaign') || ''; } catch { /* untagged */ }
      return [ubAsTag, med || 'page', camp].filter(Boolean).join('_');
    };
    if (ubAppStore === 'ios') {
      let first = true;
      const ubLangHome = /^\/[a-z]{2}(-[a-z]{2})?(\/(index(\.html)?)?)?$/.test(location.pathname);
      document.querySelectorAll('main .ub-hh-only').forEach((box) => {
        const check = box.querySelector('form[action^="/hotel-price-checker"], a[href^="/hotel-price-checker"]');
        if (!check) return;
        const chrome = box.parentElement && box.parentElement.querySelector('.ub-desk-only a[data-store="chrome"]');
        const line = document.createElement('div');
        line.className = 'mt-4';
        line.setAttribute('data-ub-appstore-line', '');
        line.innerHTML = (first ? `<p class="text-sm text-slate-700"><strong class="text-ink">${ubIPad ? ubAsL.ipad : ubAsL.iphone}</strong> ${ubAsL.body}</p>` : '')
          + `<p${first ? ' class="mt-3"' : ''}><a href="${ubAppStoreHref(chrome ? tagOf(chrome) : `${ubAsTag}_lang_page`)}" target="_blank" rel="noopener" data-ub-appstore="page" class="ub-install inline-flex items-center text-sm font-semibold bg-ink text-white px-4 py-2.5 rounded-lg hover:bg-stone-800 transition">${ubAsLabelHtml}</a></p>`;
        // X92 (2026-11-16, docs/owners/web-checks.md B14): on the 16 language homepages the line opens the phone box, above
        // the check's paragraph, so the whole App Store button is on an iPhone's first screen (walked live 11/16: 3 of 16
        // had it there; the button started 866px to 988px down on the other 13). The check follows as written. The answer
        // pages (X59's forms) keep the line under the form.
        if (first && ubLangHome) { line.className = 'mb-5'; box.insertAdjacentElement('afterbegin', line); }
        else check.insertAdjacentElement('afterend', line);
        first = false;
      });
    } else {
      document.querySelectorAll('.ub-desk-only a[data-store="chrome"][href^="https://chromewebstore.google.com/"]').forEach((a) => {
        a.href = ubAppStoreHref(tagOf(a));
        a.innerHTML = ubAsLabelHtml;
        a.dataset.store = 'appstore';
        a.dataset.ubAppstore = 'page';
      });
    }
  } catch { /* the page stays as written */ }
}

// X78 A2 (2026-11-14, docs/owners/web-checks.md B12): X62's four English phone-form guides, the pages ChatGPT links most,
// kept their check form on an iPhone or iPad and showed no way to the App Store app (walked live 11/14: 0 of 4). They now
// get the App Store line under the form, in the words the phone card uses: the form stays first and as written. Only where
// the App Store is offered (ubAppStore 'ios': not on EU time while the hold is on). ct=ios_guide_form; counted as every
// store click (.ub-install, drawn before the listener below is attached: site_install; phone_appstore_click).
if (ubAppStore === 'ios' && ubEnglishPage && !ubAsL) {
  try {
    const p = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '');
    if (/^\/(how-underbook-works|does-booking-com-have-the-lowest-prices|which-sites-does-google-hotels-show|lesser-known-hotel-booking-sites)$/.test(p)) {
      const form = document.querySelector('main .ub-hh-only form[action^="/hotel-price-checker"]');
      if (form && !document.querySelector('[data-ub-appstore-line]')) {
        const line = document.createElement('div');
        line.className = 'mt-4';
        line.setAttribute('data-ub-appstore-line', '');
        line.innerHTML = `<p class="text-sm text-slate-700"><strong class="text-ink">On this ${ubIPad ? 'iPad' : 'iPhone'}:</strong> Underbook for Safari runs the same check on the hotel pages you open in Safari. It is free on the App Store, and the app shows how to switch it on.</p>`
          + `<p class="mt-3"><a href="${ubAppStoreHref('ios_guide_form')}" target="_blank" rel="noopener" data-ub-appstore="page" class="ub-install inline-flex items-center text-sm font-semibold bg-ink text-white px-4 py-2.5 rounded-lg hover:bg-stone-800 transition">${ubAsLabelHtml}</a></p>`;
        form.insertAdjacentElement('afterend', line);
      }
    }
  } catch { /* the page stays as written */ }
}
// X131 (2026-11-24, the owner chat): the homepage and the checker carry their App Store line on an iPhone or iPad only
// below the first screen (the homepage card under the form) or after a result (the checker). Visitors from ChatGPT are
// 3 in 4 on a phone (96 in 14 days) and pressed that line 12 times; the App Store is the only install a phone can make.
// So the button also sits under the page's H1 there ([data-ub-ios-top], hidden as written; only where the App Store is
// offered: ubAppStore 'ios'). The check form follows it, still in the first screen. ct=<ubAsTag>_top; counted as every
// store click (.ub-install, drawn before the listener below is attached: site_install; phone_appstore_click).
if (ubAppStore === 'ios') {
  document.querySelectorAll('[data-ub-ios-top]').forEach((el) => {
    try {
      el.innerHTML = `<a href="${ubAppStoreHref(`${ubAsTag}_top`)}" target="_blank" rel="noopener" data-ub-appstore="top" class="ub-install inline-flex items-center text-sm font-semibold bg-ink text-white px-4 py-2.5 rounded-lg hover:bg-stone-800 transition">${ubAsLabelHtml}</a>`;
      el.hidden = false;
    } catch { /* the page stays as written */ }
  });
}

// App Store, Safari on a Mac ('ios+mac'): the checker's result offer (#installLead) and the guide pages' check box offer
// (#ub-page-offer-lead, check-inline.js) are written by the checker's own script with each result and name the browser
// their button installs into: Chrome here, since Safari's user agent names no other. Their button now opens the App Store
// (above), so the sentence says Safari. Done here, not in the checker's script, which check-inline.js copies word for word.
if (ubAppStore === 'mac' && window.MutationObserver) {
  const toSafari = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/\bChrome\b/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\bChrome\b/g, 'Safari');
  };
  ['installLead', 'ub-page-offer-lead'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    toSafari(el);
    new MutationObserver(() => toSafari(el)).observe(el, { childList: true, subtree: true, characterData: true });
  });
}

// Microsoft Edge (2026-09-30). The Edge Add-ons listing went live 9/30; before this, Edge
// visitors were sent to the Chrome Web Store, which Edge only installs from after an extra
// "allow extensions from other stores" step. On desktop Edge every store link goes to the Edge
// listing and says Edge instead of Chrome. Same click counting (site_install).
const UB_EDGE_URL = 'https://microsoftedge.microsoft.com/addons/detail/hdpeoddhbhihjmmhpidnfnochdeekicd';
const isEdge = (() => {
  try {
    const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    if (brands.some((b) => /Microsoft Edge/i.test(b.brand))) return true;
    return /\bEdg\//.test(navigator.userAgent || '');
  } catch { return false; }
})();
// A link marked data-store names one store on purpose (the homepage's "Add it to Chrome, Edge or Firefox" line and its
// store FAQ, 2026-10-02, docs/AI_VISIBILITY_2026-10-02.md): it keeps its own address and wording in every browser.
if (isEdge && !isHandheld) {
  document.querySelectorAll('a[href^="https://chromewebstore.google.com/detail/"]').forEach((a) => {
    if (a.hasAttribute('data-store')) return;
    a.href = UB_EDGE_URL;
    const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      n.nodeValue = n.nodeValue.replace(/Chrome Web Store/g, 'Edge Add-ons').replace(/\bChrome\b/g, 'Edge');
    }
  });
}

// Firefox (2026-10-02). Mozilla approved the add-on on 10/1 (addons.mozilla.org/addon/underbook). Firefox cannot
// install from the Chrome Web Store, so on desktop Firefox every store link goes to the Firefox listing and says
// Firefox instead of Chrome. Same click counting (site_install).
// Install attribution (2026-10-02, docs/INSTALL_ATTRIBUTION_2026-10-02.md): every store link on our pages carries
// utm_source=underbook.co, utm_medium=<page kind> and utm_campaign=<button> (scripts/store_link_utm.py). Firefox Add-ons
// breaks its install statistics down by those parameters, so the Firefox link keeps the Chrome link's tags. Edge Add-ons
// reports no traffic source (Partner Center splits by region, OS and language only), so the Edge link above stays bare.
const UB_FIREFOX_URL = 'https://addons.mozilla.org/firefox/addon/underbook/';
const ubStoreTags = (href) => {
  try {
    const from = new URL(href).searchParams, to = new URLSearchParams();
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach((k) => { if (from.get(k)) to.set(k, from.get(k)); });
    const q = to.toString();
    return q ? `?${q}` : '';
  } catch { return ''; }
};
const isFirefox = (() => {
  try { const ua = navigator.userAgent || ''; return /\bFirefox\//.test(ua) && !/\bSeamonkey\//i.test(ua); } catch { return false; }
})();
if (isFirefox && !isEdge && (!isHandheld || ubFxAndroid)) {
  document.querySelectorAll('a[href^="https://chromewebstore.google.com/detail/"]').forEach((a) => {
    if (a.hasAttribute('data-store')) return;
    a.href = UB_FIREFOX_URL + ubStoreTags(a.href);
    const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      n.nodeValue = n.nodeValue.replace(/Chrome Web Store/g, 'Firefox Add-ons').replace(/\bChrome\b/g, 'Firefox');
    }
  });
}

// The Chrome Web Store in the reader's own language from our English pages (2026-11-20, docs/owners/web-checks.md B18,
// list line X107). ChatGPT asked in Spanish, Portuguese, French or Italian links our English homepage (8 of 12 answers,
// docs/NONENGLISH_WALK_2026-11-17.md), so these readers land on English pages, whose Chrome links carry no hl=. The store
// has no Spanish (Latin America) listing, so an es-MX, es-AR or es-419 browser got our English listing from them (the
// walk's fix 3, so far done only on the translated pages and the translated checker). A Chrome link on any page that
// still has none gets hl=<the store's code for the browser's first language>, for the 16 languages of the language
// pages (the codes of scripts/store_link_utm.py CWS_HL); English and every other language: the link stays as it is.
(() => {
  try {
    const m = /^([A-Za-z]{2,3})(?:[-_]([A-Za-z]{4}))?(?:[-_]([A-Za-z]{2}|\d{3}))?(?:[-_]|$)/.exec(String(navigator.language || '').trim());
    if (!m) return;
    let l = m[1].toLowerCase();
    const s = (m[2] || '').toLowerCase(), r = (m[3] || '').toUpperCase();
    if (l === 'in') l = 'id';
    let hl = '';
    if (['es', 'fr', 'it', 'de', 'tr', 'ja', 'ko', 'nl', 'pl', 'sv', 'vi', 'id'].includes(l)) hl = l;
    else if (l === 'pt') hl = r === 'BR' ? 'pt-BR' : 'pt-PT';
    else if (l === 'zh') hl = s === 'hant' || (s !== 'hans' && ['TW', 'HK', 'MO'].includes(r)) ? 'zh-TW' : 'zh-CN';
    if (!hl) return;
    document.querySelectorAll('a[href^="https://chromewebstore.google.com/detail/"]').forEach((a) => {
      try {
        const u = new URL(a.href);
        if (u.searchParams.has('hl')) return;
        const q = u.searchParams.toString();
        u.search = `?hl=${encodeURIComponent(hl)}${q ? `&${q}` : ''}`;
        a.href = u.toString();
      } catch { /* the link stays as it was */ }
    });
    // X112 (2026-11-21, docs/owners/web-checks.md B19): the English homepage's first-screen install button, on a computer,
    // in the same language, with the words of that language's own homepage button (landing/public/<lang>/index.html,
    // hero_<lang>), for the browser the button installs into (Edge and Firefox were swapped above). The rest of the page
    // stays English; the line to the language homepage (X71) is untouched. Not Safari on a Mac (its button opens the App
    // Store) and not phones and tablets (they get the check form).
    if (!isHandheld && ubAppStore !== 'mac' && (location.pathname === '/' || location.pathname === '/index.html')) {
      const L = {
        es: ['Añadir a Chrome', 'Añadir a Edge', 'Añadir a Firefox'],
        'pt-BR': ['Usar no Chrome', 'Adicionar ao Edge', 'Adicionar ao Firefox'],
        'pt-PT': ['Instalar no Chrome', 'Adicionar ao Edge', 'Adicionar ao Firefox'],
        fr: ['Ajouter à Chrome', 'Ajouter à Edge', 'Ajouter à Firefox'],
        it: ['Aggiungi a Chrome', 'Aggiungi a Edge', 'Aggiungi a Firefox'],
        de: ['Zu Chrome hinzufügen', 'Zu Edge hinzufügen', 'Zu Firefox hinzufügen'],
        tr: ["Chrome'a ekle", "Edge'e ekle", "Firefox'a ekle"],
        nl: ['Toevoegen aan Chrome', 'Toevoegen aan Edge', 'Toevoegen aan Firefox'],
        pl: ['Dodaj do Chrome', 'Dodaj do przeglądarki Edge', 'Dodaj do przeglądarki Firefox'],
        sv: ['Lägg till i Chrome', 'Lägg till i Edge', 'Lägg till i Firefox'],
        id: ['Tambahkan ke Chrome', 'Tambahkan ke Edge', 'Tambahkan ke Firefox'],
        vi: ['Thêm vào Chrome', 'Thêm vào Edge', 'Thêm vào Firefox'],
        ja: ['Chrome に追加', 'Edge に追加', 'Firefox に追加'],
        ko: ['Chrome에 추가', 'Edge에 추가', 'Firefox에 추가'],
        'zh-CN': ['添加至 Chrome', '添加到 Edge', '添加到 Firefox'],
        'zh-TW': ['加到 Chrome', '新增至 Edge', '新增至 Firefox'],
      }[hl];
      const b = document.querySelector('a.ub-install[data-cta="hero"]');
      if (L && b) {
        b.textContent = `+ ${L[isEdge ? 1 : isFirefox ? 2 : 0]}`;
        b.lang = hl;
      }
      // X114 (2026-11-22, docs/owners/web-checks.md B20): the rest of the first screen in the same language: the label, the
      // headline (in a smaller size: it is a longer line, in half the width), the sentence under it, the small print under the button
      // and the no-install link, each copied from that language's own homepage (/<lang>, the pages scripts/lang_landing.py
      // writes), so no words are written here. 19 of 42 computer homepage views in 11/15 to 11/21 were these readers, on an
      // English first screen around a button in their language. The button (X112), its link (X107), the language line (X71)
      // and everything below stay as they are. Any piece missing, or the fetch failing: the page stays English.
      if (L && b && window.DOMParser && window.fetch) {
        const code = hl.toLowerCase();
        fetch(`/${code}`, { credentials: 'omit' }).then((r) => (r.ok ? r.text() : '')).then((t) => {
          if (!t) return;
          const d = new DOMParser().parseFromString(t, 'text/html');
          const h1 = d.querySelector('h1'), sec = h1 && h1.closest('section');
          const desk = sec && sec.querySelector('.ub-desk-only');
          const from = {
            pill: sec && sec.querySelector('p > span'), lead: h1 && h1.nextElementSibling,
            note: desk && desk.querySelector('p.text-sm.text-slate-600'), link: desk && desk.querySelector('a[href^="/hotel-price-checker"]'),
          };
          const H1 = document.querySelector('h1'), box = b.parentElement, here = H1 && H1.closest('section');
          const to = {
            pill: here && here.querySelector('p.ub-desk-only > span'), lead: box.querySelector('p.text-lg'),
            note: box.querySelector('p.text-sm.text-slate-600'), link: box.querySelector('a[href^="/hotel-price-checker"]'),
          };
          if (!H1 || !h1 || !from.lead || from.lead.tagName !== 'P' || !to.lead || !h1.textContent.trim() || !from.lead.textContent.trim()) return;
          H1.textContent = h1.textContent.trim(); H1.className = 'text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-4'; H1.lang = hl;
          ['pill', 'lead', 'note', 'link'].forEach((k) => {
            if (!from[k] || !to[k] || !from[k].textContent.trim()) return;
            to[k].textContent = from[k].textContent.trim(); to[k].lang = hl;
          });
          if (from.link && to.link) to.link.setAttribute('href', from.link.getAttribute('href'));
          document.documentElement.setAttribute('data-ub-hero-lang', hl);
        }).catch(() => { /* the first screen stays English */ });
      }
    }
  } catch { /* the links stay as written */ }
})();

// Human-input gate (2026-09-25). Twice (9/23 20:36Z, 9/25 20:37Z) a burst of 15+ page views in
// ~15 s ended in a TRUSTED "Add to Chrome" click from a non-bot user agent, about two minutes
// after a site deploy (likely an IndexNow-triggered renderer). Automation moves the mouse once,
// straight to the button, and scrolls it into view itself; a person moves the pointer many times,
// touches, or uses the keyboard. Count site_install only after 5+ pointer moves, a touch or a key
// press, and 3+ seconds on the page; otherwise report site_install_auto.
const loadedAt = Date.now();
let pointerMoves = 0, touchedOrKeyed = false;
addEventListener('pointermove', () => { pointerMoves++; }, { passive: true });
['touchstart', 'keydown'].forEach((t) => addEventListener(t, () => { touchedOrKeyed = true; }, { passive: true, once: true }));
const looksHuman = () => (pointerMoves >= 5 || touchedOrKeyed) && Date.now() - loadedAt >= 3000;

let installLogged = false;
const ubInstallClick = (e) => {
  // Only a person's click counts: scripted clicks (link scanners, bots) are untrusted.
  if (installLogged || (e && e.isTrusted === false)) return;
  installLogged = true;
  const human = looksHuman();
  logEvent(human ? 'install_click' : 'install_click_auto');
  try {
    const body = JSON.stringify({ ev: human ? 'site_install' : 'site_install_auto' });
    if (!(navigator.sendBeacon && navigator.sendBeacon('https://underbook-backend.underbook.workers.dev/event', body))) {
      fetch('https://underbook-backend.underbook.workers.dev/event', { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  } catch { /* measurement must never block the install */ }
  // The same click by where the visit came from (2026-10-26, ubLand above): one more daily total, the word only.
  if (human) ubSiteEvent(`site_install_land:${ubLand}`);
};
document.querySelectorAll('.ub-install, #ub-install-btn').forEach((btn) => btn.addEventListener('click', ubInstallClick));
// App Store (UB_APP_STORE above): a person's click on any link to the listing (a card's, a swapped store button, the help
// and phone pages' links) also counts the worker's phone_appstore_click, once per page view, so App Store clicks read
// apart from the other stores' site_install. Never sent while the switch is off: no such link is drawn then.
let ubAppStoreSent = false;
document.addEventListener('click', (e) => {
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  // 2026-11-16: also the listing's long address, which 8 pages carry in their own text (apps.apple.com/us/app/<name>/id...,
  // ct=answer_line and others): a press there opened the listing and counted nothing (walked live on /how-underbook-works).
  if (!a || ubAppStoreSent || e.isTrusted === false || !/^https:\/\/apps\.apple\.com\/(?:[a-z]{2}\/)?app\/(?:[^/?#]+\/)?id6818661903(?:[?#]|$)/.test(a.href)) return;
  ubAppStoreSent = true;
  ubSiteEvent('phone_appstore_click');
  // 2026-11-24 (X131 read): phone_appstore_click counts any trusted click, and on 11/24 it read 7 against 2 person store
  // clicks (site_install), so it cannot say whether people press. The same click by a person (looksHuman, as
  // site_install) is also phone_appstore_person, and on X131's button under the H1 (data-ub-appstore="top") also
  // phone_appstore_top. Event names only, once per page view, like the rest.
  if (looksHuman()) {
    ubSiteEvent('phone_appstore_person');
    if (a.getAttribute('data-ub-appstore') === 'top') ubSiteEvent('phone_appstore_top');
  }
}, true);

// Homepage first screen (2026-10-01, docs/HOMEPAGE_2026-10-01.md), as anonymous daily totals in the worker's /stats: only
// {"ev": <name>} is sent, never the page, a referrer, the hotel or the dates. The homepage shows one action per device
// (computers: add the extension; phones and tablets: the price check form), so each count is split by the same device
// test that picks the action (isHandheld above; _phone covers tablets too):
//   home_view_phone / home_view_computer: a person's load of the homepage, once per page load;
//   home_check_phone / home_check_computer: a person started a price check from the homepage, once per page load (a
//     submit of the hero's form, or a click on any link to the checker: the nav's "Check a price", the "No install?"
//     link, the buttons app.js turns into checker links on phones; not the Watch my booking links, home_watch_click);
//   home_install: a person's click on a store button on the homepage, once per page load, by the same human-input test
//     as site_install (which counts it too).
// Crawlers send nothing (UB_IS_BOT); the worker files crawler user agents under site:bot.
if (location.pathname === '/' || location.pathname === '/index.html') {
  const dev = isHandheld ? '_phone' : '_computer';
  ubSiteEvent('home_view' + dev);
  // X71 (2026-11-09, docs/EXPERIMENTS.md): the line to the visitor's language homepage (index.html's head decides it): how
  // often it was drawn and a person's click on it, once per page load, by name only.
  if (document.documentElement.getAttribute('data-ub-ll')) {
    ubSiteEvent('home_lang_line_shown');
    const llLink = document.getElementById('ub-ll-link');
    if (llLink) llLink.addEventListener('click', (e) => { if (e.isTrusted !== false && looksHuman()) ubSiteEvent('home_lang_line_click'); }, { once: true });
  }
  let homeChecked = false, homeInstalled = false;
  const homeCheck = (e) => {
    if (homeChecked || !e || e.isTrusted === false) return;
    homeChecked = true;
    ubSiteEvent('home_check' + dev);
  };
  document.addEventListener('submit', (e) => { if (e.target && e.target.id === 'ub-home-check') homeCheck(e); }, true);
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (a.classList.contains('ub-install')) {
      if (!homeInstalled && e.isTrusted !== false && looksHuman()) { homeInstalled = true; ubSiteEvent('home_install'); }
      return;
    }
    try {
      const u = new URL(a.getAttribute('href'), location.href);
      if (u.origin === location.origin && UB_CHECKER.test(u.pathname) && u.searchParams.get('booked') !== '1') homeCheck(e);
    } catch { /* not a link we know */ }
  }, true);
}

// Phone path (2026-10-06, docs/PHONE_PATH_2026-10-06.md). A phone or tablet cannot add a desktop extension: there the store
// buttons above become web checker links, the checker leaves out its extension offer and underbook.co/get sends the
// visitor to the checker. So the extension was never mentioned to a phone visitor in a way they could act on. Three
// places now say where it runs and hand them the link to open on their computer, phones and tablets only (isHandheld):
//   data-ub-phone="home"    the homepage, under its check form and trust line;
//   data-ub-phone="result"  the web checker, under a result (the page's own script shows it; not on a visit from the
//                           install's welcome page, and not when the "get" note below was shown on this page view);
//   data-ub-phone="get"     the web checker, above its form, when this tab came from underbook.co/get within two minutes
//                           (the short link in posts, press and the YouTube Shorts' descriptions). get.html leaves that mark
//                           in this tab's sessionStorage (ub_get: the time and the link's utm_source and utm_campaign); it is
//                           read and deleted here and never leaves the browser.
// The button hands the link to the phone's own share menu (navigator.share: a note, a message or an email to themselves,
// AirDrop), else copies it, else shows it selected to copy by hand. The link is https://underbook.co/get with
// utm_medium=send_to_self, and utm_source and utm_campaign kept from the /get link the visitor followed (so a Short's visitor
// who installs later still counts toward that Short in the Chrome Web Store's and Firefox Add-ons' figures), else
// utm_source=underbook.co and utm_campaign=phone_<place>. Opened on a computer, /get sends it to that browser's store and
// counts phone_link_open. Nothing about the visitor, a hotel or a date is in the link, and where it is sent is never known.
// Counted as anonymous daily totals ({"ev": <name>} only, once per page view each, a person's tap only): phone_link_start
// (the button was pressed) and phone_link_done (the share menu finished or the link was copied); and phone_get_view, the
// "get" note shown (a phone or tablet that came from /get). Crawlers send nothing.
// App Store (UB_APP_STORE above, off as committed): with it on, an iPhone or iPad card offers Underbook for Safari first
// (home, result: the card sits under the check form or the result, so the web check stays the first step) or last (the
// /get note, above the form); on Safari on a Mac ('ios+mac') the homepage card offers only the App Store. The link is
// tagged ct=<ios|mac>_<place> and counted as a store click (site_install, home_install, phone_appstore_click).
const UB_GET_LINK = 'https://underbook.co/get';
const UB_TAG_OK = /^[A-Za-z0-9._~-]{1,60}$/;
const ubPhoneEls = isHandheld ? [...document.querySelectorAll('[data-ub-phone]')]
  : (ubMacSafari ? [...document.querySelectorAll('[data-ub-phone="home"]')] : []);
// X70: on Safari on a Mac the homepage's form stays out of X54's phone counts (no src), and its small print names Safari.
if (ubMacSafari) {
  const ubHomeForm = document.getElementById('ub-home-check');
  if (ubHomeForm) {
    const src = ubHomeForm.elements.src;
    if (src) src.remove();
    const small = ubHomeForm.parentElement && ubHomeForm.parentElement.querySelector('p.text-xs');
    if (small) small.textContent = 'Free, no install, works in Safari.';
  }
}
if (ubPhoneEls.length) {
  // The App Store line (ubAppStore 'ios' or 'mac'): where it runs, that the app is free and shows how to switch it on, and
  // a button in the site's style (no Apple badge in the repo).
  // On a translated checker, in the page's language (UB_AS_L10N; i18n.js has no key for these words).
  const appLead = ubAsL ? (ubAppStore === 'mac' ? ubAsL.mac : ubIPad ? ubAsL.ipad : ubAsL.iphone)
    : `${ubAppStore === 'mac' ? 'In Safari on this Mac' : `On this ${ubIPad ? 'iPad' : 'iPhone'}`}:`;
  const appBody = ubAsL ? ubAsL.body : 'Underbook for Safari runs the same check on the hotel pages you open in Safari. It is free on the App Store, and the app shows how to switch it on.';
  const appLine = (place) => `<p class="text-sm text-slate-700"><strong class="text-ink">${appLead}</strong> ${appBody}</p>`
    + `<p class="mt-3"><a href="${ubAppStoreHref(`${ubAsTag}_${place}`)}" target="_blank" rel="noopener" data-ub-appstore="${place}" class="ub-install inline-flex items-center text-sm font-semibold bg-ink text-white px-4 py-2.5 rounded-lg hover:bg-stone-800 transition">${ubAsLabelHtml}</a></p>`;
  // This tab came from /get: the mark is read once, on the checker, and deleted whatever its age.
  let fromGet = null;
  if (UB_CHECKER.test(location.pathname)) {
    try {
      const raw = sessionStorage.getItem('ub_get');
      if (raw) {
        sessionStorage.removeItem('ub_get');
        const m = JSON.parse(raw), age = Date.now() - Number(m && m.t);
        if (age >= 0 && age < 120000) fromGet = { s: UB_TAG_OK.test(String(m.s || '')) ? m.s : '', c: UB_TAG_OK.test(String(m.c || '')) ? m.c : '' };
      }
    } catch { fromGet = null; }
  }
  const linkFor = (place) => {
    const q = new URLSearchParams();
    q.set('utm_source', (place === 'get' && fromGet && fromGet.s) || 'underbook.co');
    q.set('utm_medium', 'send_to_self');
    q.set('utm_campaign', (place === 'get' && fromGet && fromGet.c) || (ubMacSafari ? `mac_safari_${place}` : `phone_${place}`));
    return `${UB_GET_LINK}?${q}`;
  };
  // Firefox for Android (UB_FIREFOX_ANDROID above, switched on): the card first offers the Firefox Add-ons listing, tagged
  // for AMO's install statistics like every store link (utm_source=underbook.co, utm_medium=phone, utm_campaign=
  // fx_android_<place>; a /get visitor keeps the link's utm_source and utm_campaign).
  const amoFor = (place) => {
    const q = new URLSearchParams();
    q.set('utm_source', (place === 'get' && fromGet && fromGet.s) || 'underbook.co');
    q.set('utm_medium', 'phone');
    q.set('utm_campaign', (place === 'get' && fromGet && fromGet.c) || (ubAndroidOther ? `android_other_${place}` : `fx_android_${place}`));
    return `${UB_FIREFOX_URL}?${q}`;
  };
  // {get}: the address, in bold. No savings word, no "cheapest", no dash (house style); the extension's job in the words
  // the checker's computer offer (X1) and the homepage already use.
  const COPY = {
    home: '<strong class="text-ink">Booking on a computer too?</strong> The free Underbook extension for Chrome, Edge or Firefox runs this check by itself on the hotel pages you open there. On your computer, open {get}.',
    result: '<strong class="text-ink">Get this check on every hotel page.</strong> On a computer, the free Underbook extension for Chrome, Edge or Firefox runs it by itself when you open a hotel with your dates. There, open {get}.',
    get: '<strong class="text-ink">The Underbook extension runs on computers</strong> (Chrome, Edge or Firefox). On your computer, open {get}. Here on your phone, check a hotel&#39;s price below.',
    // The /get note on an iPhone or iPad with the App Store on: it also runs in Safari there (the App Store line follows).
    getIOS: (ubAsL && ubAsL.getIOS) || '<strong class="text-ink">Underbook runs in Chrome, Edge or Firefox on a computer, and in Safari on iPhone and iPad.</strong> On your computer, open {get}. Here, check a hotel&#39;s price below.',
  };
  // X124 (2026-11-23, docs/EXPERIMENTS.md): a visit that began at an AI assistant (ubLand 'ai'), on the English homepage or
  // the English checker, reads a first line about the other hotels on the visitor's list; the body says "each hotel page"
  // so that line reads on. A translated page, Safari on a Mac, the /get note and every other visit keep the lines above.
  // Nothing new is stored or sent; installs from these visits are counted as before (site_install_land:ai).
  if (ubLand === 'ai' && ubEnglishPage && (UB_CHECKER.test(location.pathname) || location.pathname === '/' || location.pathname === '/index.html')) {
    COPY.home = '<strong class="text-ink">Checking the other hotels on your list?</strong> The free Underbook extension for Chrome, Edge or Firefox runs this check by itself on each hotel page you open there. On your computer, open {get}.';
    COPY.result = '<strong class="text-ink">Checking the other hotels on your list?</strong> On a computer, the free Underbook extension for Chrome, Edge or Firefox runs this check by itself on each hotel page you open with your dates. There, open {get}.';
  }
  const ICON = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';
  let started = false, done = false;
  const sent = () => { if (!done) { done = true; ubSiteEvent('phone_link_done'); } };
  ubPhoneEls.forEach((el, i) => {
    const place = el.getAttribute('data-ub-phone');
    // Safari on a Mac with the Mac version live: the card is the App Store line only (the copy-link line said Underbook
    // does not run in Safari).
    if (ubAppStore === 'mac') {
      el.innerHTML = appLine(place);
      el.setAttribute('data-ub-ready', '1');
      el.querySelectorAll('[data-ub-appstore]').forEach((a) => a.addEventListener('click', ubInstallClick));
      return;
    }
    const copy = ubMacSafari
      ? '<strong class="text-ink">Have Chrome, Edge or Firefox on this Mac too?</strong> The free Underbook extension runs this check by itself on the hotel pages you open there. It does not run in Safari. In one of those browsers, open {get}.'
      : ubAppStore === 'ios' && place === 'get' ? COPY.getIOS : COPY[place];
    if (!copy) return;
    const url = linkFor(place), id = `ub-phone-url-${i}`;
    const ios = ubAppStore === 'ios' ? appLine(place) : '';
    el.innerHTML = (ios && place !== 'get' ? `${ios}<div class="mt-4 pt-4 border-t border-stone-200">` : '')
      + (ubFxAndroid ? `<p class="text-sm text-slate-700 mb-3"><strong class="text-ink">In Firefox on this phone:</strong> Underbook runs the same check on the hotel pages you open in Firefox. <a href="${amoFor(place)}" target="_blank" rel="noopener" data-ub-amo class="ub-install font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-emerald-700">Add it from Firefox Add-ons</a></p>` : '')
      + (ubAndroidOther ? `<p class="text-sm text-slate-700 mb-3"><strong class="text-ink">On Android:</strong> Underbook runs in Firefox for Android, on the hotel pages you open in Firefox. <a href="${amoFor(place)}" target="_blank" rel="noopener" data-ub-amo class="ub-install font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-emerald-700">Get it from Firefox Add-ons</a></p>` : '')
      + `<p class="text-sm text-slate-700">${copy.replace('{get}', '<strong class="text-ink whitespace-nowrap">underbook.co/get</strong>')}</p>`
      + '<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">'
      + `<button type="button" data-ub-phone-send class="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white hover:border-ink transition">${ICON} ${ubMacSafari ? 'Copy the link' : 'Send the link to myself'}</button>`
      + '<span data-ub-phone-msg class="text-sm text-stone-500" role="status" aria-live="polite"></span></div>'
      + `<div data-ub-phone-copy class="hidden mt-2"><label for="${id}" class="block text-xs text-stone-500 mb-1">${ubMacSafari ? "Link to open in that browser" : "Link to open on your computer"}</label>`
      + `<input id="${id}" type="text" readonly class="w-full min-w-0 px-3 py-2 rounded-lg border border-stone-500 bg-stone-50 text-base" /></div>`
      + (ios && place !== 'get' ? '</div>' : '')
      + (ios && place === 'get' ? `<div class="mt-4 pt-4 border-t border-stone-200">${ios}</div>` : '');
    el.setAttribute('data-ub-ready', '1');
    const msg = el.querySelector('[data-ub-phone-msg]'), box = el.querySelector('[data-ub-phone-copy]'), field = box.querySelector('input');
    field.value = url;
    field.addEventListener('copy', sent);
    el.querySelector('[data-ub-phone-send]').addEventListener('click', async (e) => {
      if (!e.isTrusted) return;
      if (!started) { started = true; ubSiteEvent('phone_link_start'); }
      msg.textContent = ''; box.classList.add('hidden');
      if (navigator.share && !ubMacSafari) {
        try { await navigator.share({ title: 'Underbook for your computer', text: 'Open this on your computer to add the free Underbook extension to Chrome, Edge or Firefox:', url }); sent(); return; }
        catch (err) { if (err && err.name === 'AbortError') return; /* no share menu here: copy instead */ }
      }
      try {
        await navigator.clipboard.writeText(url);
        sent();
        msg.textContent = ubMacSafari ? 'Link copied. Paste it into Chrome, Edge or Firefox.' : 'Link copied. Paste it into a note or a message to yourself, then open it on your computer.';
      } catch {
        box.classList.remove('hidden');
        msg.textContent = ubMacSafari ? 'Copy this link and open it in Chrome, Edge or Firefox.' : 'Copy this link and open it on your computer.';
        try { field.focus(); field.select(); } catch { /* ignore */ }
      }
    });
    // The App Store link is a store click (site_install here, drawn after those buttons got their listener; home_install
    // on the homepage); phone_appstore_click comes from the document listener above.
    const store = el.querySelector('[data-ub-appstore]');
    if (store) store.addEventListener('click', ubInstallClick);
    const amo = el.querySelector('[data-ub-amo]');
    // A store click, counted as the store buttons are: site_install (here, since this link is drawn after those buttons
    // got their listener) and, on the homepage, home_install (its listener reads the ub-install class at click time).
    if (amo) amo.addEventListener('click', ubInstallClick);
  });
  // The "get" note: only on a visit that came from /get. The result card then stays put for this page view (one card).
  // Counted as phone_get_view (once per page load): a phone or tablet arrived here from /get, the one count of how many
  // phone visitors the short link sends (/get itself sends nothing on its way to the checker).
  const getEl = ubPhoneEls.find((el) => el.getAttribute('data-ub-phone') === 'get');
  if (getEl && fromGet) {
    getEl.classList.remove('hidden');
    ubSiteEvent('phone_get_view');
    ubPhoneEls.filter((el) => el.getAttribute('data-ub-phone') === 'result').forEach((el) => el.setAttribute('data-ub-skip', '1'));
  }
}

const intakeForm = document.getElementById('ub-intake-form');
if (intakeForm) {
  intakeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = intakeForm.email.value.trim().toLowerCase();
    const booking = (intakeForm.booking.value || '').trim();
    const msgEl = document.getElementById('ub-intake-msg');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { if (msgEl) msgEl.textContent = 'Please enter a valid email.'; return; }
    if (booking.length < 6) { if (msgEl) msgEl.textContent = 'Add your hotel + dates so we can watch the price.'; return; }
    intakeForm.classList.add('form-loading');
    try {
      await fsAdd('pricewatch_requests', { email, booking: booking.slice(0, 1999), source: SOURCE, offer: OFFER });
      intakeForm.classList.remove('form-loading');
      if (msgEl) msgEl.innerHTML = "✅ Got it. We'll manually watch this booking and email you if the price drops.";
      intakeForm.reset();
    } catch (err) {
      console.error('[underbook] intake error', err);
      intakeForm.classList.remove('form-loading');
      if (msgEl) msgEl.textContent = 'Something went wrong. Try again.';
    }
  });
}

// ---- honest counter: NO fabricated number (was base 1247 + random). ----
// Reads are disabled on the waitlist for privacy, so we don't display a live count.
// The element is left with truthful static copy in the HTML.
