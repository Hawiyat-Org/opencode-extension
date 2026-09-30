/**
 * Minimal ambient types for Bun's SQLite module.
 *
 * The extension runs inside the OpenCode server, which is a Bun process, so
 * `bun:sqlite` is always available at runtime. We declare only the surface we
 * use instead of pulling in `@types/bun` (which would drag in the whole Bun
 * global namespace).
 */
declare module "bun:sqlite" {
  export interface Statement {
    get(...params: unknown[]): unknown
    all(...params: unknown[]): unknown[]
    run(...params: unknown[]): unknown
  }

  export class Database {
    constructor(path: string, options?: { readonly?: boolean; create?: boolean })
    query(sql: string): Statement
    prepare(sql: string): Statement
    close(): void
  }
}

/** Minimal ambient types for `bun:test` (dev only). */
declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void
  export const test: (name: string, fn: () => void | Promise<void>) => void
  export const afterAll: (fn: () => void | Promise<void>) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const expect: any
}
