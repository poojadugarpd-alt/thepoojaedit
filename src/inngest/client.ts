import { Inngest } from "inngest";

import { env } from "@/lib/env";

/**
 * Inngest client (master §2, §8). In development the CLI dev server discovers
 * this app at /api/inngest without keys; production uses INNGEST_EVENT_KEY /
 * INNGEST_SIGNING_KEY.
 */
export const inngest = new Inngest({
  id: "poojaedit",
  ...(env.INNGEST_EVENT_KEY ? { eventKey: env.INNGEST_EVENT_KEY } : {}),
});
