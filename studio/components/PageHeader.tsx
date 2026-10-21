import { site, waLink } from "@/lib/site";
import { WhatsAppIcon } from "./icons";

/** The small header on the inner pages (services, pricing, ugc): back home, logo, WhatsApp. */
export function PageHeader({ message }: { message?: string }) {
  return (
    <header className="header">
      <div className="header-row">
        <a href="/" className="service-back">
          ← all services
        </a>
        <a href="/" className="logo" aria-label={`${site.name} studio — home`}>
          <span className="logo-main">POOJA DUGAR</span>
          <span className="logo-sub">EDIT STUDIO</span>
        </a>
        <div className="header-right">
          <a className="icon-btn wa-icon" href={waLink(message)} target="_blank" rel="noopener" aria-label="Chat on WhatsApp">
            <WhatsAppIcon size={21} />
          </a>
        </div>
      </div>
    </header>
  );
}
