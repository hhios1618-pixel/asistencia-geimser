import 'server-only';

const TLS_WARNING_PATCHED = Symbol.for('asistencia.patchTlsWarning');
if (!(process as unknown as Record<symbol, boolean>)[TLS_WARNING_PATCHED]) {
  (process as unknown as Record<symbol, boolean>)[TLS_WARNING_PATCHED] = true;
  if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  const originalEmitWarning = process.emitWarning.bind(process) as (...emitArgs: unknown[]) => void;
  process.emitWarning = ((warning: unknown, ...args: unknown[]) => {
    if (
      (typeof warning === 'string' && warning.includes('NODE_TLS_REJECT_UNAUTHORIZED')) ||
      (warning instanceof Error && warning.message.includes('NODE_TLS_REJECT_UNAUTHORIZED'))
    ) {
      return;
    }
    return originalEmitWarning(warning, ...args);
  }) as typeof process.emitWarning;
}

import { Pool, PoolClient } from 'pg';

type PoolSlot = {
  pool: Pool;
  key: string;
};

let poolSlot: PoolSlot | null = null;

const getConnectionString = () => {
  const pooledUrl = process.env.POSTGRES_URL;
  const nonPooledUrl = process.env.POSTGRES_URL_NON_POOLING;
  const preferPooled = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

  const url = preferPooled ? pooledUrl ?? nonPooledUrl : nonPooledUrl ?? pooledUrl;
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

const isConnectionLimitError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const pgError = error as { code?: string; message?: string };
  if (pgError.code === '53300') {
    return true; // too_many_connections
  }
  const message = typeof pgError.message === 'string' ? pgError.message : '';
  return (
    message.includes('MaxClientsInSessionMode') ||
    message.toLowerCase().includes('max clients reached') ||
    message.toLowerCase().includes('max client connections reached') ||
    message.toLowerCase().includes('too many clients')
  );
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resetPool = async () => {
  if (!poolSlot) {
    return;
  }
  const current = poolSlot.pool;
  poolSlot = null;
  try {
    await current.end();
  } catch (closeError) {
    console.warn('[postgres] pool close failed', closeError);
  }
};

const createPool = () => {
  const connectionString = getConnectionString();
  const poolMaxRaw = process.env.PG_POOL_MAX;
  const poolMax = poolMaxRaw ? Math.max(1, Number.parseInt(poolMaxRaw, 10)) : process.env.VERCEL === '1' ? 3 : 10;
  const baseConfig = {
    connectionString,
    ssl: { rejectUnauthorized: false },
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: process.env.VERCEL === '1',
  } as unknown as Record<string, unknown>;

  baseConfig.max = Number.isFinite(poolMax) ? poolMax : 3;
  const pool = new Pool(baseConfig as never);
  pool.on('error', (error) => {
    console.error('[postgres] pool error', error);
    if (shouldResetPool(error)) {
      void resetPool();
    }
  });
  poolSlot = { pool, key: connectionString };
  return pool;
};

export const getPool = () => {
  const connectionString = getConnectionString();
  if (!poolSlot || poolSlot.key !== connectionString) {
    if (poolSlot) {
      void resetPool();
    }
    return createPool();
  }
  return poolSlot.pool;
};

export const runQuery = async <T = unknown>(query: string, params: unknown[] = []) => {
  try {
    return await getPool().query<T>(query, params);
  } catch (error) {
    if (isConnectionLimitError(error)) {
      await sleep(250 + Math.floor(Math.random() * 250));
      return await getPool().query<T>(query, params);
    }
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
