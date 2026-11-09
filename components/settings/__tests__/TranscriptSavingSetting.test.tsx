/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TranscriptSavingSetting } from "../TranscriptSavingSetting";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/queries/profile", () => ({ useUpdateProfile: jest.fn() }));
jest.mock("@/lib/queries/conversations", () => ({ useDeleteAllSavedConversations: jest.fn() }));

const { toast } = jest.requireMock("sonner");
const { useUpdateProfile } = jest.requireMock("@/lib/queries/profile");
const { useDeleteAllSavedConversations } = jest.requireMock("@/lib/queries/conversations");

const updateProfile = jest.fn();
const deleteAll = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  updateProfile.mockResolvedValue(undefined);
  deleteAll.mockResolvedValue(undefined);
  useUpdateProfile.mockReturnValue({ mutateAsync: updateProfile, isPending: false });
  useDeleteAllSavedConversations.mockReturnValue({ mutateAsync: deleteAll, isPending: false });
});

const toggle = () => screen.getByRole("switch", { name: "Save call transcripts" });

it("shows the current setting", () => {
  const { rerender } = render(<TranscriptSavingSetting enabled={false} />);
  expect(toggle()).toHaveAttribute("aria-checked", "false");

  rerender(<TranscriptSavingSetting enabled />);
  expect(toggle()).toHaveAttribute("aria-checked", "true");
});

it("turns saving on right away and confirms it", async () => {
  render(<TranscriptSavingSetting enabled={false} />);

  fireEvent.click(toggle());

  expect(toggle()).toHaveAttribute("aria-checked", "true");
  await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ saveTranscripts: true }));
  expect(toast.success).toHaveBeenCalledWith("Transcripts will be saved");
});

it("turns saving off and says saved transcripts are kept", async () => {
  render(<TranscriptSavingSetting enabled />);

  fireEvent.click(toggle());

  await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ saveTranscripts: false }));
  expect(toast.success).toHaveBeenCalledWith("Transcript saving is off. Saved transcripts are kept.");
});

it("flips back and reports an error if the change fails", async () => {
  updateProfile.mockRejectedValue(new Error("nope"));
  render(<TranscriptSavingSetting enabled={false} />);

  fireEvent.click(toggle());

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't change this setting. Try again."));
  expect(toggle()).toHaveAttribute("aria-checked", "false");
});

it("deletes all saved transcripts after confirming", async () => {
  render(<TranscriptSavingSetting enabled />);

  fireEvent.click(screen.getByRole("button", { name: "Delete all saved transcripts" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete all" }));

  await waitFor(() => expect(deleteAll).toHaveBeenCalled());
  expect(toast.success).toHaveBeenCalledWith("All saved transcripts deleted");
});

it("reports a failed delete", async () => {
  deleteAll.mockRejectedValue(new Error("nope"));
  render(<TranscriptSavingSetting enabled />);

  fireEvent.click(screen.getByRole("button", { name: "Delete all saved transcripts" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete all" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't delete your transcripts. Try again."));
});
