import 'server-only';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0';

import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

const getConnectionString = () => {
  const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error('POSTGRES_URL_NON_POOLING or POSTGRES_URL must be defined');
  }
  return url;
};

const fatalCodes = new Set([
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08007', // transaction_resolution_unknown
  '08P01', // protocol_violation
  'XX000', // internal_error (covers db termination)
]);

const shouldResetPool = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const pgError = error as { code?: string; message?: string };
  if (pgError.code && fatalCodes.has(pgError.code)) {
    return true;
  }
  if (typeof pgError.message === 'string' && pgError.message.includes('db_termination')) {
    return true;
  }
  return false;
};

const resetPool = async () => {
  if (!pool) {
    return;
  }
  const current = pool;
  pool = null;
  try {
    await current.end();
  } catch (closeError) {
    console.warn('[postgres] pool close failed', closeError);
  }
};

export const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: getConnectionString(),
      ssl: { rejectUnauthorized: false },
    });
    pool.on('error', (error) => {
      console.error('[postgres] pool error', error);
      if (shouldResetPool(error)) {
        void resetPool();
      }
    });
  }
  return pool;
};

export const runQuery = async <T = unknown>(query: string, params: unknown[] = []) => {
  try {
    return await getPool().query<T>(query, params);
  } catch (error) {
    if (shouldResetPool(error)) {
      await resetPool();
      return getPool().query<T>(query, params);
    }
    throw error;
  }
};

export const withTransaction = async <T>(handler: (client: PoolClient) => Promise<T>) => {
  const poolClient = await getPool().connect();
  try {
    await poolClient.query('BEGIN');
    const result = await handler(poolClient);
    await poolClient.query('COMMIT');
    return result;
  } catch (error) {
    await poolClient.query('ROLLBACK');
    throw error;
  } finally {
    poolClient.release();
  }
};
