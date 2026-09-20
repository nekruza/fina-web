/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { useInworldRealtime, type RealtimeConfig } from "../useInworldRealtime";

// ── WebRTC test doubles ──────────────────────────────────────────────────────

class MockDataChannel {
  readyState: RTCDataChannelState = "connecting";
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  send = jest.fn();
  close = jest.fn(() => {
    this.readyState = "closed";
  });

  /** Simulate the channel opening, which triggers the session.update handshake. */
  open() {
    this.readyState = "open";
    this.onopen?.();
  }

  /** Deliver a server event to the hook. */
  deliver(payload: unknown) {
    this.onmessage?.({
      data: typeof payload === "string" ? payload : JSON.stringify(payload),
    } as MessageEvent);
  }
}

class MockPeerConnection {
  static instances: MockPeerConnection[] = [];

  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  dataChannel = new MockDataChannel();

  addTrack = jest.fn();
  createDataChannel = jest.fn(() => this.dataChannel);
  createOffer = jest.fn(async () => ({ type: "offer", sdp: "v=0\r\noffer\r\n" }));
  setLocalDescription = jest.fn(async () => {});
  setRemoteDescription = jest.fn(async () => {});
  close = jest.fn();

  constructor(public config: RTCConfiguration) {
    MockPeerConnection.instances.push(this);
  }

  static get last() {
    return this.instances[this.instances.length - 1];
  }
}

function audioTrack() {
  return { kind: "audio", enabled: true, stop: jest.fn() };
}

function micStream() {
  const track = audioTrack();
  return {
    track,
    getAudioTracks: jest.fn(() => [track]),
    getTracks: jest.fn(() => [track]),
  };
}

let stream: ReturnType<typeof micStream>;
let getUserMedia: jest.Mock;

const CONFIG: RealtimeConfig = {
  sessionId: "session-1",
  instructions: "You are Henry, a Spanish conversation partner.",
  voice: "Clive",
  model: "inworld-realtime-1",
};

global.fetch = jest.fn();
const mockFetch = () => global.fetch as jest.Mock;

/**
 * Config fetch succeeds, then the SDP exchange returns an answer.
 * Resets first so an unconsumed `once` value from a previous connect attempt
 * cannot be served as the next config response.
 */
function happyPathFetches(iceServers: RTCIceServer[] = [{ urls: "stun:example" }]) {
  mockFetch()
    .mockReset()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ iceServers }) })
    .mockResolvedValueOnce({ ok: true, text: async () => "v=0\r\nanswer\r\n" });
}

beforeEach(() => {
  MockPeerConnection.instances = [];
  stream = micStream();
  getUserMedia = jest.fn(async () => stream);

  (global as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection =
    MockPeerConnection;
  (global as unknown as { MediaStream: unknown }).MediaStream = jest.fn(
    (tracks) => ({ tracks })
  );
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia },
    writable: true,
    configurable: true,
  });

  happyPathFetches();
});

/** Connect and return the live data channel. */
async function connected(
  result: { current: ReturnType<typeof useInworldRealtime> },
  config: RealtimeConfig = CONFIG
) {
  await act(async () => {
    await result.current.connect(config);
  });
  const dc = MockPeerConnection.last.dataChannel;
  act(() => dc.open());
  return dc;
}

