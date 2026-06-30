import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      rep_id: string;
      branch_id: string | null;
    };
  }
  interface User {
    role: string;
    rep_id: string;
    branch_id: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    rep_id: string;
    branch_id: string | null;
  }
}
