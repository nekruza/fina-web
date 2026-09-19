/** @jest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import { AppSidebar } from "../AppSidebar";

jest.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: jest.fn() } }),
}));

jest.mock("@/components/FeedbackProvider", () => ({
  useFeedbackDialog: () => ({ open: jest.fn() }),
}));

describe("desktop app shell", () => {
  it("exposes labeled primary navigation with the current route", () => {
    render(<AppSidebar userEmail="learner@example.com" avatarUrl={null} />);

    const primaryNav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(primaryNav).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(within(primaryNav).getByRole("link", { name: "Progress" })).not.toHaveAttribute("aria-current");
  });

  it("gives the desktop rail a clear workspace identity", () => {
    render(<AppSidebar userEmail="learner@example.com" avatarUrl={null} />);

    expect(screen.getByText("Your learning space")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});
