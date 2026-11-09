import {
  buildConversationInstructions,
  buildHintPrompt,
  buildAnalysisPrompt,
} from "../buildConversationInstructions";

describe("buildConversationInstructions", () => {
  it("opens with the tutor's name", () => {
    const result = buildConversationInstructions({
      language: "english",
      level: "beginner",
      tutorName: "Luna",
    });

    expect(result).toContain("Your name is Luna.");
  });

  it("uses general conversation-partner wording when there is no roleplay", () => {
    const result = buildConversationInstructions({
      language: "spanish",
      level: "intermediate",
      tutorName: "Luna",
      roleplay: null,
    });

    expect(result).toContain(
      "You are a friendly Spanish conversation partner helping the learner practice speaking Spanish."
    );
  });

  it("uses general conversation-partner wording for the general roleplay (aiRole AI)", () => {
    const result = buildConversationInstructions({
      language: "english",
      level: "beginner",
      tutorName: "Luna",
      roleplay: {
        title: "General",
        userRole: "You",
        aiRole: "AI",
        scenario: "You and the AI engage in a general conversation about anything",
      },
    });

    expect(result).toContain("You are a friendly American English conversation partner");
    expect(result).not.toContain("playing AI");
  });

  it("stays in character for a real roleplay", () => {
    const result = buildConversationInstructions({
      language: "french",
      level: "intermediate",
      tutorName: "Henry",
      roleplay: {
        title: "Ordering at Restaurant",
        userRole: "Customer",
        aiRole: "Waiter",
        scenario: "A customer orders food from a waiter",
      },
    });

    expect(result).toContain(
      "You are playing Waiter in a French language practice roleplay. The learner plays Customer. Scenario: A customer orders food from a waiter. Stay in character and keep the scene realistic."
    );
  });

  it("includes the learner level label and level guidance", () => {
    const result = buildConversationInstructions({
      language: "german",
      level: "advanced",
      tutorName: "Jake",
    });

    expect(result).toContain("LEARNER LEVEL: Advanced");
    expect(result).toContain("LANGUAGE ADJUSTMENT for ADVANCED in German:");
  });

  it("instructs the model to speak only the target language", () => {
    const result = buildConversationInstructions({
      language: "japanese",
      level: "beginner",
      tutorName: "Luna",
    });

    expect(result).toContain("CRITICAL: Speak ONLY in Japanese.");
    expect(result).toContain("gently continue in Japanese");
  });

  it("includes the live-voice rules block", () => {
    const result = buildConversationInstructions({
      language: "english",
      level: "beginner",
      tutorName: "Luna",
    });

    expect(result).toContain("CRITICAL VOICE RULES:");
    expect(result).toContain("Keep every response to 1-3 short sentences.");
    expect(result).toContain(
      'NEVER open with standalone filler like "Great!" or "Sure."'
    );
  });

  it("tells the model how to open the conversation on [BEGIN]", () => {
    const result = buildConversationInstructions({
      language: "english",
      level: "beginner",
      tutorName: "Luna",
    });

    expect(result).toContain(
      'Start the conversation: when you receive "[BEGIN]", greet the learner in American English and open the scene with a simple question.'
    );
  });
});

describe("buildHintPrompt", () => {
  it("asks for exactly 4 hints written in the target language as JSON", () => {
    const result = buildHintPrompt("spanish");

    expect(result).toContain("Spanish learner");
    expect(result).toContain("exactly 4 short, natural replies");
    expect(result).toContain("written in Spanish");
    expect(result).toContain('{"hints":["...","...","...","..."]}');
  });
});

describe("buildAnalysisPrompt", () => {
  it("references the learner level and language", () => {
    const result = buildAnalysisPrompt("french", "intermediate");

    expect(result).toContain("Intermediate");
    expect(result).toContain("French");
  });

  it("labels transcript lines Learner/Tutor and scores only the learner", () => {
    const result = buildAnalysisPrompt("english", "beginner");

    expect(result).toContain("Learner:");
    expect(result).toContain("Tutor:");
    expect(result).toContain("ONLY the learner");
  });

  it("encourages a fair but generous 60-90 range", () => {
    const result = buildAnalysisPrompt("english", "beginner");

    expect(result).toContain("60 and 90");
  });

  it("describes the six scored dimensions", () => {
    const result = buildAnalysisPrompt("english", "beginner");

    for (const dim of [
      "overall",
      "fluency",
      "grammar",
      "vocabulary",
      "engagement",
      "relevancy",
    ]) {
      expect(result).toContain(dim);
    }
  });

  it("describes the corrections shape with original/corrected/explanation", () => {
    const result = buildAnalysisPrompt("english", "beginner");

    expect(result).toContain("original");
    expect(result).toContain("corrected");
    expect(result).toContain("explanation");
    expect(result).toContain("up to 5");
  });

  it("tells the model to use British English when the learner picks UK English", () => {
    const result = buildConversationInstructions({
      language: "english_uk",
      level: "beginner",
      tutorName: "Luna",
    });

    expect(result).toContain("Speak ONLY in British English");
    expect(result).not.toContain("American");
  });
});
