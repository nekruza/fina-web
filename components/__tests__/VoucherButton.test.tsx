/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VoucherButton } from "../VoucherButton";
import { ProUpgradeDialog } from "../ProUpgradeDialog";
import { useProfile } from "@/lib/queries/profile";
import { track } from "@/lib/mixpanel";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/mixpanel", () => ({ track: jest.fn() }));
jest.mock("@/lib/queries/profile", () => ({ useProfile: jest.fn() }));

const mockUseProfile = useProfile as jest.Mock;

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  const invalidate = jest.spyOn(client, "invalidateQueries");
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { invalidate };
}

function mockRedeem(ok: boolean, error?: string) {
  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok,
    json: async () => (ok ? { ok: true } : { error }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseProfile.mockReturnValue({ data: { pro: { isPro: false } } });
});

describe("VoucherButton", () => {
  it("is hidden until the profile loads", () => {
    mockUseProfile.mockReturnValue({ data: undefined });
    renderWithClient(<VoucherButton variant="sidebar" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is hidden for learners who already have Pro", () => {
    mockUseProfile.mockReturnValue({ data: { pro: { isPro: true } } });
    renderWithClient(<VoucherButton variant="sidebar" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the redeem dialog from the sidebar", () => {
    renderWithClient(<VoucherButton variant="sidebar" />);
    fireEvent.click(screen.getByRole("button", { name: "Have a voucher?" }));

    expect(screen.getByRole("dialog", { name: "Redeem your voucher" })).toBeInTheDocument();
    expect(screen.getByLabelText("Have a voucher code?")).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith("voucher_entry_opened", { source: "sidebar" });
  });

  it("renders a compact pill in the mobile header", () => {
    renderWithClient(<VoucherButton variant="header" />);
    fireEvent.click(screen.getByRole("button", { name: "Voucher" }));
    expect(screen.getByRole("dialog", { name: "Redeem your voucher" })).toBeInTheDocument();
  });

  it("refreshes the profile and closes after a successful redeem", async () => {
    mockRedeem(true);
    const { invalidate } = renderWithClient(<VoucherButton variant="sidebar" />);
    fireEvent.click(screen.getByRole("button", { name: "Have a voucher?" }));
    fireEvent.change(screen.getByLabelText("Have a voucher code?"), { target: { value: "FINA-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Redeem" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["profile"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["conversation-usage"] });
  });

  it("keeps the dialog open and shows the error when the code is rejected", async () => {
    mockRedeem(false, "This code has expired.");
    renderWithClient(<VoucherButton variant="sidebar" />);
    fireEvent.click(screen.getByRole("button", { name: "Have a voucher?" }));
    fireEvent.change(screen.getByLabelText("Have a voucher code?"), { target: { value: "OLD" } });
    fireEvent.click(screen.getByRole("button", { name: "Redeem" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This code has expired.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("ProUpgradeDialog voucher entry", () => {
  it("reveals the redeem form on request", () => {
    renderWithClient(<ProUpgradeDialog open onClose={jest.fn()} reason="conversations" />);
    expect(screen.queryByLabelText("Have a voucher code?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Have a voucher code?" }));

    expect(screen.getByLabelText("Have a voucher code?")).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith("voucher_entry_opened", { source: "upgrade_dialog" });
  });

  it("refreshes the profile and closes after a successful redeem", async () => {
    mockRedeem(true);
    const onClose = jest.fn();
    const { invalidate } = renderWithClient(<ProUpgradeDialog open onClose={onClose} reason="upgrade" />);
    fireEvent.click(screen.getByRole("button", { name: "Have a voucher code?" }));
    fireEvent.change(screen.getByLabelText("Have a voucher code?"), { target: { value: "FINA-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Redeem" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["profile"] });
  });
});
