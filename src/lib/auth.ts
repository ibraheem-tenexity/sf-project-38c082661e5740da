import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

// Demo credentials map (email → password)
const DEMO_PASSWORDS: Record<string, string> = {
  "demo@singerindustrial.com": "Demo1234!",
  "manager@singerindustrial.com": "Demo1234!",
  "admin@singerindustrial.com": "Demo1234!",
  "rep.test@singerindustrial.com": "Demo1234!",
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Microsoft",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const expectedPw = DEMO_PASSWORDS[credentials.email.toLowerCase()];
        if (!expectedPw || expectedPw !== credentials.password) return null;

        // Look up the rep from DB
        const db = getDb();
        const reps = await db
          .select()
          .from(schema.rep)
          .where(eq(schema.rep.email, credentials.email.toLowerCase()))
          .limit(1);

        if (!reps.length) return null;
        const rep = reps[0];

        return {
          id: rep.rep_id,
          email: rep.email,
          name: rep.rep_name,
          role: rep.role,
          rep_id: rep.rep_id,
          branch_id: rep.branch_id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.rep_id = (user as any).rep_id;
        token.branch_id = (user as any).branch_id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).rep_id = token.rep_id;
        (session.user as any).branch_id = token.branch_id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
