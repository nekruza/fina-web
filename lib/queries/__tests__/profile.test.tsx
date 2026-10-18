/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useProfile, useUpdateProfile } from "../profile";
import { QUERY_KEYS } from "../keys";
import type { ProfileSummary } from "@/lib/types/profile";

const mockProfile: ProfileSummary = {
  id: "u1",
  email: "user@test.com",
  displayName: "Test User",
  level: "beginner",
  targetLanguage: "spanish",
  nativeLanguage: "russian",
  tutorId: "luna",
  dailyGoalMinutes: 10,
  learningMotivation: null,
  onboarded: true,
  streak: { current: 2, lastConversationDate: "2026-01-01", weeklyActivity: [false, false, false, false, false, false, false] },
  studyPlan: { startDate: null, completedDays: [] },
  stats: { conversationsCompleted: 5, avgOverallScore: 80, lessonsCompleted: 3, favoriteWords: 4, generatedLessons: 1 },
  pro: { isPro: false, status: null, currentPeriodEnd: null, hasCustomer: false, hasSubscription: false },
  usage: { freeConversationsRemaining: 1, freeGenerationsRemaining: 2 },
  createdAt: "2026-01-01T00:00:00Z",
};

function createWrapper(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return {
    queryClient,
    Wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  global.fetch = jest.fn();
});

describe("useProfile", () => {
  it("fetches profile from /api/profile", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockProfile),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProfile(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockProfile);
    expect(global.fetch).toHaveBeenCalledWith("/api/profile");
  });

  it("throws on non-ok response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProfile(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateProfile", () => {
  it("PATCHes /api/profile with the given updates", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: Wrapper });

    result.current.mutate({ displayName: "New Name" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "New Name" }),
    });
  });

  it("invalidates the profile query on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: Wrapper });

    result.current.mutate({ level: "intermediate" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.profile });
  });

  it("rejects with the server error message on a non-ok response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "Invalid level" }),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: Wrapper });

    result.current.mutate({ level: "bogus" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ message: "Invalid level" });
  });

  it("falls back to a generic message when the error response has no `error` field", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: Wrapper });

    result.current.mutate({ level: "intermediate" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ message: "Failed to update profile" });
  });

  it("falls back to a generic message when the error response body is not valid JSON", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: Wrapper });

    result.current.mutate({ level: "intermediate" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ message: "Failed to update profile" });
  });
});
