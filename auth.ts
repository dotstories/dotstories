import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { type User } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Twitter from "next-auth/providers/twitter";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { LoginSchema } from "@/lib/auth-schemas";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getUserByEmail, getUserById, uniqueUsername } from "@/lib/users";

const RECHECK_MS = 5 * 60_000; // how often a session checks that its account still exists

/** Social logins show up when their keys are set (AUTH_GOOGLE_ID, AUTH_GITHUB_ID, AUTH_TWITTER_ID). */
export const socialProviders = () =>
  [
    process.env.AUTH_GOOGLE_ID && { id: "google", name: "Google", provider: Google },
    process.env.AUTH_GITHUB_ID && { id: "github", name: "GitHub", provider: GitHub },
    process.env.AUTH_TWITTER_ID && { id: "twitter", name: "X", provider: Twitter },
  ].filter((p) => !!p);

function adapter(): Adapter {
  const base = DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });
  // Social sign-ups get a username right away (editable on the profile).
  return {
    ...base,
    createUser: async (user) =>
      base.createUser!({ ...user, username: await uniqueUsername(user.email ?? user.name ?? "user") } as typeof user),
  };
}

// Built per request: the database binding only exists inside a request on Cloudflare.
export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth(() => ({
  adapter: adapter(),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...socialProviders().map((p) => p.provider),
    Credentials({
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await getUserByEmail(parsed.data.email);
        if (!user?.password || !user.emailVerified) return null;
        return (await verifyPassword(parsed.data.password, user.password)) ? (user as User) : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) token.username = user.username;
      const stale = Date.now() - ((token.checkedAt as number | undefined) ?? 0) > RECHECK_MS;
      if (token.sub && (trigger === "update" || (!user && stale))) {
        // Username or picture changed on the profile; or, every few minutes: the account still exists.
        // A deleted account is logged out on every device, not only where it was deleted.
        const fresh = await getUserById(token.sub);
        if (!fresh || fresh.deletedAt) return null;
        Object.assign(token, { username: fresh.username, picture: fresh.image, checkedAt: Date.now() });
      }
      if (user) token.checkedAt = Date.now();
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.username = token.username as string;
      return session;
    },
  },
}));
