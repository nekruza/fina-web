/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StudyPlanCard } from "../StudyPlanCard";
import { getSectionDone } from "@/lib/study-plan-storage";

jest.mock("sonner", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const invalidateQueries = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

const markStudyPlanDayComplete = jest.fn();
jest.mock("@/lib/db/profile", () => ({
  markStudyPlanDayComplete: (...args: unknown[]) => markStudyPlanDayComplete(...args),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({})),
}));

const { toast } = jest.requireMock("sonner");

const START_DATE = new Date().toISOString(); // → plan day 1

describe("StudyPlanCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("marks both sections done locally, calls the server, and invalidates the profile query on success", async () => {
    markStudyPlanDayComplete.mockResolvedValue([1]);

    render(
      <StudyPlanCard
        userId="user-1"
        tutorId="luna"
        studyPlanStartDate={START_DATE}
        completedDays={[]}
      />
    );

    fireEvent.click(screen.getByRole("link", { name: /Practice speaking/i }));
    fireEvent.click(screen.getByRole("link", { name: /Learn vocabulary/i }));

    await waitFor(() => expect(markStudyPlanDayComplete).toHaveBeenCalledWith({}, "user-1", 1));
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("logs and toasts on a failed server write, and does not invalidate the profile query", async () => {
    markStudyPlanDayComplete.mockRejectedValue(new Error("network down"));

    render(
      <StudyPlanCard
        userId="user-1"
        tutorId="luna"
        studyPlanStartDate={START_DATE}
        completedDays={[]}
      />
    );

    fireEvent.click(screen.getByRole("link", { name: /Practice speaking/i }));
    fireEvent.click(screen.getByRole("link", { name: /Learn vocabulary/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't save today's plan progress. It'll retry next time.")
    );
    expect(console.error).toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();

    // The local ticks stay set despite the failed write, so the next both-done
    // interaction on this day (e.g. clicking a row again) will retry the save.
    expect(getSectionDone("speak").has(1)).toBe(true);
    expect(getSectionDone("vocab").has(1)).toBe(true);
  });
});
