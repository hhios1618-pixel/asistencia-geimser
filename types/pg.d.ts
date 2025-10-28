declare module 'pg' {
  export interface QueryResult<R = unknown> {
    rows: R[];
  }

  export interface PoolConfig {
    connectionString?: string;
    ssl?: { rejectUnauthorized?: boolean };
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<R = unknown>(text: string, params?: unknown[]): Promise<QueryResult<R>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
    on(event: 'error', listener: (error: Error) => void): this;
  }

  export interface PoolClient {
    query<R = unknown>(text: string, params?: unknown[]): Promise<QueryResult<R>>;
    release(): void;
  }
}
