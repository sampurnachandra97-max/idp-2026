import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Logo } from "@/components/Logo";
import { SoilField } from "@/components/SoilField";
import { getCurrentUser } from "@/lib/session";
import "../landing.css";

export const metadata: Metadata = { title: "Sign in · Soil Intelligence" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { mode } = await searchParams;

  return (
    <main className="landing landing-auth">
      <div className="landing-copy auth-copy">
        <div className="auth-logo">
          <Logo />
        </div>
        <AuthForm initialMode={mode === "signup" ? "signup" : "signin"} />
      </div>
      <SoilField />
    </main>
  );
}
