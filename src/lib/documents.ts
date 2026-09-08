import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";

import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Private document store (master §6, §9) — invoices, credit notes, labels.
 * Distinct from `src/lib/storage.ts` (browser-signed uploads for product
 * images): documents are SERVER-generated and downloaded only through an
 * authorized route.
 *
 * Live implementation is a private Supabase Storage bucket; until a Supabase
 * project exists it falls back to a git-ignored local directory (`.storage/`).
 * Tests inject `InMemoryDocumentStore`.
 */
export interface StoredDocument {
  bytes: Uint8Array;
  contentType: string;
}

export interface DocumentStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredDocument | null>;
  exists(key: string): Promise<boolean>;
}

export class InMemoryDocumentStore implements DocumentStore {
  private readonly objects = new Map<string, StoredDocument>();
  async put(key: string, bytes: Uint8Array, contentType: string) {
    this.objects.set(key, { bytes: Uint8Array.from(bytes), contentType });
  }
  async get(key: string) {
    return this.objects.get(key) ?? null;
  }
  async exists(key: string) {
    return this.objects.has(key);
  }
}

const DEV_ROOT = resolve(process.cwd(), ".storage");

function safePath(key: string): string {
  const clean = normalize(key).replace(/^(\.\.[/\\])+/, "");
  const full = join(DEV_ROOT, clean);
  if (!full.startsWith(DEV_ROOT)) throw new Error("invalid document key");
  return full;
}

class LocalDiskDocumentStore implements DocumentStore {
  async put(key: string, bytes: Uint8Array, contentType: string) {
    const p = safePath(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, bytes);
    await writeFile(`${p}.meta`, contentType, "utf8");
  }
  async get(key: string): Promise<StoredDocument | null> {
    try {
      const p = safePath(key);
      const bytes = await readFile(p);
      let contentType = "application/octet-stream";
      try {
        contentType = (await readFile(`${p}.meta`, "utf8")).trim() || contentType;
      } catch {
        /* no sidecar */
      }
      return { bytes: new Uint8Array(bytes), contentType };
    } catch {
      return null;
    }
  }
  async exists(key: string) {
    return (await this.get(key)) !== null;
  }
}

async function createSupabaseDocumentStore(): Promise<DocumentStore> {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const BUCKET = "documents";
  return {
    async put(key, bytes, contentType) {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(key, bytes, { contentType, upsert: true });
      if (error) throw error;
    },
    async get(key) {
      const { data, error } = await supabase.storage.from(BUCKET).download(key);
      if (error || !data) return null;
      return {
        bytes: new Uint8Array(await data.arrayBuffer()),
        contentType: data.type || "application/octet-stream",
      };
    },
    async exists(key) {
      const { data } = await supabase.storage.from(BUCKET).download(key);
      return Boolean(data);
    },
  };
}

let cached: DocumentStore | null = null;

/** The configured document store: Supabase `documents` bucket, else local disk. */
export async function getDocumentStore(): Promise<DocumentStore> {
  if (cached) return cached;
  cached = isSupabaseConfigured()
    ? await createSupabaseDocumentStore()
    : new LocalDiskDocumentStore();
  return cached;
}

export const DOCUMENTS_BUCKET = "documents";
