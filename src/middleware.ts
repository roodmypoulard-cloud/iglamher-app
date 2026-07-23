import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Every authenticated area. Anonymous users are redirected to /signin before the
// page renders. Prefixes are chosen NOT to match public routes:
//   • "/book"  → /book/[slug], /book/success, /booking, /bookings  (booking flow)
//   • "/pro/"  → provider dashboard ONLY (keeps public "/professionals/[slug]" open)
//   • "/admin" → auth gate here; ROLE (admin) is still enforced in requireAdminPage
// Public (intentionally absent): /, /discover, /search, /categories, /services,
//   /professionals, /about, /how-it-works, /legal, /offline, auth pages.
const PROTECTED = [
  "/book",
  "/bookings",
  "/messages",
  "/profile",
  "/onboarding",
  "/account",
  "/notifications",
  "/pro/",
  "/admin",
];
const AUTH_PAGES = ["/signin", "/signup"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const needsAuthCheck =
    PROTECTED.some((p) => path.startsWith(p)) || AUTH_PAGES.some((p) => path.startsWith(p));

  // PERF: public navigations (/discover, /search, /categories, /services, …) pay
  // ZERO auth cost — no Supabase network round-trip. Only protected + auth pages
  // hit auth.getUser(), which is a network call that otherwise taxed every tap.
  if (!needsAuthCheck) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // If Supabase isn't configured yet (pre-Phase-2 setup / placeholders), don't block anything.
  if (!url || !anon || url.includes("placeholder")) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // unauthenticated → keep off protected routes, remember destination.
  // EXCEPT /book/success: that is the Stripe Checkout return URL. Its session_id
  // is proof of payment (the page confirms server-side with no browser auth), so
  // bouncing it to /signin would strand a paid booking. Let it render.
  const isStripeReturn = path.startsWith("/book/success");
  if (!user && !isStripeReturn && PROTECTED.some((p) => path.startsWith(p))) {
    const redirect = new URL("/signin", request.url);
    // Preserve the full destination incl. query (e.g. ?session_id=…) so re-auth
    // returns the user exactly where they were, not a query-stripped path.
    redirect.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(redirect);
  }

  // authenticated → keep off auth pages
  if (user && AUTH_PAGES.some((p) => path.startsWith(p))) {
    return NextResponse.redirect(new URL("/discover", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:png|jpg|jpeg|svg|webmanifest)).*)"],
};
