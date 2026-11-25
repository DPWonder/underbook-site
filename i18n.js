// i18n.js: the install welcome page and the web price checker in the visitor's language (2026-10-10,
// docs/LOCALIZE_2026-10-10.md). Spanish, German, French, Portuguese (Brazil) and Italian, the five languages of the store
// listings (docs/LISTINGS_I18N_2026-10-05.md); from 2026-10-13 (docs/LOCALIZE_10_2026-10-13.md) also Japanese, Korean,
// Dutch, Polish, Turkish, Swedish, Indonesian, Vietnamese and Chinese (Simplified and Traditional), the ten listing
// languages of docs/LISTINGS_I18N_2026-10-12.md; from 2026-10-14 (docs/PT_PT_2026-10-14.md) also Portuguese (Portugal),
// for every Portuguese browser that is not Brazil's. Every other browser language gets the English page, unchanged.
//
// One page per surface, English in the HTML as the source. This file picks the language from navigator.language (a
// ?lang= on the address overrides it, for checks and screenshots), loads /i18n/<page>.<lang>.json and swaps strings:
//  - Static text: every element whose content is text and inline markup only (a, strong, kbd, span, button...) is one
//    unit, looked up by its whole innerHTML (whitespace collapsed); text beside a field or a block is looked up alone.
//    A unit is swapped by moving its own child elements into the translation's places (same tags, same order), so ids,
//    links, classes and listeners never change. Attributes: placeholder, aria-label, title, alt.
//  - The keys are the English itself (gettext style). An English sentence that is edited no longer matches its key, so
//    the page shows the new English, never a stale translated claim. scripts/i18n_check.mjs lists keys with no match.
//  - Text the page scripts write later: sentences with a value in them go through UBI18N.t(english, values) in the page's
//    code; fixed sentences written by a script (status lines, app.js's phone card) are swapped by a MutationObserver.
//  - Until the dictionary is in, a translated page stays hidden (at most 3 s; then the English page shows) and the page's
//    own scripts wait (UBI18N.ready), so counters, ids and links behave as before. In English nothing waits, nothing
//    is fetched and nothing is observed: the page runs exactly as it did.
// Nothing leaves the browser for this: the dictionary is a static file of this site, and no count is sent from here.
(function () {
  'use strict';
  var VERSION = '20261117h';
  var script = document.currentScript;
  var page = (script && script.getAttribute('data-page')) || '';
  var HAS = Object.prototype.hasOwnProperty;

  // es, es-419, es-MX: Spanish; de-AT, de-CH: German; fr-CA: French; it-CH: Italian; Portuguese: pt-BR is Brazil's, and
  // since 2026-10-14 every other Portuguese (pt-PT, a bare pt, pt-AO, pt-MZ...) is Portugal's (docs/PT_PT_2026-10-14.md;
  // until then they got English). 2026-10-13: ja, ko, nl (nl-BE too), pl, tr, sv
  // (sv-FI too), vi and id (and "in", the old code some systems still send for Indonesian) with any region; Chinese by its
  // script, else by its region: Traditional for zh-TW, zh-HK, zh-MO and zh-Hant, Simplified for zh-CN, zh-SG, zh-Hans and
  // a bare zh. Norwegian (nb, nn, no) and Danish (da) are not Swedish: they get English, as every other language does.
  var MORE = { ja: 1, ko: 1, nl: 1, pl: 1, tr: 1, sv: 1, id: 1, vi: 1 };
  // 2026-11-13 (docs/WELCOME_16_2026-11-13.md): the welcome page only (not the web checker, which has no dictionary in them)
  // also in Hebrew (and "iw", its old code), Russian and the 14 languages of extension 0.5.71: Arabic, Thai, Ukrainian, Czech,
  // Greek, Hungarian, Romanian, Danish, Finnish, Norwegian, Slovak, Bulgarian, Croatian and Malay. Norwegian is one page,
  // "nb", for nb, nn and no (the card's cardLocale is "nb"; X19 counts the three as `no`). Danish is Danish, not Norwegian.
  var WELCOME_ONLY = { he: 1, ru: 1, ar: 1, th: 1, uk: 1, cs: 1, el: 1, hu: 1, ro: 1, da: 1, fi: 1, nb: 1, sk: 1, bg: 1, hr: 1, ms: 1 };
  function pick(raw) {
    var m = /^([A-Za-z]{2,3})(?:[-_]([A-Za-z]{4}))?(?:[-_]([A-Za-z]{2}|\d{3}))?(?:[-_]|$)/.exec(String(raw || '').trim());
    if (!m) return 'en';
    var l = m[1].toLowerCase(), s = (m[2] || '').toLowerCase(), r = (m[3] || '').toUpperCase();
    if (l === 'es' || l === 'de' || l === 'fr' || l === 'it') return l;
    if (l === 'pt') return r === 'BR' ? 'pt-BR' : 'pt-PT';
    if (l === 'in') l = 'id';
    if (HAS.call(MORE, l)) return l;
    if (l === 'zh') return s === 'hant' || (s !== 'hans' && (r === 'TW' || r === 'HK' || r === 'MO')) ? 'zh-TW' : 'zh-CN';
    if (l === 'iw') l = 'he';
    if (l === 'no' || l === 'nn') l = 'nb';
    if (HAS.call(WELCOME_ONLY, l)) return page === 'welcome' ? l : 'en';
    return 'en';
  }
  var forced = '';
  try { forced = new URLSearchParams(location.search).get('lang') || ''; } catch (e) { forced = ''; }
  var nav = '';
  try { nav = navigator.language || ''; } catch (e) { nav = ''; }
  var lang = pick(forced || nav);
  if (!page) lang = 'en';
  // Numbers and dates: the browser's own locale when it is this language (es-MX keeps Mexico's way, zh-HK Hong Kong's), else
  // the language ("in-ID" is written "id-ID" for Intl; a bare "pt", which Intl writes Brazil's way, is written "pt-PT").
  var locale = lang === 'en' ? (nav || 'en-US') : (pick(nav) === lang ? nav.replace(/^in(?=[-_]|$)/i, 'id').replace(/^pt$/i, 'pt-PT') : lang);
  // Hebrew's old code and Norwegian's other two are written as Intl knows them (2026-11-13); Arabic figures and dates in Latin
  // digits, as the card writes them (its cardLocale is "ar-u-nu-latn"), whatever the region's default.
  if (lang === 'he') locale = locale.replace(/^iw(?=[-_]|$)/i, 'he');
  if (lang === 'nb') locale = locale.replace(/^(no|nn)(?=[-_]|$)/i, 'nb');
  if (lang === 'ar') locale = locale.replace(/-u-.*$/i, '') + '-u-nu-latn';

  var dict = null, meta = {}, ready = lang === 'en', queue = [], observer = null, busy = false;

  // A value that ends in a full stop (a date such as "tis 3 nov." or "Di., 3. Nov.") right before the sentence's own: one
  // stop, not two (2026-10-13). No English value ends in one, so the English page writes what it wrote before.
  function fill(s, vars) {
    if (!vars) return s;
    return String(s).replace(/\{([A-Za-z_]+)\}(\.?)/g, function (m, k, dot) {
      if (!HAS.call(vars, k)) return m;
      var v = String(vars[k]);
      return v + (dot && /\.$/.test(v) ? '' : dot);
    });
  }
  // A sentence a page script writes: the translation of the English template, or the English, with the values put in.
  function t(en, vars) {
    var s = dict && HAS.call(dict, en) && typeof dict[en] === 'string' ? dict[en] : en;
    return fill(s, vars);
  }

  // ---- static and observed text -------------------------------------------------------------------------------------
  var INLINE = { A: 1, STRONG: 1, B: 1, EM: 1, I: 1, KBD: 1, CODE: 1, SPAN: 1, BR: 1, SMALL: 1, SUP: 1, SUB: 1, U: 1, BUTTON: 1 };
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, svg: 1, SVG: 1 };
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var XHTML = 'http://www.w3.org/1999/xhtml';
  var norm = function (s) { return String(s).replace(/\s+/g, ' ').trim(); };
  var escText = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;'); };
  var skipped = function (el) { return el.nodeType !== 1 || SKIP[el.tagName] || el.namespaceURI !== XHTML || el.getAttribute('translate') === 'no'; };
  // A unit: some text of its own, and nothing but inline elements under it.
  function isUnit(el) {
    var text = false;
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && /\S/.test(c.nodeValue)) { text = true; break; }
    if (!text) return false;
    var all = el.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) if (!INLINE[all[i].tagName] || all[i].namespaceURI !== XHTML) return false;
    return true;
  }
  // The store buttons say Edge or Firefox in those browsers (app.js rewrites "Chrome" before this runs): the key is the
  // Chrome sentence, and the translation gets the same browser back. A language whose ending changes with the name
  // (Turkish "Chrome'a ekle", "Edge'e ekle") lists its forms in "@browsers": { "Edge": [["Chrome'a", "Edge'e"]] }, applied
  // first.
  function lookup(key) {
    if (!dict || !key) return null;
    if (HAS.call(dict, key) && typeof dict[key] === 'string') return dict[key];
    var m = /\b(Edge|Firefox)\b/.exec(key);
    if (m && !/\bChrome\b/.test(key)) {
      var store = m[1] === 'Edge' ? 'Edge Add-ons' : 'Firefox Add-ons';
      var k2 = key.split(store).join('Chrome Web Store').replace(/\b(Edge|Firefox)\b/g, 'Chrome');
      if (HAS.call(dict, k2) && typeof dict[k2] === 'string') {
        var v = dict[k2], forms = (meta['@browsers'] || {})[m[1]] || [];
        for (var i = 0; i < forms.length; i++) if (forms[i] && forms[i].length === 2) v = v.split(forms[i][0]).join(forms[i][1]);
        return v.split('Chrome Web Store').join(store).replace(/\bChrome\b/g, m[1]);
      }
    }
    return null;
  }
  // Swap a unit's content for the translation, keeping its own element nodes (same tags in the same order).
  function applyUnit(el, html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    var olds = Array.prototype.slice.call(el.getElementsByTagName('*'));
    var news = tpl.content.querySelectorAll('*');
    if (olds.length !== news.length) return false;
    for (var i = 0; i < news.length; i++) if (news[i].tagName !== olds[i].tagName) return false;
    var idx = 0;
    (function put(target, src) {
      var frag = document.createDocumentFragment();
      for (var n = src.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) frag.appendChild(document.createTextNode(n.nodeValue));
        else if (n.nodeType === 1) { var o = olds[idx++]; put(o, n); frag.appendChild(o); }
      }
      while (target.firstChild) target.removeChild(target.firstChild);
      target.appendChild(frag);
    })(el, tpl.content);
    return true;
  }
  function textOf(html) { var tpl = document.createElement('template'); tpl.innerHTML = html; return tpl.content.querySelector('*') ? null : tpl.content.textContent; }
  // Walk a subtree. visit(kind, key, node): 'unit' (an element, key = its innerHTML), 'text' (a text node outside any
  // unit, key = its text as HTML), 'attr' (key = the attribute's value; node = [element, name]).
  function walk(node, visit) {
    if (node.nodeType === 3) { var k = norm(escText(node.nodeValue)); if (k) visit('text', k, node); return; }
    if (skipped(node)) return;
    ATTRS.forEach(function (a) { var v = node.getAttribute(a); if (v && /[A-Za-z]/.test(v)) visit('attr', norm(v), [node, a]); });
    if (isUnit(node)) {
      Array.prototype.forEach.call(node.getElementsByTagName('*'), function (d) {
        ATTRS.forEach(function (a) { var v = d.getAttribute(a); if (v && /[A-Za-z]/.test(v)) visit('attr', norm(v), [d, a]); });
      });
      visit('unit', norm(node.innerHTML), node);
      return;
    }
    for (var c = node.firstChild, next; c; c = next) { next = c.nextSibling; walk(c, visit); }
  }
  function translate(root) {
    walk(root, function (kind, key, node) {
      var v = lookup(key);
      if (v == null || v === key) return;
      if (kind === 'unit') { applyUnit(node, v); return; }
      var txt = textOf(v);
      if (txt == null) return;
      if (kind === 'attr') { node[0].setAttribute(node[1], txt); return; }
      var raw = node.nodeValue;
      node.nodeValue = /^\s*/.exec(raw)[0] + txt + /\s*$/.exec(raw)[0];
    });
  }
  function collect(root) {
    var out = [];
    walk(root || document.body, function (kind, key) { out.push({ kind: kind, key: key }); });
    if (!root) out.unshift({ kind: 'title', key: norm(escText(document.title)) });
    return out;
  }
  // The Chrome Web Store in the page's language (2026-11-17, docs/NONENGLISH_WALK_2026-11-17.md fix 3): a Chrome Web Store
  // link without hl= opens the listing in the browser's own language, and the store has no Spanish (Latin America) listing,
  // so an es-419, es-AR or es-MX browser reading this page in Spanish got our English listing. Once the page shows in one of
  // these languages, its Chrome Web Store links carry hl=<the store's code> (the codes of scripts/store_link_utm.py CWS_HL,
  // where the server-rendered language pages get theirs); utm tags and every other part of the address stay. In English
  // nothing runs, so the links stay exactly as they are.
  var CWS_HL = { es: 1, 'pt-BR': 1, 'pt-PT': 1, fr: 1, it: 1, de: 1, tr: 1, ja: 1, ko: 1, 'zh-CN': 1, 'zh-TW': 1, nl: 1, pl: 1, sv: 1, vi: 1, id: 1 };
  function storeLang() {
    if (!HAS.call(CWS_HL, lang)) return;
    Array.prototype.forEach.call(document.querySelectorAll('a[href^="https://chromewebstore.google.com/detail/"]'), function (a) {
      try {
        var u = new URL(a.href), rest = new URLSearchParams(u.search);
        rest.delete('hl');
        var q = rest.toString();
        u.search = '?hl=' + encodeURIComponent(lang) + (q ? '&' + q : '');
        a.href = u.toString();
      } catch (e) { /* the link stays as it was */ }
    });
  }
  function observe() {
    if (!window.MutationObserver) return;
    observer = new MutationObserver(function (recs) {
      if (busy) return;
      busy = true;
      try {
        var roots = [];
        recs.forEach(function (r) {
          if (r.type === 'childList') {
            Array.prototype.forEach.call(r.addedNodes, function (n) { roots.push(n.nodeType === 3 ? r.target : n); });
          } else if (r.type === 'characterData') roots.push(r.target.parentNode);
          else if (r.type === 'attributes') roots.push(r.target);
        });
        roots.forEach(function (n) {
          if (!n || n.nodeType !== 1 || !n.isConnected) return;
          // Written inside a unit (a <strong> of a sentence, say): look the whole unit up.
          while (INLINE[n.tagName] && n.parentNode && n.parentNode.nodeType === 1 && n.parentNode !== document.body && isUnit(n.parentNode)) n = n.parentNode;
          translate(n);
        });
      } finally { observer.takeRecords(); busy = false; }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // ---- words that need the language's grammar ------------------------------------------------------------------------
  // A date as this language writes it. French writes the first of the month "1er".
  function date(d, opts) {
    var s;
    try { s = new Intl.DateTimeFormat(locale, opts).format(d); } catch (e) { s = new Intl.DateTimeFormat(lang, opts).format(d); }
    if (lang === 'fr') s = s.replace(/(^|\s)1(?=\s)/, '$11er');
    return s;
  }
  // "Oct 6 to Oct 8": the dictionary's "{a} to {b}"; Italian elides before a vowel ("dall'8 all'11").
  function range(a, b) {
    var s = t('{a} to {b}', { a: a, b: b });
    if (lang === 'it') s = s.replace(/(^|\s)(d?al) (1|8|11)(?=\D|$)/g, "$1$2l'$3");
    return s;
  }
  // "in the United States", "en Estados Unidos", "in den USA": a country as the end of "for travelers in ...". The
  // dictionary's "@in" holds the phrase per country code and "_" the pattern for any other ({name}: the country's name in
  // this language).
  function inCountry(cc) {
    var code = String(cc || '').toUpperCase();
    var map = meta['@in'] || {};
    var name = code;
    try { name = new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code; } catch (e) { name = code; }
    return HAS.call(map, code) ? map[code] : fill(map._ || '{name}', { name: name });
  }
  function countryName(cc) {
    try { return new Intl.DisplayNames([lang], { type: 'region' }).of(String(cc || '').toUpperCase()) || cc; } catch (e) { return cc; }
  }
  // Quotation marks around a room name.
  function quote(s) { var q = meta['@quotes'] || ["'", "'"]; return q[0] + s + q[1]; }

  // ---- notes only a translated page carries ---------------------------------------------------------------------------
  // "@notes": [{ "into": "<selector>", "where": "start" | "end", "tag": "li", "class": "...", "html": "..." }]: honest
  // additions the English page needs no version of (the language of the extension's banner and emails; other pages are in
  // English).
  function notes() {
    var list = meta['@notes'] || [];
    list.forEach(function (n) {
      var host = document.querySelector(n.into);
      if (!host) return;
      var el = document.createElement(n.tag || 'p');
      if (n['class']) el.className = n['class'];
      el.setAttribute('data-ub-i18n-note', '1');
      el.innerHTML = n.html;
      if (n.where === 'start') host.insertBefore(el, host.firstChild); else host.appendChild(el);
    });
  }

  // ---- start ------------------------------------------------------------------------------------------------------------
  var api = {
    lang: lang, locale: locale, page: page, version: VERSION,
    t: t, date: date, range: range, inCountry: inCountry, countryName: countryName, quote: quote,
    ready: function (fn) { if (ready) fn(); else queue.push(fn); },
    collect: collect,
  };
  window.UBI18N = api;
  if (lang === 'en') return;

  var root = document.documentElement;
  root.classList.add('ub-i18n-wait');
  var hide = document.createElement('style');
  // With the hiding rule, the type rules a translated page needs (2026-10-13), keyed on <html lang>, which is set when the
  // strings are in (an English page never gets this style):
  //  - Japanese and Chinese: no line starts with a closing mark or a small kana (strict); a long Latin run (an email, a
  //    site name) may break rather than push the page sideways. Japanese breaks between phrases, never inside a word or
  //    between a number and its counter ("Booking.comで / 実在のホテルを開く", not "…開 / く"; "大人2名" whole): auto-phrase,
  //    Chrome 119+, other browsers ignore it and break as before.
  //  - Korean wraps between words, as it is written, not inside one.
  //  - A key ("⌘ R") never splits over two lines.
  //  - Dutch, Polish, Swedish, Turkish, Indonesian, Vietnamese: a word longer than its line breaks at the edge, never past
  //    it; in Dutch, Polish and Swedish headings, a word of 14 letters or more may break with a hyphen, 6 on each side
  //    ("controleert" and "hotellpriser" never split; a 21-letter compound on a 320px phone does).
  hide.textContent = 'html.ub-i18n-wait body{visibility:hidden}'
    + 'html:lang(ja) body,html:lang(zh) body{line-break:strict;overflow-wrap:break-word}'
    + 'html:lang(ja) body{word-break:auto-phrase}'
    + 'kbd{white-space:nowrap}'
    + 'html:lang(ko) body{word-break:keep-all;overflow-wrap:break-word}'
    + 'html:lang(nl) body,html:lang(pl) body,html:lang(sv) body,html:lang(tr) body,html:lang(id) body,html:lang(vi) body{overflow-wrap:break-word}'
    + 'html:lang(nl) :is(h1,h2,h3),html:lang(pl) :is(h1,h2,h3),html:lang(sv) :is(h1,h2,h3){hyphens:auto;hyphenate-limit-chars:14 6 6}'
    // 2026-11-13, the welcome page in 16 more languages: a word longer than its line breaks at the edge, never past it
    // (Finnish and Hungarian compounds on a phone). Right to left for Arabic and Hebrew (dir is set with lang, below): the
    // list's bullets and their indent move to the right; flex rows, text and fields follow dir by themselves; a key
    // ("⌘ R"), an email address and a figure keep their own left-to-right order inside the line.
    + 'html:lang(he) body,html:lang(ru) body,html:lang(ar) body,html:lang(th) body,html:lang(uk) body,html:lang(cs) body,html:lang(el) body,html:lang(hu) body,'
    + 'html:lang(ro) body,html:lang(da) body,html:lang(fi) body,html:lang(nb) body,html:lang(sk) body,html:lang(bg) body,html:lang(hr) body,html:lang(ms) body{overflow-wrap:break-word}'
    + 'html[dir=rtl] .pl-6{padding-left:0;padding-right:1.5rem}'
    + 'html[dir=rtl] kbd{unicode-bidi:isolate;direction:ltr}';
  (document.head || root).appendChild(hide);

  var loaded = null, parsed = document.readyState !== 'loading', timer = null;
  function finish(ok) {
    if (ready) return;
    ready = true;
    clearTimeout(timer);
    if (ok) {
      dict = loaded.strings;
      meta = loaded;
      busy = true;
      try {
        if (document.title) { var tt = lookup(norm(escText(document.title))); if (tt) document.title = textOf(tt) || document.title; }
        translate(document.body);
        notes();
        storeLang();
      } finally { busy = false; }
      root.lang = lang;
      if (lang === 'ar' || lang === 'he') root.dir = 'rtl';
      observe();
    } else {
      // No dictionary in time: the English page, exactly as it is in English.
      api.lang = lang = 'en';
      api.locale = locale = nav || 'en-US';
      dict = null;
      meta = {};
    }
    var q = queue; queue = [];
    q.forEach(function (fn) { try { fn(); } catch (e) { setTimeout(function () { throw e; }); } });
    root.classList.remove('ub-i18n-wait');
  }
  function maybe() { if (loaded && parsed) finish(true); }
  timer = setTimeout(function () { finish(false); }, 3000);
  if (!parsed) document.addEventListener('DOMContentLoaded', function () { parsed = true; maybe(); });
  fetch('/i18n/' + page + '.' + lang + '.json?v=' + VERSION)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (j && typeof j === 'object' && j.lang === lang && j.strings) { loaded = j; maybe(); } else finish(false); })
    .catch(function () { finish(false); });
})();
