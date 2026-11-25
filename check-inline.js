// check-inline.js: the web price checker's check, run in the "check your hotel" box of the guide and answer pages.
// WRITTEN BY scripts/answer_check_20261026.py from landing/public/hotel-price-checker.html and app.js: edit those (or the
// adapter in that script), never this file; `python3 scripts/answer_check_20261026.py --check` fails while they differ.
// docs/ANSWER_CHECK_2026-10-26.md, experiment X33 (docs/EXPERIMENTS.md).
(function () {
  var box = document.getElementById('ub-page-check');
  if (!box || window.UBAnswerCheck) return;
  var root = box.parentNode;
  // ---- the box's side (scripts/answer_check_20261026.py, PRELUDE) ----
  // The checker's element ids, mapped to the box's; the parts the box leaves out are detached spare elements.
  var IDS = { hotel: 'ub-page-hotel', checkIn: 'ub-page-in', checkOut: 'ub-page-out', adults: 'ub-page-adults', checkBtn: 'ub-page-btn', stayMsg: 'ub-page-msg', resultStatus: 'ub-page-said', result: 'ub-page-result', verdict: 'ub-page-verdict', installCta: 'ub-page-offer', installLead: 'ub-page-offer-lead', phoneLink: 'ub-page-phone', sites: 'ub-page-sites', receipt: 'ub-page-receipt', allInNote: 'ub-page-allin' };
  var spare = {};
  var $ = function (id) {
    if (Object.prototype.hasOwnProperty.call(IDS, id)) return document.getElementById(IDS[id]);
    if (/^ub-/.test(id)) { var el = document.getElementById(id); return el && root.contains(el) ? el : null; }
    return spare[id] || (spare[id] = document.createElement(id === 'currency' ? 'input' : /^none(Booking|Expedia)$/.test(id) ? 'a' : 'div'));
  };
  // A plain visit to a guide page: no shared link, no hotel page, no holiday-page form (X48), no welcome page, no stay in
  // the address.
  var fromWelcome = false, fromHotel = false, fromHoliday = false, fromHomePhone = '', fromShare = false, viaExt = false, sharedIn = false, linkDates = false;
  var arrivalName = '', arrivalCity = '', arrivalPt = '', sampleIn = '', sampleOut = '', datesLabel = '';
  // No page events from the box: the checker's events are the checker's experiments' (X5, X7, X17, X20, X22, X29).
  var wev = function () {};
  // No price-drop box and no share row here: the full checker, linked under the answer, has both.
  var watchReset = function () {}, sharePush = function () {};
  // The page's address stays the guide's.
  var history = { replaceState: function () {} };
  // The checker's request, marked as this box's: src=answer, and ai=1 when an AI assistant's answer opened this page.
  var aiSent = false, isAuto = false;
  var fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf(API + '/compare?') === 0) u += '&src=answer' + (aiSent ? '&ai=1' : '');
    return window.fetch(u, opts);
  };
  // ---- lifted verbatim from landing/public/hotel-price-checker.html (whole-line comments dropped) ----
    var L10N = window.UBI18N && UBI18N.lang !== 'en' ? UBI18N : null;
    var T = window.UBI18N ? UBI18N.t : function (s, v) { return String(s).replace(/\{([A-Za-z_]+)\}/g, function (m, k) { return v && k in v ? String(v[k]) : m; }); };
    var CJK = !!(L10N && /^(ja|zh)/.test(L10N.lang)), SEP = CJK ? '' : ' ', END = CJK ? '。' : '.';
    var API = 'https://underbook-backend.underbook.workers.dev';
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
    var CUR = { us: 'USD', gb: 'GBP', de: 'EUR', fr: 'EUR', it: 'EUR', es: 'EUR', pt: 'EUR', nl: 'EUR', br: 'BRL', in: 'INR', ua: 'UAH', ca: 'CAD', au: 'AUD', jp: 'JPY', mx: 'MXN', pl: 'PLN', tr: 'TRY', ae: 'AED', sg: 'SGD', th: 'THB',
      il: 'ILS', cz: 'CZK', hu: 'HUF', ro: 'RON', dk: 'DKK', no: 'NOK', se: 'SEK', ch: 'CHF', my: 'MYR', kr: 'KRW', id: 'IDR', vn: 'VND', tw: 'TWD', hk: 'HKD', sa: 'SAR',
      ma: 'MAD', qa: 'QAR', nz: 'NZD', za: 'ZAR', ph: 'PHP', co: 'COP', cl: 'CLP' };
    var LANG_MARKET = { de: 'de', fr: 'fr', it: 'it', es: 'es', nl: 'nl', pl: 'pl', pt: 'pt', ja: 'jp', tr: 'tr', th: 'th', uk: 'ua', hi: 'in',
      he: 'il', cs: 'cz', hu: 'hu', ro: 'ro', da: 'dk', nb: 'no', no: 'no', nn: 'no', sv: 'se', ms: 'my', ko: 'kr', id: 'id', vi: 'vn', fil: 'ph' };
    var EURO_REGION = /^(at|be|ch|li|lu|ie|fi|gr|sk|si|ee|lv|lt|mt|cy|hr)$/;
    var gl = (function () {
      var langs = [], away = {};
      try { langs = (navigator.languages && navigator.languages.length ? Array.prototype.slice.call(navigator.languages) : [navigator.language]); } catch (e) { langs = [navigator.language]; }
      for (var i = 0; i < langs.length; i++) {
        var m = String(langs[i] || '').trim().match(/^([A-Za-z]{2,3})(?:[-_][A-Za-z]{4})?(?:[-_]([A-Za-z]{2}|\d{3}))?(?:[-_]|$)/);
        if (!m) continue;
        var lang = m[1].toLowerCase(), region = (m[2] || '').toLowerCase();
        if (region && CUR[region]) return region;
        var mk = LANG_MARKET[lang];
        if (mk && (!region ? !away[lang] : (EURO_REGION.test(region) && CUR[mk] === 'EUR'))) return mk;
        if (region && !EURO_REGION.test(region)) away[lang] = 1;
      }
      return 'us';
    })();
    var list = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'MXN', 'BRL', 'PLN', 'TRY', 'AED', 'SGD', 'THB', 'UAH',
      'ILS', 'CZK', 'HUF', 'RON', 'DKK', 'NOK', 'SEK', 'CHF', 'MYR', 'KRW', 'IDR', 'VND', 'TWD', 'HKD', 'SAR', 'MAD', 'QAR', 'NZD', 'ZAR', 'PHP', 'COP', 'CLP'];
    var fmt = function (n, cur) { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); } catch (e) { return cur + ' ' + Math.round(n); } };
    var SHARED_MARK = /^(?:\$|¥|￥)$/;
    var fmtNamed = function (n, cur) {
      var mark = '';
      try {
        var parts = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).formatToParts(n);
        for (var i = 0; i < parts.length; i++) if (parts[i].type === 'currency') mark = parts[i].value;
      } catch (e) { mark = ''; }
      return fmt(n, cur) + (SHARED_MARK.test(mark) ? ' ' + cur : '');
    };
    var ymd = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    var today = new Date(), d1 = new Date(); d1.setDate(d1.getDate() + 21); var d2 = new Date(d1); d2.setDate(d2.getDate() + 2);
    var q = new URLSearchParams(location.search);
    var parseYmd = function (s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
    var nightsOf = function (a, b) { var x = parseYmd(a), y = parseYmd(b); return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 864e5); };
    var dayFmt = function (s) {
      var d = parseYmd(s);
      var dl = /^en(-|$)/i.test(navigator.language || 'en-US') ? (navigator.language || 'en-US') : 'en-GB';
      try { return new Intl.DateTimeFormat(dl, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' }).format(d); } catch (e) { return s; }
    };
    var dayShow = function (s) {
      if (!L10N) return dayFmt(s);
      var d = parseYmd(s);
      try { return L10N.date(d, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' }); } catch (e) { return s; }
    };
    var stayText = function (st) {
      var n = nightsOf(st.checkIn, st.checkOut);
      if (!L10N) return dayFmt(st.checkIn) + ' to ' + dayFmt(st.checkOut) + ' · ' + n + '\u00a0night' + (n === 1 ? '' : 's');
      return L10N.range(dayShow(st.checkIn), dayShow(st.checkOut)) + ' · ' + (n === 1 ? T('{n}\u00a0night', { n: n }) : T('{n}\u00a0nights', { n: n }));
    };
    var refCat = (function () {
      var h = ''; try { h = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : ''; } catch (x) { h = ''; }
      if (!h) return 'direct';
      if (/(^|\.)underbook\.co$/.test(h)) return 'ours';
      if (/(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|baidu|brave|startpage|qwant|naver)\./.test(h)) return 'search';
      if (/(^|\.)(facebook|instagram|twitter|x|t|reddit|linkedin|pinterest|tiktok|youtube|threads|bsky)\./.test(h) || /(^|\.)t\.co$/.test(h)) return 'social';
      return 'other';
    })();
    var LANDS = ['outreach', 'ai', 'youtube', 'store', 'search', 'direct', 'other'];
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
    function landNow() {
      var v = '';
      try { v = sessionStorage.getItem('ub_ls') || ''; } catch (x) { v = ''; }
      return LANDS.indexOf(v) >= 0 ? v : (ubLandOf(location.search, document.referrer, location.hostname) || 'other');
    }
    var handheld = (function () {
      try {
        if (navigator.userAgentData && navigator.userAgentData.mobile) return true;
        if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')) return true;
        return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
      } catch (x) { return false; }
    })();
    var ic = $('installCta');
    var pl = $('phoneLink');
    function phoneShown(top) {
      if (!pl) return;
      var up = !!top && !!pl.querySelector('[data-ub-appstore]'), at = up ? $('verdict') : $('bookedJump');
      if (at && at.parentNode && pl.previousElementSibling !== at) at.parentNode.insertBefore(pl, at.nextSibling);
      if (pl.getAttribute('data-ub-ready') === '1' && !pl.hasAttribute('data-ub-skip')) pl.classList.remove('hidden');
    }
    var ROW_OPEN = handheld ? 'ub-row-open inline-block mt-1 text-sm font-semibold px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:border-ink'
      : 'inline-block mt-1 text-xs font-semibold px-2.5 py-1 rounded-md border border-stone-300 hover:border-ink';
    function rowOpen(link, source, all, cur) {
      return link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener sponsored" data-site="' + esc(source) + '" aria-label="' + T('Open {site}, {price} a night', { site: esc(source), price: fmt(all, cur) }) + '" class="' + ROW_OPEN + '">' + T('Open') + '</a>' : '';
    }
    var installSent = false, installShown = false, installClicked = false;
    function offerShown() {
      if (!ic || fromWelcome || installShown || isAuto || !ic.getClientRects().length) return;
      installShown = true; wev('web_install_shown');
    }
    function offerHide() {
      if (!ic) return;
      var had = ic.contains(document.activeElement);
      var box = ic, cands = ['shareBtn', 'bookedJumpBtn', 'ub-open'].map($).filter(function (el) { return el && el.getClientRects().length; });
      var after = cands.filter(function (el) { return box.compareDocumentPosition(el) & 4; }); // Node.DOCUMENT_POSITION_FOLLOWING
      ic.parentNode.removeChild(ic); ic = null;
      if (!had) return;
      var next = after[0] || cands[0];
      if (next) { try { next.focus({ preventScroll: true }); } catch (x) { next.focus(); } }
    }
    var BROWSER = (function () {
      try {
        var ua = navigator.userAgent || '', br = (navigator.userAgentData && navigator.userAgentData.brands) || [];
        if (br.some(function (x) { return /Microsoft Edge/i.test(x.brand); }) || /\bEdg\//.test(ua)) return 'Edge';
        if (/\bFirefox\//.test(ua) && !/\bSeamonkey\//i.test(ua)) return 'Firefox';
      } catch (x) { /* Chrome */ }
      return 'Chrome';
    })();
    function leadPlain() {
      return '<strong class="block text-base text-ink">' + (offerReset.n >= 2 ? T('You have run {n} checks in this visit.', { n: offerReset.n }) : !L10N && landNow() === 'ai' && /^\/hotel-price-checker(\.html)?\/?$/.test(location.pathname) ? 'Checking the other hotels on your list?' : T('Check hotel prices on the hotel page itself.')) + '</strong> ' +
        T('The free Underbook extension for {browser} runs this check by itself when you open a hotel with your dates on Booking.com, Expedia, Hotels.com, Agoda or the hotel&#39;s own site.', { browser: BROWSER });
    }
    var EXT_SITE = /^(booking\.com|expedia(\.com)?|hotels\.com|agoda(\.com)?)$/i;
    var afterGo = false;
    function offerTone(on) {
      if (!ic) return;
      ['border-stone-200', 'bg-stone-50'].forEach(function (c) { ic.classList.toggle(c, !on); });
      ['border-accent', 'bg-emerald-50/40'].forEach(function (c) { ic.classList.toggle(c, on); });
    }
    function offerReset() {
      afterGo = false;
      offerReset.n = Math.min(999, (offerReset.n || 0) + 1);
      if (!ic || fromWelcome || !$('installLead')) return;
      $('installLead').innerHTML = leadPlain();
      offerTone(false);
    }
    function offerAfterGo(site) {
      if (!ic || fromWelcome || !$('installLead') || !site) return;
      afterGo = true;
      var named = EXT_SITE.test(site);
      var sv = { site: esc(site) };
      $('installLead').innerHTML = '<span class="block text-xs text-stone-500">' + T('Opened {site} in a new tab.', sv) + '</span>' +
        '<strong class="block text-base text-ink">' + (named ? T('Next time, get this check on the {site} page itself.', sv) : T('Next time, get this check on the hotel page itself.')) + '</strong> ' + (named
          ? T('When you open a hotel on {site} with your dates, the free Underbook extension runs it on that page by itself.', sv)
          : T('When you open a hotel with your dates on Booking.com, Expedia, Hotels.com, Agoda or the hotel&#39;s own site, the free Underbook extension runs it on that page by itself.'));
      offerTone(true);
    }
    var goClick = function (e) {
      if (e.isTrusted === false || (e.type === 'auxclick' && e.button !== 1) || !e.target.closest) return;
      var a = e.target.closest('a[data-site]');
      if (a) offerAfterGo(a.getAttribute('data-site'));
    };
    var stay = null;
    function goHref(link, source) {
      if (!link) return '';
      var tag = '&ch=web' + (fromShare ? '&src=share' + (viaExt ? '&via=ext' : '') : fromHotel ? '&src=hotel' : '');
      if (link.indexOf(API + '/go?') === 0) return link + tag;
      return API + '/go?u=' + encodeURIComponent(link) + '&s=' + encodeURIComponent(source || '') + tag;
    }
    var TRUST_PAGE = /^is-[a-z0-9]+(?:-[a-z0-9]+)*-legit$/;
    function trustNote(a, source) {
      var all = a && a.siteNotes;
      var n = all && typeof all === 'object' && source && Object.prototype.hasOwnProperty.call(all, source) ? all[source] : null;
      if (!n || typeof n !== 'object') return null;
      var page = typeof n.legit === 'string' && TRUST_PAGE.test(n.legit) && typeof n.name === 'string' && n.name.trim() ? n.legit : '';
      var signIn = n.signIn === true;
      return page || signIn ? { page: page, name: page ? n.name.trim().slice(0, 40) : '', signIn: signIn } : null;
    }
    function trustLine(a, c, verdict) {
      if (verdict !== 'UNVERIFIED_LOWER' && verdict !== 'REAL_LOWER_MATCHED') return '';
      var t = trustNote(a, c && c.source);
      if (!t) return '';
      return '<p id="ub-trust" class="text-sm text-slate-600 mt-3">' + (t.signIn ? T('This site may ask you to sign in to see this price.') : '') + (t.signIn && t.page ? ' ' : '') +
        (t.page ? '<a id="ub-legit" href="' + esc('/' + t.page) + '" target="_blank" rel="noopener" class="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-emerald-700">' + T('Is {site} legit?', { site: esc(t.name) }) + '</a>' : '') + '</p>';
    }
    var legitSent = false;
    function noneHide() { $('noneNext').classList.add('hidden'); }
    function noneShow(st) {
      var qs = function (o) { return Object.keys(o).map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&'); };
      var stayWords = st.hotel + ', ' + stayText(st);
      var bk = 'https://www.booking.com/searchresults.html?' + qs({ ss: st.hotel, checkin: st.checkIn, checkout: st.checkOut, group_adults: st.adults, no_rooms: 1, group_children: 0 });
      var ex = 'https://www.expedia.com/Hotel-Search?' + qs({ destination: st.hotel, startDate: st.checkIn, endDate: st.checkOut, adults: st.adults, rooms: 1 });
      [['noneBooking', bk, 'Booking.com'], ['noneExpedia', ex, 'Expedia']].forEach(function (x) {
        var a = $(x[0]);
        a.href = goHref(x[1], x[2]) + '&res=none';
        a.setAttribute('aria-label', T('Search {site} for {stay}', { site: x[2], stay: stayWords }));
      });
      var box = $('noneNext');
      box.classList.remove('hidden');
      if (!isAuto) wev('web_none_next_shown');
      try { box.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' }); } catch (x) { /* ignore */ }
    }
    function sitesDedup(sources) {
      var seen = {}, out = [];
      var ad = function (u) { return /^https:\/\/www\.google\.[a-z.]+\/(?:pagead\/)?aclk\?/.test(String(u || '')); };
      var free = function (u) { return /^https:\/\/www\.google\.[a-z.]+\/travel\/(?:[a-z]+\/)*clk\?/.test(String(u || '')); };
      (sources || []).forEach(function (s) {
        if (!s || !s.source) return; var k = s.source.toLowerCase();
        if (seen.hasOwnProperty(k)) {
          var o = out[seen[k]];
          if (k === 'booking.com' && !o.adLink && ad(o.link) && free(s.link) && o.allIn === s.allIn && o.nightly === s.nightly && !o.country === !s.country) {
            var c2 = {}; for (var f in o) if (o.hasOwnProperty(f)) c2[f] = o[f];
            c2.link = s.link; c2.adLink = o.link; out[seen[k]] = c2;
          }
          return;
        }
        seen[k] = out.length; out.push(s);
      });
      return out;
    }
    function countryName(cc) {
      if (L10N) return L10N.countryName(cc);
      try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc) || cc; } catch (e) { return cc; }
    }
    function countryPhrase(cc) {
      var c = String(cc || '').toUpperCase();
      return (/^(US|GB|NL|AE|PH|BS|GM|DO|CF|KM|MV|MH|SB)$/.test(c) ? 'the ' : '') + countryName(c);
    }
    function otherRows(a, srcs) {
      var have = {};
      (srcs || []).forEach(function (s) { have[s.source.toLowerCase()] = 1; });
      return sitesDedup(a.otherCountry || []).filter(function (s) { return s.country && !have[s.source.toLowerCase()]; });
    }
    function otherNote(s) {
      return '<p class="text-xs text-amber-800">' + T('Another country&#39;s site: priced for travelers in {country}. Yours may differ.', { country: esc(countryName(s.country)), in_country: L10N ? esc(L10N.inCountry(s.country)) : '' }) + '</p>';
    }
    function byShown(x, y) {
      var price = function (s) { return s.allIn != null ? s.allIn : s.nightly; };
      var ax = x.allIn == null, ay = y.allIn == null; if (ax !== ay) return ax - ay; var px = price(x), py = price(y); return (px == null) - (py == null) || (px == null ? 0 : px - py);
    }
    function stayHead(sample) {
      return '<p class="text-sm text-stone-500">' + esc(stay.hotel) + ' · ' + (stay.adults > 1 ? T('{n} adults', { n: stay.adults }) : T('{n} adult', { n: stay.adults })) + '</p>' +
        '<p class="text-sm mt-0.5 mb-2 leading-7"><span id="ub-stay" class="' + (sample ? 'text-amber-800' : 'text-stone-700') + '">' +
        (sample ? '<strong>' + datesLabel + '</strong> ' : '') + esc(stayText(stay)) + '</span> ' +
        '<button id="ub-dates" type="button" class="inline-block ml-1 text-sm font-semibold text-ink px-2.5 py-0.5 rounded-lg border border-stone-300 bg-white hover:border-ink">' + (sample ? T('Enter your dates') : T('Change dates')) + '</button>' +
        (sample ? '' : '<button id="ub-another" type="button" class="inline-block ml-1 mt-1 text-sm font-semibold text-ink px-2.5 py-0.5 rounded-lg border border-stone-300 bg-white hover:border-ink">' + T('Check another hotel') + '</button>') + '</p>';
    }
    function listPlace(other) {
      var el = $('sites'), v = $('verdict'), rc = $('receipt');
      if (!el || !v || !rc) return;
      var box = el.parentNode && el.parentNode.tagName === 'DETAILS' ? el.parentNode : el;
      if (other) v.parentNode.insertBefore(box, v.nextSibling);
      else rc.parentNode.insertBefore(box, rc);
      if (box.tagName !== 'DETAILS') return;
      if (other && !box.open) { box.open = true; box.setAttribute('data-ub-opened', '1'); }
      else if (!other && box.getAttribute('data-ub-opened')) { box.open = false; box.removeAttribute('data-ub-opened'); }
    }
    function render(a, cur) {
      listPlace(false);
      var c = a.cheapest || {}, rm = a.roomMatch || {}, srcs = sitesDedup((a.sources || []).concat(a.more || []));
      var nSites = a.sourceCount || srcs.length;
      var base = a.consensusAllIn != null ? a.consensusAllIn : a.consensus;
      var price = function (s) { return s.allIn != null ? s.allIn : s.nightly; };
      srcs.sort(byShown);
      var shown = srcs.concat(otherRows(a, srcs)).sort(byShown);
      var withAll = srcs.filter(function (s) { return s.allIn != null; });
      var low = withAll[0] || null, lowPrice = low ? low.allIn : null;
      var repick = !!(low && low.source !== c.source && c.allIn != null && lowPrice < c.allIn && a.verdict !== 'REAL_LOWER_MATCHED');
      var verdict = a.verdict;
      var proof = verdict === 'REAL_LOWER_MATCHED' && rm.proof && rm.proof.source ? rm.proof : null;
      var lowest = a.cheapest || {};
      var proofElsewhere = !!(proof && !(proof.source === lowest.source && proof.nightly === lowest.nightly));
      if (proofElsewhere) {
        var pRow = srcs.filter(function (s) { return s.source === proof.source; })[0] || {};
        c = { source: proof.source, nightly: proof.nightly, allIn: proof.allIn, link: proof.link || pRow.link, freeCancellation: proof.freeCancellation, rooms: [proof.room] };
        if (proof.memberPrice) c.memberPrice = proof.memberPrice;
      }
      if (repick) {
        verdict = a.verdict !== 'PARITY' || (base != null && lowPrice < base * 0.95) ? 'UNVERIFIED_LOWER' : 'PARITY';
        c = low;
      }
      var cheapAll = price(c);
      var save = base != null && cheapAll != null && cheapAll < base ? base - cheapAll : null;
      var roomHere = repick ? (c.rooms && c.rooms[0]) || '' : (rm.cheapRoom && a.cheapestRoom && a.cheapestRoom.source === c.source ? rm.cheapRoom : '');
      var q2 = function (s) { var x = String(s || '').trim(), v = esc(x.length > 60 ? x.slice(0, 57) + '...' : x); return L10N ? L10N.quote(v) : '&#39;' + v + '&#39;'; };
      var evidence = '';
      if (rm.relation !== undefined) {
        if (verdict === 'REAL_LOWER_MATCHED' && proof) {
          evidence = T('Same room name: {room} on {site} and {goingRoom} on {goingSite}.', { room: q2(proof.room), site: esc(proof.source), goingRoom: q2(proof.goingRoom), goingSite: esc(proof.goingSource) });
        } else if (verdict === 'UNVERIFIED_LOWER') {
          if (!(c.rooms && c.rooms.length) && !roomHere) evidence = T('{site} doesn&#39;t name the room. Check it before you book.', { site: esc(c.source) });
          else if (!repick && roomHere && (rm.relation === 'nogoing' || !rm.goingRoom)) evidence = T('{site} lists {room}; no site at the going rate names its room.', { site: esc(c.source), room: q2(roomHere) });
          else if (!repick && roomHere) evidence = T('{site} lists {room}; the going rate is for {goingRoom}.', { site: esc(c.source), room: q2(roomHere), goingRoom: q2(rm.goingRoom) }) + SEP +
            (rm.relation === 'different' ? T('Different room.') : rm.relation === 'similar' ? T('Similar, but not proof.') : T('Not clear it is the same room.'));
        }
      }
      var lowestLine = proofElsewhere && lowest.source
        ? '<p class="text-sm text-slate-600 mt-2">' + T('Lowest: {price} a night on {site} ({room}).', { price: fmt(price(lowest), cur), site: esc(lowest.source),
          room: lowest.rooms && lowest.rooms.length ? T('room not confirmed: {room}', { room: q2(lowest.rooms[0]) }) : T('no room named') }) + '</p>' : '';
      var h = '', sub = '';
      var sameAs = (proof && proof.goingSource) || rm.goingSource || '';
      var hv = { same: esc(sameAs), site: esc(c.source), amount: save ? fmt(save, cur) : '' };
      if (verdict === 'REAL_LOWER_MATCHED') {
        h = sameAs
          ? (save ? T('Same room name as on {same}, cheaper on {site}: about {amount} a night less', hv) : T('Same room name as on {same}, cheaper on {site}', hv))
          : (save ? T('Same room name, cheaper on {site}: about {amount} a night less', hv) : T('Same room name, cheaper on {site}', hv));
        sub = evidence
          ? '<p id="ub-evidence" class="mt-2 text-sm font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg">✓ ' + evidence + '</p>' + lowestLine
          : '<span class="inline-block mt-2 text-sm font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">' + T('✓ Room name matches: {room}', { room: esc(roomHere || rm.cheapRoom) }) + '</span>';
      } else if (verdict === 'UNVERIFIED_LOWER') {
        h = save ? T('A lower price is listed on {site}, about {amount} a night less', hv) : T('A lower price is listed on {site}', hv);
        sub = evidence ? '<p id="ub-evidence" class="mt-2 text-sm font-semibold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg">' + evidence + '</p>' :
          '<span class="inline-block mt-2 text-sm font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg">' + T('Not confirmed as the same room. Check the room and cancellation terms.') + '</span>' +
          (roomHere ? '<p class="text-sm text-slate-600 mt-2">' + (rm.goingRoom
            ? T('{site}&#39;s price is for: <strong>{room}</strong>. The going rate is for: {goingRoom}.', { site: esc(c.source), room: esc(roomHere), goingRoom: esc(rm.goingRoom) })
            : T('{site}&#39;s price is for: <strong>{room}</strong>.', { site: esc(c.source), room: esc(roomHere) })) + '</p>'
            : '<p class="text-sm text-slate-600 mt-2">' + T('{site} does not say which room this price is for.', { site: esc(c.source) }) + '</p>');
      } else {
        h = save ? T('Prices are close: no site is 5% or more below the going rate.') : T('No site is cheaper than the going rate.');
        var lv = { price: fmt(cheapAll != null ? cheapAll : base, cur) };
        sub = '<p class="text-sm text-slate-600 mt-2">' + (a.feesUnverified ? T('The lowest listed price is about {price} a night.', lv) : T('The lowest listed price is about {price} a night, all in.', lv)) + '</p>';
      }
      var homeCc = gl.toUpperCase();
      var askedCc = /^[A-Za-z]{2}$/.test(a.searchedMarket || '') ? String(a.searchedMarket).toUpperCase() : '';
      var posCc = a.pointOfSale ? String(a.pointOfSale).toUpperCase() : askedCc;
      if (gl !== 'us' && posCc && posCc !== homeCc) {
        var pv = { country: esc(countryPhrase(posCc)), in_country: L10N ? esc(L10N.inCountry(posCc)) : '', cur: esc(cur),
          home: esc(countryPhrase(homeCc)), in_home: L10N ? esc(L10N.inCountry(homeCc)) : '' };
        if (askedCc && askedCc !== homeCc) { pv.asked = esc(countryPhrase(askedCc)); pv.in_asked = L10N ? esc(L10N.inCountry(askedCc)) : ''; }
        sub += '<p id="ub-pos" class="text-sm text-amber-800 mt-2">' + (pv.asked
          ? T('These are the prices the sites list for a visitor in {country}, shown in {cur}. Google Hotels, where our prices come from, gave us no prices for this hotel for a visitor in {home}, so we asked for a visitor in {asked}. A site may show you a different price.', pv)
          : T('These are the prices the sites list for a visitor in {country}, shown in {cur}. Google Hotels, where our prices come from, decides which country each search is priced for; we asked for a visitor in {home}, from your browser settings. A site may show you a different price.', pv)) + '</p>';
      }
      if (a.engine === 'makcorps') {
        sub += '<p id="ub-standby" class="text-sm text-amber-800 mt-2">' + (a.mcName
          ? T('These prices come from MakCorps, a backup price service, not from Google Hotels, for {name}. It names no rooms and has no links to book: check the hotel and the price on a booking site before you book.', { name: esc(a.mcName) })
          : T('These prices come from MakCorps, a backup price service, not from Google Hotels. It names no rooms and has no links to book: check the hotel and the price on a booking site before you book.')) + '</p>';
      }
      var awayLow = shown.filter(function (s) { return s.country && price(s) != null && cheapAll != null && price(s) < cheapAll; })[0];
      if (awayLow) {
        if (verdict === 'PARITY') h = T('No site priced for you is 5% or more below the going rate.');
        sub += '<p id="ub-away" class="text-sm text-amber-800 mt-2">' + T('{site} lists {price} a night on another country&#39;s site, priced for travelers in {country}. It may not be your price, so it is not counted here.',
          { site: esc(awayLow.source), price: fmt(price(awayLow), cur), country: esc(countryName(awayLow.country)), in_country: L10N ? esc(L10N.inCountry(awayLow.country)) : '' }) + '</p>';
      }
      var fcs = srcs.filter(function (s) { return s.freeCancellation && price(s) != null; }).sort(function (x, y) { return price(x) - price(y); });
      var fcBest = fcs[0];
      var fcAlt = null;
      if (a.fcData >= 1 && c.freeCancellation === false && cheapAll != null) {
        fcAlt = srcs.filter(function (s) {
          return s.source.toLowerCase() !== String(c.source || '').toLowerCase() && s.freeCancellation === true && price(s) != null &&
            (s.allIn != null) === (c.allIn != null) && price(s) <= cheapAll * 1.02;
        }).sort(function (x, y) { return price(x) - price(y) || (y.link ? 1 : 0) - (x.link ? 1 : 0); })[0] || null;
      }
      if (verdict !== 'PARITY' && c.freeCancellation) {
        sub += '<p class="text-sm text-emerald-800 mt-2">' + T('✓ Free cancellation is listed on {site}: you can book, check the room on your confirmation, and cancel before the deadline if it is not the one you want.', { site: esc(c.source) }) + '</p>';
      } else if (!fcAlt && fcBest && base != null && price(fcBest) <= base * 1.02) {
        sub += '<p class="text-sm text-emerald-800 mt-2">' + T('✓ Lowest price with free cancellation: {site}, {price} a night.', { site: esc(fcBest.source), price: fmt(price(fcBest), cur) }) + '</p>';
      }
      var mPrice = function (s) { var m = s && s.memberPrice; return m ? (s.allIn != null && m.allIn != null ? m.allIn : m.nightly) : null; };
      var mNote = '';
      if (mPrice(c) != null && cheapAll != null) {
        mNote = T('{site} lists {member} a night for members who sign in. The {price} above is its price without signing in.', { site: esc(c.source), member: fmt(mPrice(c), cur), price: fmt(cheapAll, cur) });
      } else if (cheapAll != null) {
        var mLow = srcs.filter(function (s) { return mPrice(s) != null && price(s) != null && mPrice(s) < cheapAll; })
          .sort(function (x, y) { return mPrice(x) - mPrice(y); })[0];
        if (mLow) mNote = T('Members-only prices are not counted: {site} lists {member} a night for members who sign in, {price} without.', { site: esc(mLow.source), member: fmt(mPrice(mLow), cur), price: fmt(price(mLow), cur) });
      }
      if (mNote) sub += '<p id="ub-member" class="text-sm text-slate-600 mt-2">' + mNote + '</p>';
      var fcBlock = '';
      if (fcAlt) {
        var fp = price(fcAlt), fAll = c.allIn != null && !a.feesUnverified;
        var fv = { site: esc(c.source), alt: esc(fcAlt.source), price: fmt(cheapAll, cur), altPrice: fmt(fp, cur),
          room: fcAlt.rooms && fcAlt.rooms.length ? T('room not confirmed: {room}', { room: q2(fcAlt.rooms[0]) }) : T('no room named') };
        var fLink = goHref(fcAlt.link, fcAlt.source);
        fcBlock = '<div id="ub-fc" class="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3">' +
          '<p class="font-bold text-emerald-800">' + (fmt(fp, cur) === fmt(cheapAll, cur) ? T('✓ Free cancellation for the same price on {alt}', fv) : fp < cheapAll ? T('✓ Free cancellation for less on {alt}', fv) : T('✓ Free cancellation for about the same price on {alt}', fv)) + '</p>' +
          '<p class="text-sm text-slate-700 mt-1">' + (fAll
            ? T('The {site} price above, {price} a night, all in, has no free-cancellation label on Google Hotels. {alt} lists free cancellation at {altPrice} a night, all in ({room}). Check the room and the cancellation terms on {alt} before you book.', fv)
            : T('The {site} price above, {price} a night, has no free-cancellation label on Google Hotels. {alt} lists free cancellation at {altPrice} a night ({room}). Check the room and the cancellation terms on {alt} before you book.', fv)) + '</p>' +
          (fLink ? '<a id="ub-fc-open" href="' + esc(fLink) + '" target="_blank" rel="noopener sponsored" data-site="' + esc(fcAlt.source) + '" class="block text-center mt-3 bg-white text-ink font-bold px-5 py-3 rounded-xl text-base border border-stone-300 hover:border-ink transition">' +
            T('Open {alt} at {altPrice}&nbsp;a&nbsp;night', fv) + '</a>' : '') +
          '</div>';
      }
      var cRow = srcs.filter(function (s) { return s.source === c.source; })[0] || {};
      var cLink = goHref(cRow.adLink && c.link === cRow.adLink ? cRow.link : (c.link || cRow.link), c.source);
      var ov = { site: esc(c.source), price: fmt(cheapAll, cur) };
      var openBtn = cLink && cheapAll != null ? '<a id="ub-open" href="' + esc(cLink) + '" target="_blank" rel="noopener sponsored" data-site="' + esc(c.source) + '" class="block text-center mt-4 bg-accent text-ink font-bold px-5 py-3.5 rounded-xl text-base hover:brightness-95 transition">' +
        T('Open {site} at {price} a night', ov) + '</a>' +
        '<p class="text-xs text-stone-500 mt-1.5 text-center">' + (verdict === 'PARITY' ? T('The lowest listed price. Check the room and the final total on {site} before you book.', ov) : T('Check the room and the final total on {site} before you book.', ov)) + '</p>' : '';
      var tieBlock = '';
      if (openBtn && (!window.UBI18N || UBI18N.lang === 'en') && String(c.source || '').toLowerCase() !== 'booking.com' && !(fcAlt && String(fcAlt.source || '').toLowerCase() === 'booking.com')) {
        var bkRow = srcs.filter(function (s) { return !s.country && String(s.source || '').toLowerCase() === 'booking.com'; })[0];
        var adLk = function (u) { return /^https:\/\/www\.google\.[a-z.]+\/(?:pagead\/)?aclk\?/.test(String(u || '')); };
        var bkP = bkRow ? price(bkRow) : null;
        var bkTie = bkP != null && fmt(bkP, cur) === fmt(cheapAll, cur);
        var bkNear = bkP != null && !bkTie && bkP > cheapAll && bkP <= cheapAll * 1.05;
        if (bkRow && bkRow.link && !adLk(bkRow.link) && (bkRow.allIn == null) === (c.allIn == null) && (bkTie || bkNear)) {
          var bkLink = goHref(bkRow.link, bkRow.source);
          var allTxt = c.allIn != null && !a.feesUnverified ? ', all in' : '';
          if (bkLink) tieBlock = (bkTie
              ? '<p id="ub-tie-note" class="text-sm text-slate-600 mt-3 text-center">Booking.com lists the same price, ' + fmt(cheapAll, cur) + ' a night' + allTxt + '.</p>'
              : '<p id="ub-tie-note" data-near="1" class="text-sm text-slate-600 mt-3 text-center">Booking.com lists ' + fmt(bkP, cur) + ' a night' + allTxt + ', ' + fmt(Math.round(bkP) - Math.round(cheapAll), cur) + ' more than ' + esc(c.source) + '.</p>') +
            '<a id="ub-tie-open" href="' + esc(bkLink) + '" target="_blank" rel="noopener sponsored" data-site="Booking.com" class="block text-center mt-2 bg-white text-ink font-bold px-5 py-3 rounded-xl text-base border border-stone-300 hover:border-ink transition">Open Booking.com at ' + fmt(bkTie ? cheapAll : bkP, cur) + '&nbsp;a&nbsp;night</a>';
        }
      }
      var sample = linkDates && stay.checkIn === sampleIn && stay.checkOut === sampleOut;
      legitSent = false; // X22: one legit_click per result
      $('verdict').innerHTML = stayHead(sample) +
        '<h2 class="text-xl font-extrabold leading-snug">' + h + '</h2>' + sub +
        (base != null ? '<p class="text-sm text-slate-600 mt-3">' + (a.feesUnverified
          ? T('Going rate: <strong>{price}</strong> a night (listed rate; resort or property fees may be missing).', { price: fmt(base, cur) })
          : T('Going rate: <strong>{price}</strong> a night all in.', { price: fmt(base, cur) })) + '</p>' : '') +
        trustLine(a, c, verdict) + openBtn + tieBlock + fcBlock;
      if (fcBlock && !isAuto) wev('web_flex_shown');
      var fcOpen = $('ub-fc-open'), fcClicked = false;
      if (fcOpen) fcOpen.addEventListener('click', function (e) {
        if (fcClicked || e.isTrusted === false || isAuto) return;
        fcClicked = true; wev('web_flex_click');
      });
      var lowTag = cheapAll != null && cheapAll === lowPrice ? c.source : (low && low.source);
      var rows = shown.map(function (s) {
        var all = price(s);
        var isCheap = !s.country && s.source === c.source;
        var sameRoom = verdict === 'REAL_LOWER_MATCHED' && isCheap;
        var room = sameRoom && proof ? proof.room : (s.rooms && s.rooms.length ? s.rooms[0] : '');
        var link = goHref(s.link, s.source);
        return '<li class="flex items-start justify-between gap-3 py-3 border-t border-stone-100' + (isCheap ? ' bg-emerald-50/40 -mx-2 px-2 rounded-lg' : '') + '">' +
          '<div class="min-w-0"><p class="font-semibold">' + esc(s.source) + (!s.country && s.source === lowTag ? ' <span class="text-xs font-semibold text-emerald-700">' + T('lowest') + '</span>' : '') + '</p>' +
          '<p class="text-xs text-stone-500 break-words">' + (room ? esc(room) + (sameRoom ? ' · ' + (sameAs ? T('same room name as on {site}', { site: esc(sameAs) }) : T('same room name')) : '') : T('No room named')) + (s.freeCancellation ? ' · ' + T('free cancellation') : '') + '</p>' + (s.country ? otherNote(s) : '') +
          (mPrice(s) != null ? '<p class="text-xs text-stone-600">' + T('Members who sign in: {price}. The price shown is without signing in.', { price: fmt(mPrice(s), cur) }) + '</p>' : '') + '</div>' +
          '<div class="text-right shrink-0"><p class="font-bold">' + fmt(all, cur) + '</p>' +
          rowOpen(link, s.source, all, cur) + '</div></li>';
      }).join('');
      $('sites').innerHTML = '<p class="text-sm font-semibold mb-1">' + (a.feesUnverified ? T('Listed price per night, by site (fees may be missing)') : T('All-in price per night, by site')) + '</p><ul class="list-none">' + rows + '</ul>' +
        (shown.length < nSites ? '<p class="text-xs text-stone-500 mt-2">' + moreSites(nSites - shown.length) + '</p>' : '');
      $('receipt').textContent = receiptText(nSites, cur);
      allInNote(!a.feesUnverified);
      var lowerV = verdict === 'REAL_LOWER_MATCHED' || verdict === 'UNVERIFIED_LOWER';
      shared = { url: shareUrl(stay, true), started: false, done: false, title: 'Hotel price check: ' + stay.hotel,
        text: shareText(stay, verdict, c.source, lowerV ? cheapAll : (cheapAll != null ? cheapAll : base), lowerV ? c.allIn != null && !a.feesUnverified : !a.feesUnverified, base, nSites, cur) };
      $('shareMsg').textContent = ''; $('shareCopy').classList.add('hidden'); $('shareRow').classList.remove('hidden');
      sharePush(lowerV && cheapAll != null);
      stay.resCur = cur; // the currency the prices came back in: a booked watch is priced and compared in it
      watchReset(sample, a.feesUnverified ? null : lowPrice);
      $('result').classList.remove('hidden');
      offerReset(); offerShown(); phoneShown(true);
      $('result').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
      var said = String(h).replace(/<[^>]*>/g, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
      announce(T('Result: {result}', { result: said + (/[.!?。！？]$/.test(said) ? '' : END) }) + SEP + checkedSites(nSites));
    }
    function moreSites(n) { return n === 1 ? T('{n} more site listed higher prices.', { n: n }) : T('{n} more sites listed higher prices.', { n: n }); }
    function receiptText(n, cur) {
      return n === 1 ? T('Checked {n} booking site just now, in {cur}. Prices change; the site you open shows the final total.', { n: n, cur: cur })
        : T('Checked {n} booking sites just now, in {cur}. Prices change; the site you open shows the final total.', { n: n, cur: cur });
    }
    function checkedSites(n) { return n === 1 ? T('Checked {n} booking site.', { n: n }) : T('Checked {n} booking sites.', { n: n }); }
    function allInNote(on) {
      var el = $('allInNote');
      el.textContent = on ? T('All-in = taxes and fees as each site reports them; a resort or destination fee may be extra.') : '';
      el.classList.toggle('hidden', !on);
    }
    function reduceMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (x) { return false; } }
    function announce(text) {
      var el = $('resultStatus'); el.textContent = '';
      setTimeout(function () { el.textContent = text; }, 120);
    }
    function renderOther(a, cur) {
      listPlace(true);
      var rows = sitesDedup(a.otherCountry).filter(function (s) { return s.country; }).sort(byShown);
      var nSites = a.sourceCount || rows.length;
      var where = a.pointOfSale ? countryName(a.pointOfSale) : T('another country');
      var wv = { country: esc(where), in_country: L10N ? esc(a.pointOfSale ? L10N.inCountry(a.pointOfSale) : T('in another country')) : '' };
      var sample = linkDates && stay.checkIn === sampleIn && stay.checkOut === sampleOut;
      $('verdict').innerHTML = stayHead(sample) +
        '<h2 id="ub-other" class="text-xl font-extrabold leading-snug">' + T('These prices were listed for travelers in {country}', wv) + '</h2>' +
        '<p class="text-sm text-slate-600 mt-2">' + T('Google Hotels gave us this stay&#39;s prices as they are shown in {country}, not where you are. A site can show you another price, so we do not name a cheaper site. We keep each answer for half an hour; checking again after that may find prices listed for you.', wv) + '</p>';
      $('sites').innerHTML = '<p class="text-sm font-semibold mb-1">' + (a.feesUnverified ? T('Listed price per night, by site (fees may be missing)') : T('All-in price per night, by site')) + '</p><ul class="list-none">' +
        rows.map(function (s) {
          var all = s.allIn != null ? s.allIn : s.nightly, link = goHref(s.link, s.source), room = s.rooms && s.rooms.length ? s.rooms[0] : '';
          return '<li class="flex items-start justify-between gap-3 py-3 border-t border-stone-100"><div class="min-w-0"><p class="font-semibold">' + esc(s.source) + '</p>' +
            '<p class="text-xs text-stone-500 break-words">' + (room ? esc(room) : T('No room named')) + (s.freeCancellation ? ' · ' + T('free cancellation') : '') + '</p>' + (a.pointOfSale && s.country === a.pointOfSale ? '' : otherNote(s)) + '</div>' +
            '<div class="text-right shrink-0"><p class="font-bold">' + fmt(all, cur) + '</p>' +
            rowOpen(link, s.source, all, cur) + '</div></li>';
        }).join('') + '</ul>';
      $('receipt').textContent = receiptText(nSites, cur);
      allInNote(!a.feesUnverified);
      shared = null; $('shareMsg').textContent = ''; $('shareCopy').classList.add('hidden'); $('shareRow').classList.add('hidden');
      stay.resCur = cur;
      watchReset(sample, null);
      $('result').classList.remove('hidden');
      offerReset(); offerShown(); phoneShown();
      $('result').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
      announce(T('Result: these prices were listed for travelers in {country}.', { country: where, in_country: L10N ? (a.pointOfSale ? L10N.inCountry(a.pointOfSale) : T('in another country')) : '' }) + SEP + checkedSites(nSites));
    }
    var SHARE_BASE = /(^|\.)underbook\.co$/.test(location.hostname) ? 'https://underbook.co/hotel-price-checker' : location.origin + '/hotel-price-checker';
    var shared = null;
    var linkLang = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?$/.test(q.get('lang') || '') ? q.get('lang') : '';
    function shareUrl(st, forShare) {
      var p = new URLSearchParams({ hotel: st.hotel, in: st.checkIn, out: st.checkOut, adults: String(st.adults), cur: st.currency });
      if (!forShare) { if (linkLang) p.set('lang', linkLang); return location.origin + location.pathname + '?' + p.toString(); }
      if (st.pt) p.set('pt', st.pt);
      p.set('src', 'share');
      return SHARE_BASE + '?' + p.toString();
    }
    function checkedOn() {
      var dl = /^en(-|$)/i.test(navigator.language || 'en-US') ? (navigator.language || 'en-US') : 'en-GB';
      try { return new Intl.DateTimeFormat(dl, { month: 'short', day: 'numeric' }).format(new Date()); } catch (e) { return ymd(new Date()); }
    }
    function shareText(st, verdict, site, price, allIn, base, nSites, cur) {
      var head = 'Hotel price check on ' + checkedOn() + ': ' + st.hotel + ', ' + dayFmt(st.checkIn) + ' to ' + dayFmt(st.checkOut) + ' (' + st.adults + ' adult' + (st.adults > 1 ? 's' : '') + '). ';
      var each = price != null ? fmtNamed(price, cur) + ' a night' + (allIn ? ', all in' : '') : '';
      var under = base != null && price != null && price < base ? ', under the ' + fmt(base, cur) + ' going rate' : '';
      var line = '';
      if (price != null && verdict === 'REAL_LOWER_MATCHED') line = site + ' listed ' + each + under + ', with the same room name as a site at the going rate. ';
      else if (price != null && verdict === 'UNVERIFIED_LOWER') line = site + ' listed ' + each + under + '. Not confirmed as the same room. ';
      else if (price != null) line = (under ? 'No site was 5% or more below the going rate; the lowest listed price was ' + each + under : 'No site was cheaper than the going rate; the lowest listed price was ' + each) + '. ';
      var def = allIn && price != null ? 'All-in = taxes and fees as each site reports them; a resort or destination fee may be extra. ' : '';
      return head + line + def + 'Underbook checked ' + nSites + ' booking site' + (nSites === 1 ? '' : 's') + '. The link runs the check again with today’s prices.';
    }
    async function run() {
      var hotel = $('hotel').value.trim(), checkIn = $('checkIn').value, checkOut = $('checkOut').value;
      var adults = Math.min(6, Math.max(1, parseInt($('adults').value, 10) || 2)), currency = $('currency').value;
      if (!hotel || !checkIn || !checkOut) { $('stayMsg').textContent = 'Enter a hotel and both dates.'; return; }
      if (checkOut <= checkIn) { $('stayMsg').textContent = 'Check-out must be after check-in.'; return; }
      if (fromShare && (checkIn !== sampleIn || checkOut !== sampleOut || hotel !== arrivalName)) $('sharedNote').classList.add('hidden');
      var hadFocus = document.activeElement === $('checkBtn');
      $('checkBtn').disabled = true; $('checkBtn').textContent = 'Checking every site…';
      $('stayMsg').textContent = 'This takes about 5 to 15 seconds.';
      noneHide(); // the last no-price result's next step goes with it
      $('resultStatus').textContent = ''; // the last result's line goes with it; a failed check says so in stayMsg
      stay = { hotel: hotel, checkIn: checkIn, checkOut: checkOut, adults: adults, currency: currency };
      try {
        var p = new URLSearchParams({ hotel: hotel, checkIn: checkIn, checkOut: checkOut, adults: String(adults), currency: currency, gl: gl, web: '1', rm: '2', oc: '1', nr: '1', sn: '1' });
        if (fromHotel) p.set('src', 'hotel');
        if (fromShare) p.set('src', 'share');
        if (fromHoliday) p.set('src', 'holiday');
        if (fromHomePhone) p.set('src', fromHomePhone);
        if (viaExt) p.set('via', 'ext');
        if (arrivalPt && hotel === arrivalName) p.set('pt', arrivalPt);
        stay.pt = p.get('pt') || ''; // a shared link carries it only when this check was priced with it
        p.set('ref', refCat);
        p.set('ls', landNow()); // where the visit came from, one word (landNow above)
        var r = await fetch(API + '/compare?' + p.toString());
        if (r.status === 429) {
          $('stayMsg').textContent = T('You have reached today’s limit of checks from this connection. Try again tomorrow, or add the free browser extension, which checks hotel pages as you browse.');
          return;
        }
        var a = await r.json();
        if (r.status === 403 && a && (a.automated || a.error === 'automated client')) {
          $('stayMsg').textContent = 'This browser says it is an automated client or a link preview, so we did not run a live check. Open this page in your own browser to check prices.';
          $('result').classList.add('hidden'); return;
        }
        var otherOnly = !!(a && a.none && a.reason === 'other_country' && Array.isArray(a.otherCountry) && a.otherCountry.length);
        if ((!a || a.error || a.none || a.consensus == null) && !otherOnly && arrivalCity && hotel === arrivalName &&
            hotel.toLowerCase().indexOf(arrivalCity.toLowerCase()) < 0) {
          var withCity = hotel + ', ' + arrivalCity;
          p.set('hotel', withCity);
          var r2 = await fetch(API + '/compare?' + p.toString());
          if (r2.ok) {
            var a2 = await r2.json();
            if (a2 && !a2.error && !a2.none && a2.consensus != null) { a = a2; hotel = withCity; stay.hotel = withCity; stay.pt = ''; $('hotel').value = withCity; }
          }
        }
        if (otherOnly) {
          $('stayMsg').textContent = '';
          try { history.replaceState(null, '', shareUrl(stay, false)); } catch (e) { /* ignore */ }
          renderOther(a, a.currency || currency);
          return;
        }
        if (!a || a.error || a.none || a.consensus == null) {
          if (r.status >= 500) {
            $('stayMsg').textContent = 'We could not get prices just now. Try again in a few minutes, or search this stay on a booking site below.';
            $('result').classList.add('hidden');
            noneShow(stay);
            return;
          }
          if (a && Array.isArray(a.suggestions) && a.suggestions.length) {
            var dymSugg = a.suggestions.slice(0, 3), dymPressed = false;
            $('stayMsg').innerHTML = T('We could not match that name exactly. Did you mean:') + ' ' + dymSugg.map(function (s, i) {
              return '<button type="button" data-sugg="' + i + '" class="ub-sugg inline-block mt-2 mr-2 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-ink font-semibold hover:border-ink">' + esc(s) + '</button>';
            }).join('');
            if (!isAuto) wev('dym_view');
            Array.prototype.forEach.call(document.querySelectorAll('.ub-sugg'), function (btn) {
              btn.addEventListener('click', function (e) {
                if (!dymPressed && !isAuto && e.isTrusted !== false) { dymPressed = true; wev('dym_press'); }
                $('hotel').value = dymSugg[Number(btn.getAttribute('data-sugg'))]; run();
              });
            });
          } else if (a && a.reason === 'not_found') {
            $('stayMsg').textContent = 'We couldn’t find a hotel by that name on Google Hotels, where our prices come from. If you typed a town, type the hotel’s name as your booking site shows it. Small guesthouses and holiday rentals are often not listed there.';
          } else if (a && a.reason === 'zero_rates' && adults < 3) {
            $('stayMsg').textContent = 'Google Hotels, where our prices come from, lists this hotel but shows no prices for these dates right now. Try again later.';
          } else {
            $('stayMsg').textContent = 'No booking site is publishing a price for that hotel and those dates. Try the hotel’s full name as a booking site shows it, or other dates.';
          }
          var plain = function (x) { return String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
          var typedWords = plain(hotel.split(',')[0]).split(/[^\p{L}\p{N}]+/u).filter(function (w) { return w.length >= 4; });
          var townAbout = a && Array.isArray(a.townHotels) && a.townHotels.length && ((a.suggestions && a.suggestions.length) ||
            a.townHotels.some(function (n) { var pn = plain(n); return typedWords.some(function (w) { return pn.indexOf(w) >= 0; }); }));
          if (townAbout) {
            var townTyped = hotel;
            if (!(a.suggestions && a.suggestions.length)) $('stayMsg').textContent = '';
            var townBox = document.createElement('span');
            townBox.className = 'block mt-1';
            townBox.innerHTML = T('If you typed a town or area, pick a hotel there:') + ' ' + a.townHotels.map(function (s, i) {
              return '<button type="button" data-town="' + i + '" class="ub-town inline-block mt-2 mr-2 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-ink font-semibold hover:border-ink">' + esc(s) + '</button>';
            }).join('');
            $('stayMsg').appendChild(townBox);
            Array.prototype.forEach.call(document.querySelectorAll('.ub-town'), function (btn) {
              btn.addEventListener('click', function () { $('hotel').value = a.townHotels[Number(btn.getAttribute('data-town'))] + ', ' + townTyped; run(); });
            });
          }
          $('result').classList.add('hidden');
          noneShow(stay); // X5: a next step under the no-price line (and under any "Did you mean" buttons)
          return;
        }
        $('stayMsg').textContent = '';
        try { history.replaceState(null, '', shareUrl(stay, false)); } catch (e) { /* ignore */ }
        render(a, a.currency || currency);
      } catch (err) {
        $('stayMsg').textContent = 'Something went wrong. Try again in a moment.';
      } finally {
        $('checkBtn').disabled = false; $('checkBtn').textContent = 'Check every booking site';
        if (hadFocus && (!document.activeElement || document.activeElement === document.body)) { try { $('checkBtn').focus({ preventScroll: true }); } catch (x) { /* ignore */ } }
      }
    }
    var CRAWLER_UA = /bot|crawl|spider|slurp|headless|lighthouse|phantom|puppeteer|playwright|selenium|preview|scan|monitor|python|curl|wget|httpclient|inspectiontool|\bYeti\/|\bDaum\/\d|\bDaumoa|\bia_archiver|facebookexternalhit|\bmeta-(webindexer|external)|^WhatsApp\/\d|\bEmbedly\b|\bIframely\/|\bGoogle-(InspectionTool|Read-Aloud|Site-Verification|CWS)\b|\bGoogleOther\b|\bPTST\//i;
  // ---- lifted verbatim from landing/public/app.js ----
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
      ['copilot.microsoft.com', 'copilot'], ['copilot.com', 'copilot'], ['www.copilot.com', 'copilot'], ['edgeservices.bing.com', 'copilot'],
      ['m365.cloud.microsoft', 'copilot'], ['com.microsoft.copilot', 'copilot'],
      ['gemini.google.com', 'gemini'], ['bard.google.com', 'gemini'], ['com.google.android.apps.bard', 'gemini'],
      ['you.com', 'you'], ['phind.com', 'phind'], ['www.phind.com', 'phind'], ['meta.ai', 'meta'], ['www.meta.ai', 'meta'],
      ['chat.deepseek.com', 'deepseek'], ['grok.com', 'grok'], ['chat.mistral.ai', 'mistral'],
    ]);
  // ---- the box's side (scripts/answer_check_20261026.py, EPILOGUE) ----
  // An AI assistant's answer opened this page: app.js's own test (ubAiLanding), on this page's referrer and utm_source.
  try {
    var refHost = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : '';
    var ours = refHost && (refHost === location.hostname || /(^|\.)underbook\.co$/.test(refHost));
    aiSent = !ours && !!(UB_AI_UTM.get((new URLSearchParams(location.search).get('utm_source') || '').trim().toLowerCase()) || UB_AI_HOST.get(refHost));
  } catch (x) { aiSent = false; }
  // The checker's crawler test: an automated browser runs nothing here.
  try { isAuto = navigator.webdriver === true || CRAWLER_UA.test(navigator.userAgent || ''); } catch (x) { isAuto = false; }
  // As on the checker: phones and tablets get app.js's card under a result, computers the extension offer.
  if (ic && handheld) { ic.parentNode.removeChild(ic); ic = null; }
  if (pl && !handheld) { pl.parentNode.removeChild(pl); pl = null; }
  if (handheld) { $('sites').classList.add('ub-tap-rows'); }
  $('currency').value = CUR[gl];
  $('result').addEventListener('click', goClick);
  $('result').addEventListener('auxclick', goClick);
  if (ic) ic.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#ub-page-offer-hide')) offerHide(); });
  // "Change dates" in the answer: back to the box's dates, check-in open.
  $('verdict').addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('#ub-dates')) return;
    var ci = $('checkIn');
    try { box.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); } catch (x) { /* ignore */ }
    try { ci.focus({ preventScroll: true }); } catch (x) { ci.focus(); }
    try { if (ci.showPicker) ci.showPicker(); } catch (x) { /* focus is enough */ }
  });
  // X74 (2026-11-09): the next hotel, same dates and party (as the checker's).
  $('verdict').addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('#ub-another')) return;
    var h = $('hotel'); h.value = ''; $('stayMsg').textContent = '';
    try { box.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); } catch (x) { /* ignore */ }
    try { h.focus({ preventScroll: true }); } catch (x) { h.focus(); }
  });
  // Every booking-site link of the box goes through /go as the checker's does, marked src=answer.
  var goPlain = goHref;
  goHref = function (link, source) { var h = goPlain(link, source); return h ? h + '&src=answer' : h; };
  // After an answer: the full checker for this stay (every control the box leaves out: the price-drop email, sharing).
  var full = function () {
    var a = document.getElementById('ub-page-full');
    if (!a || !stay) return;
    a.setAttribute('href', '/hotel-price-checker?' + new URLSearchParams({ hotel: stay.hotel, in: stay.checkIn, out: stay.checkOut, adults: String(stay.adults), cur: stay.currency }).toString());
  };
  var drawPlain = render, otherPlain = renderOther;
  render = function (a, cur) { drawPlain(a, cur); full(); };
  renderOther = function (a, cur) { otherPlain(a, cur); full(); };
  window.UBAnswerCheck = {
    // A person's submit of the box: true when the check runs here, false when the box should open the checker instead.
    check: function () { if (isAuto) return false; run(); return true; },
  };
})();
