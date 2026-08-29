import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = {
  name: string;
  value: string;
  options?: any;
};

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Never make public/static/API traffic wait on a remote auth lookup.
  // Route handlers enforce their own authorization where needed.
  const bypassAuth =
    path.startsWith("/login") ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/owner-setup") ||
    path.startsWith("/api/") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico";

  if (bypassAuth) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  try {
    // getSession reads the signed session from cookies and avoids a blocking
    // Supabase network request on every page navigation.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    return response;
  } catch {
    // Middleware must fail fast instead of taking the entire site down with a 504.
    // Server pages/API routes remain responsible for sensitive authorization.
    return response;
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2)$).*)",
  ],
};
