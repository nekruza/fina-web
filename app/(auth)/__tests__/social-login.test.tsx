/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "../login/page";
import SignupPage from "../signup/page";
import { track } from "@/lib/mixpanel";

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/mixpanel", () => ({ track: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: jest.fn(), useSearchParams: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/client");
const { useRouter, useSearchParams } = jest.requireMock("next/navigation");
const signInWithOAuth = jest.fn();

beforeEach(() => {
  signInWithOAuth.mockReset().mockResolvedValue({ error: null });
  createClient.mockReturnValue({ auth: { signInWithOAuth } });
  useRouter.mockReturnValue({ replace: jest.fn() });
  useSearchParams.mockReturnValue(new URLSearchParams("next=%2Fapp%2Fstudy-plan"));
});

describe.each([
  ["login", LoginPage, "Log in"],
  ["signup", SignupPage, "Create account"],
] as const)("%s social sign-in", (_name, Page, emailButton) => {
  it.each(["Apple", "Google"])("starts %s OAuth and preserves the destination", async (provider) => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: `Continue with ${provider}` }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: provider.toLowerCase(),
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Fapp%2Fstudy-plan` },
    }));
    expect(track).toHaveBeenCalledWith("Auth Started", { method: provider.toLowerCase() });
    expect(screen.getByRole("button", { name: "Redirecting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: emailButton })).toBeDisabled();
  });

  it("prevents competing OAuth requests while redirecting", async () => {
    signInWithOAuth.mockReturnValue(new Promise(() => {}));
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Apple" }));
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
  });

  it("rejects an external return destination", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("next=https://example.com"));
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Apple" }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "apple",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2Fapp` },
    }));
  });

  it("shows a provider error and allows a retry", async () => {
    signInWithOAuth.mockResolvedValueOnce({ error: new Error("Apple sign-in is unavailable") });
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Apple" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Apple sign-in is unavailable");
    expect(screen.getByRole("button", { name: "Continue with Apple" })).toBeEnabled();
    expect(screen.getByRole("button", { name: emailButton })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Apple" }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("handles a thrown network error", async () => {
    signInWithOAuth.mockRejectedValueOnce(new Error("Network unavailable"));
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Apple" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });
});
