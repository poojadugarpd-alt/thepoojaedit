import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma";
import {
  DEFAULT_HOME_CONTENT,
  DEFAULT_HOME_MEDIA,
  DEFAULT_HOME_SECTIONS,
  getHomeContent,
} from "../../src/server/settings";
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

  it("a home.content row saved before media/sections existed still resolves with the shipped defaults for both", async () => {
    // Exactly the shape Part A's original save wrote — no media, no sections.
    await db.storeSettings.create({
      data: { key: "home.content", value: { hero: { heading: "Old save" } } },
    });
    const content = await getHomeContent(db);
    expect(content.hero.heading).toBe("Old save");
    expect(content.media).toEqual(DEFAULT_HOME_MEDIA);
    expect(content.sections).toEqual(DEFAULT_HOME_SECTIONS);
  });
});

// Owner follow-up (2026-09-13) — "no option to edit the actual pictures/
// video and layout of the home page".
describe("getHomeContent — media slots", () => {
  it("a media slot is replaced wholesale, not merged field by field", async () => {
    await db.storeSettings.create({
      data: {
        key: "home.content",
        value: { media: { editorial: { kind: "image", path: "home/editorial/x.webp" } } },
      },
    });
    const content = await getHomeContent(db);
    expect(content.media.editorial).toEqual({
      kind: "image",
      path: "home/editorial/x.webp",
      bucket: undefined,
      url: undefined,
      posterUrl: undefined,
      alt: undefined,
    });
    // Untouched slots keep the default "auto" shape.
    expect(content.media.labelBlock).toEqual(DEFAULT_HOME_MEDIA.labelBlock);
  });

  it("an unknown/invalid kind falls back to the slot's default instead of crashing", async () => {
    await db.storeSettings.create({
      data: { key: "home.content", value: { media: { closetBlock: { kind: "gif" } } } },
    });
    const content = await getHomeContent(db);
    expect(content.closetBlock).toEqual(DEFAULT_HOME_CONTENT.closetBlock);
    expect(content.media.closetBlock).toEqual(DEFAULT_HOME_MEDIA.closetBlock);
  });

  it("reverting a slot to auto drops any leftover path/url from a previous upload", async () => {
    await db.storeSettings.create({
      data: {
        key: "home.content",
        value: { media: { editorial: { kind: "auto", path: "stale/leftover.webp" } } },
      },
    });
    const content = await getHomeContent(db);
    expect(content.media.editorial).toEqual({ kind: "auto" });
  });
});

describe("getHomeContent — section layout", () => {
  it("respects a saved order and hidden sections", async () => {
    await db.storeSettings.create({
      data: {
        key: "home.content",
        value: {
          sections: [
            { key: "newsletter", enabled: true },
            { key: "newIn", enabled: false },
          ],
        },
      },
    });
    const content = await getHomeContent(db);
    // Saved order wins for the keys present...
    expect(content.sections[0]).toEqual({ key: "newsletter", enabled: true });
    expect(content.sections[1]).toEqual({ key: "newIn", enabled: false });
    // ...and every other known section is appended, enabled, so a section
    // never silently disappears just because an old save predates it.
    const remaining = content.sections.slice(2).map((s) => s.key).sort();
    expect(remaining).toEqual(["editBlocks", "editorial", "fromCloset", "instagram"].sort());
    expect(content.sections.slice(2).every((s) => s.enabled)).toBe(true);
    expect(content.sections).toHaveLength(DEFAULT_HOME_SECTIONS.length);
  });

  it("drops unknown keys and de-duplicates repeats rather than crashing", async () => {
    await db.storeSettings.create({
      data: {
        key: "home.content",
        value: {
          sections: [
            { key: "newIn", enabled: true },
            { key: "newIn", enabled: false }, // duplicate — first occurrence wins
            { key: "totallyMadeUp", enabled: true },
          ],
        },
      },
    });
    const content = await getHomeContent(db);
    expect(content.sections.filter((s) => s.key === "newIn")).toHaveLength(1);
    expect(content.sections.find((s) => s.key === "newIn")).toEqual({
      key: "newIn",
      enabled: true,
    });
    expect(content.sections.map((s) => s.key)).not.toContain("totallyMadeUp");
    expect(content.sections).toHaveLength(DEFAULT_HOME_SECTIONS.length);
  });

  it("a non-array saved value falls back to the default order entirely", async () => {
    await db.storeSettings.create({
      data: { key: "home.content", value: { sections: "not-an-array" } },
    });
    const content = await getHomeContent(db);
    expect(content.sections).toEqual(DEFAULT_HOME_SECTIONS);
  });
});
