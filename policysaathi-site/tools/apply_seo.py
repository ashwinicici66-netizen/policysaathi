#!/usr/bin/env python3
"""
tools/apply_seo.py — one-shot project finisher for the PolicySaathi static site.

What it does to every HTML page:
  1. adds a mobile nav toggle button + id="main-nav" (needed by assets/app.js)
  2. marks the current page in the nav with aria-current
  3. adds the favicon where missing
  4. adds canonical, Open Graph, Twitter Card, theme-color and robots meta
  5. adds JSON-LD: Organization/WebSite, BreadcrumbList, FAQPage, WebApplication
  6. adds the missing footer link to the "simple words" page
  7. injects assets/surrender.js (calculator pages) and assets/app.js everywhere
It also writes sitemap.xml and robots.txt.

Re-runnable: it strips its own previous output before inserting again.
"""
import re, html, os, json, datetime, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.environ.get("PS_SITE", "https://policysaathi.in")   # change if the domain differs
TODAY = datetime.date.today().isoformat()

FAVICON = ("<link rel=\"icon\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' "
           "viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23123f63'/%3E%3Ctext "
           "x='32' y='44' font-size='34' font-family='Arial' font-weight='bold' fill='%23f59e0b' "
           "text-anchor='middle'%3EPS%3C/text%3E%3C/svg%3E\">")

NAV = [
    ("index.html", "Home"),
    ("surrender-value-calculator.html", "Calculator"),
    ("surrender-value-guide.html", "Guide"),
    ("lic-surrender-value-chart.html", "LIC Chart"),
    ("about.html", "About"),
]

PAGES = [f for f in sorted(os.listdir(ROOT)) if f.endswith(".html") and f != "404.html"]

MARK_BEGIN = "<!--PS-SEO-->"
MARK_END = "<!--/PS-SEO-->"


def strip_tags(s):
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def grab(pattern, text, default=""):
    m = re.search(pattern, text, re.S | re.I)
    return m.group(1).strip() if m else default


def build_nav(fname, text):
    links = []
    for href, label in NAV:
        cur = ' aria-current="page"' if href == fname else ""
        links.append(f'      <a href="{href}"{cur}>{label}</a>')
    nav = "\n".join(links)
    return ('<button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" '
            'aria-controls="main-nav" aria-label="Open menu">\n'
            '        <span class="bar"></span><span class="bar"></span><span class="bar"></span>\n'
            '      </button>\n'
            f'    <nav class="main-nav" id="main-nav" aria-label="Main">\n{nav}\n    </nav>')


def faqs(text):
    out = []
    for block in re.findall(r'<details class="faq"[^>]*>(.*?)</details>', text, re.S):
        q = grab(r"<summary>(.*?)</summary>", block)
        a = strip_tags(re.sub(r"<summary>.*?</summary>", "", block, flags=re.S))
        if q and a:
            out.append({"@type": "Question", "name": strip_tags(q),
                        "acceptedAnswer": {"@type": "Answer", "text": a}})
    return out


def breadcrumb(fname, text):
    bc = grab(r'<div class="breadcrumb">(.*?)</div>', text)
    if not bc:
        return None
    parts = [p.strip() for p in re.split(r"→|&rarr;", strip_tags(bc).replace("→", " → "))]
    items = [{"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/index.html"}]
    if len(parts) > 1:
        items.append({"@type": "ListItem", "position": 2, "name": parts[-1],
                      "item": f"{SITE}/{fname}"})
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}


