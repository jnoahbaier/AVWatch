import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { ADMIN_EMAILS } from '@/lib/auth';

/**
 * Protects all /admin/* routes.
 *
 * Subdomain routing (optional):
 *   If you want the admin panel on admin.avwatch.org instead of avwatch.org/admin,
 *   configure your DNS to point admin.avwatch.org at the same deployment, then
 *   uncomment the hostname check below. Railway/Vercel custom domains handle the TLS.
 */
export default withAuth(
  function middleware(req) {
    const email = req.nextauth?.token?.email as string | undefined;

    // Double-check the allowlist server-side (withAuth already requires a session,
    // but we re-validate the email to be safe).
    if (!email || !ADMIN_EMAILS.includes(email)) {
      return NextResponse.redirect(new URL('/admin/login?error=AccessDenied', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Only run the middleware function above when there IS a valid session token;
      // if there is no token, withAuth redirects to the signIn page automatically.
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  // Protect all /admin/* routes except the login page itself
  matcher: ['/admin/((?!login).*)'],
};
