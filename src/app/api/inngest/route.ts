import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  ...(env.INNGEST_SIGNING_KEY ? { signingKey: env.INNGEST_SIGNING_KEY } : {}),
});
