"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export type AuthMode = "signin" | "signup";

const SERVICE_DOWN = "The service is not responding. Please try again in a moment.";
const RETRY_DELAY_MS = 700;

const COPY = {
  signin: {
    title: "Sign in",
    intro: "Use your email and a password. New emails get an account automatically.",
    submit: "Sign in",
    busy: "Signing in…",
    switchText: "New to Soil Intelligence?",
    switchAction: "Create an account",
  },
  signup: {
    title: "Create your account",
    intro: "Start analysing soil tests in under a minute.",
    submit: "Create account",
    busy: "Creating account…",
    switchText: "Already have an account?",
    switchAction: "Sign in",
  },
};

/** Tries once more after a brief pause, so a momentary server hiccup goes unnoticed. */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  try {
    const first = await fetch(url, init);
    if (first.status < 500) return first;
  } catch {
    // The second attempt below reports the failure if it is still happening.
  }
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  return fetch(url, init);
}

type Field = "name" | "email" | "password";
type FieldErrors = Partial<Record<Field, string>>;

function validate(mode: AuthMode, name: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === "signup" && !name.trim()) errors.name = "Enter your name";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) errors.email = "Enter a valid email address";
  if (mode === "signup" && password.length < 8) errors.password = "Use at least 8 characters";
  if (mode === "signin" && !password) errors.password = "Enter your password";
  return errors;
}

export function AuthForm({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setErrors({});
    setFailure(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(mode, name, email, password);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const response = await fetchWithRetry(`/api/auth/${mode === "signin" ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signin" ? { email, password } : { name, email, password }),
      });
      if (response.ok) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      const body = await response.json().catch(() => null);
      const known = [400, 401, 409, 429].includes(response.status) && typeof body?.detail === "string";
      setFailure(known ? body.detail : response.status === 422 ? "Check your details and try again." : SERVICE_DOWN);
    } catch {
      setFailure(SERVICE_DOWN);
    }
    setBusy(false);
  };

  const field = (
    id: Field,
    label: string,
    value: string,
    onChange: (next: string) => void,
    type: string,
    autoComplete: string,
  ) => (
    <label className="auth-field">
      <span>{label}</span>
      <input
        name={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={Boolean(errors[id])}
        aria-describedby={errors[id] ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {errors[id] && <em id={`${id}-error`}>{errors[id]}</em>}
    </label>
  );

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <h1>{copy.title}</h1>
      <p className="auth-intro">{copy.intro}</p>

      {mode === "signup" && field("name", "Name", name, setName, "text", "name")}
      {field("email", "Email", email, setEmail, "email", "email")}
      {field(
        "password",
        "Password",
        password,
        setPassword,
        "password",
        mode === "signin" ? "current-password" : "new-password",
      )}

      {failure && <p className="auth-failure" role="alert">{failure}</p>}

      <button className="auth-submit" type="submit" disabled={busy}>
        {busy ? copy.busy : copy.submit}
      </button>

      <p className="auth-switch">
        {copy.switchText}{" "}
        <button type="button" onClick={switchMode}>{copy.switchAction}</button>
      </p>
    </form>
  );
}
