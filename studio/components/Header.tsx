"use client";

import { useState } from "react";
import { site, waLink } from "@/lib/site";
import { BagButton } from "./Bag";
import { CloseIcon, WhatsAppIcon } from "./icons";

const NAV = [
  ["best sellers", "#shop"],
  ["reels", "#reels"],
  ["youtube", "#youtube"],
  ["carousels", "#carousels"],
  ["graphics", "#graphics"],
  ["contact", "#chat"],
] as const;

export function Header() {
  const [menu, setMenu] = useState(false);
  return (
    <>
      <div className="announce">
        <p>
          reels & graphics delivered in 24–48 hours · bulk & monthly discounts —{" "}
          <a href={waLink()} target="_blank" rel="noopener">
            chat on whatsapp
          </a>
        </p>
      </div>
      <header className="header">
        <div className="header-row">
          <div className="header-left">
            <button type="button" className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Open menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <span className="locale">
              in <span className="rupee">₹</span>
            </span>
          </div>
          <a href="#top" className="logo" aria-label={`${site.name} studio — home`}>
            <span className="logo-main">POOJA DUGAR</span>
            <span className="logo-sub">EDIT STUDIO</span>
          </a>
          <div className="header-right">
            <a className="icon-btn wa-icon" href={waLink()} target="_blank" rel="noopener" aria-label="Chat on WhatsApp">
              <WhatsAppIcon size={21} />
            </a>
            <BagButton />
          </div>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className={`drawer-root left ${menu ? "is-open" : ""}`} aria-hidden={!menu} inert={!menu}>
        <div className="drawer-scrim" onClick={() => setMenu(false)} />
        <nav className="drawer menu" aria-label="Mobile">
          <div className="drawer-head">
            <span className="logo-main">MENU</span>
            <button type="button" className="icon-btn" onClick={() => setMenu(false)} aria-label="Close menu">
              <CloseIcon />
            </button>
          </div>
          {NAV.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setMenu(false)}>
              {label}
            </a>
          ))}
          <a className="btn btn-wa btn-block" href={waLink()} target="_blank" rel="noopener">
            <WhatsAppIcon size={18} /> chat on whatsapp
          </a>
        </nav>
      </div>
    </>
  );
}
