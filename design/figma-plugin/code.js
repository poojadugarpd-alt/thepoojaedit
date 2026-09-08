/* ============================================================================
 * The Pooja Edit + Thrift Store — Figma Mockup Builder
 * ----------------------------------------------------------------------------
 * Builds an editable Figma file: token variables + text styles, component sets
 * with variants, and Auto Layout frames for every required storefront screen and
 * state (mobile / tablet / desktop), plus prototype wiring for the core flows.
 *
 * Run once in a fresh Figma file:  Plugins → Development → Import plugin from
 * manifest → pick manifest.json → Run "The Pooja Edit — Mockup Builder".
 *
 * Everything it makes is native, editable Figma: no images-in-frames stand in
 * for the design. Reference screenshots are added as labelled placeholders on
 * the Research page — drag the PNGs from design/research/screenshots/ onto them,
 * or use the html.to.design plugin for a reference area.
 * ==========================================================================*/

(async () => {
  const LOG = [];
  const log = (m) => { LOG.push(m); console.log(m); };

  try {
    /* ---- 0. fonts ---------------------------------------------------------- */
    const FONTS = [
      { family: "Inter", style: "Regular" },
      { family: "Inter", style: "Medium" },
      { family: "Inter", style: "Semi Bold" },
      { family: "Inter", style: "Bold" },
    ];
    for (const f of FONTS) await figma.loadFontAsync(f);
    const F = {
      reg: { family: "Inter", style: "Regular" },
      med: { family: "Inter", style: "Medium" },
      semi: { family: "Inter", style: "Semi Bold" },
      bold: { family: "Inter", style: "Bold" },
    };
    log("fonts loaded");

    /* ---- 1. tokens ------------------------------------------------------------
     * Colours as real Figma variables (collection "tokens") + literal helpers.
     * ------------------------------------------------------------------------*/
    const hex = (h) => {
      const s = h.replace("#", "");
      return {
        r: parseInt(s.slice(0, 2), 16) / 255,
        g: parseInt(s.slice(2, 4), 16) / 255,
        b: parseInt(s.slice(4, 6), 16) / 255,
      };
    };

    const COL = {
      ground: "#FFFFFF",
      fill: "#F1F0ED",
      ink: "#625F59",
      "ink-strong": "#403E39",
      "ink-soft": "#6A6762",
      line: "#D8D6D1",
      "line-strong": "#C4C4C4",
      ok: "#2F5233",
      "ok-bg": "#E4EDE2",
      wait: "#7A5A1E",
      "wait-bg": "#F3E7CF",
      stop: "#8A3320",
      "stop-bg": "#F0DFDA",
    };

    let varCol, modeId;
    const VARS = {};
    try {
      varCol = figma.variables.createVariableCollection("tokens");
      modeId = varCol.modes[0].modeId;
      for (const [name, h] of Object.entries(COL)) {
        const v = figma.variables.createVariable("color/" + name, varCol, "COLOR");
        v.setValueForMode(modeId, hex(h));
        VARS[name] = v;
      }
      const NUMS = { "space/1": 4, "space/2": 8, "space/3": 12, "space/4": 16, "space/5": 20, "space/6": 24, "space/8": 32, "space/10": 40, "space/14": 56, "space/18": 72, "space/24": 96, "radius/media": 12, "radius/bar": 14, "radius/input": 10, "radius/pill": 999 };
      for (const [name, n] of Object.entries(NUMS)) {
        const v = figma.variables.createVariable(name, varCol, "FLOAT");
        v.setValueForMode(modeId, n);
      }
      log("variables created");
    } catch (e) {
      log("variables skipped: " + e);
    }

    const solid = (h) => [{ type: "SOLID", color: hex(h) }];
    const boundSolid = (name) => {
      const p = { type: "SOLID", color: hex(COL[name]) };
      if (VARS[name]) p.boundVariables = { color: { type: "VARIABLE_ALIAS", id: VARS[name].id } };
      return [p];
    };

    /* ---- 2. text styles --------------------------------------------------- */
    const TS = {};
    const mkText = (name, { font, size, lh, tracking = 0, upper = false, color = "ink-strong" }) => {
      const st = figma.createTextStyle();
      st.name = name;
      st.fontName = font;
      st.fontSize = size;
      st.lineHeight = lh ? { value: lh, unit: "PIXELS" } : { unit: "AUTO" };
      st.letterSpacing = { value: tracking, unit: "PERCENT" };
      st.textCase = upper ? "UPPER" : "ORIGINAL";
      TS[name] = { style: st, color };
      return st;
    };
    mkText("display", { font: F.reg, size: 52, lh: 55, tracking: -2, color: "ink-strong" });
    mkText("display/mobile", { font: F.reg, size: 40, lh: 42, tracking: -2, color: "ink-strong" });
    mkText("h2", { font: F.reg, size: 30, lh: 34, tracking: -1, color: "ink-strong" });
    mkText("h3", { font: F.reg, size: 20, lh: 24, color: "ink-strong" });
    mkText("lead", { font: F.reg, size: 18, lh: 27, color: "ink" });
    mkText("body", { font: F.reg, size: 16, lh: 23, tracking: 1, color: "ink" });
    mkText("body-sm", { font: F.reg, size: 14, lh: 20, tracking: 1, color: "ink" });
    mkText("label", { font: F.bold, size: 13, lh: 17, tracking: 6, upper: true, color: "ink-strong" });
    mkText("eyebrow", { font: F.bold, size: 12, lh: 16, tracking: 8, upper: true, color: "ink-soft" });
    mkText("nav", { font: F.bold, size: 13, lh: 13, tracking: 9, upper: true, color: "ink" });
    mkText("price", { font: F.reg, size: 16, lh: 20, tracking: 1, color: "ink-strong" });
    mkText("caption", { font: F.reg, size: 12, lh: 16, color: "ink-soft" });
    log("text styles created");

    /* ---- 3. node helpers ----------------------------------------------------*/
    const setAL = (n, o = {}) => {
      n.layoutMode = o.dir || "VERTICAL";
      n.primaryAxisSizingMode = o.primary || "AUTO";
      n.counterAxisSizingMode = o.counter || "AUTO";
      n.itemSpacing = o.gap != null ? o.gap : 0;
      const p = o.pad != null ? o.pad : 0;
      n.paddingTop = o.pt != null ? o.pt : p;
      n.paddingBottom = o.pb != null ? o.pb : p;
      n.paddingLeft = o.pl != null ? o.pl : p;
      n.paddingRight = o.pr != null ? o.pr : p;
      if (o.primaryAlign) n.primaryAxisAlignItems = o.primaryAlign;
      if (o.counterAlign) n.counterAxisAlignItems = o.counterAlign;
      if (o.wrap) n.layoutWrap = "WRAP";
      return n;
    };
    const frame = (name, o = {}) => {
      const f = figma.createFrame();
      f.name = name;
      f.fills = o.bg ? boundSolid(o.bg) : [];
      setAL(f, o);
      if (o.counter === undefined && o.w) f.counterAxisSizingMode = "FIXED";
      if (o.w || o.h) f.resize(o.w || f.width, o.h || f.height);
      if (o.radius) f.cornerRadius = o.radius;
      if (o.clip != null) f.clipsContent = o.clip;
      return f;
    };
    const stretch = (n) => { n.layoutAlign = "STRETCH"; return n; };
    const grow = (n) => { n.layoutGrow = 1; return n; };
    const txt = (chars, styleName, opts = {}) => {
      const t = figma.createText();
      const spec = TS[styleName] || TS["body"];
      t.fontName = spec.style.fontName;
      t.fontSize = spec.style.fontSize;
      t.lineHeight = spec.style.lineHeight;
      t.letterSpacing = spec.style.letterSpacing;
      t.textCase = spec.style.textCase;
      t.characters = String(chars);
      t.fills = boundSolid(opts.color || spec.color);
      if (opts.w) { t.textAutoResize = "HEIGHT"; t.resize(opts.w, t.height); }
      else t.textAutoResize = "WIDTH_AND_HEIGHT";
      if (opts.align) t.textAlignHorizontal = opts.align;
      t.name = styleName + ": " + String(chars).slice(0, 24);
      return t;
    };
    const rect = (w, h, o = {}) => {
      const r = figma.createRectangle();
      r.resize(w, h);
      r.fills = boundSolid(o.bg || "fill");
      if (o.radius != null) r.cornerRadius = o.radius;
      r.name = o.name || "rect";
      return r;
    };
    const hairline = () => { const r = rect(100, 1, { bg: "line", name: "hairline" }); stretch(r); return r; };
    const photo = (w, h, label = "Product photo", o = {}) => {
      const f = frame(o.name || "photo", { w, h, bg: "fill", radius: o.radius != null ? o.radius : 12, clip: true, dir: "VERTICAL", primary: "FIXED", counter: "FIXED", primaryAlign: "CENTER", counterAlign: "CENTER" });
      f.resize(w, h);
      f.appendChild(txt(label, "caption", { color: "ink-soft" }));
      return f;
    };
    const spacer = (h) => { const r = figma.createRectangle(); r.resize(10, h); r.fills = []; r.name = "spacer " + h; return r; };

    /* ---- 4. components ---------------------------------------------------- */
    const registry = {};

    // -- Button set: Variant × State
    const mkButton = (variant, state, label) => {
      const c = figma.createComponent();
      c.name = `Variant=${variant}, State=${state}`;
      const isPill = variant === "pill";
      const isGhost = variant === "ghost";
      setAL(c, { dir: "HORIZONTAL", primary: "AUTO", counter: "AUTO", gap: 8, pt: isPill || isGhost ? 14 : 2, pb: isPill || isGhost ? 14 : 2, pl: isPill || isGhost ? 28 : 0, pr: isPill || isGhost ? 28 : 0, primaryAlign: "CENTER", counterAlign: "CENTER" });
      c.cornerRadius = variant === "rail" ? 999 : isPill || isGhost ? 999 : 0;
      if (isPill) c.fills = boundSolid("ink-strong");
      else if (isGhost) { c.fills = []; c.strokes = boundSolid("line-strong"); c.strokeWeight = 1; }
      else c.fills = [];
      if (state === "disabled") c.opacity = 0.4;
      if (state === "hover") c.opacity = isPill ? 0.84 : 1;
      const t = txt(label, isPill || isGhost ? "body-sm" : "label", { color: isPill ? "ground" : "ink-strong" });
      if (variant === "textlink") { /* underline via a hairline child */ }
      c.appendChild(t);
      if (variant === "textlink") {
        const u = rect(40, 1, { bg: "ink-strong", name: "underline" });
        c.appendChild(u);
        setAL(c, { dir: "VERTICAL", gap: 2, primary: "AUTO", counter: "AUTO" });
      }
      return c;
    };
    {
      const parts = [];
      for (const v of ["pill", "ghost", "textlink"]) for (const s of ["default", "hover", "disabled"]) parts.push(mkButton(v, s, v === "pill" ? "Add to cart" : v === "ghost" ? "Load more" : "All new pieces"));
      const set = figma.combineAsVariants(parts, figma.currentPage);
      set.name = "Button";
      registry.Button = set;
    }

    // -- Badge set: Kind
    const mkBadge = (kind, label, fg, bg) => {
      const c = figma.createComponent();
      c.name = `Kind=${kind}`;
      setAL(c, { dir: "HORIZONTAL", gap: 6, pt: 5, pb: 5, pl: 10, pr: 10, primaryAlign: "CENTER", counterAlign: "CENTER" });
      c.cornerRadius = 999;
      c.fills = boundSolid(bg);
      const t = txt(label, "eyebrow", { color: fg });
      c.appendChild(t);
      return c;
    };
    {
      const parts = [
        mkBadge("one-of-one", "One of one", "ink-strong", "ground"),
        mkBadge("sold", "Sold", "ink-strong", "ground"),
        mkBadge("payment-received", "Payment received", "ok", "ok-bg"),
        mkBadge("pending", "Pending confirmation", "wait", "wait-bg"),
        mkBadge("failed", "Payment failed", "stop", "stop-bg"),
        mkBadge("final-sale", "Final sale", "ink-soft", "fill"),
        mkBadge("returnable", "Returnable", "ink-soft", "fill"),
      ];
      const set = figma.combineAsVariants(parts, figma.currentPage);
      set.name = "Badge";
      registry.Badge = set;
    }

    // -- Form field set: State
    const mkField = (state) => {
      const c = figma.createComponent();
      c.name = `State=${state}`;
      setAL(c, { dir: "VERTICAL", gap: 6, primary: "AUTO", counter: "FIXED" });
      c.resize(320, 10);
      c.fills = [];
      c.appendChild(txt("Full name", "label", { color: "ink-soft" }));
      const box = frame("input", { w: 320, h: 44, bg: "ground", radius: 10, dir: "HORIZONTAL", primary: "FIXED", counter: "FIXED", pl: 14, pr: 14, counterAlign: "CENTER" });
      box.resize(320, 44);
      box.strokes = boundSolid(state === "error" ? "stop" : state === "focus" ? "ink-strong" : "line");
      box.strokeWeight = state === "focus" ? 2 : 1;
      box.appendChild(txt(state === "default" ? "" : "Priya Sharma", "body", { color: state === "default" ? "ink-soft" : "ink" }));
      stretch(box);
      c.appendChild(box);
      if (state === "error") c.appendChild(txt("Enter your full name as on the delivery address", "caption", { color: "stop" }));
      return c;
    };
    {
      const set = figma.combineAsVariants(["default", "focus", "error"].map(mkField), figma.currentPage);
      set.name = "Field";
      registry.Field = set;
    }

    // -- Product card set: Catalog × Tag
    const mkCard = (catalog, tag) => {
      const c = figma.createComponent();
      c.name = `Catalog=${catalog}, Tag=${tag}`;
      setAL(c, { dir: "VERTICAL", gap: 14, primary: "AUTO", counter: "FIXED" });
      c.resize(180, 10);
      c.fills = [];
      const panel = photo(180, 225, catalog === "thrift" ? "Thrift piece photo" : "Apparel photo", { name: "image panel" });
      panel.resize(180, 225);
      stretch(panel);
      if (tag !== "none") {
        const b = registry.Badge.defaultVariant.createInstance();
        b.setProperties({ Kind: tag === "sold" ? "sold" : "one-of-one" });
        b.x = 12; b.y = 12;
        b.name = "tag";
        // place tag inside panel
        panel.layoutMode = "NONE";
        panel.appendChild(b);
        b.x = 12; b.y = 12;
      }
      const row = frame("name / price", { dir: "HORIZONTAL", primary: "FIXED", counter: "AUTO", gap: 12, counterAlign: "MIN" });
      stretch(row);
      const nm = txt(catalog === "thrift" ? "ON THE RACKS GREEN DRESS" : "RAKTIMA KURTI", "label");
      nm.layoutGrow = 1; nm.textAutoResize = "HEIGHT"; nm.resize(100, nm.height);
      row.appendChild(nm);
      row.appendChild(txt(catalog === "thrift" ? "₹500" : "₹1,499", "price"));
      c.appendChild(row);
      c.appendChild(txt(catalog === "thrift" ? "Good · labelled M" : "Cotton", "body-sm", { color: "ink-soft" }));
      return c;
    };
    {
      const parts = [];
      for (const cat of ["edit", "thrift"]) for (const tag of ["none", "one-of-one", "sold"]) {
        if (cat === "edit" && tag !== "none") continue;
        parts.push(mkCard(cat, tag));
      }
      const set = figma.combineAsVariants(parts, figma.currentPage);
      set.name = "ProductCard";
      registry.ProductCard = set;
    }

    // -- Announcement bar
    {
      const c = figma.createComponent();
      c.name = "AnnouncementBar";
      setAL(c, { dir: "HORIZONTAL", primary: "FIXED", counter: "FIXED", pt: 10, pb: 10, primaryAlign: "CENTER", counterAlign: "CENTER" });
      c.resize(366, 38);
      c.cornerRadius = 14;
      c.fills = boundSolid("fill");
      c.appendChild(txt("Considered clothing, new and second-life", "eyebrow", { color: "ink-soft" }));
      registry.Announcement = c;
    }

    // -- Header set: Breakpoint
    const mkHeader = (bp) => {
      const c = figma.createComponent();
      c.name = `Breakpoint=${bp}`;
      const w = bp === "desktop" ? 1392 : 366;
      setAL(c, { dir: "HORIZONTAL", primary: "FIXED", counter: "FIXED", pt: bp === "desktop" ? 22 : 16, pb: bp === "desktop" ? 22 : 16, pl: 20, pr: 20, gap: 24, counterAlign: "CENTER" });
      c.resize(w, bp === "desktop" ? 84 : 60);
      c.cornerRadius = 14;
      c.fills = boundSolid("fill");
      c.appendChild(txt("THE POOJA EDIT", "nav", { color: "ink-strong" }));
      if (bp === "desktop") {
        c.appendChild(txt("The Pooja Edit", "nav"));
        c.appendChild(txt("Thrift Store", "nav"));
      }
      const grp = frame("spacer", { dir: "HORIZONTAL" }); grow(grp); grp.fills = []; c.appendChild(grp);
      if (bp === "desktop") { c.appendChild(txt("Search", "nav")); c.appendChild(txt("Account", "nav")); }
      c.appendChild(txt(bp === "desktop" ? "Bag (2)" : "☰", "nav"));
      return c;
    };
    {
      const set = figma.combineAsVariants(["mobile", "desktop"].map(mkHeader), figma.currentPage);
      set.name = "Header";
      registry.Header = set;
    }

    // -- Footer (mobile-ish, reusable)
    {
      const c = figma.createComponent();
      c.name = "Footer";
      setAL(c, { dir: "VERTICAL", primary: "AUTO", counter: "FIXED", pad: 24, gap: 16, bg: "fill" });
      c.resize(390, 10);
      c.appendChild(txt("The Pooja Edit", "h3"));
      c.appendChild(txt("New pieces and second lives, made and kept in Jaipur.", "body-sm", { color: "ink-soft" }));
      for (const g of ["Shop", "Help", "Studio"]) {
        const col = frame(g, { gap: 8 }); stretch(col);
        col.appendChild(txt(g, "label"));
        col.appendChild(txt("Link\nLink\nLink", "body-sm", { color: "ink-soft" }));
        c.appendChild(col);
      }
      c.appendChild(hairline());
      c.appendChild(txt("© 2026 The Pooja Edit. All prices in INR, inclusive of taxes where applicable.", "caption"));
      registry.Footer = c;
    }
    log("components built");

    /* ---- 5. screen scaffolding helpers --------------------------------------*/
    const inst = (setName, props) => {
      const set = registry[setName];
      const i = (set.type === "COMPONENT_SET" ? set.defaultVariant : set).createInstance();
      if (props && set.type === "COMPONENT_SET") { try { i.setProperties(props); } catch (e) { log("setProps " + setName + " " + e); } }
      return i;
    };
    const screen = (name, { w = 390, bp = "mobile" } = {}) => {
      const s = frame(name, { w, bg: "ground", dir: "VERTICAL", primary: "AUTO", counter: "FIXED", gap: 0 });
      s.resize(w, 100);
      s.name = name;
      // sand bars
      const bar1 = frame("announcement inset", { dir: "HORIZONTAL", pad: 12, primary: "FIXED", counter: "AUTO" }); bar1.resize(w, 62); stretch(bar1); bar1.fills = [];
      const a = inst("Announcement"); a.resize(w - 24, 38); grow(a); bar1.appendChild(a);
      s.appendChild(bar1);
      const bar2 = frame("header inset", { dir: "HORIZONTAL", pl: 12, pr: 12, pb: 8, primary: "FIXED", counter: "AUTO" }); bar2.resize(w, 76); stretch(bar2); bar2.fills = [];
      const h = inst("Header", { Breakpoint: bp }); h.resize(w - 24, bp === "desktop" ? 84 : 60); grow(h); bar2.appendChild(h);
      s.appendChild(bar2);
      return s;
    };
    const section = (parent, { gap = 16, pad = 20, fill } = {}) => {
      const sec = frame("section", { dir: "VERTICAL", gap, pl: pad, pr: pad, pt: 40, pb: 40, primary: "AUTO", counter: "FIXED", bg: fill });
      sec.resize(parent.width, 10);
      stretch(sec);
      parent.appendChild(sec);
      return sec;
    };
    const railOf = (parent, catalog, count = 4) => {
      const rail = frame("rail", { dir: "HORIZONTAL", gap: 14, primary: "AUTO", counter: "AUTO", clip: false });
      for (let i = 0; i < count; i++) {
        const card = inst("ProductCard", catalog === "thrift" ? { Catalog: "thrift", Tag: i === 3 ? "sold" : i === 0 ? "one-of-one" : "none" } : { Catalog: "edit", Tag: "none" });
        card.resize(150, card.height);
        rail.appendChild(card);
      }
      parent.appendChild(rail);
      return rail;
    };
    const grid = (parent, catalog, cols, rows) => {
      const g = frame("product grid", { dir: "HORIZONTAL", gap: 12, wrap: true, primary: "FIXED", counter: "AUTO" });
      g.resize(parent.width - 40, 10); stretch(g); g.name = "grid";
      const cw = Math.floor((parent.width - 40 - 12 * (cols - 1)) / cols);
      for (let i = 0; i < cols * rows; i++) {
        const card = inst("ProductCard", catalog === "thrift" ? { Catalog: "thrift", Tag: i % 5 === 4 ? "sold" : i % 3 === 0 ? "one-of-one" : "none" } : { Catalog: "edit", Tag: "none" });
        card.resize(cw, card.height);
        g.appendChild(card);
      }
      parent.appendChild(g);
      return g;
    };
    const pill = (label) => { const b = inst("Button", { Variant: "pill", State: "default" }); b.children[0] && (b.children[0].characters = label); return b; };
    const ghost = (label) => { const b = inst("Button", { Variant: "ghost", State: "default" }); b.children[0] && (b.children[0].characters = label); return b; };
    const tlink = (label) => { const b = inst("Button", { Variant: "textlink", State: "default" }); const tn = b.findOne((n) => n.type === "TEXT"); if (tn) tn.characters = label; return b; };
    const rowBetween = (parent, leftNode, rightNode) => {
      const r = frame("row", { dir: "HORIZONTAL", primary: "FIXED", counter: "AUTO", gap: 12, counterAlign: "CENTER" });
      stretch(r); r.appendChild(leftNode); const sp = frame("sp", { dir: "HORIZONTAL" }); grow(sp); sp.fills = []; r.appendChild(sp); r.appendChild(rightNode);
      parent.appendChild(r);
      return r;
    };
    const kv = (parent, k, v) => {
      const r = frame("kv", { dir: "HORIZONTAL", primary: "FIXED", counter: "AUTO", gap: 12, pt: 8, pb: 8 });
      stretch(r);
      r.appendChild(txt(k, "body-sm", { color: "ink-soft" }));
      const sp = frame("sp", { dir: "HORIZONTAL" }); grow(sp); sp.fills = []; r.appendChild(sp);
      r.appendChild(txt(v, "body-sm", { color: "ink" }));
      parent.appendChild(r);
      parent.appendChild(hairline());
      return r;
    };

    /* ---- 6. pages ------------------------------------------------------------*/
    const PAGE_NAMES = [
      "1 · Research & References",
      "2 · Foundations",
      "3 · Components",
      "4 · Mobile Storefront",
      "5 · Desktop Storefront",
      "6 · Responsive Examples",
      "7 · Prototype & Handoff",
    ];
    const pages = {};
    const first = figma.currentPage;
    first.name = PAGE_NAMES[0];
    pages[0] = first;
    for (let i = 1; i < PAGE_NAMES.length; i++) { const p = figma.createPage(); p.name = PAGE_NAMES[i]; pages[i] = p; }
    // move component sets onto the Components page, tidy
    figma.currentPage = pages[2];
    let cx = 0;
    for (const key of Object.keys(registry)) {
      const node = registry[key];
      pages[2].appendChild(node);
      node.x = cx; node.y = 0;
      cx += node.width + 80;
    }
    log("pages + components arranged");

    /* ---- 7. Foundations --------------------------------------------------- */
    {
      figma.currentPage = pages[1];
      const root = frame("Foundations", { dir: "VERTICAL", gap: 48, pad: 48, bg: "ground" });
      root.resize(1200, 10);
      root.appendChild(txt("The Pooja Edit — Foundations", "h2"));

      const colWrap = frame("Colour tokens", { dir: "VERTICAL", gap: 12 });
      colWrap.appendChild(txt("Colour", "label"));
      const swGrid = frame("swatches", { dir: "HORIZONTAL", gap: 16, wrap: true, primary: "FIXED", counter: "AUTO" });
      swGrid.resize(1100, 10); stretch(swGrid);
      for (const [name, h] of Object.entries(COL)) {
        const s = frame("swatch " + name, { dir: "VERTICAL", gap: 6, w: 200 });
        const chip = rect(200, 64, { bg: name, radius: 10 });
        chip.strokes = boundSolid("line"); chip.strokeWeight = 1;
        s.appendChild(chip);
        s.appendChild(txt("--" + name, "body-sm"));
        s.appendChild(txt(h, "caption"));
        swGrid.appendChild(s);
      }
      colWrap.appendChild(swGrid);
      root.appendChild(colWrap);

      const typeWrap = frame("Type scale", { dir: "VERTICAL", gap: 14 });
      typeWrap.appendChild(txt("Type — Inter (Helvetica Neue on macOS)", "label"));
      for (const n of ["display", "h2", "h3", "lead", "body", "body-sm", "label", "eyebrow", "nav", "price", "caption"]) {
        const r = frame("type " + n, { dir: "HORIZONTAL", gap: 24, counterAlign: "CENTER" });
        r.appendChild(txt(n, "caption", { color: "ink-soft" }));
        r.appendChild(txt(n === "label" || n === "eyebrow" || n === "nav" ? "The Pooja Edit" : "The Pooja Edit + Thrift Store", n));
        typeWrap.appendChild(r);
      }
      root.appendChild(typeWrap);

      const spWrap = frame("Spacing scale", { dir: "VERTICAL", gap: 10 });
      spWrap.appendChild(txt("Spacing (4-based)", "label"));
      const spRow = frame("sp", { dir: "HORIZONTAL", gap: 12, counterAlign: "MAX" });
      for (const n of [4, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96]) {
        const b = frame("s" + n, { dir: "VERTICAL", gap: 4, counterAlign: "CENTER" });
        const bar = rect(24, n, { bg: "ink-soft", radius: 2 });
        b.appendChild(bar); b.appendChild(txt(String(n), "caption"));
        spRow.appendChild(b);
      }
      spWrap.appendChild(spRow);
      root.appendChild(spWrap);

      const rWrap = frame("Radius", { dir: "VERTICAL", gap: 10 });
      rWrap.appendChild(txt("Radius — 12 media · 14 bars · 10 inputs · 999 pills", "label"));
      const rRow = frame("r", { dir: "HORIZONTAL", gap: 16 });
      for (const [nm, v] of [["media", 12], ["bar", 14], ["input", 10], ["pill", 999]]) {
        const b = frame("rad " + nm, { dir: "VERTICAL", gap: 4, counterAlign: "CENTER" });
        const box = rect(80, 56, { bg: "fill", radius: v });
        box.strokes = boundSolid("line"); box.strokeWeight = 1;
        b.appendChild(box); b.appendChild(txt(nm + " " + v, "caption"));
        rRow.appendChild(b);
      }
      rWrap.appendChild(rRow);
      root.appendChild(rWrap);

      pages[1].appendChild(root);
    }
    log("foundations built");

    /* ---- 8. Mobile screens --------------------------------------------------*/
    figma.currentPage = pages[3];
    const mob = {};
    let my = 0;
    const place = (page, node, gap = 80) => { node.x = my ? 0 : 0; node.y = my; my += node.height + gap; page.appendChild(node); };
    // layout mobile screens left→right in rows of 4
    let mcol = 0, mrow = 0;
    const placeMobile = (node) => { node.x = mcol * 470; node.y = mrow * 1500; pages[3].appendChild(node); mcol++; if (mcol === 4) { mcol = 0; mrow++; } };

    // 8.1 Home
    {
      const s = screen("Mobile / Home");
      const hero = section(s, { gap: 20 });
      hero.appendChild(txt("The Pooja Edit + Thrift Store", "eyebrow"));
      hero.appendChild(txt("One brand, two ways to shop.", "display/mobile"));
      hero.appendChild(txt("New, slow-made apparel from the studio, and pre-loved one-of-one pieces. One cart holds both — each keeps its own return policy at checkout.", "lead", { w: 320 }));
      const ctas = frame("ctas", { dir: "HORIZONTAL", gap: 20, counterAlign: "CENTER" });
      ctas.appendChild(pill("Shop The Pooja Edit"));
      ctas.appendChild(tlink("Shop Thrift Store"));
      hero.appendChild(ctas);
      const band = section(s, { gap: 12 });
      band.appendChild(photo(350, 260, "Editorial image — the piece"));
      rowBetween(band, txt("RAKTIMA KURTI", "label"), tlink("Shop the piece"));
      const r1 = section(s, { gap: 10 });
      r1.appendChild(txt("New apparel", "eyebrow"));
      rowBetween(r1, txt("New in", "h3"), tlink("All new pieces"));
      railOf(r1, "edit");
      const split = section(s, { gap: 24, fill: "fill" });
      for (const [t, b, c] of [["The Pooja Edit", "Original apparel — kurtis, co-ord sets and linen, in real sizes and colours.", "View the collection"], ["Thrift Store", "Pre-loved and one-of-one. Every piece listed with its condition, measurements and any flaws.", "Browse the rails"]]) {
        const blk = frame("edit block", { gap: 12 }); stretch(blk);
        blk.appendChild(photo(350, 300, "Catalogue image"));
        blk.appendChild(txt(t, "h3"));
        blk.appendChild(txt(b, "body-sm", { color: "ink", w: 320 }));
        blk.appendChild(tlink(c));
        split.appendChild(blk);
      }
      const r2 = section(s, { gap: 10 });
      r2.appendChild(txt("Pre-loved", "eyebrow"));
      rowBetween(r2, txt("From the Thrift Store", "h3"), tlink("All pre-loved"));
      railOf(r2, "thrift");
      const ig = section(s, { gap: 12 });
      rowBetween(ig, txt("On Instagram", "h3"), pill("Follow"));
      const igr = frame("ig", { dir: "HORIZONTAL", gap: 8 });
      for (let i = 0; i < 3; i++) igr.appendChild(photo(110, 110, "@poojadugar_"));
      ig.appendChild(igr);
      const nl = section(s, { gap: 12 });
      nl.appendChild(txt("Newsletter", "eyebrow"));
      nl.appendChild(txt("Get the drop list", "h3"));
      nl.appendChild(txt("One email when new pieces and thrift restocks go live. No noise.", "body-sm", { color: "ink" }));
      const nf = inst("Field", { State: "default" }); nf.resize(350, nf.height); stretch(nf); nl.appendChild(nf);
      nl.appendChild(pill("Notify me"));
      const ft = inst("Footer"); ft.resize(390, ft.height); stretch(ft); s.appendChild(ft);
      mob.home = s; placeMobile(s);
    }

    // 8.2 Edit listing
    const listing = (name, catalog, subLabel, sub) => {
      const s = screen(name);
      const head = section(s, { gap: 12 });
      head.appendChild(txt(subLabel, "eyebrow"));
      head.appendChild(txt(catalog === "thrift" ? "Thrift Store" : "The Pooja Edit", "display/mobile"));
      head.appendChild(txt(sub, "body-sm", { color: "ink", w: 330 }));
      const bar = frame("filter bar", { dir: "HORIZONTAL", gap: 12, pt: 12, pb: 12, counterAlign: "CENTER" });
      stretch(bar); bar.strokes = boundSolid("line"); bar.strokeWeight = 1; bar.strokeTopWeight = 1; bar.strokeBottomWeight = 1; bar.strokeLeftWeight = 0; bar.strokeRightWeight = 0;
      bar.appendChild(txt("Filter & sort", "label"));
      const sp = frame("sp", { dir: "HORIZONTAL" }); grow(sp); sp.fills = []; bar.appendChild(sp);
      bar.appendChild(txt(catalog === "thrift" ? "37 pieces" : "24 pieces", "caption"));
      head.appendChild(bar);
      const body = section(s, { gap: 20 });
      grid(body, catalog, 2, 4);
      body.appendChild(ghost("Load more"));
      const ft = inst("Footer"); ft.resize(390, ft.height); stretch(ft); s.appendChild(ft);
      return s;
    };
    mob.editList = listing("Mobile / The Pooja Edit listing", "edit", "New apparel", "Original, slow-made apparel from the studio — kurtis, co-ord sets and linen.");
    placeMobile(mob.editList);
    mob.thriftList = listing("Mobile / Thrift listing", "thrift", "Pre-loved · one of each", "Pre-loved and one-of-one. Each piece is listed as-is with its own measurements; when it's gone, it's gone.");
    placeMobile(mob.thriftList);

    // 8.4 Edit PDP
    {
      const s = screen("Mobile / Edit PDP — variant selection");
      const g = section(s, { gap: 12 });
      g.appendChild(photo(350, 438, "Apparel photo 1 of 5"));
      const thumbs = frame("thumbs", { dir: "HORIZONTAL", gap: 8 });
      for (let i = 0; i < 4; i++) thumbs.appendChild(photo(64, 80, "•"));
      g.appendChild(thumbs);
      const d = section(s, { gap: 16 });
      d.appendChild(txt("The Pooja Edit", "eyebrow"));
      d.appendChild(txt("Raktima Kurti", "h2"));
      const pr = frame("price row", { dir: "HORIZONTAL", gap: 12, counterAlign: "CENTER" });
      pr.appendChild(txt("₹1,499", "h3"));
      pr.appendChild(txt("Available", "body-sm", { color: "ink-soft" }));
      d.appendChild(pr);
      d.appendChild(txt("Size", "label"));
      const sizes = frame("sizes", { dir: "HORIZONTAL", gap: 8, wrap: true });
      ["XXS", "XS", "S", "M", "L", "XL", "2XL"].forEach((z, i) => {
        const b = frame("size " + z, { dir: "HORIZONTAL", pt: 10, pb: 10, pl: 14, pr: 14, primaryAlign: "CENTER", counterAlign: "CENTER" });
        b.cornerRadius = 999; b.strokes = boundSolid(i === 3 ? "ink-strong" : "line"); b.strokeWeight = i === 3 ? 2 : 1;
        if (i === 3) b.fills = boundSolid("ink-strong");
        b.appendChild(txt(z, "body-sm", { color: i === 3 ? "ground" : "ink" }));
        sizes.appendChild(b);
      });
      d.appendChild(sizes);
      const qtyRow = frame("qty + add", { dir: "HORIZONTAL", gap: 12, counterAlign: "CENTER" });
      const q = frame("qty", { dir: "HORIZONTAL", gap: 12, pl: 12, pr: 12, pt: 10, pb: 10, counterAlign: "CENTER" }); q.strokes = boundSolid("line"); q.strokeWeight = 1; q.cornerRadius = 10;
      q.appendChild(txt("−  1  +", "body"));
      qtyRow.appendChild(q);
      const add = pill("Add to cart"); grow(add); qtyRow.appendChild(add);
      d.appendChild(qtyRow);
      d.appendChild(txt("Added to cart. View cart →", "body-sm", { color: "ok" }));
      d.appendChild(txt("Returnable within 7 days · Ships pan-India via Shadowfax", "caption"));
      const info = section(s, { gap: 8 });
      info.appendChild(txt("About this piece", "label"));
      info.appendChild(txt("Pure cotton kurti with a full cotton lining and a corset back. Slow-made in Jaipur.", "body-sm", { color: "ink", w: 330 }));
      info.appendChild(spacer(8));
      info.appendChild(txt("Fabric & care", "label"));
      kv(info, "Fabric", "Pure cotton (from the maker's notes)");
      kv(info, "Care", "Gentle hand wash, dry in shade");
      info.appendChild(spacer(8));
      info.appendChild(txt("Fit & length", "label"));
      kv(info, "Length", "32 in");
      kv(info, "Fit", "True to size · size up for a relaxed fit");
      info.appendChild(tlink("Size guide"));
      const more = section(s, { gap: 10 });
      more.appendChild(txt("More like this", "label"));
      railOf(more, "edit", 3);
      const ft = inst("Footer"); ft.resize(390, ft.height); stretch(ft); s.appendChild(ft);
      mob.editPDP = s; placeMobile(s);
    }

    // 8.5 Thrift PDP
    const thriftPDP = (name, sold) => {
      const s = screen(name);
      const g = section(s, { gap: 12 });
      const main = photo(350, 438, sold ? "Thrift photo (sold)" : "Thrift photo 1 of 6");
      if (sold) main.opacity = 0.7;
      g.appendChild(main);
      const thumbs = frame("thumbs", { dir: "HORIZONTAL", gap: 8 });
      ["front", "back", "detail", "flaw"].forEach((r) => thumbs.appendChild(photo(64, 80, r)));
      g.appendChild(thumbs);
      const d = section(s, { gap: 14 });
      d.appendChild(txt("Thrift Store", "eyebrow"));
      const nmRow = frame("nm", { dir: "HORIZONTAL", gap: 10, counterAlign: "CENTER" });
      nmRow.appendChild(txt("On the racks green dress", "h2"));
      const oneTag = inst("Badge", { Kind: sold ? "sold" : "one-of-one" });
      nmRow.appendChild(oneTag);
      d.appendChild(nmRow);
      d.appendChild(txt("₹500", "h3"));
      if (sold) {
        d.appendChild(txt("This piece has sold — it was one of one, so it won't be restocked.", "body-sm", { color: "ink" }));
      } else {
        d.appendChild(pill("Add to cart"));
        d.appendChild(txt("Final sale — one of one · Ships pan-India via Shadowfax", "caption"));
      }
      const cond = section(s, { gap: 8 });
      cond.appendChild(txt("Condition", "label"));
      cond.appendChild(txt("Good — light wear, no damage. Worn a handful of times.", "body-sm", { color: "ink", w: 330 }));
      cond.appendChild(spacer(8));
      cond.appendChild(txt("Measurements", "label"));
      kv(cond, "Bust", "34 in");
      kv(cond, "Length", "38 in");
      kv(cond, "Waist", "28 in");
      cond.appendChild(txt("As measured flat by the seller; confirm before ordering. Unit assumed inches — not stated on the original listing.", "caption"));
      cond.appendChild(spacer(8));
      cond.appendChild(txt("Fit", "label"));
      cond.appendChild(txt("Labelled M · runs slightly small · best on a UK 8–10.", "body-sm", { color: "ink" }));
      cond.appendChild(spacer(8));
      cond.appendChild(txt("Flaws", "label"));
      const flaws = frame("flaws", { dir: "VERTICAL", gap: 10 });
      const fr = frame("flaw row", { dir: "HORIZONTAL", gap: 12, counterAlign: "MIN" });
      fr.appendChild(photo(80, 80, "flaw"));
      fr.appendChild(txt("Small pull near the left seam, ~1 cm. Not visible when worn. Shown in photo 6.", "body-sm", { color: "ink", w: 220 }));
      flaws.appendChild(fr);
      cond.appendChild(flaws);
      const more = section(s, { gap: 10 });
      more.appendChild(txt(sold ? "Similar pieces still available" : "More like this", "label"));
      railOf(more, "thrift", 3);
      const ft = inst("Footer"); ft.resize(390, ft.height); stretch(ft); s.appendChild(ft);
      return s;
    };
    mob.thriftPDP = thriftPDP("Mobile / Thrift PDP — condition & flaws", false);
    placeMobile(mob.thriftPDP);
    mob.soldPDP = thriftPDP("Mobile / Thrift PDP — sold state", true);
    placeMobile(mob.soldPDP);

    // 8.6 Cart (mixed)
    const cartScreen = (name, empty) => {
      const s = screen(name);
      const body = section(s, { gap: 16 });
      body.appendChild(txt("Your cart", "display/mobile"));
      if (empty) {
        body.appendChild(txt("Your cart is empty.", "h3"));
        const links = frame("links", { dir: "HORIZONTAL", gap: 20 });
        links.appendChild(tlink("The Pooja Edit"));
        links.appendChild(tlink("Thrift Store"));
        body.appendChild(links);
      } else {
        body.appendChild(txt("Different return rules apply — see each item.", "caption"));
        for (const [group, items] of [["The Pooja Edit", [["Raktima Kurti", "Size M", "₹1,499", "Returnable within 7 days"]]], ["Thrift Store", [["On the racks green dress", "One of one", "₹500", "Final sale — one of one"]]]]) {
          body.appendChild(txt(group, "label"));
          body.appendChild(hairline());
          for (const [nm, vr, pr, note] of items) {
            const line = frame("line", { dir: "HORIZONTAL", gap: 16, pt: 12, pb: 12, counterAlign: "MIN" });
            stretch(line);
            line.appendChild(photo(80, 100, "img"));
            const col = frame("col", { gap: 4 }); grow(col);
            col.appendChild(txt(nm, "body-sm", { color: "ink" }));
            col.appendChild(txt(vr, "caption"));
            col.appendChild(txt(pr, "body-sm", { color: "ink-strong" }));
            col.appendChild(txt(note, "caption"));
            const ctl = frame("ctl", { dir: "HORIZONTAL", gap: 12, pt: 4 });
            const q = frame("q", { pl: 8, pr: 8, pt: 6, pb: 6 }); q.strokes = boundSolid("line"); q.strokeWeight = 1; q.cornerRadius = 8; q.appendChild(txt("1", "body-sm"));
            ctl.appendChild(q);
            ctl.appendChild(tlink("Remove"));
            col.appendChild(ctl);
            line.appendChild(col);
            body.appendChild(line);
          }
          body.appendChild(spacer(8));
        }
        const sum = section(s, { gap: 8, fill: "fill" });
        sum.appendChild(txt("Summary", "label"));
        rowBetween(sum, txt("Subtotal (2 items)", "body-sm", { color: "ink" }), txt("₹1,999", "body-sm", { color: "ink-strong" }));
        sum.appendChild(txt("Shipping & taxes calculated at checkout.", "caption"));
        const co = pill("Proceed to checkout"); stretch(co); sum.appendChild(co);
      }
      const ft = inst("Footer"); ft.resize(390, ft.height); stretch(ft); s.appendChild(ft);
      return s;
    };
    mob.cart = cartScreen("Mobile / Cart — mixed catalogues", false);
    placeMobile(mob.cart);
    mob.cartEmpty = cartScreen("Mobile / Cart — empty", true);
    placeMobile(mob.cartEmpty);

    // 8.7 Checkout (guest) + validation-error variant
    const checkoutScreen = (name, withError, withPrice) => {
      const s = screen(name);
      const body = section(s, { gap: 16 });
      body.appendChild(txt("Checkout", "h2"));
      body.appendChild(txt("No account needed. We'll email your order confirmation.", "caption"));
      if (withError) {
        const alert = frame("alert", { dir: "VERTICAL", gap: 4, pad: 12, bg: "stop-bg", radius: 10 });
        stretch(alert);
        alert.appendChild(txt("Fix 2 fields to continue", "label", { color: "stop" }));
        alert.appendChild(txt("• Enter a 6-digit PIN code   • Choose a state", "caption", { color: "stop" }));
        body.appendChild(alert);
      }
      body.appendChild(txt("Contact & delivery", "label"));
      body.appendChild(cloneField("default", "Full name"));
      body.appendChild(cloneField("default", "Phone"));
      body.appendChild(cloneField("default", "Address"));
      const cityRow = frame("city", { dir: "HORIZONTAL", gap: 12 }); stretch(cityRow);
      const c1 = cloneField("default", "City"); grow(c1); cityRow.appendChild(c1);
      const c2 = cloneField(withError ? "error" : "default", "State"); grow(c2); cityRow.appendChild(c2);
      body.appendChild(cityRow);
      body.appendChild(cloneField(withError ? "error" : "default", "PIN code"));
      body.appendChild(spacer(8));
      body.appendChild(txt("Delivery", "label"));
      kv(body, "Standard delivery (3–6 days)", "₹79");
      body.appendChild(txt("Cash on delivery available for this address.", "caption"));
      body.appendChild(spacer(8));
      body.appendChild(txt("Payment", "label"));
      const pm1 = frame("pm", { dir: "HORIZONTAL", gap: 10, pt: 10, pb: 10, counterAlign: "CENTER" }); stretch(pm1);
      pm1.appendChild(radio(true)); pm1.appendChild(txt("Pay online — UPI / card / netbanking", "body-sm", { color: "ink" }));
      body.appendChild(pm1);
      const pm2 = frame("pm", { dir: "HORIZONTAL", gap: 10, pt: 10, pb: 10, counterAlign: "CENTER" }); stretch(pm2);
      pm2.appendChild(radio(false)); pm2.appendChild(txt("Cash on delivery  (+₹0 fee)", "body-sm", { color: "ink" }));
      body.appendChild(pm2);
      const rev = section(s, { gap: 8, fill: "fill" });
      rev.appendChild(txt("Review & pay", "label"));
      kv(rev, "Raktima Kurti · M × 1", "₹1,499");
      kv(rev, "On the racks green dress × 1", "₹500");
      kv(rev, "Subtotal", "₹1,999");
      kv(rev, "Shipping", "₹79");
      kv(rev, "Tax (incl.)", "₹0");
      rowBetween(rev, txt("Total", "label"), txt("₹2,078", "label"));
      rev.appendChild(txt("Stock is held for 10 minutes after you place a prepaid order.", "caption"));
      const pay = pill("Pay ₹2,078"); stretch(pay); rev.appendChild(pay);
      rev.appendChild(txt("You'll pay securely on Razorpay — an external screen.", "caption"));
      const ft = inst("Footer"); ft.resize(390, ft.height); stretch(ft); s.appendChild(ft);
      return s;
    };
    function cloneField(state, label) {
      const f = inst("Field", { State: state });
      const lbl = f.findOne((n) => n.type === "TEXT");
      if (lbl) lbl.characters = label;
      f.resize(350, f.height); stretch(f);
      return f;
    }
    function radio(on) {
      const r = figma.createEllipse();
      r.resize(20, 20);
      r.strokes = boundSolid("ink-strong"); r.strokeWeight = on ? 6 : 1;
      r.fills = [];
      r.name = on ? "radio on" : "radio off";
      return r;
    }
    mob.checkout = checkoutScreen("Mobile / Checkout — guest", false, true);
    placeMobile(mob.checkout);
    mob.checkoutErr = checkoutScreen("Mobile / Checkout — validation errors", true, true);
    placeMobile(mob.checkoutErr);

    // 8.8 Order confirmation + tracking + payment states
    const orderScreen = (name, mode) => {
      const s = screen(name);
      const body = section(s, { gap: 16 });
      const badge = inst("Badge", { Kind: mode === "prepaid" ? "payment-received" : mode === "pending" ? "pending" : mode === "failed" ? "failed" : "pending" });
      body.appendChild(badge);
      body.appendChild(txt("Order PE-2026-0142", "h2"));
      if (mode === "prepaid") body.appendChild(txt("Payment received. Your order is confirmed — we'll email the details and message you when it ships.", "body-sm", { color: "ink" }));
      if (mode === "cod") body.appendChild(txt("Order placed. It's pending confirmation — we'll message you to confirm your cash-on-delivery order.", "body-sm", { color: "ink" }));
      if (mode === "pending") body.appendChild(txt("We're confirming your payment. No action needed — we'll email you shortly.", "body-sm", { color: "ink" }));
      if (mode === "failed") {
        body.appendChild(txt("Payment didn't go through. Your order is saved and the items are held for a short time.", "body-sm", { color: "ink" }));
        const retry = pill("Try payment again"); body.appendChild(retry);
        body.appendChild(txt("or choose Cash on delivery instead.", "caption"));
      }
      const st = section(s, { gap: 8, fill: "fill" });
      st.appendChild(txt("Status", "label"));
      kv(st, "Order", mode === "cod" ? "PENDING CONFIRMATION" : "CONFIRMED");
      kv(st, "Payment", mode === "prepaid" ? "PAID" : mode === "failed" ? "FAILED" : mode === "cod" ? "COD — ON DELIVERY" : "PENDING");
      kv(st, "Fulfilment", "PREPARING");
      kv(st, "Method", mode === "cod" ? "Cash on delivery" : "Prepaid (Razorpay)");
      const track = section(s, { gap: 8 });
      track.appendChild(txt("Tracking", "label"));
      kv(track, "Carrier", "Shadowfax");
      kv(track, "AWB", "SFX0293841");
      kv(track, "Status", "PICKED UP");
      track.appendChild(tlink("Track on the carrier site"));
      track.appendChild(spacer(8));
      track.appendChild(txt("Delivery to", "label"));
      track.appendChild(txt("Priya Sharma\n12 MG Road, Jaipur, Rajasthan 302001\n+91 98xxxxxx21", "body-sm", { color: "ink" }));
      const items = section(s, { gap: 8 });
      items.appendChild(txt("Items", "label"));
      kv(items, "Raktima Kurti · M × 1", "₹1,499");
      kv(items, "On the racks green dress × 1", "₹500");
      kv(items, "Shipping", "₹79");
      rowBetween(items, txt("Total", "label"), txt("₹2,078", "label"));
      const ft = inst("Footer"); ft.resize(390, ft.height); stretch(ft); s.appendChild(ft);
      return s;
    };
    mob.confPrepaid = orderScreen("Mobile / Order confirmation — prepaid", "prepaid");
    placeMobile(mob.confPrepaid);
    mob.confCod = orderScreen("Mobile / Order confirmation — COD", "cod");
    placeMobile(mob.confCod);
    mob.payPending = orderScreen("Mobile / Payment pending", "pending");
    placeMobile(mob.payPending);
    mob.payFailed = orderScreen("Mobile / Payment failed & retry", "failed");
    placeMobile(mob.payFailed);

    // 8.9 Overlays: mobile menu, filter sheet
    {
      const s = frame("Mobile / Menu overlay", { w: 390, bg: "ground", dir: "VERTICAL", gap: 0, primary: "AUTO", counter: "FIXED" });
      s.resize(390, 100);
      const top = frame("top", { dir: "HORIZONTAL", pad: 20, counterAlign: "CENTER" }); stretch(top);
      top.appendChild(txt("✕", "h3"));
      const spx = frame("sp", { dir: "HORIZONTAL" }); grow(spx); spx.fills = []; top.appendChild(spx);
      top.appendChild(txt("THE POOJA EDIT", "nav"));
      s.appendChild(top);
      const list = section(s, { gap: 6 });
      list.appendChild(txt("The Pooja Edit", "label"));
      ["New in", "Kurtis & tunics", "Co-ord sets", "Trousers & linen", "Shop everything"].forEach((r) => { const row = txt(r, "body", { color: "ink" }); row.name = "menu row"; list.appendChild(row); list.appendChild(spacer(10)); });
      list.appendChild(hairline());
      list.appendChild(txt("Thrift Store", "label"));
      ["New arrivals", "Kurtis & sets", "Dresses & tops", "Bags & accessories", "Shop everything"].forEach((r) => { list.appendChild(txt(r, "body", { color: "ink" })); list.appendChild(spacer(10)); });
      list.appendChild(hairline());
      ["Search", "Account", "Help & shipping"].forEach((r) => { list.appendChild(txt(r, "body", { color: "ink" })); list.appendChild(spacer(10)); });
      mob.menu = s; placeMobile(s);
    }
    {
      const s = frame("Mobile / Filter & sort sheet", { w: 390, bg: "ground", dir: "VERTICAL", gap: 0, primary: "AUTO", counter: "FIXED", radius: 16 });
      s.resize(390, 100);
      const handle = rect(40, 4, { bg: "line-strong", radius: 999 }); const hw = frame("hw", { pt: 10, pb: 6, primaryAlign: "CENTER" }); stretch(hw); hw.appendChild(handle); s.appendChild(hw);
      const b = section(s, { gap: 16 });
      rowBetween(b, txt("Filter & sort", "h3"), tlink("Clear all"));
      b.appendChild(txt("Sort", "label"));
      ["Newest", "Price — low to high", "Price — high to low", "Available only (thrift)"].forEach((o, i) => { const r = frame("opt", { dir: "HORIZONTAL", gap: 10, pt: 8, pb: 8, counterAlign: "CENTER" }); stretch(r); r.appendChild(radio(i === 0)); r.appendChild(txt(o, "body-sm", { color: "ink" })); b.appendChild(r); });
      b.appendChild(hairline());
      b.appendChild(txt("Condition (thrift)", "label"));
      const chips = frame("chips", { dir: "HORIZONTAL", gap: 8, wrap: true });
      ["New with tags", "Like new", "Excellent", "Good", "Fair"].forEach((c) => { const chip = frame("chip", { pt: 8, pb: 8, pl: 14, pr: 14 }); chip.cornerRadius = 999; chip.strokes = boundSolid("line-strong"); chip.strokeWeight = 1; chip.appendChild(txt(c, "body-sm", { color: "ink" })); chips.appendChild(chip); });
      b.appendChild(chips);
      b.appendChild(txt("Size", "label"));
      const sc = frame("sc", { dir: "HORIZONTAL", gap: 8, wrap: true });
      ["XS", "S", "M", "L", "XL"].forEach((z) => { const chip = frame("chip", { pt: 8, pb: 8, pl: 14, pr: 14 }); chip.cornerRadius = 999; chip.strokes = boundSolid("line-strong"); chip.strokeWeight = 1; chip.appendChild(txt(z, "body-sm", { color: "ink" })); sc.appendChild(chip); });
      b.appendChild(sc);
      const apply = pill("Apply · 18 pieces"); stretch(apply); b.appendChild(apply);
      mob.filter = s; placeMobile(s);
    }

    // 8.10 Search results + no results
    {
      const s = screen("Mobile / Search results");
      const b = section(s, { gap: 16 });
      const sb = frame("searchbox", { dir: "HORIZONTAL", pl: 14, pr: 14, pt: 12, pb: 12, counterAlign: "CENTER" }); stretch(sb); sb.strokes = boundSolid("line"); sb.strokeWeight = 1; sb.cornerRadius = 999;
      sb.appendChild(txt("linen", "body", { color: "ink" }));
      b.appendChild(sb);
      b.appendChild(txt("6 results for “linen”", "caption"));
      const g = grid(b, "edit", 2, 3);
      // add per-card catalog label note
      b.appendChild(txt("Each card shows its catalogue label — “The Pooja Edit” or “Thrift Store”.", "caption"));
      const ft = inst("Footer"); ft.resize(390, ft.height); stretch(ft); s.appendChild(ft);
      mob.search = s; placeMobile(s);
    }
    {
      const s = screen("Mobile / Search — no results");
      const b = section(s, { gap: 16 });
      const sb = frame("searchbox", { dir: "HORIZONTAL", pl: 14, pr: 14, pt: 12, pb: 12, counterAlign: "CENTER" }); stretch(sb); sb.strokes = boundSolid("line"); sb.strokeWeight = 1; sb.cornerRadius = 999;
      sb.appendChild(txt("qwerty", "body", { color: "ink" }));
      b.appendChild(sb);
      b.appendChild(txt("Nothing matched “qwerty”.", "h3"));
      b.appendChild(txt("Try a fabric, a colour, or a piece — or start from a catalogue:", "body-sm", { color: "ink" }));
      const links = frame("links", { dir: "HORIZONTAL", gap: 20 });
      links.appendChild(tlink("The Pooja Edit"));
      links.appendChild(tlink("Thrift Store"));
      b.appendChild(links);
      b.appendChild(txt("Popular: Kurtis · Co-ord sets · Linen trousers · Dresses", "caption"));
      const ft = inst("Footer"); ft.resize(390, ft.height); stretch(ft); s.appendChild(ft);
      mob.searchEmpty = s; placeMobile(s);
    }

    // 8.11 Product unavailable / price changed (on cart)
    {
      const s = screen("Mobile / Cart — item unavailable & price changed");
      const body = section(s, { gap: 16 });
      body.appendChild(txt("Your cart", "display/mobile"));
      const warn = frame("warn", { dir: "VERTICAL", gap: 4, pad: 12, bg: "wait-bg", radius: 10 }); stretch(warn);
      warn.appendChild(txt("Two things changed since you added these", "label", { color: "wait" }));
      warn.appendChild(txt("• “Silk scarf — paisley” is no longer available — remove to continue.\n• “Raktima Kurti” is now ₹1,599 (was ₹1,499).", "caption", { color: "wait" }));
      body.appendChild(warn);
      const line1 = frame("line", { dir: "HORIZONTAL", gap: 16, pt: 12, pb: 12, counterAlign: "MIN" }); stretch(line1);
      line1.appendChild(photo(80, 100, "img"));
      const col1 = frame("c", { gap: 4 }); grow(col1);
      col1.appendChild(txt("Silk scarf — paisley", "body-sm", { color: "ink" }));
      col1.appendChild(txt("No longer available", "caption", { color: "stop" }));
      col1.appendChild(tlink("Remove"));
      line1.appendChild(col1);
      body.appendChild(line1);
      const line2 = frame("line", { dir: "HORIZONTAL", gap: 16, pt: 12, pb: 12, counterAlign: "MIN" }); stretch(line2);
      line2.appendChild(photo(80, 100, "img"));
      const col2 = frame("c", { gap: 4 }); grow(col2);
      col2.appendChild(txt("Raktima Kurti · M", "body-sm", { color: "ink" }));
      col2.appendChild(txt("₹1,499  →  ₹1,599", "body-sm", { color: "ink-strong" }));
      col2.appendChild(txt("Price updated", "caption", { color: "wait" }));
      line2.appendChild(col2);
      body.appendChild(line2);
      const co = ghost("Review again to continue"); stretch(co); body.appendChild(co);
      const ft = inst("Footer"); ft.resize(390, ft.height); stretch(ft); s.appendChild(ft);
      mob.priceChanged = s; placeMobile(s);
    }
    log("mobile screens built: " + Object.keys(mob).length);

    /* ---- 9. Desktop screens ----------------------------------------------- */
    figma.currentPage = pages[4];
    let dcol = 0, drow = 0;
    const placeDesk = (node) => { node.x = dcol * 1560; node.y = drow * 2400; pages[4].appendChild(node); dcol++; if (dcol === 3) { dcol = 0; drow++; } };
    const desk = {};

    // Desktop Home
    {
      const s = screen("Desktop / Home", { w: 1440, bp: "desktop" });
      const hero = section(s, { gap: 24, pad: 64 });
      hero.appendChild(txt("The Pooja Edit + Thrift Store", "eyebrow"));
      hero.appendChild(txt("One brand, two ways to shop.", "display"));
      hero.appendChild(txt("New, slow-made apparel from the studio, and pre-loved one-of-one pieces. One cart holds both.", "lead"));
      const ctas = frame("ctas", { dir: "HORIZONTAL", gap: 24, counterAlign: "CENTER" });
      ctas.appendChild(pill("Shop The Pooja Edit"));
      ctas.appendChild(tlink("Shop Thrift Store"));
      hero.appendChild(ctas);
      const band = section(s, { gap: 12, pad: 64 });
      band.appendChild(photo(1312, 620, "Editorial image — full width"));
      const r1 = section(s, { gap: 16, pad: 64 });
      r1.appendChild(txt("New apparel", "eyebrow"));
      rowBetween(r1, txt("New in", "h2"), tlink("All new pieces"));
      const rr = frame("rail", { dir: "HORIZONTAL", gap: 18 });
      for (let i = 0; i < 4; i++) { const c = inst("ProductCard", { Catalog: "edit", Tag: "none" }); c.resize(300, c.height); rr.appendChild(c); }
      r1.appendChild(rr);
      const ctrls = frame("ctrls", { dir: "HORIZONTAL", gap: 12, primaryAlign: "MAX" }); stretch(ctrls);
      const prev = circleBtn("‹"), next = circleBtn("›"); ctrls.appendChild(prev); ctrls.appendChild(next);
      r1.appendChild(ctrls);
      const split = section(s, { gap: 24, pad: 64, fill: "fill" });
      const sr = frame("split row", { dir: "HORIZONTAL", gap: 24 }); stretch(sr);
      for (const [t, b] of [["The Pooja Edit", "Original apparel — kurtis, co-ord sets and linen."], ["Thrift Store", "Pre-loved and one-of-one. Condition, measurements and flaws on every piece."]]) {
        const blk = frame("blk", { gap: 16 }); grow(blk);
        blk.appendChild(photo(620, 460, "Catalogue image"));
        blk.appendChild(txt(t, "h3"));
        blk.appendChild(txt(b, "body-sm", { color: "ink" }));
        blk.appendChild(tlink(t === "Thrift Store" ? "Browse the rails" : "View the collection"));
        sr.appendChild(blk);
      }
      split.appendChild(sr);
      const ft = inst("Footer"); ft.resize(1440, ft.height); stretch(ft); s.appendChild(ft);
      desk.home = s; placeDesk(s);
    }
    function circleBtn(g) { const f = frame("rail control", { w: 44, h: 44, primaryAlign: "CENTER", counterAlign: "CENTER", dir: "HORIZONTAL", primary: "FIXED", counter: "FIXED" }); f.resize(44, 44); f.cornerRadius = 999; f.strokes = boundSolid("line-strong"); f.strokeWeight = 1; f.appendChild(txt(g, "body", { color: "ink-strong" })); return f; }

    // Desktop Listing (thrift, with filter rail)
    {
      const s = screen("Desktop / Thrift listing", { w: 1440, bp: "desktop" });
      const head = section(s, { gap: 12, pad: 64 });
      head.appendChild(txt("Pre-loved · one of each", "eyebrow"));
      head.appendChild(txt("Thrift Store", "display"));
      head.appendChild(txt("Pre-loved and one-of-one. Each piece is listed as-is with its own measurements.", "body-sm", { color: "ink" }));
      const cols = frame("cols", { dir: "HORIZONTAL", gap: 40, pl: 64, pr: 64, pt: 20, pb: 64, primary: "FIXED", counter: "AUTO" });
      stretch(cols);
      const fil = frame("filter rail", { gap: 20 }); fil.resize(240, 10);
      for (const [t, opts] of [["Category", ["Kurtis & sets", "Dresses & tops", "Trousers", "Bags"]], ["Condition", ["Like new", "Excellent", "Good"]], ["Labelled size", ["XS", "S", "M", "L"]], ["Availability", ["In stock", "Show sold"]], ["Price", ["Under ₹500", "₹500–₹1,000"]]]) {
        fil.appendChild(txt(t, "label"));
        opts.forEach((o) => fil.appendChild(txt(o, "body-sm", { color: "ink" })));
        fil.appendChild(spacer(8));
      }
      cols.appendChild(fil);
      const gwrap = frame("gwrap", { gap: 16 }); grow(gwrap);
      rowBetween(gwrap, txt("37 pieces", "caption"), txt("Sort: Newest ▾", "body-sm", { color: "ink" }));
      const g = frame("grid", { dir: "HORIZONTAL", gap: 18, wrap: true, primary: "FIXED", counter: "AUTO" }); g.resize(980, 10); stretch(g);
      for (let i = 0; i < 12; i++) { const c = inst("ProductCard", { Catalog: "thrift", Tag: i % 5 === 4 ? "sold" : i % 3 === 0 ? "one-of-one" : "none" }); c.resize(300, c.height); g.appendChild(c); }
      gwrap.appendChild(g);
      cols.appendChild(gwrap);
      s.appendChild(cols);
      const ft = inst("Footer"); ft.resize(1440, ft.height); stretch(ft); s.appendChild(ft);
      desk.listing = s; placeDesk(s);
    }

    // Desktop Thrift PDP (2-col, sticky detail)
    {
      const s = screen("Desktop / Thrift PDP", { w: 1440, bp: "desktop" });
      const cols = frame("cols", { dir: "HORIZONTAL", gap: 48, pl: 64, pr: 64, pt: 24, pb: 64, primary: "FIXED", counter: "MIN" });
      stretch(cols);
      const gal = frame("gallery", { gap: 12 }); gal.resize(720, 10);
      gal.appendChild(photo(720, 900, "Thrift photo 1 of 6"));
      const tr = frame("thumbs", { dir: "HORIZONTAL", gap: 10 });
      ["front", "back", "detail", "flaw", "tag"].forEach((r) => tr.appendChild(photo(96, 120, r)));
      gal.appendChild(tr);
      cols.appendChild(gal);
      const d = frame("detail", { gap: 16 }); d.resize(520, 10);
      d.appendChild(txt("Thrift Store", "eyebrow"));
      const nmr = frame("nm", { dir: "HORIZONTAL", gap: 10, counterAlign: "CENTER" });
      nmr.appendChild(txt("On the racks green dress", "h2"));
      nmr.appendChild(inst("Badge", { Kind: "one-of-one" }));
      d.appendChild(nmr);
      d.appendChild(txt("₹500", "h3"));
      d.appendChild(pill("Add to cart"));
      d.appendChild(txt("Final sale — one of one · Ships pan-India via Shadowfax", "caption"));
      d.appendChild(spacer(8));
      d.appendChild(txt("Condition", "label"));
      d.appendChild(txt("Good — light wear, no damage.", "body-sm", { color: "ink" }));
      d.appendChild(txt("Measurements", "label"));
      kv(d, "Bust", "34 in"); kv(d, "Length", "38 in"); kv(d, "Waist", "28 in");
      d.appendChild(txt("As measured flat by the seller; confirm before ordering.", "caption"));
      d.appendChild(txt("Fit", "label"));
      d.appendChild(txt("Labelled M · runs slightly small.", "body-sm", { color: "ink" }));
      d.appendChild(txt("Flaws", "label"));
      const fr = frame("flaw", { dir: "HORIZONTAL", gap: 12 });
      fr.appendChild(photo(96, 96, "flaw"));
      fr.appendChild(txt("Small pull near the left seam, ~1 cm. Not visible when worn.", "body-sm", { color: "ink", w: 380 }));
      d.appendChild(fr);
      cols.appendChild(d);
      s.appendChild(cols);
      const ft = inst("Footer"); ft.resize(1440, ft.height); stretch(ft); s.appendChild(ft);
      desk.pdp = s; placeDesk(s);
    }

    // Desktop Cart (2-col) + Checkout (2-col)
    {
      const s = screen("Desktop / Cart", { w: 1440, bp: "desktop" });
      const b = section(s, { gap: 24, pad: 64 });
      b.appendChild(txt("Your cart", "display"));
      const cols = frame("cols", { dir: "HORIZONTAL", gap: 48, primary: "FIXED", counter: "MIN" }); stretch(cols);
      const lines = frame("lines", { gap: 16 }); grow(lines);
      lines.appendChild(txt("Different return rules apply — see each item.", "caption"));
      for (const [group, nm, vr, pr, note] of [["The Pooja Edit", "Raktima Kurti", "Size M", "₹1,499", "Returnable within 7 days"], ["Thrift Store", "On the racks green dress", "One of one", "₹500", "Final sale — one of one"]]) {
        lines.appendChild(txt(group, "label"));
        lines.appendChild(hairline());
        const line = frame("line", { dir: "HORIZONTAL", gap: 20, pt: 16, pb: 16, counterAlign: "MIN" }); stretch(line);
        line.appendChild(photo(96, 120, "img"));
        const col = frame("c", { gap: 4 }); grow(col);
        col.appendChild(txt(nm, "body-sm", { color: "ink" }));
        col.appendChild(txt(vr + " · " + note, "caption"));
        line.appendChild(col);
        line.appendChild(txt(pr, "body-sm", { color: "ink-strong" }));
        lines.appendChild(line);
      }
      cols.appendChild(lines);
      const sum = frame("summary", { gap: 8, pad: 24, bg: "fill", radius: 12 }); sum.resize(360, 10);
      sum.appendChild(txt("Summary", "label"));
      rowBetween(sum, txt("Subtotal (2 items)", "body-sm", { color: "ink" }), txt("₹1,999", "body-sm", { color: "ink-strong" }));
      sum.appendChild(txt("Shipping & taxes calculated at checkout.", "caption"));
      const co = pill("Proceed to checkout"); stretch(co); sum.appendChild(co);
      cols.appendChild(sum);
      b.appendChild(cols);
      const ft = inst("Footer"); ft.resize(1440, ft.height); stretch(ft); s.appendChild(ft);
      desk.cart = s; placeDesk(s);
    }
    {
      const s = screen("Desktop / Checkout — guest", { w: 1440, bp: "desktop" });
      const b = section(s, { gap: 24, pad: 64 });
      b.appendChild(txt("Checkout", "h2"));
      const cols = frame("cols", { dir: "HORIZONTAL", gap: 48, primary: "FIXED", counter: "MIN" }); stretch(cols);
      const form = frame("form", { gap: 16 }); grow(form);
      form.appendChild(txt("No account needed. We'll email your order confirmation.", "caption"));
      form.appendChild(txt("Contact & delivery", "label"));
      form.appendChild(cloneField("default", "Full name"));
      form.appendChild(cloneField("default", "Phone"));
      form.appendChild(cloneField("default", "Address"));
      form.appendChild(cloneField("default", "PIN code"));
      form.appendChild(txt("Payment", "label"));
      const pm1 = frame("pm", { dir: "HORIZONTAL", gap: 10, counterAlign: "CENTER" }); pm1.appendChild(radio(true)); pm1.appendChild(txt("Pay online — UPI / card / netbanking", "body-sm", { color: "ink" })); form.appendChild(pm1);
      const pm2 = frame("pm", { dir: "HORIZONTAL", gap: 10, counterAlign: "CENTER" }); pm2.appendChild(radio(false)); pm2.appendChild(txt("Cash on delivery", "body-sm", { color: "ink" })); form.appendChild(pm2);
      cols.appendChild(form);
      const sum = frame("summary", { gap: 8, pad: 24, bg: "fill", radius: 12 }); sum.resize(380, 10);
      sum.appendChild(txt("Review & pay", "label"));
      kv(sum, "Raktima Kurti · M × 1", "₹1,499");
      kv(sum, "On the racks green dress × 1", "₹500");
      kv(sum, "Subtotal", "₹1,999"); kv(sum, "Shipping", "₹79"); kv(sum, "Tax (incl.)", "₹0");
      rowBetween(sum, txt("Total", "label"), txt("₹2,078", "label"));
      sum.appendChild(txt("Stock is held for 10 minutes after you place a prepaid order.", "caption"));
      const pay = pill("Pay ₹2,078"); stretch(pay); sum.appendChild(pay);
      sum.appendChild(txt("You'll pay securely on Razorpay — an external screen.", "caption"));
      cols.appendChild(sum);
      b.appendChild(cols);
      const ft = inst("Footer"); ft.resize(1440, ft.height); stretch(ft); s.appendChild(ft);
      desk.checkout = s; placeDesk(s);
    }

    // Desktop expanded nav
    {
      const s = frame("Desktop / Expanded navigation", { w: 1440, bg: "ground", dir: "VERTICAL", gap: 0, primary: "AUTO", counter: "FIXED" });
      s.resize(1440, 100);
      const bar2 = frame("header inset", { dir: "HORIZONTAL", pl: 12, pr: 12, pt: 12, pb: 8 }); stretch(bar2); bar2.fills = [];
      const h = inst("Header", { Breakpoint: "desktop" }); h.resize(1416, 84); grow(h); bar2.appendChild(h);
      s.appendChild(bar2);
      const panel = frame("category panel", { dir: "HORIZONTAL", gap: 48, pad: 40, bg: "fill" }); stretch(panel);
      const list = frame("list", { gap: 10 }); grow(list);
      list.appendChild(txt("Shop The Pooja Edit", "label"));
      ["New in", "Kurtis & tunics", "Co-ord sets", "Trousers & linen", "View everything"].forEach((r) => list.appendChild(txt(r, "body-sm", { color: "ink" })));
      panel.appendChild(list);
      const list2 = frame("list2", { gap: 10 }); grow(list2);
      list2.appendChild(txt("Shop Thrift Store", "label"));
      ["New arrivals", "Kurtis & sets", "Dresses & tops", "Bags & accessories", "Everything one-of-one"].forEach((r) => list2.appendChild(txt(r, "body-sm", { color: "ink" })));
      panel.appendChild(list2);
      panel.appendChild(photo(360, 260, "Category image"));
      s.appendChild(panel);
      desk.nav = s; placeDesk(s);
    }
    log("desktop screens built: " + Object.keys(desk).length);

    /* ---- 10. Responsive Examples --------------------------------------------*/
    {
      figma.currentPage = pages[5];
      const root = frame("Responsive — Listing & PDP at 390 / 768 / 1440", { dir: "VERTICAL", gap: 48, pad: 48, bg: "ground" });
      root.resize(2000, 10);
      root.appendChild(txt("Responsive examples", "h2"));
      root.appendChild(txt("The same two screens across breakpoints. Desktop is a different composition (2-col PDP, filter rail, summary sidebars) — not a stretched phone. Everything holds to 360px: name/price rows truncate, tap targets ≥ 44px.", "body-sm", { color: "ink", w: 900 }));

      const tabletListing = () => {
        const s = screen("Tablet / Listing (768)", { w: 768, bp: "desktop" });
        const head = section(s, { gap: 12, pad: 40 });
        head.appendChild(txt("New apparel", "eyebrow"));
        head.appendChild(txt("The Pooja Edit", "h2"));
        const bar = frame("bar", { dir: "HORIZONTAL", pt: 12, pb: 12 }); stretch(bar); bar.strokes = boundSolid("line"); bar.strokeWeight = 1;
        bar.appendChild(txt("Filter & sort", "label"));
        const sp = frame("sp", { dir: "HORIZONTAL" }); grow(sp); sp.fills = []; bar.appendChild(sp);
        bar.appendChild(txt("Sort: Newest ▾", "body-sm", { color: "ink" }));
        head.appendChild(bar);
        const body = section(s, { gap: 20, pad: 40 });
        const g = frame("grid", { dir: "HORIZONTAL", gap: 16, wrap: true, primary: "FIXED", counter: "AUTO" }); g.resize(688, 10); stretch(g);
        for (let i = 0; i < 9; i++) { const c = inst("ProductCard", { Catalog: "edit", Tag: "none" }); c.resize(218, c.height); g.appendChild(c); }
        body.appendChild(g);
        return s;
      };
      const tabletCheckout = () => {
        const s = screen("Tablet / Checkout (768)", { w: 768, bp: "desktop" });
        const b = section(s, { gap: 20, pad: 40 });
        b.appendChild(txt("Checkout", "h2"));
        b.appendChild(cloneField("default", "Full name"));
        b.appendChild(cloneField("default", "Phone"));
        b.appendChild(cloneField("default", "Address"));
        b.appendChild(txt("Payment", "label"));
        const pm = frame("pm", { dir: "HORIZONTAL", gap: 10, counterAlign: "CENTER" }); pm.appendChild(radio(true)); pm.appendChild(txt("Pay online — UPI / card / netbanking", "body-sm", { color: "ink" })); b.appendChild(pm);
        const sum = frame("summary card", { gap: 8, pad: 20, bg: "fill", radius: 12 }); stretch(sum);
        sum.appendChild(txt("Review & pay", "label"));
        kv(sum, "Subtotal", "₹1,999"); kv(sum, "Shipping", "₹79");
        rowBetween(sum, txt("Total", "label"), txt("₹2,078", "label"));
        const pay = pill("Pay ₹2,078"); stretch(pay); sum.appendChild(pay);
        b.appendChild(sum);
        return s;
      };

      const rowA = frame("Listing row", { dir: "HORIZONTAL", gap: 40, counterAlign: "MIN" });
      const m1 = mob.editList.clone(); rowA.appendChild(m1);
      rowA.appendChild(tabletListing());
      rowA.appendChild(desk.listing.clone());
      root.appendChild(rowA);
      const rowB = frame("Checkout row", { dir: "HORIZONTAL", gap: 40, counterAlign: "MIN" });
      rowB.appendChild(mob.checkout.clone());
      rowB.appendChild(tabletCheckout());
      rowB.appendChild(desk.checkout.clone());
      root.appendChild(rowB);
      pages[5].appendChild(root);
      log("responsive page built");
    }

    /* ---- 11. Research page ------------------------------------------------- */
    {
      figma.currentPage = pages[0];
      const root = frame("Research & References", { dir: "VERTICAL", gap: 24, pad: 48, bg: "ground" });
      root.resize(1400, 10);
      root.appendChild(txt("Research & References", "h2"));
      root.appendChild(txt("Analysis: design/research/reference-analysis.md · navigation-map.md · ux-findings.md\nScreenshots: design/research/screenshots/<site>/<viewport>-<page>.png (rhode, thepoojaedit, dm2buy at 390 / 768 / 1440)\n\nDrop the PNGs onto the placeholders below, or use the html.to.design plugin to import the reference pages into this page as a separate reference area (imported pages are reference material, not the finished design).", "body-sm", { color: "ink", w: 1000 }));
      for (const site of ["rhode", "thepoojaedit", "dm2buy"]) {
        const secr = frame(site, { gap: 12 });
        secr.appendChild(txt(site, "label"));
        const row = frame("row", { dir: "HORIZONTAL", gap: 16, wrap: true });
        for (const pg of ["home", "listing", "pdp", "cart", "menu"]) for (const vw of ["390", "768", "1440"]) {
          const ph = photo(vw === "1440" ? 300 : vw === "768" ? 180 : 110, 200, `${vw}-${pg}.png`);
          row.appendChild(ph);
        }
        secr.appendChild(row);
        root.appendChild(secr);
      }
      pages[0].appendChild(root);
      log("research page built");
    }

    /* ---- 12. Prototype & Handoff ---------------------------------------------*/
    {
      figma.currentPage = pages[6];
      const root = frame("Prototype & Handoff", { dir: "VERTICAL", gap: 20, pad: 48, bg: "ground" });
      root.resize(1200, 10);
      root.appendChild(txt("Prototype & Handoff", "h2"));
      root.appendChild(txt(
        "Full handoff: design/handoff.md\n\nPrototype flows (wired on the Mobile Storefront page):\n" +
        "• Home → The Pooja Edit listing → Edit PDP → Cart → Checkout → Order confirmation (prepaid) → Order tracking\n" +
        "• Header ☰ → Menu overlay → catalogue\n" +
        "• Listing “Filter & sort” → Filter sheet (overlay) → back to listing\n" +
        "• Edit PDP “Add to cart” → in-page “Added to cart” confirmation (see PDP frame)\n" +
        "• Sold thrift PDP → “Similar pieces still available” rail → Thrift PDP\n" +
        "• Payment failed → “Try payment again” → (external Razorpay handoff, simulated) → confirmation\n" +
        "• Order confirmation → “Track this order” → Order tracking\n\n" +
        "Simulated: the prototype does not process payments or check real inventory. Razorpay screens are an external handoff and are labelled as such.\n\n" +
        "Manual step if a link is missing: open the Mobile Storefront page, select the source layer (button/link), and in the Prototype tab drag a connection to the target frame; use “Navigate to” with Smart Animate.",
        "body-sm", { color: "ink", w: 1000 }));
      pages[6].appendChild(root);
      log("handoff page built");
    }

    /* ---- 13. wire the core prototype -------------------------------------- */
    const linkFirst = (fromFrame, matcher, toFrame, overlay) => {
      if (!fromFrame || !toFrame) return;
      try {
        const node = fromFrame.findOne((n) => (n.type === "INSTANCE" || n.type === "TEXT" || n.type === "FRAME") && matcher(n));
        if (!node) { log("prototype: no source for " + toFrame.name); return; }
        const act = { type: "NODE", destinationId: toFrame.id, navigation: overlay ? "OVERLAY" : "NAVIGATE", transition: { type: "SMART_ANIMATE", easing: { type: "EASE_OUT" }, duration: 0.3 }, preserveScrollPosition: false };
        node.reactions = [{ actions: [act], action: act, trigger: { type: "ON_CLICK" } }];
      } catch (e) { log("prototype link failed (" + toFrame.name + "): " + e); }
    };
    const hasText = (s) => (n) => {
      try { const t = n.type === "TEXT" ? n.characters : (n.findOne && n.findOne((x) => x.type === "TEXT") || {}).characters; return t && t.toLowerCase().includes(s); } catch (e) { return false; }
    };
    linkFirst(mob.home, hasText("shop the pooja edit"), mob.editList);
    linkFirst(mob.home, hasText("shop thrift store"), mob.thriftList);
    linkFirst(mob.editList, (n) => n.type === "INSTANCE" && n.name.startsWith("ProductCard"), mob.editPDP);
    linkFirst(mob.editList, hasText("filter & sort"), mob.filter, true);
    linkFirst(mob.thriftList, (n) => n.type === "INSTANCE" && n.name.startsWith("ProductCard"), mob.thriftPDP);
    linkFirst(mob.editPDP, hasText("view cart"), mob.cart);
    linkFirst(mob.cart, hasText("proceed to checkout"), mob.checkout);
    linkFirst(mob.checkout, hasText("pay ₹"), mob.confPrepaid);
    linkFirst(mob.confPrepaid, hasText("track"), mob.payPending);
    linkFirst(mob.soldPDP, (n) => n.type === "INSTANCE" && n.name.startsWith("ProductCard"), mob.thriftPDP);
    linkFirst(mob.payFailed, hasText("try payment again"), mob.confPrepaid);
    // header hamburger → menu overlay (search across mobile screens' headers)
    for (const s of Object.values(mob)) linkFirst(s, hasText("☰"), mob.menu, true);
    try {
      pages[3].flowStartingPoints = [{ nodeId: mob.home.id, name: "Storefront flow — start" }];
    } catch (e) { log("flow start: " + e); }
    log("prototype wired");

    /* ---- done ----------------------------------------------------------------*/
    figma.currentPage = pages[3];
    figma.viewport.scrollAndZoomIntoView(pages[3].children);
    figma.notify("The Pooja Edit mockups built — 7 pages. See the log in the console.");
    console.log("BUILD LOG:\n" + LOG.join("\n"));
    figma.closePlugin("Built ✓  Pages: Research · Foundations · Components · Mobile · Desktop · Responsive · Prototype");
  } catch (err) {
    console.error(err);
    figma.notify("Build error: " + (err && err.message ? err.message : err), { error: true });
    figma.closePlugin("Error — see console. " + (err && err.stack ? err.stack.split("\n")[1] : ""));
  }
})();
