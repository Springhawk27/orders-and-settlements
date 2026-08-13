import { NextResponse, type NextRequest } from 'next/server';

/**
 * The refresh cookie, not the access one. Access tokens last minutes and their
 * cookie disappears with them, so checking that would bounce a signed-in user
 * to the login page every quarter of an hour. The presence of a refresh cookie
 * means there is still a session to renew.
 */
const REFRESH_COOKIE = 'refresh_token';

const SIGNED_OUT_ROUTES = ['/login', '/register'];

/**
 * Cookies are httpOnly and signed by the API, so nothing here can verify one.
 * This only saves a signed-out visitor a round trip to a shell they cannot use;
 * the API remains the authority on every request.
 */
export const proxy = (request: NextRequest) => {
  const hasSession = request.cookies.has(REFRESH_COOKIE);
  const { pathname } = request.nextUrl;
  const isSignedOutRoute = SIGNED_OUT_ROUTES.includes(pathname);

  if (!hasSession && !isSignedOutRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasSession && isSignedOutRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ['/dashboard/:path*', '/orders/:path*', '/login', '/register'],
};
