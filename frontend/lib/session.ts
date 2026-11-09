import { cookies } from "next/headers";

const BACKEND = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export interface User {
  id: number;
  name: string;
  email: string;
}

/** Asks the API who is signed in, so an expired or forged cookie is never trusted. */
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get("si_session")?.value;
  if (!token) return null;
  try {
    const response = await fetch(`${BACKEND}/api/auth/me`, {
      headers: { Cookie: `si_session=${token}` },
      cache: "no-store",
    });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}
