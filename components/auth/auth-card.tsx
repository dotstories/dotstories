import Image from "next/image";
import { signIn, socialProviders } from "@/auth";

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="container flex flex-1 justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={36} height={36} />
          <h1 className="text-2xl font-semibold">{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}

/** Google / GitHub / X: shown when their keys are set. Plain forms, no JavaScript needed. */
export function SocialButtons({ next }: { next: string }) {
  const providers = socialProviders();
  if (!providers.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-xs text-[var(--cds-text-secondary)]">or</p>
      {providers.map((p) => (
        <form
          key={p.id}
          action={async () => {
            "use server";
            await signIn(p.id, { redirectTo: next });
          }}
        >
          <button type="submit" className="cds--btn cds--btn--secondary !w-full !max-w-none">
            Continue with {p.name}
          </button>
        </form>
      ))}
    </div>
  );
}
