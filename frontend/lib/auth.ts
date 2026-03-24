import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

/**
 * Fallback allowlist used when the backend is unreachable.
 * The live allowlist is managed via the admin Settings page and stored in the DB.
 */
export const ADMIN_EMAILS = [
  'jnoah_baier@berkeley.edu',
  'mppaz@berkeley.edu',
  'joshua.mussman@berkeley.edu',
  'evanhaas@berkeley.edu',
];

async function isEmailAllowed(email: string): Promise<boolean> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      const res = await fetch(
        `${apiUrl}/api/admin/allowlist/check?email=${encodeURIComponent(email)}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const { allowed } = await res.json();
        return allowed as boolean;
      }
    } catch {
      // fall through to hardcoded list
    }
  }
  // Fallback: use hardcoded list if backend is unavailable
  return ADMIN_EMAILS.includes(email);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return isEmailAllowed(user.email);
    },

    async session({ session }) {
      return session;
    },
  },

  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
};
