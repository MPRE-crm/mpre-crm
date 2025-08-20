import NextAuth from "next-auth";
import { SupabaseAdapter } from "@next-auth/supabase-adapter";
import EmailProvider from "next-auth/providers/email";

const handler = NextAuth({
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!, // Make sure to use the correct URL for Next.js
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!, // requires service role
  }),

  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
    }),
    // Add Google/GitHub/etc providers here when needed
  ],

  session: {
    strategy: "database",
  },

  pages: {
    signIn: "/login",
  },
});

export { handler as GET, handler as POST };
