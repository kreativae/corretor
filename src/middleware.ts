import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "imob_session";

/** Espelho de AUTH_OPEN em src/lib/auth.ts. */
const AUTH_TEMP_DISABLED = process.env.AUTH_OPEN !== "0";

/** Guarda de borda: bloqueia /crm e /admin sem cookie de sessão.
 *  A validação real (sessão válida + papel) acontece nos layouts server-side. */
export function middleware(req: NextRequest) {
  if (AUTH_TEMP_DISABLED) {
    return NextResponse.next();
  }

  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/crm/:path*", "/admin/:path*"],
};
