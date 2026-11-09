"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } catch {
      setBusy(false);
    }
  };

  return (
    <button className="dash-signout" type="button" onClick={signOut} disabled={busy}>
      <LogOut size={15} strokeWidth={1.75} aria-hidden="true" />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
