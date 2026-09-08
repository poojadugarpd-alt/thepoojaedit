/**
 * Reference-site capture for The Pooja Edit design research.
 * Usage: node design/research/_capture.mjs <stage>
 *   stage 1 = homepages @ 390/768/1440 + structure/links extraction
 *   stage 2 = subpages discovered in stage 1 (listing / PDP / cart)
 *
 * Writes: design/research/screenshots/<site>/<vw>-<page>.png
 *         design/research/raw/<site>.json   (computed styles, links, fonts)
 * No orders, no form submits, no personal data.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

const OUT = new URL("./", import.meta.url).pathname;
const SHOTS = OUT + "screenshots/";
const RAW = OUT + "raw/";
mkdirSync(RAW, { recursive: true });

const SITES = {
  rhode: "https://www.rhodeskin.com/",
  thepoojaedit: "https://thepoojaedit.in/",
  dm2buy: "https://poojadugar.dm2buy.com/",
};
const VIEWPORTS = [
  { w: 390, h: 844, tag: "390" },
  { w: 768, h: 1024, tag: "768" },
  { w: 1440, h: 900, tag: "1440" },
];

const EXTRACT = () => {
  const styleOf = (el) => {
    if (!el) return null;
    const c = getComputedStyle(el);
    return {
      fontFamily: c.fontFamily,
      fontSize: c.fontSize,
      fontWeight: c.fontWeight,
      lineHeight: c.lineHeight,
      letterSpacing: c.letterSpacing,
      textTransform: c.textTransform,
      color: c.color,
      background: c.backgroundColor,
      borderRadius: c.borderRadius,
      border: c.border,
      padding: c.padding,
      margin: c.margin,
      boxShadow: c.boxShadow,
      position: c.position,
    };
  };
  const pick = (sel) => styleOf(document.querySelector(sel));
  const first = (sels) => {
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) return { sel: s, ...styleOf(el), text: (el.textContent || "").trim().slice(0, 80) };
    }
    return null;
  };
  const links = [...document.querySelectorAll("header a, nav a")]
    .map((a) => ({ text: (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40), href: a.getAttribute("href") }))
    .filter((l) => l.text && l.href)
    .slice(0, 40);
  const productHref =
    (document.querySelector('a[href*="/products/"]') ||
      document.querySelector('a[href*="/product/"]') ||
      document.querySelector('a[href*="/collections/"]'))?.getAttribute("href") || null;
  const collectionHref =
    (document.querySelector('a[href*="/collections/"]') ||
      document.querySelector('a[href*="/shop"]') ||
      document.querySelector('a[href*="/all"]'))?.getAttribute("href") || null;
  return {
    url: location.href,
    title: document.title,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyFont: getComputedStyle(document.body).fontFamily,
    bodyColor: getComputedStyle(document.body).color,
    contentWidth: (document.querySelector("main, [role=main], .main-content, #MainContent") || document.body).getBoundingClientRect().width,
    h1: first(["h1", '[class*="hero"] h1', "header h1"]),
    h2: first(["h2", "section h2"]),
    button: first(["button", "a[class*='button']", "a[class*='btn']", ".btn", "[class*='Button']"]),
    productCardTitle: first(['a[href*="/products/"] h2', 'a[href*="/products/"] h3', '[class*="product"] h3', '[class*="product-card"] [class*="title"]']),
    price: first(['[class*="price"]', '.price', '[class*="Price"]', 'span[class*="money"]']),
    nav: pick("header, nav, [class*='header']"),
    links,
    productHref,
    collectionHref,
    fonts: [...new Set([...document.querySelectorAll("*")].slice(0, 4000).map((e) => getComputedStyle(e).fontFamily))].slice(0, 12),
  };
};

async function run(stage) {
  const browser = await chromium.launch();
  for (const [name, url] of Object.entries(SITES)) {
    mkdirSync(SHOTS + name, { recursive: true });
    const raw = existsSync(RAW + name + ".json") ? JSON.parse(readFileSync(RAW + name + ".json", "utf8")) : { site: name, url };

    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36" });
      const page = await ctx.newPage();
      try {
        if (stage === "1") {
          await page.goto(url, { waitUntil: "load", timeout: 60000 });
          await page.waitForTimeout(4500);
          await page.screenshot({ path: `${SHOTS}${name}/${vp.tag}-home.png`, fullPage: true });
          const data = await page.evaluate(EXTRACT);
          raw[`home_${vp.tag}`] = data;
        } else if (stage === "2") {
          const base = new URL(url);
          const targets = [];
          const coll = raw.home_1440?.collectionHref;
          const prod = raw.home_1440?.productHref;
          if (coll) targets.push(["listing", new URL(coll, base).href]);
          if (prod) targets.push(["pdp", new URL(prod, base).href]);
          if (name !== "dm2buy") targets.push(["cart", new URL("/cart", base).href]);
          for (const [label, turl] of targets) {
            await page.goto(turl, { waitUntil: "load", timeout: 60000 }).catch(() => {});
            await page.waitForTimeout(4000);
            await page.screenshot({ path: `${SHOTS}${name}/${vp.tag}-${label}.png`, fullPage: true });
            if (vp.tag === "1440") raw[`${label}`] = await page.evaluate(EXTRACT).catch(() => null);
          }
        }
      } catch (e) {
        raw[`error_${vp.tag}_${stage}`] = String(e).slice(0, 200);
      }
      await ctx.close();
    }
    writeFileSync(RAW + name + ".json", JSON.stringify(raw, null, 2));
    console.log(`${name}: stage ${stage} done`);
  }
  await browser.close();
}

run(process.argv[2] || "1");
