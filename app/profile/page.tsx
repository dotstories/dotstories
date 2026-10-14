import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import DeleteAccount from "@/components/delete-account";
import ProfileForm from "@/components/profile-form";
import { getUserById } from "@/lib/users";

export const metadata: Metadata = { title: "Profile · DotStories" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/login?next=%2Fprofile");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login?next=%2Fprofile");

  return (
    <main className="container flex flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <ProfileForm username={user.username} image={user.image} email={user.email} />
      <DeleteAccount username={user.username} />
    </main>
  );
}
