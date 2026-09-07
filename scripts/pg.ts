import EmbeddedPostgres from "embedded-postgres";

/**
 * Local development / test PostgreSQL via `embedded-postgres` — a real
 * PostgreSQL 17 server, no Docker and no account required (decision D-17).
 * Production uses Supabase; these helpers are dev/test only and never imported
 * by application code.
 */

export const PG_HOST = "127.0.0.1";
export const PG_PORT = 5433;
export const PG_USER = "postgres";
export const PG_PASSWORD = "postgres";
export const DEV_DB = "poojaedit_dev";
export const SHADOW_DB = "poojaedit_shadow";

export function dbUrl(database: string, port: number = PG_PORT): string {
  return `postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${port}/${database}`;
}

export function createEmbeddedPostgres(opts: {
  dataDir: string;
  port?: number;
  persistent?: boolean;
}): EmbeddedPostgres {
  return new EmbeddedPostgres({
    databaseDir: opts.dataDir,
    user: PG_USER,
    password: PG_PASSWORD,
    port: opts.port ?? PG_PORT,
    persistent: opts.persistent ?? true,
  });
}

/** Create a database, tolerating "already exists". */
export async function ensureDatabase(
  pg: EmbeddedPostgres,
  name: string,
): Promise<void> {
  try {
    await pg.createDatabase(name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) throw error;
  }
}
