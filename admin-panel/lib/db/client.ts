import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Create admin-panel/.env.local from admin-panel/.env.example and set a valid PostgreSQL connection string.",
    );
  }

  return databaseUrl;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      min: parseInt(process.env.DATABASE_POOL_MIN || "2"),
      max: parseInt(process.env.DATABASE_POOL_MAX || "10"),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis:
        parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || "5000") || 5000,
    });

    pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<T>> {
  const client = await getPool().connect();

  try {
    return await client.query<T>(text, values);
  } finally {
    client.release();
  }
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
