declare module "better-sqlite3" {
  type BindParameters = unknown[] | Record<string, unknown>;

  interface Statement {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(params?: BindParameters): unknown;
  }

  export default class Database {
    constructor(filename: string);
    exec(sql: string): this;
    prepare(sql: string): Statement;
    transaction<T extends (...args: never[]) => unknown>(fn: T): T;
  }
}
