/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import RoleplayPage from "../page";
import type { CustomRoleplayRecord } from "@/lib/types/roleplay";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/lib/queries/profile", () => ({
  useProfile: jest.fn(),
  useUpdateProfile: jest.fn(),
}));

jest.mock("@/lib/queries/roleplays", () => ({
  useCustomRoleplays: jest.fn(),
  useDeleteCustomRoleplay: jest.fn(),
}));

const { useSearchParams } = jest.requireMock("next/navigation");
const { toast } = jest.requireMock("sonner");
const { useProfile, useUpdateProfile } = jest.requireMock("@/lib/queries/profile");
const { useCustomRoleplays, useDeleteCustomRoleplay } = jest.requireMock("@/lib/queries/roleplays");

type MutateOptions = { onSuccess?: () => void; onError?: () => void };

const CUSTOM_RECORD: CustomRoleplayRecord = {
  id: "custom-1",
  user_id: "u1",
  title: "Ordering coffee",
  category: "custom",
  difficulty: "Beginner",
  userRole: "Customer",
  aiRole: "Barista",
  scenario: "You are ordering a coffee at a busy cafe.",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  isCustom: true,
};

beforeEach(() => {
  useSearchParams.mockReturnValue(new URLSearchParams(""));
});

function setup({
  deleteMutate,
  isPending = false,
}: { deleteMutate?: (id: string, opts?: MutateOptions) => void; isPending?: boolean } = {}) {
  useProfile.mockReturnValue({ data: { tutorId: "luna" }, isLoading: false });
  useUpdateProfile.mockReturnValue({ mutate: jest.fn() });
  useCustomRoleplays.mockReturnValue({ data: [CUSTOM_RECORD], isLoading: false });
  const mutate = jest.fn(deleteMutate ?? ((_id: string, opts?: MutateOptions) => opts?.onSuccess?.()));
  useDeleteCustomRoleplay.mockReturnValue({ mutate, isPending });
  return { mutate };
}

function openDeleteDialogFor(title: string) {
  fireEvent.click(screen.getByRole("button", { name: `Delete ${title}` }));
}

describe("RoleplayPage delete confirmation", () => {
  it("deletes on confirm, shows a success toast, and closes the dialog", () => {
    const { mutate } = setup();
    render(<RoleplayPage />);

    openDeleteDialogFor("Ordering coffee");
    expect(screen.getByText("Delete roleplay?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(mutate).toHaveBeenCalledWith("custom-1", expect.objectContaining({
      onSuccess: expect.any(Function),
      onError: expect.any(Function),
    }));
    expect(toast.success).toHaveBeenCalledWith("Roleplay deleted");
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete roleplay?")).not.toBeInTheDocument();
  });

  it("shows an error toast and keeps the dialog open when the delete fails", () => {
    setup({ deleteMutate: (_id, opts) => opts?.onError?.() });
    render(<RoleplayPage />);

    openDeleteDialogFor("Ordering coffee");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(toast.error).toHaveBeenCalledWith("Couldn't delete this roleplay. Please try again.");
    expect(toast.success).not.toHaveBeenCalled();
    // The dialog stays open on failure so the user can retry or cancel.
    expect(screen.getByText("Delete roleplay?")).toBeInTheDocument();
  });

  it("disables the confirm button and shows a pending label while the delete is in flight", () => {
    setup({ isPending: true });
    render(<RoleplayPage />);

    openDeleteDialogFor("Ordering coffee");

    const confirmButton = screen.getByRole("button", { name: "Deleting…" });
    expect(confirmButton).toBeDisabled();
  });
});

describe("RoleplayPage custom roleplays loading state", () => {
  beforeEach(() => {
    useProfile.mockReturnValue({ data: { tutorId: "luna" }, isLoading: false });
    useUpdateProfile.mockReturnValue({ mutate: jest.fn() });
    useCustomRoleplays.mockReturnValue({ data: undefined, isLoading: true });
    useDeleteCustomRoleplay.mockReturnValue({ mutate: jest.fn(), isPending: false });
  });

  it("still renders predefined scenarios under the 'all' filter, plus the loading status, while custom roleplays load", () => {
    useSearchParams.mockReturnValue(new URLSearchParams(""));
    render(<RoleplayPage />);

    // Predefined scenarios (General is first, pinned) never depend on the custom-roleplays
    // query, so they render immediately rather than being blanked while it loads.
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading custom roleplays…");
    // No custom scenarios have loaded yet, so the "(k custom)" suffix is omitted, not "(0 custom)".
    expect(screen.queryByText(/custom\)/)).not.toBeInTheDocument();
  });

  it("shows the loading status instead of the empty state under the 'custom' filter", () => {
    useSearchParams.mockReturnValue(new URLSearchParams("filter=custom"));
    render(<RoleplayPage />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading custom roleplays…");
    expect(screen.queryByText("No scenarios found")).not.toBeInTheDocument();
  });

  it("does not show the loading status under a category filter that never includes custom roleplays", () => {
    useSearchParams.mockReturnValue(new URLSearchParams("filter=life"));
    render(<RoleplayPage />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // Predefined "life" scenarios still render immediately.
    expect(screen.getByText("Introductions")).toBeInTheDocument();
  });
});

describe("RoleplayPage mobile filter layout", () => {
  it("keeps filter badges on one horizontally scrollable row on mobile", () => {
    setup();
    render(<RoleplayPage />);

    const filterGroup = screen.getByRole("group", { name: "Filter roleplays" });

    expect(filterGroup).toHaveClass("flex-nowrap", "overflow-x-auto", "md:flex-wrap", "md:overflow-visible");
    for (const filter of within(filterGroup).getAllByRole("button")) {
      expect(filter).toHaveClass("shrink-0");
    }
  });
});
