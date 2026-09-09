/**
 * Next.js middleware — protects the /admin area with HTTP Basic Auth.
 *
 * Uses a single shared password stored in ADMIN_AUTH_SECRET.
 * For multi-user access, swap this for a proper auth provider (e.g. NextAuth,
 * Clerk) — the PRD leaves this as an Open Item for v1.
 */
import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  // Only protect /admin/* routes
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    return NextResponse.next()
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const [scheme, encoded] = authHeader.split(' ')

  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8')
    const [, password] = decoded.split(':')
    if (password === process.env.ADMIN_AUTH_SECRET) {
      return NextResponse.next()
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="KelliWorks Admin"',
    },
  })
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
