/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { CallTranscript, TranscriptSaveNotice } from "../CallTranscript";
import type { Correction, Message } from "@/lib/types/conversation";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const MESSAGES: Message[] = [
  { role: "assistant", content: "¡Hola! ¿Qué te pongo?" },
  { role: "user", content: "Yo quiero un café, gracias muchos." },
  { role: "assistant", content: "¡Claro!" },
  { role: "user", content: "Perfecto." },
];

const CORRECTIONS: Correction[] = [
  { original: "gracias muchos", corrected: "muchas gracias", explanation: "'Gracias' is feminine." },
  { original: "Tengo veinte años", corrected: "Tengo veinte años.", explanation: "Add a full stop." },
];

describe("CallTranscript", () => {
  const writeText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });

  it("shows every turn with the tutor's name and You", () => {
    render(<CallTranscript messages={MESSAGES} tutorName="Luna" corrections={[]} />);

    const list = screen.getByRole("list", { name: "Transcript" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Luna");
    expect(items[0]).toHaveTextContent("¡Hola! ¿Qué te pongo?");
    expect(items[1]).toHaveTextContent("You");
  });

  it("marks the learner line a correction belongs to and lists the rest separately", () => {
    render(<CallTranscript messages={MESSAGES} tutorName="Luna" corrections={CORRECTIONS} />);

    const items = within(screen.getByRole("list", { name: "Transcript" })).getAllByRole("listitem");
    expect(items[1]).toHaveTextContent("Worth fixing");
    expect(items[1]).toHaveTextContent("muchas gracias");
    expect(items[1]).toHaveTextContent("'Gracias' is feminine.");
    expect(items[3]).not.toHaveTextContent("Worth fixing");

    const other = screen.getByRole("list", { name: "Other corrections" });
    expect(other).toHaveTextContent("Tengo veinte años.");
  });

  it("shows the plain transcript while feedback is still loading", () => {
    render(<CallTranscript messages={MESSAGES} tutorName="Luna" corrections={null} />);

    expect(screen.queryByText("Worth fixing")).not.toBeInTheDocument();
    expect(screen.getByText("Marking lines that need work…")).toBeInTheDocument();
  });

  it("copies the transcript as plain text", async () => {
    render(<CallTranscript messages={MESSAGES} tutorName="Luna" corrections={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy transcript" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "Luna: ¡Hola! ¿Qué te pongo?\nYou: Yo quiero un café, gracias muchos.\nLuna: ¡Claro!\nYou: Perfecto."
      )
    );
    expect(toast.success).toHaveBeenCalledWith("Transcript copied");
  });

  it("reports a failed copy", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<CallTranscript messages={MESSAGES} tutorName="Luna" corrections={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy transcript" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not copy transcript"));
  });

  it("says so when nothing was said, and hides the copy button", () => {
    render(<CallTranscript messages={[]} tutorName="Luna" corrections={[]} />);

    expect(screen.getByText("Nothing was said in this call.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy transcript" })).not.toBeInTheDocument();
  });

  it("renders a notice slot", () => {
    render(<CallTranscript messages={MESSAGES} tutorName="Luna" corrections={[]} notice={<p>Saved</p>} />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
});

describe("TranscriptSaveNotice", () => {
  it("links to history once saved", () => {
    render(<TranscriptSaveNotice status="saved" onKeep={jest.fn()} />);
    expect(screen.getByText(/Saved/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Progress" })).toHaveAttribute("href", "/app/progress");
  });

  it("shows progress while saving", () => {
    render(<TranscriptSaveNotice status="saving" onKeep={jest.fn()} />);
    expect(screen.getByText("Saving transcript…")).toBeInTheDocument();
  });

  it("offers to turn saving on when it's off", () => {
    const onKeep = jest.fn();
    render(<TranscriptSaveNotice status="off" onKeep={onKeep} />);

    expect(screen.getByText("This transcript disappears when you leave this page.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep my transcripts" }));
    expect(onKeep).toHaveBeenCalled();
  });

  it("offers a retry when saving failed", () => {
    const onKeep = jest.fn();
    render(<TranscriptSaveNotice status="error" onKeep={onKeep} />);

    expect(screen.getByText("Couldn't save this transcript.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onKeep).toHaveBeenCalled();
  });
});
