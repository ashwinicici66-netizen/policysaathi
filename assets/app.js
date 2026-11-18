/*!
 * app.js — UI layer for PolicySaathi
 * Depends on surrender.js (window.SurrenderCalc) on calculator pages.
 * Nothing is stored or sent anywhere: all maths happens in this browser tab.
 */
(function () {
  'use strict';

  var SC = window.SurrenderCalc;

  /* ============ helpers ============ */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(v) { return SC ? SC.formatINR(v) : '₹' + v; }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  /* ============ mobile navigation ============ */
  function initNav() {
    var header = $('.site-header');
    var toggle = $('[data-nav-toggle]');
    var nav = $('.main-nav');
    if (!header || !toggle || !nav) return;

    function setOpen(open) {
      header.setAttribute('data-nav-open', open ? 'true' : 'false');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      setOpen(header.getAttribute('data-nav-open') !== 'true');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });

    // Close the menu if the viewport grows back to desktop size
    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: 901px)');
      var onChange = function (e) { if (e.matches) setOpen(false); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
    setOpen(false);
  }

  /* ============ ad slots ============
     The .ad-slot boxes are placeholders. When you paste your AdSense code
     inside one, it is detected and the placeholder styling is removed.
     Slots left empty (no AdSense on the page yet) are collapsed so the
     layout stays clean. */
  function initAds() {
    var hasAdSense = !!window.adsbygoogle || $$('script[src*="adsbygoogle"]').length > 0;
    $$('.ad-slot').forEach(function (slot) {
      var filled = $$('ins, iframe, script', slot).length > 0;
      if (filled) {
        slot.classList.add('is-filled');
      } else if (!hasAdSense) {
        slot.classList.add('is-hidden');
      }
    });
  }

  /* ============ calculator ============ */
  function initCalc() {
    var wrap = $('[data-calc]');
    if (!wrap || !SC) return;

    var form = $('.calc-inputs', wrap);
    var out = $('[data-result]', wrap);
    if (!form || !out) return;

    var fields = {
      policyType: $('#policyType', form),
      premium: $('#premium', form),
      term: $('#term', form),
      yearsPaid: $('#yearsPaid', form),
      sumAssured: $('#sumAssured', form)
    };
    var submitted = false;
    var lastSummary = '';

    /* ---- validation UI ---- */
    function clearErrors() {
      $$('.field', form).forEach(function (f) { f.classList.remove('is-error'); });
      $$('.field-error', form).forEach(function (n) { n.remove(); });
      $$('input, select', form).forEach(function (n) { n.removeAttribute('aria-invalid'); });
    }
    function showError(field, message) {
      var el = fields[field];
      if (!el) return;
      var holder = el.closest('.field');
      if (holder) holder.classList.add('is-error');
      el.setAttribute('aria-invalid', 'true');
      var p = document.createElement('p');
      p.className = 'field-error';
      p.id = field + '-error';
      p.textContent = message;
      if (holder) holder.appendChild(p);
      el.setAttribute('aria-describedby', p.id);
      el.focus();
    }

    /* ---- read the form ---- */
    function readForm() {
      return {
        policyType: fields.policyType ? fields.policyType.value : 'traditional',
        premium: fields.premium ? fields.premium.value : '',
        term: fields.term ? fields.term.value : '',
        yearsPaid: fields.yearsPaid ? fields.yearsPaid.value : '',
        sumAssured: fields.sumAssured ? fields.sumAssured.value : ''
      };
    }

    /* ---- render ---- */
    function note(n) {
      var cls = n.type === 'warn' ? ' is-warn' : n.type === 'info' ? ' is-info' : '';
      var head = n.title ? '<strong>' + esc(n.title) + '.</strong> ' : '';
      return '<p class="result-note' + cls + '">' + head + esc(n.text) + '</p>';
    }

    function render(res) {
      var inp = res.input;

      /* ULIP after 5 years: fund value case, no percentage maths */
      if (res.fundValueCase) {
        out.innerHTML =
          '<p class="result-label">ULIP — surrender value</p>' +
          '<p class="result-amount">Your fund value</p>' +
          '<p class="result-sub">After 5 years a ULIP pays units × NAV, not a fixed percentage.</p>' +
          res.notes.map(note).join('') +
          actionsHTML();
        lastSummary = 'ULIP after 5 years: surrender value = current fund value (units x NAV). Premiums paid ' +
          money(res.totalPremiums) + '.';
        return;
      }

      var pct = Math.max(0, Math.min(100, Math.round(res.returnedPct || 0)));
      var rows = [];

      rows.push(['Total premiums paid', money(res.totalPremiums) + '  (' + plural(inp.yearsPaid, 'year') + ' × ' + money(inp.premium) + ')', '']);
      rows.push(['Policy year of surrender', 'Year ' + inp.yearsPaid + ' of ' + inp.term, '']);
      rows.push(['Minimum GSV rate (IRDAI 2024)', (res.factor || 0) + '% of premiums paid', '']);
      rows.push(['Guaranteed surrender value (minimum)', money(res.gsv), 'is-strong']);
      rows.push(['You would lose at least', money(res.loss), 'is-loss']);
      if (res.paidUpSA) {
        rows.push(['If paid-up instead: reduced cover', money(res.paidUpSA) + ' (paid at maturity)', 'is-good']);
      }
      if (res.loan) {
        rows.push(['Possible policy loan (80–90%)', money(res.loan.min) + ' – ' + money(res.loan.max), '']);
      }

      var html =
        '<p class="result-label">Minimum surrender value</p>' +
        '<p class="result-amount">' + money(res.gsv) + '</p>' +
        '<p class="result-sub">The legal minimum for a ' +
        (res.isUlip ? 'ULIP' : 'traditional life') + ' policy in year ' + inp.yearsPaid +
        '. The insurer pays GSV or SSV — whichever is higher.</p>' +
        '<div class="meter">' +
          '<div class="meter-track"><div class="meter-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="meter-scale"><span>You get back ≈ ' + pct + '%</span><span>Premiums paid ' + money(res.totalPremiums) + '</span></div>' +
        '</div>' +
        '<dl class="result-rows">' +
          rows.map(function (r) {
            return '<div class="result-row ' + r[2] + '"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
          }).join('') +
        '</dl>' +
        res.notes.map(note).join('') +
        actionsHTML();

      out.innerHTML = html;

      lastSummary =
        'Surrender value estimate (PolicySaathi)\n' +
        'Policy: ' + (res.isUlip ? 'ULIP' : 'Traditional') + ', premium ' + money(inp.premium) +
        '/year, term ' + inp.term + ' years, paid ' + inp.yearsPaid + ' years\n' +
        'Total premiums paid: ' + money(res.totalPremiums) + '\n' +
        'Minimum GSV rate: ' + (res.factor || 0) + '%\n' +
        'Guaranteed surrender value (minimum): ' + money(res.gsv) + '\n' +
        'You would lose at least: ' + money(res.loss) + '\n' +
        (res.paidUpSA ? 'Paid-up reduced cover: ' + money(res.paidUpSA) + '\n' : '') +
        (res.loan ? 'Possible policy loan: ' + money(res.loan.min) + ' - ' + money(res.loan.max) + '\n' : '') +
        'Estimate only — confirm the final amount with your insurer.';

      /* animate the meter from 0 */
      var fill = $('.meter-fill', out);
      if (fill) {
        var w = fill.style.width;
        fill.style.width = '0%';
        requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.width = w; }); });
      }
    }

    function actionsHTML() {
      return '<div class="result-actions">' +
        '<button type="button" class="btn btn-quiet btn-sm" data-copy>Copy summary</button>' +
        '<button type="button" class="btn btn-quiet btn-sm" data-print>Print / save PDF</button>' +
        '<button type="button" class="btn btn-quiet btn-sm" data-reset>Reset</button>' +
        '</div>';
    }

    function run(scrollTo) {
      clearErrors();
      var res = SC.estimate(readForm());
      if (!res.ok) {
        out.innerHTML = '<p class="result-empty">Please fix the highlighted field and calculate again.</p>';
        showError(res.error.field, res.error.message);
        return false;
      }
      render(res);
      if (scrollTo && window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
        out.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return true;
    }

    /* ---- events ---- */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitted = run(true);
    });

    // Keep "years paid" inside the selected term
    if (fields.term) {
      fields.term.addEventListener('change', function () {
        if (fields.yearsPaid) {
          fields.yearsPaid.max = fields.term.value || SC.LIMITS.maxYears;
          if (Number(fields.yearsPaid.value) > Number(fields.term.value)) fields.yearsPaid.value = '';
        }
        if (submitted) run(false);
      });
    }

    // Recalculate live once the user has seen a first result
    ['input', 'change'].forEach(function (evt) {
      form.addEventListener(evt, function (e) {
        if (!submitted) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') run(false);
      });
    });

    out.addEventListener('click', function (e) {
      var copy = e.target.closest('[data-copy]');
      var print = e.target.closest('[data-print]');
      var reset = e.target.closest('[data-reset]');

      if (copy) {
        var done = function () {
          var old = copy.textContent;
          copy.textContent = 'Copied ✓';
          setTimeout(function () { copy.textContent = old; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(lastSummary).then(done, function () {});
        } else {
          var ta = document.createElement('textarea');
          ta.value = lastSummary;
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); done(); } catch (err) {}
          document.body.removeChild(ta);
        }
      }
      if (print) window.print();
      if (reset) {
        submitted = false;
        form.reset();
        clearErrors();
        out.innerHTML = '<p class="result-empty">Fill in your policy details above — your minimum surrender value will appear here.</p>';
        if (fields.premium) fields.premium.focus();
      }
    });
  }

  /* ============ small progressive enhancements ============ */
  function initMisc() {
    // Open the FAQ item that a same-page link points at (e.g. #faq-vehicle)
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target && target.tagName === 'DETAILS') target.open = true;
    }
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function () {
        var el = document.getElementById(a.getAttribute('href').slice(1));
        if (el && el.tagName === 'DETAILS') el.open = true;
      });
    });

    // Right-align cells that hold only numbers in .data tables
    $$('table.data tbody td').forEach(function (td) {
      var txt = td.textContent.trim();
      if (txt && /^[₹0-9,.%–—\-\s\/()]+$/.test(txt) && /\d/.test(txt) && txt.length < 26) {
        td.classList.add('num');
      }
    });
  }

  function init() {
    document.documentElement.classList.add('js');
    initNav();
    initCalc();
    initMisc();
    initAds(); // run last so injected ads have a chance to appear
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', initAds);
})();
