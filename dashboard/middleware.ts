// middleware.ts — protección por contraseña simple
// Corre en el Edge Runtime (sin acceso a Node.js nativo).
// La contraseña vive en la env var server-side SITE_PASSWORD.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'bi_auth'
const MAX_AGE     = 60 * 60 * 24 * 7  // 7 días

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Los endpoints /api/... no requieren auth del navegador
  // (el dashboard ya está protegido en la ruta raíz)
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // Ruta de login
  if (pathname === '/login') return NextResponse.next()

  const password   = process.env.SITE_PASSWORD ?? ''
  const cookieVal  = req.cookies.get(COOKIE_NAME)?.value ?? ''

  // Ya autenticado
  if (cookieVal === password) return NextResponse.next()

  // POST /login — verificar contraseña
  if (req.method === 'POST' && pathname === '/login') return NextResponse.next()

  // Redirigir al login
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
