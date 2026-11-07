/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { TranscriptPanel } from "../TranscriptPanel";
import type { Message } from "@/lib/types/conversation";

jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const MESSAGES: Message[] = [
  { role: "assistant", content: "Hello! How are you today?" },
  { role: "user", content: "I am good, thanks." },
];

function renderPanel(messages: Message[] = MESSAGES) {
  return render(
    <TranscriptPanel
      messages={messages}
      interimTranscript=""
      isActivelyListening={false}
      isVisible
      tutorName="Luna"
      nativeLanguage="spanish"
    />
  );
}

beforeEach(() => {
  global.fetch = jest.fn();
});

describe("TranscriptPanel copy", () => {
  const writeText = jest.fn();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    (toast.success as jest.Mock).mockClear();
    (toast.error as jest.Mock).mockClear();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });

  it("copies the whole transcript as plain text with speaker names", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Copy transcript" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "Luna: Hello! How are you today?\nYou: I am good, thanks."
      )
    );
    expect(toast.success).toHaveBeenCalledWith("Transcript copied");
  });

  it("shows an error toast when the clipboard is unavailable", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Copy transcript" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not copy transcript"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("disables the copy button while there is nothing to copy", () => {
    renderPanel([]);
    expect(screen.getByRole("button", { name: "Copy transcript" })).toBeDisabled();
  });
});

describe("TranscriptPanel", () => {
  it("labels tutor lines with the tutor's name and learner lines with You", () => {
    renderPanel();
    expect(screen.getByText("Luna")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("offers a translate button on tutor lines only", () => {
    renderPanel();
    const buttons = screen.getAllByRole("button", { name: "Translate to Spanish" });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("ES");
  });

  it("translates via /api/ai/translate and toggles back to the original", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ translation: "¡Hola! ¿Cómo estás hoy?" }),
    });

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Translate to Spanish" }));

    expect(await screen.findByText("¡Hola! ¿Cómo estás hoy?")).toBeInTheDocument();
    expect(screen.queryByText("Hello! How are you today?")).not.toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ai/translate",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({ text: "Hello! How are you today?", targetLanguage: "spanish" });

    const toggle = screen.getByRole("button", { name: "Show original" });
    expect(toggle).toHaveTextContent("Original");

    fireEvent.click(toggle);
    expect(screen.getByText("Hello! How are you today?")).toBeInTheDocument();
    expect(screen.queryByText("¡Hola! ¿Cómo estás hoy?")).not.toBeInTheDocument();
  });

  it("caches the translation so toggling again does not refetch", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ translation: "¡Hola!" }),
    });

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Translate to Spanish" }));
    await screen.findByText("¡Hola!");

    fireEvent.click(screen.getByRole("button", { name: "Show original" }));
    fireEvent.click(screen.getByRole("button", { name: "Translate to Spanish" }));

    expect(screen.getByText("¡Hola!")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("shows a toast and keeps the original when translation fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Translation failed" }),
    });

    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Translate to Spanish" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Translation failed"));
    expect(screen.getByText("Hello! How are you today?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Translate to Spanish" })).toBeInTheDocument();
  });

  describe('variant="sheet" (below md)', () => {
    function renderSheet(onClose = jest.fn()) {
      render(
        <TranscriptPanel
          variant="sheet"
          messages={MESSAGES}
          interimTranscript=""
          isVisible
          tutorName="Luna"
          nativeLanguage="spanish"
          onClose={onClose}
        />
      );
      return onClose;
    }

    it("renders a mobile-only, height-capped transcript region", () => {
      renderSheet();
      const region = screen.getByRole("region", { name: "Live transcript" });
      expect(region).toHaveClass("md:hidden");
      expect(region).toHaveClass("max-h-[45vh]");
      expect(region).not.toHaveClass("hidden");
    });

    it("keeps the Translate control and translates on phones", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ translation: "¡Hola! ¿Cómo estás hoy?" }),
      });

      renderSheet();
      const region = screen.getByRole("region", { name: "Live transcript" });
      const translate = within(region).getByRole("button", { name: "Translate to Spanish" });
      expect(translate).toHaveTextContent("ES");

      fireEvent.click(translate);
      expect(await within(region).findByText("¡Hola! ¿Cómo estás hoy?")).toBeInTheDocument();
      expect(within(region).getByRole("button", { name: "Show original" })).toBeInTheDocument();
    });

    it("closes via the Close captions button", () => {
      const onClose = renderSheet();
      fireEvent.click(screen.getByRole("button", { name: "Close captions" }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("renders nothing when captions are off", () => {
      const { container } = render(
        <TranscriptPanel
          variant="sheet"
          messages={MESSAGES}
          interimTranscript=""
          isVisible={false}
          tutorName="Luna"
          nativeLanguage="spanish"
          onClose={jest.fn()}
        />
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("keeps the default side panel desktop-only with no close button", () => {
    renderPanel();
    expect(screen.queryByRole("region", { name: "Live transcript" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close captions" })).not.toBeInTheDocument();
    expect(screen.getByText("Live transcript").closest("[data-variant]")).toHaveAttribute("data-variant", "side");
  });

  it("renders nothing when hidden", () => {
    const { container } = render(
      <TranscriptPanel
        messages={MESSAGES}
        interimTranscript=""
        isVisible={false}
        tutorName="Luna"
        nativeLanguage="spanish"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
