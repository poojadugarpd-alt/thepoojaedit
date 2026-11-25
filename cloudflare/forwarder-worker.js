// Forwarder Worker "thepoojaedit-store" in POOJA's Cloudflare account
// (the account that owns the thepoojaedit.in zone). Custom domains:
// thepoojaedit.in and www.thepoojaedit.in. It passes every request to the real
// store Worker in the vinayakch17 account (Cloudflare only lets a custom domain
// attach to a Worker in the same account as the zone). Same idea as the
// studio forwarder; see studio/docs/HANDOFF.md.
const ORIGIN = "https://thepoojaedit-store.vinayakch17.workers.dev";
const CANONICAL = "thepoojaedit.in";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // www -> apex, permanent (keeps the old Vercel behaviour).
    if (url.hostname === "www." + CANONICAL) {
      url.hostname = CANONICAL;
      return Response.redirect(url.toString(), 308);
    }

    const target = new URL(url.pathname + url.search, ORIGIN);
    const headers = new Headers(request.headers);
    // Next.js checks Server Action origins against x-forwarded-host, and the
    // store's rate limits read the visitor IP from x-forwarded-for.
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", "https");
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) headers.set("x-forwarded-for", ip);

    const res = await fetch(target, {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });

    // Rewrite redirects that point at the workers.dev origin back to the domain.
    const loc = res.headers.get("location");
    if (loc && loc.startsWith(ORIGIN)) {
      const out = new Response(res.body, res);
      out.headers.set("location", "https://" + url.host + loc.slice(ORIGIN.length));
      return out;
    }
    return res;
  },
};
