import "server-only";

import type { PrismaClient } from "@/generated/prisma";

import { dbInAppTransport } from "./transports";
import type {
  EmailMessage,
  EmailTransport,
  Transports,
  WhatsAppMessage,
  WhatsAppTransport,
} from "./transports";

/** Deterministic transports for tests: record every message, never leave the process. */
export class FakeEmailTransport implements EmailTransport {
  readonly name = "fake-email";
  configured = true;
  readonly sent: EmailMessage[] = [];
  failNext = false;
  async send(msg: EmailMessage) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("simulated email provider outage");
    }
    this.sent.push(msg);
    return { providerMessageId: `email_${this.sent.length}` };
  }
}

export class FakeWhatsAppTransport implements WhatsAppTransport {
  readonly name = "fake-whatsapp";
  configured = true;
  readonly sent: WhatsAppMessage[] = [];
  failNext = false;
  async send(msg: WhatsAppMessage) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("simulated whatsapp provider outage");
    }
    this.sent.push(msg);
    return { providerMessageId: `wamid_${this.sent.length}` };
  }
}

export function fakeTransports(db: PrismaClient): Transports & {
  email: FakeEmailTransport;
  whatsapp: FakeWhatsAppTransport;
} {
  return {
    email: new FakeEmailTransport(),
    whatsapp: new FakeWhatsAppTransport(),
    inApp: dbInAppTransport(db),
  };
}
