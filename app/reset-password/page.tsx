import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset password · DotStories" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Reset password">
      <ResetForm />
    </AuthCard>
  );
}
