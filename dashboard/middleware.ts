import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'bi_auth'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api/')) return NextResponse.next()
  if (pathname === '/login') return NextResponse.next()

  const password  = process.env.SITE_PASSWORD ?? ''
  const cookieVal = req.cookies.get(COOKIE_NAME)?.value ?? ''

  if (cookieVal === password) return NextResponse.next()

  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
