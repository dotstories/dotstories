import "next-auth";

declare module "next-auth" {
  interface User {
    username?: string;
  }
  interface Session {
    user: { id: string; username: string; name?: string | null; email?: string | null; image?: string | null };
  }
}
