import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "./keys";
import type { ProfileSummary } from "@/lib/types/profile";
import { hasUserPreferences, loadUserPreferences } from "@/lib/user-preferences";

export function mergeLocalPreferences(profile: ProfileSummary): ProfileSummary {
  if (!hasUserPreferences(profile.id)) return profile;
  const preferences = loadUserPreferences(profile.id);
  return {
    ...profile,
    tutorId: preferences.tutorId,
    nativeLanguage: preferences.nativeLanguage,
    dailyGoalMinutes: preferences.dailyGoalMinutes,
  };
}

async function fetchProfile(): Promise<ProfileSummary> {
  const res = await fetch("/api/profile");
  if (!res.ok) throw Object.assign(new Error("Failed to fetch profile"), { status: res.status });
  return mergeLocalPreferences((await res.json()) as ProfileSummary);
}

export function useProfile() {
  return useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: fetchProfile,
  });
}

async function patchProfile(updates: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw Object.assign(new Error(body.error ?? "Failed to update profile"), { status: res.status });
  }
}

/** PATCHes a subset of profile fields and invalidates the cached profile on success. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: patchProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    },
  });
}
