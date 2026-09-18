import { createSupabaseMock } from "@/test-utils/supabase-mock";
import { countGenerationEvents, recordGenerationEvent } from "@/lib/db/generationEvents";

describe("countGenerationEvents", () => {
  it("counts the user's existing generated_lessons rows", async () => {
    const mock = createSupabaseMock({ tables: { generated_lessons: { data: null, error: null, count: 4 } } });

    await expect(countGenerationEvents(mock as never, "u1")).resolves.toBe(4);

    const builder = mock.builderFor("generated_lessons");
    expect(builder.select).toHaveBeenCalledWith("*", { count: "exact", head: true });
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1");
  });
});

describe("recordGenerationEvent", () => {
  it("does not write to a table that is not part of the current schema", async () => {
    const mock = createSupabaseMock();

    await expect(recordGenerationEvent(mock as never, "u1")).resolves.toBeUndefined();
    expect(mock.callCountFor("vocabulary_generation_events")).toBe(0);
  });
});
