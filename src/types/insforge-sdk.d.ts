/**
 * Type declarations for @insforge/sdk.
 *
 * The real package is installed in production via `npm install`.
 * For local mock-mode development (MOCK_DB=true), a stub is used via the
 * webpack alias in next.config.ts — createServiceClient() is never actually
 * called in mock mode so the stub is never invoked.
 *
 * Using `any` return types intentionally — this is a build stub, not a
 * type-safe integration. Actual type safety comes from the calling code's
 * explicit type casts (e.g. `as Order`, `as Order | null`).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@insforge/sdk' {
  interface InsforgeQueryBuilder extends Promise<{ data: any; error: any }> {
    select(columns: string): InsforgeQueryBuilder
    insert(data: Record<string, any> | Record<string, any>[]): InsforgeQueryBuilder
    update(data: Record<string, any>): InsforgeQueryBuilder
    delete(): InsforgeQueryBuilder
    eq(column: string, value: unknown): InsforgeQueryBuilder
    range(from: number, to: number): InsforgeQueryBuilder
    order(column: string, options?: { ascending?: boolean }): InsforgeQueryBuilder
    maybeSingle(): Promise<{ data: any; error: any }>
    single(): Promise<{ data: any; error: any }>
  }

  interface InsforgeDatabase {
    from(table: string): InsforgeQueryBuilder
  }

  interface InsforgeClient {
    database: InsforgeDatabase
  }

  export function createClient(config: {
    baseUrl: string
    anonKey: string
    isServerMode?: boolean
  }): InsforgeClient
}
