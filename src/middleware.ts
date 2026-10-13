import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "imob_session";
/** Espelho de CRM_MARK_COOKIE em src/lib/auth.ts. */
const CRM_MARK_COOKIE = "imob_crm";

/** Espelho de AUTH_OPEN em src/lib/auth.ts. */
const AUTH_TEMP_DISABLED = process.env.AUTH_OPEN !== "0";

/** Guarda de borda: bloqueia /crm e /admin sem cookie de sessão.
 *  A validação real (sessão válida + papel) acontece nos layouts server-side. */
export function middleware(req: NextRequest) {
  if (AUTH_TEMP_DISABLED) {
    // Marca este navegador como de quem usa o painel: o site mostra a barra de edição
    const res = NextResponse.next();
    if (!req.cookies.has(CRM_MARK_COOKIE)) {
      res.cookies.set(CRM_MARK_COOKIE, "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
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