describe("connect", () => {
  it("builds the peer connection with the fetched ICE servers", async () => {
    const { result } = renderHook(() => useInworldRealtime());

    await act(async () => {
      await result.current.connect(CONFIG);
    });

    expect(mockFetch().mock.calls[0][0]).toBe("/api/realtime/config?sessionId=session-1");
    expect(MockPeerConnection.last.config.iceServers).toEqual([
      { urls: "stun:example" },
    ]);
  });

  it("adds the microphone track to the connection", async () => {
    const { result } = renderHook(() => useInworldRealtime());

    await act(async () => {
      await result.current.connect(CONFIG);
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(MockPeerConnection.last.addTrack).toHaveBeenCalledWith(
      stream.track,
      stream
    );
  });

  it("exchanges the local offer for a remote answer", async () => {
    const { result } = renderHook(() => useInworldRealtime());

    await act(async () => {
      await result.current.connect(CONFIG);
    });

    expect(mockFetch().mock.calls[1][0]).toBe("/api/realtime/connect");
    expect(JSON.parse(mockFetch().mock.calls[1][1].body)).toEqual({
      sdp: "v=0\r\noffer\r\n",
      sessionId: CONFIG.sessionId,
    });
    expect(MockPeerConnection.last.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "v=0\r\nanswer\r\n",
    });
  });

  it("reports connected only once the data channel opens", async () => {
    const { result } = renderHook(() => useInworldRealtime());

    await act(async () => {
      await result.current.connect(CONFIG);
    });
    expect(result.current.isConnected).toBe(false);

    act(() => MockPeerConnection.last.dataChannel.open());
    expect(result.current.isConnected).toBe(true);
  });

  it("sends the session config when the channel opens", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);

    const sessionUpdate = JSON.parse(dc.send.mock.calls[0][0]);
    expect(sessionUpdate.type).toBe("session.update");
    expect(sessionUpdate.session).toMatchObject({
      model: CONFIG.model,
      instructions: CONFIG.instructions,
      output_modalities: ["audio", "text"],
    });
    expect(sessionUpdate.session.audio.output.voice).toBe("Clive");
  });

  it("enables voice detection and transcription in voice mode", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);

    const { session } = JSON.parse(dc.send.mock.calls[0][0]);
    expect(session.audio.input.turn_detection.type).toBe("semantic_vad");
    expect(session.audio.input.transcription).toBeDefined();
  });

  it("suppresses interruption until the greeting finishes", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);

    const { session } = JSON.parse(dc.send.mock.calls[0][0]);
    expect(session.audio.input.turn_detection.interrupt_response).toBe(false);
  });

  it("ignores a second connect while one is live", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    await connected(result);

    await act(async () => {
      await result.current.connect(CONFIG);
    });

    expect(MockPeerConnection.instances).toHaveLength(1);
  });

  it("publishes the agent audio stream when the remote track arrives", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    await connected(result);

    act(() => {
      MockPeerConnection.last.ontrack?.({
        track: { kind: "audio" },
      } as RTCTrackEvent);
    });

    expect(result.current.agentAudioStream).not.toBeNull();
  });

  it("ignores a non-audio remote track", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    await connected(result);

    act(() => {
      MockPeerConnection.last.ontrack?.({
        track: { kind: "video" },
      } as RTCTrackEvent);
    });

    expect(result.current.agentAudioStream).toBeNull();
  });
});

describe("hybrid (text) mode", () => {
  const HYBRID = { ...CONFIG, hybridMode: true };

  it("mutes the microphone so the agent's VAD never fires", async () => {
    const { result } = renderHook(() => useInworldRealtime());

    await act(async () => {
      await result.current.connect(HYBRID);
    });

    expect(stream.track.enabled).toBe(false);
  });

  it("still adds the track so the audio connection stays symmetrical", async () => {
    const { result } = renderHook(() => useInworldRealtime());

    await act(async () => {
      await result.current.connect(HYBRID);
    });

    expect(MockPeerConnection.last.addTrack).toHaveBeenCalled();
  });

  it("omits the voice detection and transcription config", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result, HYBRID);

    const { session } = JSON.parse(dc.send.mock.calls[0][0]);
    expect(session.audio.input).toBeUndefined();
  });
});

describe("connection failures", () => {
  it("rejects a missing session before requesting configuration or microphone access", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    await expect(result.current.connect({ ...CONFIG, sessionId: "" })).rejects.toThrow("Start a conversation before connecting");
    expect(mockFetch()).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("includes the server reason when configuration is rejected", async () => {
    mockFetch().mockReset().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "invalid_session" }),
    });
    const { result } = renderHook(() => useInworldRealtime());
    await expect(result.current.connect(CONFIG)).rejects.toThrow("403 — invalid_session");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("throws when the config endpoint fails", async () => {
    mockFetch().mockReset().mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const { result } = renderHook(() => useInworldRealtime());

    await expect(
      act(async () => {
        await result.current.connect(CONFIG);
      })
    ).rejects.toThrow("Failed to fetch realtime config");
  });

  it("releases the microphone when the SDP exchange fails", async () => {
    mockFetch()
      .mockReset()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ iceServers: [] }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ detail: "upstream down" }),
      });
    const { result } = renderHook(() => useInworldRealtime());

    await act(async () => {
      await result.current.connect(CONFIG).catch(() => {});
    });

    expect(stream.track.stop).toHaveBeenCalled();
    expect(MockPeerConnection.last.close).toHaveBeenCalled();
  });

  it("reports the upstream detail in the thrown error", async () => {
    mockFetch()
      .mockReset()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ iceServers: [] }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ detail: "upstream down" }),
      });
    const { result } = renderHook(() => useInworldRealtime());

    await expect(
      act(async () => {
        await result.current.connect(CONFIG);
      })
    ).rejects.toThrow(/503 — upstream down/);
  });

  it("throws when the microphone is denied", async () => {
    getUserMedia.mockRejectedValue(new Error("Permission denied"));
    const { result } = renderHook(() => useInworldRealtime());

    await expect(
      act(async () => {
        await result.current.connect(CONFIG);
      })
    ).rejects.toThrow("Permission denied");
  });

  it("allows a retry after a failed connect", async () => {
    getUserMedia.mockRejectedValueOnce(new Error("Permission denied"));
    const { result } = renderHook(() => useInworldRealtime());

    await act(async () => {
      await result.current.connect(CONFIG).catch(() => {});
    });

    happyPathFetches();
    await act(async () => {
      await result.current.connect(CONFIG);
    });

    expect(MockPeerConnection.instances).toHaveLength(1);
  });
});

