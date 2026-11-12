/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { usePronunciation } from "../usePronunciation";

class MockUtterance {
  static instances: MockUtterance[] = [];
  lang = "";
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {
    MockUtterance.instances.push(this);
  }
}

function makeSpeechSynthesis() {
  return {
    speak: jest.fn(),
    cancel: jest.fn(),
  };
}

let synth: ReturnType<typeof makeSpeechSynthesis>;

class MockAudio {
  static instances: MockAudio[] = [];
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = jest.fn(() => Promise.resolve());
  pause = jest.fn();
  constructor(public src: string) {
    MockAudio.instances.push(this);
  }
  static get last() {
    return this.instances[this.instances.length - 1];
  }
}

beforeEach(() => {
  MockUtterance.instances = [];
  MockAudio.instances = [];

  synth = makeSpeechSynthesis();
  Object.defineProperty(window, "speechSynthesis", { value: synth, writable: true, configurable: true });
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = MockUtterance;
  (window as unknown as { Audio: unknown }).Audio = MockAudio;
  (global as unknown as { Audio: unknown }).Audio = MockAudio;

  let blobUrlCount = 0;
  global.URL.createObjectURL = jest.fn(() => `blob:mock-url-${blobUrlCount++}`);
  global.URL.revokeObjectURL = jest.fn();
  global.fetch = jest.fn();
});

const mockFetch = () => global.fetch as jest.Mock;

function ttsOk() {
  mockFetch().mockResolvedValue({ ok: true, blob: async () => new Blob(["audio"]) });
}

function ttsFails(status = 503) {
  mockFetch().mockResolvedValue({ ok: false, status });
}

/** Starts `play`, waits for an Audio instance to be created, fires its onended, then awaits completion. */
async function playAndFinish(result: { current: ReturnType<typeof usePronunciation> }, text: string, key: string) {
  const promise = result.current.play(text, key);
  await waitFor(() => expect(MockAudio.instances.length).toBeGreaterThan(0));
  act(() => MockAudio.last.onended?.());
  await act(() => promise);
}

/** Starts `play` expecting the fallback path, waits for an utterance, fires its onend, then awaits completion. */
async function playAndFinishFallback(result: { current: ReturnType<typeof usePronunciation> }, text: string, key: string) {
  const promise = result.current.play(text, key);
  await waitFor(() => expect(MockUtterance.instances.length).toBeGreaterThan(0));
  act(() => MockUtterance.instances[MockUtterance.instances.length - 1].onend?.());
  await act(() => promise);
}

