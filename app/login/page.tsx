import type { Metadata } from "next";
import { AuthCard, SocialButtons } from "@/components/auth/auth-card";
import { CredentialsForm } from "@/components/auth/auth-forms";
import { safeRedirect } from "@/lib/redirect";

export const metadata: Metadata = { title: "Log in · DotStories" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const to = safeRedirect(typeof next === "string" ? next : null);
  return (
    <AuthCard title="Log in">
      {error && <p role="alert" className="text-sm text-[var(--cds-text-error)]">That didn&apos;t work. Please try again.</p>}
      <CredentialsForm mode="login" next={to} />
      <SocialButtons next={to} />
    </AuthCard>
  );
}