describe("server events", () => {
  it("reports provider errors instead of leaving the response processing", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    act(() => dc.deliver({ type: "response.created" }));
    act(() => dc.deliver({ type: "error", error: { message: "The requested model is not supported" } }));
    expect(result.current.error).toBe("The requested model is not supported");
    expect(result.current.agentState).toBe("idle");
  });

  it("does not treat a failed greeting as a successful response", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    dc.send.mockClear();
    act(() => dc.deliver({ type: "response.done", response: { status: "failed", status_details: { error: { message: "Model unavailable" } } } }));
    expect(result.current.error).toBe("Model unavailable");
    expect(dc.send).not.toHaveBeenCalled();
  });

  it("provides a fallback error when a failed response has no detail", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    act(() => dc.deliver({ type: "response.done", response: { status: "failed" } }));
    expect(result.current.error).toBe("Your tutor couldn’t respond. Please start a new conversation.");
  });

  it("clears the provider error on disconnect", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    act(() => dc.deliver({ type: "error", error: { message: "Unavailable" } }));
    act(() => result.current.disconnect());
    expect(result.current.error).toBeNull();
  });

  it("kicks off the greeting when the session is confirmed", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    dc.send.mockClear();

    act(() => dc.deliver({ type: "session.updated" }));

    const sent = dc.send.mock.calls.map((c) => JSON.parse(c[0]));
    expect(sent[0].item.content[0].text).toBe("[BEGIN]");
    expect(sent[1]).toEqual({ type: "response.create" });
  });

  it("re-enables interruption once the greeting is done", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    dc.send.mockClear();

    act(() => dc.deliver({ type: "response.done" }));

    const { session } = JSON.parse(dc.send.mock.calls[0][0]);
    expect(session.audio.input.turn_detection.interrupt_response).toBe(true);
  });

  it("does not re-enable interruption in hybrid mode", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result, { ...CONFIG, hybridMode: true });
    dc.send.mockClear();

    act(() => dc.deliver({ type: "response.done" }));

    expect(dc.send).not.toHaveBeenCalled();
  });

  it("does not repeat the greeting after it has run", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    act(() => dc.deliver({ type: "response.done" }));
    dc.send.mockClear();

    act(() => dc.deliver({ type: "session.updated" }));

    expect(dc.send).not.toHaveBeenCalled();
  });

  it.each([
    ["response.created", "processing"],
    ["response.output_audio.started", "speaking"],
    ["input_audio_buffer.speech_started", "listening"],
    ["input_audio_buffer.speech_stopped", "processing"],
  ])("maps %s to the %s agent state", async (type, expected) => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);

    act(() => dc.deliver({ type }));

    expect(result.current.agentState).toBe(expected);
  });

  it("returns to idle when a response completes", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    act(() => dc.deliver({ type: "response.done" })); // greeting
    act(() => dc.deliver({ type: "response.created" }));

    act(() => dc.deliver({ type: "response.done" }));

    expect(result.current.agentState).toBe("idle");
  });

  it("appends the agent's transcript to the message list", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);

    act(() =>
      dc.deliver({
        type: "response.output_item.done",
        item: {
          role: "assistant",
          content: [
            { type: "audio", transcript: "Tell me about" },
            { type: "audio", transcript: "a hard decision." },
          ],
        },
      })
    );

    expect(result.current.messages).toEqual([
      { role: "assistant", content: "Tell me about a hard decision." },
    ]);
  });

  it("ignores an assistant item with no transcript", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);

    act(() =>
      dc.deliver({
        type: "response.output_item.done",
        item: { role: "assistant", content: [{ type: "audio" }] },
      })
    );

    expect(result.current.messages).toEqual([]);
  });

  it("ignores a non-assistant output item", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);

    act(() =>
      dc.deliver({
        type: "response.output_item.done",
        item: { role: "user", content: [{ type: "audio", transcript: "hi" }] },
      })
    );

    expect(result.current.messages).toEqual([]);
  });

  it("appends the speaker's speech transcript", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);

    act(() =>
      dc.deliver({
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "  I led the migration.  ",
      })
    );

    expect(result.current.messages).toEqual([
      { role: "user", content: "I led the migration." },
    ]);
  });

  it("ignores an empty speech transcript", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);

    act(() =>
      dc.deliver({
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "   ",
      })
    );

    expect(result.current.messages).toEqual([]);
  });

  it("skips speech transcripts in hybrid mode - sendText already added them", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result, { ...CONFIG, hybridMode: true });

    act(() =>
      dc.deliver({
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "typed answer",
      })
    );

    expect(result.current.messages).toEqual([]);
  });

  it("ignores a malformed event without throwing", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);

    expect(() => act(() => dc.deliver("not json"))).not.toThrow();
    expect(result.current.messages).toEqual([]);
  });
});

