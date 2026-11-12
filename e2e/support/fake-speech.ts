import type { Page } from "@playwright/test";

/**
 * Replaces the browser's Web Speech recognition with a scripted fake, so a
 * test can "say" exactly what the mic would have transcribed — including the
 * wrong words a learner's pronunciation produces.
 *
 * In the page: `window.__fakeSpeech.say("text")` delivers a final result to
 * whichever recogniser is running; `.sayLate("text")` delivers it even after
 * stop(), as Chrome sometimes does.
 */
export async function installFakeSpeech(page: Page) {
  await page.addInitScript(() => {
    type Handler = ((e: unknown) => void) | null;
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = "en-US";
      onresult: Handler = null;
      onend: Handler = null;
      onerror: Handler = null;
      running = false;
      start() {
        this.running = true;
        fake.current = this;
      }
      stop() {
        this.running = false;
        setTimeout(() => this.onend?.({}), 0);
      }
      abort() {
        this.stop();
      }
      emit(text: string) {
        const alt = { transcript: text, confidence: 0.9 };
        const result = Object.assign([alt], { isFinal: true });
        this.onresult?.({ resultIndex: 0, results: [result] });
      }
    }
    const fake = {
      current: null as FakeRecognition | null,
      say(text: string) {
        if (!fake.current?.running) throw new Error("fake speech: not listening");
        fake.current.emit(text);
      },
      sayLate(text: string) {
        fake.current?.emit(text);
      },
      isListening() {
        return !!fake.current?.running;
      },
    };
    const w = window as unknown as Record<string, unknown>;
    w.__fakeSpeech = fake;
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  });
}

type FakeSpeechWindow = {
  __fakeSpeech: { say(t: string): void; sayLate(t: string): void; isListening(): boolean };
};

export const say = (page: Page, text: string) =>
  page.evaluate((t) => (window as unknown as FakeSpeechWindow).__fakeSpeech.say(t), text);

export const sayLate = (page: Page, text: string) =>
  page.evaluate((t) => (window as unknown as FakeSpeechWindow).__fakeSpeech.sayLate(t), text);

export const isListening = (page: Page) =>
  page.evaluate(() => (window as unknown as FakeSpeechWindow).__fakeSpeech.isListening());
