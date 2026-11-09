/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SavedConversationPage from "../page";
import type { SavedConversation } from "@/lib/types/conversation";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "s1" }),
  useRouter: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/queries/conversations", () => ({
  useSavedConversation: jest.fn(),
  useDeleteSavedConversation: jest.fn(),
}));

const { useRouter } = jest.requireMock("next/navigation");
const { toast } = jest.requireMock("sonner");
const { useSavedConversation, useDeleteSavedConversation } = jest.requireMock("@/lib/queries/conversations");

const CONVERSATION: SavedConversation = {
  id: "s1",
  roleplayId: "food-restaurant-1",
  roleplayTitle: "Ordering at Restaurant",
  tutorId: "luna",
  language: "spanish",
  level: "intermediate",
  status: "completed",
  startedAt: "2026-11-09T10:00:00.000Z",
  completedAt: "2026-11-09T10:05:00.000Z",
  durationSeconds: 300,
  overallScore: 78,
  analysis: {
    overall: 78,
    fluency: 70,
    grammar: 72,
    vocabulary: 80,
    engagement: 85,
    relevancy: 82,
    summary: "Good pace.",
    strengths: [],
    corrections: [{ original: "Yo tiene hambre", corrected: "Yo tengo hambre", explanation: "Use tengo." }],
  },
  messageCount: 1,
  messages: [
    { role: "assistant", content: "¿Qué desea?" },
    { role: "user", content: "Yo tiene hambre." },
  ],
};

const push = jest.fn();
const mutateAsync = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useRouter.mockReturnValue({ push });
  useDeleteSavedConversation.mockReturnValue({ mutateAsync, isPending: false });
});

it("shows the saved transcript with its corrections marked", () => {
  useSavedConversation.mockReturnValue({ data: CONVERSATION, isLoading: false, isError: false });

  render(<SavedConversationPage />);

  expect(useSavedConversation).toHaveBeenCalledWith("s1");
  expect(screen.getByRole("heading", { level: 1, name: "Ordering at Restaurant" })).toBeInTheDocument();
  expect(screen.getByText(/Nov 9, 2026/)).toBeInTheDocument();
  expect(screen.getByText(/Spanish · with Luna/)).toBeInTheDocument();
  expect(screen.getByText("Good pace.")).toBeInTheDocument();
  expect(screen.getByText("Luna")).toBeInTheDocument();
  expect(screen.getByText("Worth fixing")).toBeInTheDocument();
  expect(screen.getByText("Yo tengo hambre")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Progress/ })).toHaveAttribute("href", "/app/progress");
});

it("shows a loading state", () => {
  useSavedConversation.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  render(<SavedConversationPage />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading transcript…");
});

it("explains when the transcript can't be found", () => {
  useSavedConversation.mockReturnValue({ data: undefined, isLoading: false, isError: true });
  render(<SavedConversationPage />);
  expect(screen.getByRole("heading", { name: "This transcript isn't available" })).toBeInTheDocument();
});

it("deletes the transcript after confirming and goes back to Progress", async () => {
  useSavedConversation.mockReturnValue({ data: CONVERSATION, isLoading: false, isError: false });
  mutateAsync.mockResolvedValue(undefined);
  render(<SavedConversationPage />);

  fireEvent.click(screen.getByRole("button", { name: "Delete transcript" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));

  await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith("s1"));
  expect(toast.success).toHaveBeenCalledWith("Transcript deleted");
  expect(push).toHaveBeenCalledWith("/app/progress");
});

it("reports a failed delete", async () => {
  useSavedConversation.mockReturnValue({ data: CONVERSATION, isLoading: false, isError: false });
  mutateAsync.mockRejectedValue(new Error("nope"));
  render(<SavedConversationPage />);

  fireEvent.click(screen.getByRole("button", { name: "Delete transcript" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't delete the transcript. Try again."));
  expect(push).not.toHaveBeenCalled();
});
