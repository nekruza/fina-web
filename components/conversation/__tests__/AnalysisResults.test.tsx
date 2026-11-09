/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { AnalysisResults } from "../AnalysisResults";
import type { LanguageAnalysis } from "@/lib/types/conversation";

const ANALYSIS: LanguageAnalysis = {
  overall: 82,
  fluency: 78,
  grammar: 71,
  vocabulary: 88,
  engagement: 90,
  relevancy: 84,
  summary: "You kept the conversation going well. Watch your verb endings.",
  strengths: ["Asked follow-up questions", "Good café vocabulary"],
  corrections: [
    {
      original: "Yo quiero un café con leche, por favor, gracias muchos.",
      corrected: "Quiero un café con leche, por favor. Muchas gracias.",
      explanation: "'Gracias' is feminine, so use 'muchas'.",
    },
  ],
};

const NO_SPEECH: LanguageAnalysis = {
  overall: 0,
  fluency: 0,
  grammar: 0,
  vocabulary: 0,
  engagement: 0,
  relevancy: 0,
  summary:
    "We didn't catch any speech this time. Check your microphone and try speaking a few sentences next session.",
  strengths: [],
  corrections: [],
};

describe("AnalysisResults", () => {
  it("renders the six labelled score bars with their values", () => {
    render(<AnalysisResults analysis={ANALYSIS} isLoading={false} durationSeconds={185} />);

    const expected: [string, number][] = [
      ["Overall", 82],
      ["Fluency", 78],
      ["Grammar", 71],
      ["Words", 88],
      ["Engagement", 90],
      ["Relevancy", 84],
    ];

    for (const [label, value] of expected) {
      const bar = screen.getByRole("progressbar", { name: label });
      expect(bar).toHaveAttribute("aria-valuenow", String(value));
    }
  });

  it("shows the session duration as mm:ss", () => {
    render(<AnalysisResults analysis={ANALYSIS} isLoading={false} durationSeconds={185} />);
    expect(screen.getByText("03:05")).toBeInTheDocument();
  });

  it("shows the summary and strengths", () => {
    render(<AnalysisResults analysis={ANALYSIS} isLoading={false} durationSeconds={60} />);
    expect(screen.getByText(ANALYSIS.summary)).toBeInTheDocument();
    expect(screen.getByText("Asked follow-up questions")).toBeInTheDocument();
    expect(screen.getByText("Good café vocabulary")).toBeInTheDocument();
  });

  it("lists corrections with the original struck through and the corrected version", () => {
    render(<AnalysisResults analysis={ANALYSIS} isLoading={false} durationSeconds={60} />);

    const list = screen.getByRole("list", { name: "Corrections" });
    const item = within(list).getAllByRole("listitem")[0];

    const original = within(item).getByText(ANALYSIS.corrections[0].original);
    expect(original.tagName).toBe("DEL");

    const corrected = within(item).getByText(ANALYSIS.corrections[0].corrected);
    expect(corrected.tagName).toBe("INS");

    expect(within(item).getByText(ANALYSIS.corrections[0].explanation)).toBeInTheDocument();
  });

  it("shows an empty state when there are no corrections", () => {
    render(
      <AnalysisResults analysis={{ ...ANALYSIS, corrections: [] }} isLoading={false} durationSeconds={60} />
    );
    expect(screen.queryByRole("list", { name: "Corrections" })).not.toBeInTheDocument();
    expect(screen.getByText(/no corrections this time/i)).toBeInTheDocument();
  });

  it("shows the no-speech summary instead of zeroed score bars", () => {
    render(<AnalysisResults analysis={NO_SPEECH} isLoading={false} durationSeconds={20} />);
    expect(screen.getByText(NO_SPEECH.summary)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows a loading state while the analysis is being generated", () => {
    render(<AnalysisResults analysis={null} isLoading durationSeconds={60} />);
    expect(screen.getByText(/analysing your conversation/i)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("explains that the conversation was still saved when analysis is unavailable", () => {
    render(<AnalysisResults analysis={null} isLoading={false} durationSeconds={60} />);
    expect(screen.getByText(/couldn't analyze this conversation, but it still counts toward your streak/i)).toBeInTheDocument();
  });
});
