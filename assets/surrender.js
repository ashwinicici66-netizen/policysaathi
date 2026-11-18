/*!
 * surrender.js — pure calculation layer for PolicySaathi
 * No DOM, no dependencies. Works in the browser (window.SurrenderCalc)
 * and in Node (module.exports) so it can be unit-tested.
 *
 * Rules implemented: IRDAI (Insurance Products) Regulations, 2024 — Schedule I
 * minimum Guaranteed Surrender Value (GSV) for non-single-premium life policies:
 *   year 1        -> 0%  (no GSV; an enhanced Special Surrender Value may apply)
 *   year 2        -> 30% of total premiums paid
 *   year 3        -> 35%
 *   years 4 to 7  -> 50%
 *   after year 7  -> smooth progression upwards
 *   last 2 years  -> at least 90%
 * The insurer pays whichever is HIGHER: GSV or its own SSV. This tool shows GSV.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (root) { root.SurrenderCalc = api; }
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LIMITS = { minPremium: 500, maxPremium: 10000000, maxYears: 40 };

  /* ---- GSV percentage for a given policy year + premium paying term ---- */
  function gsvFactor(year, term) {
    year = Math.floor(Number(year) || 0);
    term = Math.floor(Number(term) || 0);
    if (year < 2) return 0;
    if (year === 2) return 30;
    if (year === 3) return 35;
    if (year <= 7) return 50;
    // Final two policy years: minimum 90%
    if (term && year >= term - 1) return 90;
    // Otherwise rise smoothly from 50% (year 7) towards 90%, in 5% steps
    var endYear = term ? term - 1 : year + 4;
    var span = endYear - 7;
    if (span <= 0) return 90;
    var pct = 50 + (40 * (year - 7)) / span;
    pct = Math.round(pct / 5) * 5;
    return Math.max(50, Math.min(90, pct));
  }

  /* ---- Reduced paid-up sum assured: SA x (premiums paid / premiums payable) ---- */
  function paidUpSumAssured(sumAssured, yearsPaid, term) {
    if (!sumAssured || !term || yearsPaid == null) return null;
    var v = (sumAssured * yearsPaid) / term;
    return Math.round(v / 100) * 100; // round to nearest ₹100
  }

  /* ---- Input validation: returns {field, message} or null ---- */
  function validate(input) {
    var premium = Number(input.premium);
    var term = Number(input.term);
    var years = Number(input.yearsPaid);
    var sa = input.sumAssured === '' || input.sumAssured == null ? null : Number(input.sumAssured);

    if (!input.premium || isNaN(premium) || premium <= 0) {
      return { field: 'premium', message: 'Please enter your annual premium.' };
    }
    if (premium < LIMITS.minPremium) {
      return { field: 'premium', message: 'Annual premium looks too low (minimum ₹' + LIMITS.minPremium + ').' };
    }
    if (premium > LIMITS.maxPremium) {
      return { field: 'premium', message: 'Please check the premium — that value looks too high.' };
    }
    if (!term || isNaN(term) || term <= 0) {
      return { field: 'term', message: 'Please select the premium paying term of your policy.' };
    }
    if (!years || isNaN(years) || years <= 0) {
      return { field: 'yearsPaid', message: 'Please enter how many years of premium you have paid.' };
    }
    if (years > LIMITS.maxYears) {
      return { field: 'yearsPaid', message: 'Years paid cannot be more than ' + LIMITS.maxYears + '.' };
    }
    if (years > term) {
      return { field: 'yearsPaid', message: 'Years paid (' + years + ') cannot be more than the premium paying term (' + term + ').' };
    }
    if (sa !== null && (isNaN(sa) || sa < 0)) {
      return { field: 'sumAssured', message: 'Sum assured must be a positive number.' };
    }
    if (sa !== null && sa > 0 && sa < years * premium) {
      return { field: 'sumAssured', message: 'Sum assured is usually higher than total premiums paid — please re-check.' };
    }
    return null;
  }

  /* ---- Main estimate ---- */
  function estimate(raw) {
    var input = {
      policyType: (raw.policyType || 'traditional').toLowerCase(),
      premium: Number(raw.premium) || 0,
      term: Number(raw.term) || 0,
      yearsPaid: Math.floor(Number(raw.yearsPaid) || 0),
      sumAssured: raw.sumAssured === '' || raw.sumAssured == null ? null : Number(raw.sumAssured) || null
    };

    var error = validate(input);
    if (error) { return { ok: false, error: error, input: input }; }

    var isUlip = input.policyType === 'ulip';
    var totalPremiums = input.premium * input.yearsPaid;
    var factor = gsvFactor(input.yearsPaid, input.term);
    var gsv = Math.round((totalPremiums * factor) / 100);
    var notes = [];

    // ULIPs: after 5 years the payout is the fund value, not the GSV table
    if (isUlip && input.yearsPaid >= 5) {
      return {
        ok: true,
        input: input,
        isUlip: true,
        fundValueCase: true,
        totalPremiums: totalPremiums,
        factor: null,
        gsv: null,
        loss: null,
        returnedPct: null,
        paidUpSA: null,
        loan: null,
        notes: [
          {
            type: 'info',
            title: 'ULIP after 5 years = your fund value',
            text: 'Once a ULIP completes 5 years, the surrender value is the current value of your units (units x NAV), not a fixed percentage. Log in to your insurer\u2019s portal and check \u201cFund value\u201d or \u201cUnit balance\u201d \u2014 that is the amount you would receive, minus any discontinuation/surrender charge stated in the policy.'
          },
          {
            type: 'plain',
            text: 'Total premiums paid so far: ' + input.yearsPaid + ' year' + (input.yearsPaid === 1 ? '' : 's') + ' x \u20b9' + input.premium.toLocaleString('en-IN') + ' = \u20b9' + totalPremiums.toLocaleString('en-IN') + '. Your fund value can be above or below this depending on market performance.'
          }
        ]
      };
    }

    // Year 1: no GSV at all
    if (input.yearsPaid < 2) {
      notes.push({
        type: 'warn',
        title: 'No guaranteed surrender value in year 1',
        text: 'A regular premium life policy acquires a GSV only after 2 full years of premiums. If you surrender now, the guaranteed amount is \u20b90. Under IRDAI\u2019s 2024 rules an enhanced Special Surrender Value (SSV) may still be payable after 1 year \u2014 ask your insurer for a surrender quotation before deciding.'
      });
      return {
        ok: true,
        input: input,
        isUlip: isUlip,
        fundValueCase: false,
        totalPremiums: totalPremiums,
        factor: 0,
        gsv: 0,
        loss: totalPremiums,
        returnedPct: 0,
        paidUpSA: paidUpSumAssured(input.sumAssured, input.yearsPaid, input.term),
        loan: null,
        notes: notes
      };
    }

    var loss = totalPremiums - gsv;
    var returnedPct = totalPremiums > 0 ? (gsv / totalPremiums) * 100 : 0;
    var loan = gsv > 0 ? { min: Math.round((gsv * 0.8) / 100) * 100, max: Math.round((gsv * 0.9) / 100) * 100 } : null;

    notes.push({
      type: 'plain',
      text: 'Calculated as: total premiums paid \u20b9' + totalPremiums.toLocaleString('en-IN') + ' \u00d7 ' + factor + '% (minimum GSV for policy year ' + input.yearsPaid + ') = \u20b9' + gsv.toLocaleString('en-IN') + '.'
    });

    if (factor < 90) {
      notes.push({
        type: 'info',
        title: 'This is the floor, not the final figure',
        text: 'Insurers must pay the higher of GSV and their own Special Surrender Value (SSV), which includes accrued bonuses. Your actual payout is usually higher \u2014 request a \u201csurrender quotation\u201d from your insurer (it is free).'
      });
    }

    if (loss > 0) {
      notes.push({
        type: 'warn',
        title: 'You would lose \u20b9' + loss.toLocaleString('en-IN'),
        text: 'That is ' + Math.round(100 - returnedPct) + '% of the premiums paid so far. Before surrendering, compare two alternatives: (1) a policy loan of roughly 80\u201390% of the surrender value, which keeps your cover alive, or (2) converting the policy to paid-up, which keeps a reduced cover and still pays at maturity.'
      });
    }

    if (isUlip) {
      notes.push({
        type: 'info',
        title: 'ULIP before 5 years',
        text: 'Within the first 5 years the minimum GSV table above applies, and a discontinuation charge may also be deducted. From year 5 onwards you receive the fund value instead \u2014 recalculate with 5 or more years paid to see that note.'
      });
    }

    if (input.yearsPaid === input.term) {
      notes.push({
        type: 'info',
        title: 'You are in the final policy year',
        text: 'If you are close to maturity, it is usually better to wait \u2014 the maturity payout (sum assured + bonus) is normally higher than the surrender value.'
      });
    }

    return {
      ok: true,
      input: input,
      isUlip: isUlip,
      fundValueCase: false,
      totalPremiums: totalPremiums,
      factor: factor,
      gsv: gsv,
      loss: loss,
      returnedPct: returnedPct,
      paidUpSA: paidUpSumAssured(input.sumAssured, input.yearsPaid, input.term),
      loan: loan,
      notes: notes
    };
  }

  /* ---- Indian numbering: 125000 -> "1,25,000" ---- */
  function formatINR(value, withSymbol) {
    if (value === null || value === undefined || isNaN(value)) return '\u2014';
    var n;
    try {
      n = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(value));
    } catch (e) {
      n = String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return withSymbol === false ? n : '\u20b9' + n;
  }

  return {
    LIMITS: LIMITS,
    gsvFactor: gsvFactor,
    paidUpSumAssured: paidUpSumAssured,
    validate: validate,
    estimate: estimate,
    formatINR: formatINR
  };
});
