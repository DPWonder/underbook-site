/* One line in their words (2026-11-26, the owner; docs/USER_QUESTIONS.md "One line in their words").
 *
 * Why: in the 3 days to 11/26 no stranger said a word to Underbook: no reply at hi@, 0 store reviews (Chrome, Edge,
 * Firefox, App Store), and the one-tap question on the checker answered 0 of 12 times. A tap is a count, not words.
 * This puts one question with a one-line box on the pages where people decide: the homepage (not adding it today?),
 * the welcome page every install opens (what made you add it?), the page Chrome opens after a removal (what happened?)
 * and the Black Friday page. Markup: <div data-ub-ask="<page id>" data-q="<question>"></div>; this script fills it.
 *
 * What is sent, and only after the visitor types at least 2 characters and presses Send: the words (up to 300
 * characters), the page id, the browser's language and the time, to the write-only Firestore collection `words`
 * (firestore.rules: no other field is accepted, nobody can read it from the web). No email, no id, no cookie.
 * Read with: python3 scripts/words_read.py
 *
 * Not drawn: on a translated page (i18n.js language other than English; the question is English only for now), for a
 * browser that says it is automated (navigator.webdriver), or once this browser has sent an answer on that page.
 * ?ubask=test draws it anyway and files the line under "test:<page id>" so our own checks never count as strangers.
 */
(function () {
  var URL = 'https://firestore.googleapis.com/v1/projects/underbook-prod/databases/(default)/documents/words';
  var TEST = /[?&]ubask=test\b/.test(location.search);

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (x) { return null; } }

  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.setAttribute('style', css);
    if (text) e.textContent = text;
    return e;
  }

  function draw(host) {
    var id = (host.getAttribute('data-ub-ask') || 'page').slice(0, 30);
    var q = host.getAttribute('data-q') || 'Anything you want to tell us? One line is plenty.';
    // Optional per-page words (2026-11-26, /for-hotels): data-ph placeholder, data-small small print, data-thanks reply.
    var ph = host.getAttribute('data-ph') || 'One line is plenty';
    var smallText = host.getAttribute('data-small') || 'No email needed. We keep only the words you send, and we read every one (';
    var thanks = host.getAttribute('data-thanks') || 'Thank you. We read every line, and this one goes to the person who decides what to change.';
    if (!TEST && store('ub_ask_' + id)) return;

    var box = el('div', 'border:1px solid #e7e5e4;background:#fff;border-radius:16px;padding:16px 20px;max-width:42rem;margin:0 auto;');
    var p = el('p', 'margin:0 0 10px;color:#334155;font-weight:600;', q);
    var form = el('form', 'display:flex;gap:8px;flex-wrap:wrap;margin:0;');
    var input = el('input', 'flex:1 1 220px;min-width:0;padding:10px 12px;border:1px solid #78716c;border-radius:12px;font-size:16px;');
    input.type = 'text';
    input.maxLength = 300;
    input.autocomplete = 'off';
    input.placeholder = ph;
    input.setAttribute('aria-label', q);
    var btn = el('button', 'padding:10px 18px;border:0;border-radius:12px;background:#0f172a;color:#fff;font-weight:600;font-size:16px;cursor:pointer;', 'Send');
    btn.type = 'submit';
    var small = el('p', 'margin:8px 0 0;font-size:12px;color:#64748b;');
    small.appendChild(document.createTextNode(smallText));
    var a = el('a', 'color:inherit;text-decoration:underline;', 'privacy');
    a.href = '/privacy';
    small.appendChild(a);
    small.appendChild(document.createTextNode(').'));
    var msg = el('p', 'margin:8px 0 0;font-size:14px;color:#047857;');
    msg.setAttribute('role', 'status');
    msg.setAttribute('aria-live', 'polite');
    form.appendChild(input);
    form.appendChild(btn);
    box.appendChild(p);
    box.appendChild(form);
    box.appendChild(small);
    box.appendChild(msg);
    host.appendChild(box);
    host.hidden = false;

    var busy = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = (input.value || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      if (text.length < 2) { input.focus(); return; }
      if (busy) return;
      busy = true;
      btn.disabled = true;
      var lang = String(navigator.language || '').slice(0, 12);
      var body = JSON.stringify({ fields: {
        text: { stringValue: text },
        page: { stringValue: (TEST ? 'test:' : '') + id },
        lang: { stringValue: lang },
        createdAt: { timestampValue: new Date().toISOString() },
      } });
      fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          store('ub_ask_' + id, '1');
          form.remove();
          small.remove();
          msg.textContent = thanks;
        })
        .catch(function () {
          busy = false;
          btn.disabled = false;
          msg.style.color = '#b45309';
          msg.textContent = '';
          msg.appendChild(document.createTextNode('That did not send. You can '));
          var m = el('a', 'color:inherit;text-decoration:underline;', 'email it to hi@underbook.co');
          m.href = 'mailto:hi@underbook.co?subject=' + encodeURIComponent('A line about Underbook') + '&body=' + encodeURIComponent(text);
          msg.appendChild(m);
          msg.appendChild(document.createTextNode(' instead.'));
        });
    });
  }

  function start() {
    if (navigator.webdriver && !TEST) return;
    if (window.UBI18N && UBI18N.lang && UBI18N.lang !== 'en' && !TEST) return;
    var hosts = document.querySelectorAll('[data-ub-ask]');
    for (var i = 0; i < hosts.length; i++) { try { draw(hosts[i]); } catch (x) {} }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
