/* tools/dom-test.js — smoke test: load pages in jsdom and drive the calculator.
   Run: node tools/dom-test.js */
const { JSDOM } = require('jsdom');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
  if (!cond) failures++;
}

async function loadPage(file) {
  const dom = await JSDOM.fromFile(path.join(ROOT, file), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
  });
  await new Promise((res, rej) => {
    dom.window.addEventListener('load', res);
    setTimeout(res, 3000);
  });
  return dom;
}

function setVal(win, id, value) {
  const el = win.document.getElementById(id);
  el.value = value;
  el.dispatchEvent(new win.Event('change', { bubbles: true }));
  el.dispatchEvent(new win.Event('input', { bubbles: true }));
}

(async () => {
  console.log('\n== index.html ==');
  let dom = await loadPage('index.html');
  let win = dom.window, doc = win.document;

  check('scripts executed (html.js)', doc.documentElement.classList.contains('js'));
  check('nav toggle injected button exists', !!doc.querySelector('[data-nav-toggle]'));

  const toggle = doc.querySelector('[data-nav-toggle]');
  toggle.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('nav opens on toggle click', doc.querySelector('.site-header').getAttribute('data-nav-open') === 'true');
  toggle.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('nav closes on second click', doc.querySelector('.site-header').getAttribute('data-nav-open') === 'false');

  check('empty ad slots collapsed', Array.from(doc.querySelectorAll('.ad-slot')).every(a => a.classList.contains('is-hidden')));

  // fill + submit the calculator
  setVal(win, 'premium', '50000');
  setVal(win, 'term', '15');
  setVal(win, 'yearsPaid', '5');
  setVal(win, 'sumAssured', '500000');
  doc.querySelector('.calc-inputs').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));

  const result = doc.querySelector('[data-result]').textContent;
  check('shows ₹1,25,000 for 50k x 5y', result.includes('₹1,25,000'), result.replace(/\s+/g, ' ').slice(0, 90));
  check('shows 50% factor row', result.includes('50%'));
  check('shows paid-up cover', result.includes('1,66,700'));
  check('shows loan range', result.includes('1,00,000'));
  check('copy/print/reset buttons rendered', !!doc.querySelector('[data-copy]') && !!doc.querySelector('[data-print]') && !!doc.querySelector('[data-reset]'));

  // ULIP path
  setVal(win, 'policyType', 'ulip');
  setVal(win, 'yearsPaid', '7');
  doc.querySelector('.calc-inputs').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  const r2 = doc.querySelector('[data-result]').textContent;
  check('ULIP after 5y shows fund-value note', r2.includes('fund value'), r2.replace(/\s+/g, ' ').slice(0, 80));

  // validation path
  setVal(win, 'policyType', 'traditional');
  setVal(win, 'yearsPaid', '5');
  setVal(win, 'premium', '');
  doc.querySelector('.calc-inputs').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  check('validation error shown for empty premium', !!doc.querySelector('.field-error'));
  check('field marked aria-invalid', doc.getElementById('premium').getAttribute('aria-invalid') === 'true');

  // year 1 path
  setVal(win, 'premium', '50000');
  setVal(win, 'yearsPaid', '1');
  doc.querySelector('.calc-inputs').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  const r3 = doc.querySelector('[data-result]').textContent;
  check('year 1 shows ₹0 + SSV note', r3.includes('₹0') && r3.toLowerCase().includes('special surrender value'));

  dom.window.close();

  console.log('\n== surrender-value-calculator.html ==');
  dom = await loadPage('surrender-value-calculator.html');
  win = dom.window; doc = win.document;
  setVal(win, 'premium', '25000');
  setVal(win, 'term', '10');
  setVal(win, 'yearsPaid', '2');
  doc.querySelector('.calc-inputs').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  const r4 = doc.querySelector('[data-result]').textContent;
  check('year 2 -> 30% of 50,000 = ₹15,000', r4.includes('₹15,000') && r4.includes('30%'));
  dom.window.close();

  console.log('\n== static pages load & enhance ==');
  for (const f of ['surrender-value-guide.html', 'lic-surrender-value-chart.html', 'surrender-vs-paid-up-vs-lapse.html',
                   'surrender-value-kya-hai.html', 'about.html', 'contact.html', 'privacy.html', '404.html']) {
    const d = await loadPage(f);
    const ok = d.window.document.documentElement.classList.contains('js') &&
               !!d.window.document.querySelector('.site-footer');
    check(f + ' boots cleanly', ok);
    d.window.close();
  }

  console.log(failures ? '\n' + failures + ' FAILURES' : '\nAll DOM tests passed');
  process.exit(failures ? 1 : 0);
})();
