/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { VideoArea } from "../VideoArea";
import { getTutorById } from "@/lib/tutors";

jest.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

beforeAll(() => {
  // jsdom has no media playback.
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: () => Promise.resolve(),
  });
});

function renderWithCaption(text = "Where did you go last weekend?") {
  return render(
    <VideoArea
      webcamStream={null}
      isAISpeaking={false}
      isUserSpeaking={false}
      analyserData={new Uint8Array(0)}
      caption={{ text, role: "assistant" }}
      tutor={getTutorById("luna")}
    />
  );
}

describe("VideoArea captions", () => {
  it("lets the learner select and copy the caption text", () => {
    renderWithCaption();
    const caption = screen.getByTestId("video-caption");
    // The overlay wrapper ignores pointer events so it doesn't block the video;
    // the caption box itself must take them back, or no selection can start.
    expect(caption).toHaveClass("pointer-events-auto", "select-text");
    expect(caption).toHaveTextContent("Where did you go last weekend?");
  });

  it("keeps the speaker label out of the copied text", () => {
    renderWithCaption();
    const caption = screen.getByTestId("video-caption");
    expect(within(caption).getByText("Luna")).toHaveClass("select-none");
  });
});
