import type { Metadata } from "next";
import { AuthCard, SocialButtons } from "@/components/auth/auth-card";
import { CredentialsForm } from "@/components/auth/auth-forms";
import { safeRedirect } from "@/lib/redirect";

export const metadata: Metadata = { title: "Create an account · DotStories" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { next } = await searchParams;
  const to = safeRedirect(typeof next === "string" ? next : null);
  return (
    <AuthCard title="Create an account">
      <CredentialsForm mode="register" next={to} />
      <SocialButtons next={to} />
    </AuthCard>
  );
}
