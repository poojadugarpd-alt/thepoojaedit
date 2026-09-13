import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import { DEFAULT_HOME_CONTENT, getHomeContent } from "../../src/server/settings";
import { makeClient, resetDb } from "./helpers";

let db: PrismaClient;

beforeAll(() => {
  db = makeClient();
});
afterAll(async () => {
  await db.$disconnect();
});
beforeEach(async () => {
  await resetDb(db);
});

describe("getHomeContent — per-field fallback (owner feedback, 2026-09-13)", () => {
  it("returns the shipped defaults when the setting has never been saved", async () => {
    const content = await getHomeContent(db);
    expect(content).toEqual(DEFAULT_HOME_CONTENT);
  });

  it("falls back per field, not per section, when the saved value is partial", async () => {
    await db.storeSettings.create({
      data: {
        key: "home.content",
        value: {
          hero: { heading: "New headline only" }, // eyebrow/lead/CTAs left out
          newIn: { heading: "" }, // explicitly blank, not just missing
        },
      },
    });
    const content = await getHomeContent(db);
    expect(content.hero.heading).toBe("New headline only");
    expect(content.hero.eyebrow).toBe(DEFAULT_HOME_CONTENT.hero.eyebrow);
    expect(content.hero.lead).toBe(DEFAULT_HOME_CONTENT.hero.lead);
    expect(content.hero.primaryCta).toBe(DEFAULT_HOME_CONTENT.hero.primaryCta);
    // A blank string is treated the same as a missing field — never an
    // empty heading on the live page.
    expect(content.newIn.heading).toBe(DEFAULT_HOME_CONTENT.newIn.heading);
    // Untouched sections are untouched.
    expect(content.newsletter).toEqual(DEFAULT_HOME_CONTENT.newsletter);
  });

  it("falls back to defaults entirely when the saved value is an empty object", async () => {
    await db.storeSettings.create({ data: { key: "home.content", value: {} } });
    const content = await getHomeContent(db);
    expect(content).toEqual(DEFAULT_HOME_CONTENT);
  });
});
