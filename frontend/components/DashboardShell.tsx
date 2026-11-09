"use client";

import { ChartColumn, Sprout, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Analyzer } from "@/components/Analyzer";
import { Logo } from "@/components/Logo";
import { ModelEvidence } from "@/components/ModelEvidence";
import { SignOutButton } from "@/components/SignOutButton";

type View = "analysis" | "performance";

const VIEWS: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "analysis", label: "Soil analysis", icon: Sprout },
  { id: "performance", label: "Model performance", icon: ChartColumn },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function DashboardShell({ user }: { user: { name: string; email: string } }) {
  const [view, setView] = useState<View>("analysis");

  return (
    <div className="dash">
      <aside className="dash-side">
        <Logo />
        <nav className="dash-nav" aria-label="Dashboard">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={view === id ? "page" : undefined}
              onClick={() => setView(id)}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </button>
          ))}
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

      <main className="dash-body">
        {/* Both views stay mounted, so switching never loses the entered sample. */}
        <section hidden={view !== "analysis"}>
          <Analyzer />
        </section>
        <section hidden={view !== "performance"} className="dash-section">
          <h1>Model performance</h1>
          <ModelEvidence />
          <p className="dash-credits">
            Soil data: <a href="https://data.mendeley.com/datasets/c7tr9j78td/1">AgriNet, KVK Bareilly</a> (
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>). Crop data:{" "}
            <a href="https://raw.githubusercontent.com/Gladiator07/Harvestify/master/Data-processed/crop_recommendation.csv">
              Crop Recommendation benchmark
            </a>
            . Soil models are trained on one district in India and do not measure soil moisture. Decision
            support only; confirm with a soil lab before acting.
          </p>
        </section>
      </main>
    </div>
  );
}
