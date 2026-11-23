import { Sprout } from "lucide-react";
import { Analyzer } from "@/components/Analyzer";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function DashboardShell({ user }: { user: { name: string; email: string } }) {
  return (
    <div className="dash">
      <aside className="dash-side">
        <Logo />
        <nav className="dash-nav" aria-label="Dashboard">
          <a href="#soil-analysis" aria-current="page">
            <Sprout size={18} strokeWidth={1.75} aria-hidden="true" />
            Soil analysis
          </a>
        </nav>
        <div className="dash-account">
          <span className="dash-avatar" aria-hidden="true">{initials(user.name)}</span>
          <div className="dash-identity">
            <span className="dash-user">{user.name}</span>
            <span className="dash-email">{user.email}</span>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main id="soil-analysis" className="dash-body">
        <Analyzer />
      </main>
    </div>
  );
}
