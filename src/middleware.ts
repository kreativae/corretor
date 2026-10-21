import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "imob_session";
/** Espelho de CRM_MARK_COOKIE em src/lib/auth.ts. */
const CRM_MARK_COOKIE = "imob_crm";

/** Espelho de AUTH_OPEN em src/lib/auth.ts. */
const AUTH_TEMP_DISABLED = process.env.AUTH_OPEN === "1";

/** Espelho de TENANT_HEADER em src/lib/tenant.ts. */
const TENANT_HEADER = "x-imob-tenant";

/** Espelho de PATH_HEADER em src/lib/tenant.ts (endereço pedido, para o www das empresas). */
const PATH_HEADER = "x-imob-path";

/** Repassa ?t=empresa como cabeçalho interno (e descarta o que vier do cliente) */
function forward(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.delete(TENANT_HEADER);
  headers.set(PATH_HEADER, req.nextUrl.pathname + req.nextUrl.search);
  const t = req.nextUrl.searchParams.get("t");
  if (t && /^[a-z0-9-]{1,40}$/.test(t)) headers.set(TENANT_HEADER, t);
  return NextResponse.next({ request: { headers } });
}

/** Guarda de borda: bloqueia /crm e /admin sem cookie de sessão.
 *  A validação real (sessão válida + papel) acontece nos layouts server-side. */
/**
 * Endereço oficial com www (NEXT_PUBLIC_SITE_URL = https://www.dominio): quem digita sem o www
 * é levado para ele, no mesmo caminho. Outras empresas e domínios não mudam.
 */
const OFFICIAL = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || "").host;
  } catch {
    return "";
  }
})();

function toWww(req: NextRequest) {
  if (!OFFICIAL.startsWith("www.")) return null;
  // Webhooks (WhatsApp, portais), feed e agendador chamam /api direto: redirecionar quebra o POST
  if (req.nextUrl.pathname.startsWith("/api/")) return null;
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim().toLowerCase();
  if (host !== OFFICIAL.slice(4)) return null;
  const { pathname, search } = req.nextUrl;
  return NextResponse.redirect(`https://${OFFICIAL}${pathname}${search}`, 308);
}

export function middleware(req: NextRequest) {
  const www = toWww(req);
  if (www) return www;
  const { pathname } = req.nextUrl;
  const panel = pathname.startsWith("/crm") || pathname.startsWith("/admin");
  if (!panel) return forward(req);

  if (AUTH_TEMP_DISABLED) {
    // Marca este navegador como de quem usa o painel: o site mostra a barra de edição
    const res = forward(req);
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

  const { search } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return forward(req);
}

export const config = {
  // Tudo, menos arquivos estáticos do Next
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
