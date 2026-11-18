# PolicySaathi — surrender value calculator + guides

A static, dependency-free website: 9 HTML pages, one stylesheet, two small JS files.
Everything (including the calculator) runs in the visitor's browser — no backend,
no cookies, no data collection.

## Project structure

```
index.html                        Home: hero + calculator + trust strip + FAQ
surrender-value-calculator.html   Standalone calculator page + GSV table + FAQ
surrender-value-guide.html        Long-form guide (GSV, SSV, paid-up, bonuses)
surrender-value-kya-hai.html      "Surrender value in simple words" — 2-minute version
surrender-vs-paid-up-vs-lapse.html Comparison of the three ways to stop a policy
lic-surrender-value-chart.html    Year-by-year GSV chart (15-year / 20-year policies)
about.html / contact.html / privacy.html
404.html                          Friendly not-found page
sitemap.xml / robots.txt          SEO
assets/
  style.css                       Whole design system (tokens → components → dark mode → print)
  surrender.js                    Pure calculation layer (browser + Node/CommonJS)
  app.js                          UI layer: calculator, mobile nav, ads, enhancements
  og-image.png                    1200x630 social share image
tools/
  apply_seo.py                    Re-runnable patcher: nav toggle, meta/OG/JSON-LD, sitemap
  make_og_image.py                Regenerates assets/og-image.png (no dependencies)
```

## Run locally

Any static server works:

```bash
python3 -m http.server 8080        # then open http://localhost:8080
```

## How the calculator works

`assets/surrender.js` implements the minimum Guaranteed Surrender Value from the
IRDAI (Insurance Products) Regulations, 2024 (Schedule I):

| Surrender in policy year | Minimum GSV (% of total premiums paid) |
|---|---|
| 1 | 0 (an enhanced SSV may apply after 1 year) |
| 2 | 30% |
| 3 | 35% |
| 4–7 | 50% |
| 8 → final years | rises progressively, in 5% steps |
| last 2 years | at least 90% |

The insurer pays the **higher** of GSV and its own SSV, so the tool shows the floor.
Paid-up cover uses the reduced paid-up formula: `SA × (years paid ÷ premium paying term)`.
ULIPs: within 5 years the GSV table applies; from year 5 the payout is the fund value.

Test the maths without a browser:

```bash
node -e "const s=require('./assets/surrender.js'); console.log(s.estimate({premium:50000,term:15,yearsPaid:5}))"
```

## Editing pages

Pages are plain HTML. Reusable bits: `.calc`, `.card`, `.callout(.info)`, `table.data`
inside `.table-scroll`, `details.faq`, `.cta-band`, `.trust-strip`.

After editing page titles/descriptions or FAQs, regenerate the SEO block:

```bash
PS_SITE=https://policysaathi.in python3 tools/apply_seo.py
```

The script strips its previous output first, so it is safe to run repeatedly.
Set `PS_SITE` to your real domain (it is baked into canonical URLs, og:url and sitemap.xml).

## Going live

1. **Domain:** set `PS_SITE` and re-run `tools/apply_seo.py`.
2. **Ads (AdSense):** paste the AdSense snippet inside any `<div class="ad-slot">`.
   The placeholder styling disappears automatically once real ad code is detected;
   empty placeholders are hidden so the layout stays clean.
3. **Hosting:** upload the folder to any static host.
   - Netlify/Vercel/Cloudflare Pages: zero config; `404.html` is picked up automatically.
   - GitHub Pages: same; set the repo to serve from the folder root.
   - Apache/Nginx: add `ErrorDocument 404 /404.html`.
4. **Search Console:** submit `https://YOUR-DOMAIN/sitemap.xml`.

## Content policy

All figures are estimates of the regulatory minimum. Every page states that the
insurer's own quotation is final, and the site is not affiliated with LIC or any
insurer. Keep those disclaimers when editing content.

## GitHub Pages (free hosting) — exact steps

Already prepared in this folder: `.nojekyll` (skips Jekyll), `404.html`, relative links
everywhere (so it also works on `username.github.io/repo/` sub-paths).

**Option A — browser me (sabse aasan):**
1. github.com → New repository → name e.g. `policysaathi` → Public → Create (README mat chunein)
2. Repo page par "uploading an existing file" link → poora folder drag-drop (`.nojekyll` zaroor include karein) → Commit
3. Settings → Pages → Source: "Deploy from a branch" → branch `main`, folder `/ (root)` → Save
4. 1–2 minute me site live: `https://<username>.github.io/<repo>/`

**Option B — git commands (repo already committed in this workspace):**
```bash
git remote add origin https://github.com/<USERNAME>/<REPO>.git
git branch -M main
git push -u origin main
```
Phir upar wala step 3 (Settings → Pages).

**Custom domain (policysaathi.in):**
1. Repo root me file banayein: `CNAME` content sirf `policysaathi.in`
   (ya Settings → Pages → Custom domain me type karein — GitHub khud CNAME file bana dega)
2. Domain registrar ke DNS me:
   - `A` records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `www` ke liye `CNAME` → `<USERNAME>.github.io`
3. DNS propagate hone par (kuch minutes se 48 ghante) Settings → Pages me
   "Enforce HTTPS" enable karein.