def seo_block(fname, text):
    title = strip_tags(grab(r"<title>(.*?)</title>", text))
    desc = grab(r'<meta name="description" content="(.*?)"', text)
    desc = html.unescape(desc).replace('"', "&quot;")
    url = f"{SITE}/{'index.html' if fname == 'index.html' else fname}"
    og_type = "website" if fname == "index.html" else "article"

    meta = [
        f'<link rel="canonical" href="{url}">',
        '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">',
        '<meta name="theme-color" content="#123f63">',
        '<meta name="author" content="PolicySaathi">',
        f'<meta property="og:type" content="{og_type}">',
        '<meta property="og:site_name" content="PolicySaathi">',
        f'<meta property="og:locale" content="en_IN">',
        f'<meta property="og:title" content="{title}">',
        f'<meta property="og:description" content="{desc}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{SITE}/assets/og-image.png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{title}">',
        f'<meta name="twitter:description" content="{desc}">',
        f'<meta name="twitter:image" content="{SITE}/assets/og-image.png">',
    ]

    graph = [{
        "@context": "https://schema.org", "@type": ["Organization", "WebSite"],
        "name": "PolicySaathi", "url": SITE + "/",
        "description": "Insurance decisions explained in plain language. Free tools, straight answers.",
        "email": "hello@policysaathi.in", "inLanguage": "en-IN",
    }]

    bc = breadcrumb(fname, text)
    if bc:
        graph.append(bc)

    f = faqs(text)
    if f:
        graph.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": f})

    if "data-calc" in text:
        graph.append({
            "@context": "https://schema.org", "@type": "WebApplication",
            "name": "Surrender Value Calculator", "url": url,
            "applicationCategory": "FinanceApplication", "operatingSystem": "Any",
            "browserRequirements": "Requires JavaScript", "inLanguage": "en-IN",
            "description": "Free life insurance surrender value calculator based on the IRDAI 2024 minimum GSV rules.",
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"},
        })

    ld = json.dumps(graph if len(graph) > 1 else graph[0], ensure_ascii=False, indent=1)
    return MARK_BEGIN + "\n" + "\n".join(meta) + \
        f'\n<script type="application/ld+json">\n{ld}\n</script>\n' + MARK_END


def patch(fname):
    path = os.path.join(ROOT, fname)
    text = open(path, encoding="utf-8").read()
    orig = text

    # 1. remove previous run of this script + previous script tags
    text = re.sub(re.escape(MARK_BEGIN) + r".*?" + re.escape(MARK_END) + r"\n?", "", text, flags=re.S)
    text = re.sub(r'\s*<script src="assets/(app|surrender)\.js"[^>]*></script>', "", text)

    # 2. nav: toggle button + id + aria-current
    text = re.sub(r'<nav class="main-nav".*?</nav>', build_nav(fname, text), text, count=1, flags=re.S)

    # 3. favicon
    if "rel=\"icon\"" not in text:
        text = text.replace('<link rel="stylesheet" href="assets/style.css">',
                            '<link rel="stylesheet" href="assets/style.css">\n' + FAVICON, 1)

    # 4. footer: link to the simple-words page
    if "surrender-value-kya-hai.html" not in text and fname != "surrender-value-kya-hai.html":
        text = text.replace('<a href="surrender-value-guide.html">What is surrender value</a>',
                            '<a href="surrender-value-guide.html">What is surrender value</a>\n'
                            '        <a href="surrender-value-kya-hai.html">Surrender value in simple words</a>', 1)

    # 5. SEO block before </head>
    text = text.replace("</head>", seo_block(fname, text) + "\n</head>", 1)

    # 6. scripts before </body>
    scripts = ""
    if "data-calc" in text:
        scripts += '<script src="assets/surrender.js" defer></script>\n'
    scripts += '<script src="assets/app.js" defer></script>\n'
    text = text.replace("</body>", scripts + "</body>", 1)

    if text != orig:
        open(path, "w", encoding="utf-8").write(text)
        return True
    return False


def write_sitemap():
    prio = {"index.html": "1.0", "surrender-value-calculator.html": "0.9",
            "surrender-value-guide.html": "0.8", "lic-surrender-value-chart.html": "0.8",
            "surrender-value-kya-hai.html": "0.7", "surrender-vs-paid-up-vs-lapse.html": "0.7",
            "about.html": "0.4", "contact.html": "0.3", "privacy.html": "0.2"}
    urls = []
    for p in PAGES:
        loc = f"{SITE}/" if p == "index.html" else f"{SITE}/{p}"
        urls.append(f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{TODAY}</lastmod>\n"
                    f"    <changefreq>monthly</changefreq>\n    <priority>{prio.get(p, '0.5')}</priority>\n  </url>")
    body = ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "\n".join(urls) + "\n</urlset>\n")
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write(body)

    open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8").write(
        "User-agent: *\nAllow: /\n\nSitemap: " + SITE + "/sitemap.xml\n")


if __name__ == "__main__":
    changed = [f for f in PAGES if patch(f)]
    write_sitemap()
    print(f"Site: {SITE}")
    print(f"Patched {len(changed)}/{len(PAGES)} pages: {', '.join(changed)}")
    print("Wrote sitemap.xml and robots.txt")
