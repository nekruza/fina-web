/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { EndCallDialog } from "../EndCallDialog";

describe("EndCallDialog", () => {
  it("only promises to save the transcript when saving is on", () => {
    const { rerender } = render(<EndCallDialog onCancel={jest.fn()} onConfirm={jest.fn()} saveTranscripts />);
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "We'll analyze your conversation and save the transcript."
    );

    rerender(<EndCallDialog onCancel={jest.fn()} onConfirm={jest.fn()} saveTranscripts={false} />);
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("We'll analyze your conversation.");
  });

  it("cancels with the button or Escape and confirms with Complete", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(<EndCallDialog onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Complete" }));

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
