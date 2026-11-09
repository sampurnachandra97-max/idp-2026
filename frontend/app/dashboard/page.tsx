import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { getCurrentUser } from "@/lib/session";
import "./dashboard.css";

export const metadata: Metadata = { title: "Dashboard · Soil Intelligence" };

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <DashboardShell user={{ name: user.name, email: user.email }} />;
}
