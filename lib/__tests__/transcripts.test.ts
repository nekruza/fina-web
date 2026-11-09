import {
  MAX_MESSAGE_CHARS,
  MAX_MESSAGES,
  formatTranscript,
  matchCorrections,
  sanitizeMessages,
  stripBeginMarker,
} from "@/lib/transcripts";
import type { Correction, Message } from "@/lib/types/conversation";

const correction = (original: string, corrected = "fixed", explanation = "why"): Correction => ({
  original,
  corrected,
  explanation,
});

describe("stripBeginMarker", () => {
  it("drops the hidden [BEGIN] learner turn and keeps everything else", () => {
    const msgs: Message[] = [
      { role: "user", content: "  [begin] start" },
      { role: "assistant", content: "[BEGIN] is fine from the tutor" },
      { role: "user", content: "Hola" },
    ];
    expect(stripBeginMarker(msgs)).toEqual([msgs[1], msgs[2]]);
  });
});

describe("sanitizeMessages", () => {
  it("keeps valid turns, trims them and drops empty ones and the [BEGIN] marker", () => {
    expect(
      sanitizeMessages([
        { role: "user", content: "[BEGIN]" },
        { role: "assistant", content: "  Hola  " },
        { role: "user", content: "   " },
        { role: "user", content: "Buenos días", extra: "ignored" },
      ])
    ).toEqual([
      { role: "assistant", content: "Hola" },
      { role: "user", content: "Buenos días" },
    ]);
  });

  it.each([
    ["not an array", { role: "user", content: "x" }],
    ["null", null],
    ["a bad role", [{ role: "system", content: "x" }]],
    ["non-string content", [{ role: "user", content: 4 }]],
    ["a non-object entry", ["hello"]],
    ["an over-long message", [{ role: "user", content: "a".repeat(MAX_MESSAGE_CHARS + 1) }]],
    ["too many messages", Array.from({ length: MAX_MESSAGES + 1 }, () => ({ role: "user", content: "x" }))],
  ])("rejects %s", (_label, input) => {
    expect(sanitizeMessages(input)).toBeNull();
  });

  it("accepts an empty list", () => {
    expect(sanitizeMessages([])).toEqual([]);
  });
});

describe("matchCorrections", () => {
  const messages: Message[] = [
    { role: "assistant", content: "Yo soy contento de verte." },
    { role: "user", content: "Hola! Yo soy contento hoy." },
    { role: "user", content: "Me gusta los perros, ¿y tú?" },
  ];

  it("attaches each correction to the first learner line that contains it, ignoring case and punctuation", () => {
    const first = correction("yo soy contento");
    const second = correction("Me gusta los perros.");
    const { byIndex, unmatched } = matchCorrections(messages, [first, second]);
    expect(byIndex.get(1)).toEqual([first]);
    expect(byIndex.get(2)).toEqual([second]);
    expect(byIndex.has(0)).toBe(false);
    expect(unmatched).toEqual([]);
  });

  it("never marks tutor lines and lists corrections it cannot place", () => {
    const onlyInTutor = correction("de verte");
    const blank = correction("  ¡! ");
    const { byIndex, unmatched } = matchCorrections(messages, [onlyInTutor, blank]);
    expect(byIndex.size).toBe(0);
    expect(unmatched).toEqual([onlyInTutor, blank]);
  });

  it("groups several corrections on the same line", () => {
    const a = correction("Hola");
    const b = correction("contento hoy");
    expect(matchCorrections(messages, [a, b]).byIndex.get(1)).toEqual([a, b]);
  });
});

describe("formatTranscript", () => {
  it("labels turns with the tutor name and You", () => {
    expect(
      formatTranscript(
        [
          { role: "assistant", content: "Hi" },
          { role: "user", content: "Hello" },
        ],
        "Luna"
      )
    ).toBe("Luna: Hi\nYou: Hello");
  });
});
