import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./AuthForm";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));

const respond = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const type = (name: string, value: string) =>
  fireEvent.change(document.querySelector(`input[name="${name}"]`)!, { target: { value } });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  replace.mockClear();
});

describe("AuthForm", () => {
  it("signs in and opens the dashboard", async () => {
    const fetchMock = vi.fn((_url: string, _init: RequestInit) => respond({ id: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForm initialMode="signin" />);
    type("email", "asha@example.com");
    type("password", "correct-horse");
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/login");
  });

  it("validates before calling the API", () => {
    const fetchMock = vi.fn(() => respond({}));
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthForm initialMode="signup" />);
    type("email", "nope");
    type("password", "short");
    fireEvent.submit(document.querySelector("form")!);

    expect(screen.getByText("Enter your name")).toBeTruthy();
    expect(screen.getByText("Enter a valid email address")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the reason when sign-in is refused", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respond({ detail: "Incorrect email or password." }, 401)));
    render(<AuthForm initialMode="signin" />);
    type("email", "asha@example.com");
    type("password", "wrong-password");
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Incorrect"));
    expect(replace).not.toHaveBeenCalled();
  });

  it("switches between sign in and create account", () => {
    render(<AuthForm initialMode="signin" />);
    expect(document.querySelector('input[name="name"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(document.querySelector('input[name="name"]')).not.toBeNull();
  });
});
