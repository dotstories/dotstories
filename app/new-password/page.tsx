import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { NewPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "New password · DotStories" };

export default async function NewPasswordPage({ searchParams }: PageProps<"/new-password">) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Choose a new password">
      {typeof token === "string" ? (
        <NewPasswordForm token={token} />
      ) : (
        <p>
          This link is incomplete.{" "}
          <Link className="cds--link" href="/reset-password">
            Ask for a new one
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
