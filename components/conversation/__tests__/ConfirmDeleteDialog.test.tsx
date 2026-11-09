/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { ConfirmDeleteDialog } from "../ConfirmDeleteDialog";

function renderDialog(overrides: Partial<ComponentProps<typeof ConfirmDeleteDialog>> = {}) {
  const props = {
    open: true,
    onOpenChange: jest.fn(),
    onConfirm: jest.fn(),
    title: "Delete this transcript?",
    description: "It can't be brought back.",
    confirmLabel: "Delete transcript",
    pending: false,
    ...overrides,
  };
  render(<ConfirmDeleteDialog {...props} />);
  return props;
}

describe("ConfirmDeleteDialog", () => {
  it("shows the title and description and confirms", () => {
    const props = renderDialog();

    expect(screen.getByRole("dialog", { name: "Delete this transcript?" })).toHaveAccessibleDescription(
      "It can't be brought back."
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete transcript" }));
    expect(props.onConfirm).toHaveBeenCalled();
  });

  it("closes on Cancel", () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables both buttons while deleting", () => {
    renderDialog({ pending: true });
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