describe("outgoing controls", () => {
  it("sends a text message and asks for a response", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    dc.send.mockClear();

    act(() => result.current.sendTextMessage("My answer"));

    const sent = dc.send.mock.calls.map((c) => JSON.parse(c[0]));
    expect(sent[0].item.content[0].text).toBe("My answer");
    expect(sent[1]).toEqual({ type: "response.create" });
  });

  it("sendText also records the message locally", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    await connected(result);

    act(() => result.current.sendText("Typed answer"));

    expect(result.current.messages).toEqual([
      { role: "user", content: "Typed answer" },
    ]);
  });

  it("sendText is a no-op when the channel is not open", async () => {
    const { result } = renderHook(() => useInworldRealtime());

    await act(async () => {
      await result.current.connect(CONFIG);
    });
    const dc = MockPeerConnection.last.dataChannel; // still "connecting"

    act(() => result.current.sendText("Typed answer"));

    expect(dc.send).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("drops outgoing events when there is no channel at all", () => {
    const { result } = renderHook(() => useInworldRealtime());

    expect(() => act(() => result.current.sendTextMessage("hi"))).not.toThrow();
  });

  it("cancels the in-flight response", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    dc.send.mockClear();

    act(() => result.current.cancelResponse());

    expect(JSON.parse(dc.send.mock.calls[0][0])).toEqual({
      type: "response.cancel",
    });
  });

  it("interrupt cancels and returns the agent to idle", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    act(() => dc.deliver({ type: "response.output_audio.started" }));
    dc.send.mockClear();

    act(() => result.current.interrupt());

    expect(JSON.parse(dc.send.mock.calls[0][0])).toEqual({
      type: "response.cancel",
    });
    expect(result.current.agentState).toBe("idle");
  });

  it("mutes and unmutes the microphone track", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    await connected(result);

    act(() => result.current.muteMic(true));
    expect(stream.track.enabled).toBe(false);

    act(() => result.current.muteMic(false));
    expect(stream.track.enabled).toBe(true);
  });

  it("muteMic is a no-op before connecting", () => {
    const { result } = renderHook(() => useInworldRealtime());

    expect(() => act(() => result.current.muteMic(true))).not.toThrow();
  });
});

describe("disconnect", () => {
  it("tears down the channel, connection and microphone", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    const pc = MockPeerConnection.last;

    act(() => result.current.disconnect());

    expect(dc.close).toHaveBeenCalled();
    expect(pc.close).toHaveBeenCalled();
    expect(stream.track.stop).toHaveBeenCalled();
  });

  it("resets all state", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    act(() =>
      dc.deliver({
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "an answer",
      })
    );

    act(() => result.current.disconnect());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.agentState).toBe("idle");
    expect(result.current.messages).toEqual([]);
    expect(result.current.agentAudioStream).toBeNull();
  });

  it("allows a fresh connection afterwards", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    await connected(result);
    act(() => result.current.disconnect());

    happyPathFetches();
    await act(async () => {
      await result.current.connect(CONFIG);
    });

    expect(MockPeerConnection.instances).toHaveLength(2);
  });

  it("replays the greeting on the next session", async () => {
    const { result } = renderHook(() => useInworldRealtime());
    const first = await connected(result);
    act(() => first.deliver({ type: "response.done" }));
    act(() => result.current.disconnect());

    happyPathFetches();
    const second = await connected(result);
    second.send.mockClear();
    act(() => second.deliver({ type: "session.updated" }));

    expect(second.send).toHaveBeenCalled();
  });

  it("is safe to call before connecting", () => {
    const { result } = renderHook(() => useInworldRealtime());

    expect(() => act(() => result.current.disconnect())).not.toThrow();
  });

  it("releases the connection on unmount", async () => {
    const { result, unmount } = renderHook(() => useInworldRealtime());
    const dc = await connected(result);
    const pc = MockPeerConnection.last;

    unmount();

    await waitFor(() => {
      expect(dc.close).toHaveBeenCalled();
      expect(pc.close).toHaveBeenCalled();
      expect(stream.track.stop).toHaveBeenCalled();
    });
  });
});
