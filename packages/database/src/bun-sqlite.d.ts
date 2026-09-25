// Minimal types for the Bun built-in; Node type-checks this package without bun-types.
declare module "bun:sqlite" {
  interface Statement {
    run(...params: unknown[]): unknown;
    values(...params: unknown[]): unknown[][];
  }
  export class Database {
    constructor(file: string);
    query(sql: string): Statement;
    close(): void;
  }
}
