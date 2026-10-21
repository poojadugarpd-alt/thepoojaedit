import { site, waLink } from "@/lib/site";
import { InstagramIcon, MailIcon, WhatsAppIcon, YouTubeIcon } from "./icons";

/** Pooja's shop, linked both ways with this site (owner, 2026-10-20). */
const SHOP = "https://thepoojaedit.in";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer-cta">
        <p className="display display-sm">have footage in your camera roll?</p>
        <a className="btn btn-wa" href={waLink()} target="_blank" rel="noopener">
          <WhatsAppIcon size={18} /> chat on whatsapp
        </a>
      </div>
      <div className="footer-grid">
        <div>
          <p className="footer-head">services</p>
          <a href="/reels">instagram reel editing</a>
          <a href="/youtube">youtube video editing</a>
          <a href="/carousels">instagram carousels</a>
          <a href="/graphics">graphic design</a>
          <a href="/ugc">ugc &amp; brand videos</a>
        </div>
        <div>
          <p className="footer-head">help</p>
          <a href="/#process">how it works</a>
          <a href="/#faq">faq</a>
          <a href="/pricing">pricing</a>
          <a href="/#chat">contact us</a>
        </div>
        <div>
          <p className="footer-head">the pooja edit</p>
          <a href={`${SHOP}/label`}>the label</a>
          <a href={`${SHOP}/closet`}>the closet (pre-loved)</a>
          <a href={`${SHOP}/styling`}>personal styling</a>
          <a href={`${SHOP}/about`}>about pooja</a>
        </div>
        <div>
          <p className="footer-head">connect</p>
          <a href={site.instagramUrl} target="_blank" rel="noopener">
            <InstagramIcon size={16} /> {site.instagramHandle}
          </a>
          <a href={site.youtubeUrl} target="_blank" rel="noopener">
            <YouTubeIcon size={16} /> {site.youtubeHandle}
          </a>
          <a href={waLink()} target="_blank" rel="noopener">
            <WhatsAppIcon size={16} /> {site.whatsappDisplay}
          </a>
          <a href={`mailto:${site.email}`}>
            <MailIcon size={16} /> {site.email}
          </a>
        </div>
      </div>
      <p className="footer-logo" aria-hidden="true">
        POOJA DUGAR
      </p>
      <p className="copyright">
        © {year} {site.name}. all rights reserved.
      </p>
    </footer>
  );
}
