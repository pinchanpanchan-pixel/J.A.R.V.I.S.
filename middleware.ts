import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isMockMode, publicEnv } from "@/lib/env";

/** Refresca la sesión de Supabase en cada petición (sesión persistente). */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } });
  if (isMockMode) return res;
  const sb = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      get: (name: string) => req.cookies.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) => {
        res.cookies.set({ name, value, ...options });
      },
      remove: (name: string, options: CookieOptions) => {
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });
  await sb.auth.getUser();
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|sounds|manifest.json|sw.js|workbox-.*|swe-worker-.*).*)"],
};
