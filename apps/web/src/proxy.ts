import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'access_token';

const SIGNED_OUT_ROUTES = ['/login', '/register'];

/**
 * The cookie is httpOnly and signed by the API, so nothing here can verify it.
 * This only saves a signed-out visitor a round trip to a shell they cannot use;
 * the API remains the authority on every request.
 */
export const proxy = (request: NextRequest) => {
  const hasAccessCookie = request.cookies.has(ACCESS_COOKIE);
  const { pathname } = request.nextUrl;
  const isSignedOutRoute = SIGNED_OUT_ROUTES.includes(pathname);

  if (!hasAccessCookie && !isSignedOutRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasAccessCookie && isSignedOutRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ['/dashboard/:path*', '/orders/:path*', '/login', '/register'],
};
