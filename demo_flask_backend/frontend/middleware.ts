// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 1. Check if the 'session' cookie exists
  // Flask's default cookie name is 'session'.
  const sessionCookie = request.cookies.get('session')

  // 2. Define protected routes (Add more as needed)
  // We want to protect the home page ('/') and any future dashboard routes
  const isProtectedRoute = request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/dashboard')

  // 3. The Logic:
  // If user is trying to access a protected route BUT has no cookie...
  if (isProtectedRoute && !sessionCookie) {
    // ...redirect them to the Login page immediately.
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Otherwise, let them pass
  return NextResponse.next()
}

// Optimization: Only run middleware on specific paths to save performance
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (The login page itself!)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ],
}