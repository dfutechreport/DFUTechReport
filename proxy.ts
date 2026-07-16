import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

const ROLE_ROUTES: Record<string, string[]> = {
  admin:     ["/admin", "/dashboard"],
  operator:  ["/admin", "/dashboard"],
  uretim:    ["/admin/aktif-isler"],
  ik:        ["/admin/mesai"],
  teknisyen: ["/dashboard"],
  user:      ["/dashboard"],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = ["/admin", "/dashboard"].some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const sessionCookie = request.cookies.get("__session")?.value;
  if (!sessionCookie) return NextResponse.redirect(new URL("/", request.url));

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    const userData = userDoc.data();
    const role = userData?.role as string;

    if (!userData?.isApproved || !role) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const allowedRoutes = ROLE_ROUTES[role] ?? [];
    const hasAccess = allowedRoutes.some((r) => pathname.startsWith(r));

    if (!hasAccess) {
      return NextResponse.redirect(new URL(allowedRoutes[0] ?? "/", request.url));
    }

    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/", request.url));
    res.cookies.set("__session", "", { maxAge: 0, path: "/" });
    return res;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};