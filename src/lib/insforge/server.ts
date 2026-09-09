import { createClient as createInsforgeClient } from '@insforge/sdk'

/**
 * Server-side Insforge client for API routes.
 * Uses the service role key to bypass Row Level Security.
 * Never import this in client components.
 */
export function createServiceClient() {
  return createInsforgeClient({
    baseUrl:        process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey:        process.env.INSFORGE_SERVICE_ROLE_KEY!,
    isServerMode:   true,
  })
}