describe("initial state", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => usePronunciation("spanish"));
    expect(result.current.loadingKey).toBeNull();
    expect(result.current.playingKey).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe("primary path — /api/tts", () => {
  it("POSTs text and the language's pronunciation voice", async () => {
    ttsOk();
    const { result } = renderHook(() => usePronunciation("spanish"));

    await playAndFinish(result, "hola", "word-1");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/tts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "hola", voiceId: "Diego", language: "spanish" }),
      })
    );
  });

  it("sets loadingKey while the request is in flight, then playingKey once playback starts", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    mockFetch().mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

    const { result } = renderHook(() => usePronunciation("english"));

    act(() => {
      void result.current.play("hello", "word-1");
    });
    await waitFor(() => expect(result.current.loadingKey).toBe("word-1"));

    await act(async () => {
      resolveFetch({ ok: true, blob: async () => new Blob(["audio"]) });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.playingKey).toBe("word-1"));
    expect(result.current.loadingKey).toBeNull();
  });

  it("clears playingKey once playback ends", async () => {
    ttsOk();
    const { result } = renderHook(() => usePronunciation("english"));

    await playAndFinish(result, "hello", "word-1");

    expect(result.current.playingKey).toBeNull();
  });

  it("pauses an in-flight clip when a new one is requested before it ends", async () => {
    ttsOk();
    const { result } = renderHook(() => usePronunciation("english"));

    const first = result.current.play("hello", "word-1");
    await waitFor(() => expect(MockAudio.instances.length).toBe(1));
    const firstAudio = MockAudio.last;

    // Start a second play before the first clip's onended fires.
    const second = result.current.play("bye", "word-2");
    await waitFor(() => expect(MockAudio.instances.length).toBe(2));

    expect(firstAudio.pause).toHaveBeenCalled();

    act(() => MockAudio.last.onended?.());
    await act(() => second);
    void first;
  });

  it("caches the blob URL by key+language and does not refetch", async () => {
    ttsOk();
    const { result } = renderHook(() => usePronunciation("english"));

    await playAndFinish(result, "hello", "word-1");
    await playAndFinish(result, "hello", "word-1");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not reuse the cache across different languages for the same key", async () => {
    ttsOk();
    const { result, rerender } = renderHook(({ lang }: { lang: "english" | "spanish" }) => usePronunciation(lang), {
      initialProps: { lang: "english" },
    });

    await playAndFinish(result, "hello", "word-1");
    rerender({ lang: "spanish" });
    await playAndFinish(result, "hola", "word-1");

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("fallback to speechSynthesis", () => {
  it("falls back when /api/tts returns 503", async () => {
    ttsFails(503);
    const { result } = renderHook(() => usePronunciation("spanish"));

    await playAndFinishFallback(result, "hola", "word-1");

    expect(synth.speak).toHaveBeenCalled();
  });

  it("uses the language's speech locale on the fallback utterance", async () => {
    ttsFails();
    const { result } = renderHook(() => usePronunciation("spanish"));

    await playAndFinishFallback(result, "hola", "word-1");

    expect(MockUtterance.instances[0].lang).toBe("es-ES");
  });

  it("falls back to speechSynthesis when the audio element errors during playback", async () => {
    ttsOk();
    const { result } = renderHook(() => usePronunciation("english"));

    const promise = result.current.play("hello", "word-1");
    await waitFor(() => expect(MockAudio.instances.length).toBeGreaterThan(0));
    act(() => MockAudio.last.onerror?.());
    await waitFor(() => expect(MockUtterance.instances.length).toBeGreaterThan(0));
    act(() => MockUtterance.instances[0].onend?.());
    await act(() => promise);

    expect(synth.speak).toHaveBeenCalled();
  });

  it("falls back when the fetch itself rejects", async () => {
    mockFetch().mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => usePronunciation("english"));

    await playAndFinishFallback(result, "hello", "word-1");

    expect(synth.speak).toHaveBeenCalled();
  });

  it("clears loadingKey and playingKey once the fallback utterance ends", async () => {
    ttsFails();
    const { result } = renderHook(() => usePronunciation("english"));

    await playAndFinishFallback(result, "hello", "word-1");

    expect(result.current.loadingKey).toBeNull();
    expect(result.current.playingKey).toBeNull();
  });

  it("sets an error when the browser has no speechSynthesis to fall back to", async () => {
    ttsFails();
    Object.defineProperty(window, "speechSynthesis", { value: undefined, writable: true, configurable: true });
    const { result } = renderHook(() => usePronunciation("english"));

    await act(() => result.current.play("hello", "word-1"));

    expect(result.current.error).toBe("Could not play pronunciation.");
  });
});

describe("unmount cleanup", () => {
  it("pauses any playing audio on unmount", async () => {
    ttsOk();
    const { result, unmount } = renderHook(() => usePronunciation("english"));

    const promise = result.current.play("hello", "word-1");
    await waitFor(() => expect(MockAudio.instances.length).toBeGreaterThan(0));
    const audio = MockAudio.last;
    await waitFor(() => expect(result.current.playingKey).toBe("word-1"));

    unmount();

    expect(audio.pause).toHaveBeenCalled();
    // The in-flight play() promise never resolves once unmounted (no onended
    // fires) — nothing else to await here.
    void promise;
  });

  it("cancels speechSynthesis on unmount", async () => {
    const { unmount } = renderHook(() => usePronunciation("english"));

    unmount();

    expect(synth.cancel).toHaveBeenCalled();
  });

  it("does not throw on unmount when speechSynthesis is unavailable", () => {
    Object.defineProperty(window, "speechSynthesis", { value: undefined, writable: true, configurable: true });
    const { unmount } = renderHook(() => usePronunciation("english"));

    expect(() => unmount()).not.toThrow();
  });

  it("revokes every cached blob URL on unmount", async () => {
    ttsOk();
    const { result, unmount } = renderHook(() => usePronunciation("english"));

    await playAndFinish(result, "hello", "word-1");
    await playAndFinish(result, "bye", "word-2");

    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2);

    unmount();

    expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url-0");
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url-1");
  });

  it("does not revoke anything on unmount when nothing was cached", () => {
    const { unmount } = renderHook(() => usePronunciation("english"));

    unmount();

    expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
