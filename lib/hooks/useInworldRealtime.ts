"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Message } from "@/lib/types/conversation";

export interface RealtimeConfig {
  sessionId: string;
  instructions: string;
  voice: string;
  model: string;
  hybridMode?: boolean;
}

export interface UseInworldRealtimeReturn {
  connect: (config: RealtimeConfig) => Promise<void>;
  disconnect: () => void;
  isConnected: boolean;
  error: string | null;
  agentState: "idle" | "speaking" | "listening" | "processing";
  messages: Message[];
  agentAudioStream: MediaStream | null;
  sendTextMessage: (text: string) => void;
  cancelResponse: () => void;
  muteMic: (muted: boolean) => void;
  sendText: (text: string) => void;
  interrupt: () => void;
}

export function useInworldRealtime(): UseInworldRealtimeReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<"idle" | "speaking" | "listening" | "processing">("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentAudioStream, setAgentAudioStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  // No streaming text deltas from Inworld — full transcript arrives via response.output_item.done

  const sendEvent = useCallback((event: object) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(event));
    }
  }, []);

  const greetingDoneRef = useRef(false);
  const hybridModeRef = useRef(false);

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(event.data as string);
    } catch {
      return;
    }

    const type = parsed.type as string;
    console.log("[inworld event]", type, parsed);

    if (type === "error") {
      const providerError = parsed.error as { message?: string } | undefined;
      setError(providerError?.message ?? "Your tutor couldn’t respond. Please start a new conversation.");
      setAgentState("idle");
      return;
    }

    if (type === "response.done") {
      const response = parsed.response as {
        status?: string;
        status_details?: { error?: { message?: string } };
      } | undefined;
      if (response?.status === "failed") {
        setError((previous) => previous ?? response.status_details?.error?.message ?? "Your tutor couldn’t respond. Please start a new conversation.");
        setAgentState("idle");
        return;
      }
    }

    if (type === "session.updated") {
      if (!greetingDoneRef.current) {
        sendEvent({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "[BEGIN]" }],
          },
        });
        sendEvent({ type: "response.create" });
      }
    } else if (type === "response.done" && !greetingDoneRef.current) {
      greetingDoneRef.current = true;
      setAgentState("idle");
      if (!hybridModeRef.current) {
        // Re-enable interrupt_response now that greeting is complete
        sendEvent({
          type: "session.update",
          session: {
            audio: {
              input: {
                turn_detection: {
                  type: "semantic_vad",
                  eagerness: "low",
                  create_response: true,
                  interrupt_response: true,
                },
              },
            },
          },
        });
      }
    } else if (type === "response.created") {
      setAgentState("processing");
    } else if (type === "response.output_audio.started") {
      setAgentState("speaking");
    } else if (type === "input_audio_buffer.speech_started") {
      setAgentState("listening");
    } else if (type === "input_audio_buffer.speech_stopped") {
      setAgentState("processing");
    } else if (type === "response.done") {
      setAgentState("idle");
    } else if (type === "response.output_item.done") {
      // Inworld sends full transcript here (no streaming text deltas)
      const item = parsed.item as {
        role?: string;
        content?: { type: string; text?: string; transcript?: string }[];
      } | undefined;
      if (item?.role === "assistant" && item.content) {
        // The same assistant turn can contain matching output_text and
        // output_audio parts. Prefer the text part so the caption is added once;
        // audio-only responses may still arrive as multiple transcript chunks.
        const textPart = item.content.find(
          (c) => c.type === "output_text" && (c.text || c.transcript)
        );
        const transcript = textPart
          ? (textPart.text || textPart.transcript || "").trim()
          : item.content
              .filter((c) => c.transcript)
              .map((c) => c.transcript)
              .join(" ")
              .trim();
        if (transcript) {
          setMessages((prev) => [...prev, { role: "assistant", content: transcript }]);
        }
      }
    } else if (type === "conversation.item.input_audio_transcription.completed") {
      if (hybridModeRef.current) return; // text items are added directly by sendText()
      const transcript = (parsed.transcript as string)?.trim();
      if (transcript) {
        setMessages((prev) => [...prev, { role: "user", content: transcript }]);
      }
    }
  }, [sendEvent]);

  const connect = useCallback(async (config: RealtimeConfig) => {
    if (pcRef.current) return;
    if (!config.sessionId) throw new Error("Start a conversation before connecting");
    setError(null);

    hybridModeRef.current = config.hybridMode ?? false;

    const configRes = await fetch(`/api/realtime/config?${new URLSearchParams({ sessionId: config.sessionId })}`);
    if (!configRes.ok) {
      const body = await configRes.json().catch(() => ({})) as { error?: string };
      throw new Error(`Failed to fetch realtime config: ${configRes.status} — ${body.error ?? "unknown"}`);
    }
    const { iceServers } = await configRes.json() as { iceServers: RTCIceServer[] };

    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      const audioTrack = micStream.getAudioTracks()[0];
      if (config.hybridMode) {
        // Mute immediately — sends silence so Inworld's VAD never fires,
        // but the sendrecv SDP connection is identical to normal mode so
        // AI audio is received and played back correctly.
        audioTrack.enabled = false;
      }
      pc.addTrack(audioTrack, micStream);

      pc.ontrack = (event: RTCTrackEvent) => {
        if (event.track.kind === "audio") {
          const remoteStream = new MediaStream([event.track]);
          setAgentAudioStream(remoteStream);
          const audio = document.getElementById("inworld-agent-audio") as HTMLAudioElement | null;
          if (audio) {
            audio.srcObject = remoteStream;
            audio.play().catch(() => {});
          }
        }
      };

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        const sessionUpdate: Record<string, unknown> = {
          type: "realtime",
          model: config.model,
          instructions: config.instructions,
          output_modalities: ["audio", "text"],
          audio: {
            output: {
              model: "inworld-tts-1.5-mini",
              voice: config.voice,
            },
          },
        };

        // Only include audio input config (VAD/transcription) when NOT in hybrid mode
        if (!config.hybridMode) {
          (sessionUpdate.audio as Record<string, unknown>).input = {
            transcription: { model: "assemblyai/universal-streaming-multilingual" },
            turn_detection: {
              type: "semantic_vad",
              eagerness: "low",
              create_response: true,
              interrupt_response: false,
            },
          };
        }

        sendEvent({ type: "session.update", session: sessionUpdate });
        setIsConnected(true);
      };

      dc.onmessage = handleDataChannelMessage;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch("/api/realtime/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: offer.sdp, sessionId: config.sessionId }),
      });

      if (!sdpRes.ok) {
        const errBody = await sdpRes.json().catch(() => ({})) as { error?: string; detail?: string };
        console.error("[useInworldRealtime] SDP error:", sdpRes.status, errBody);
        throw new Error(`SDP exchange failed: ${sdpRes.status} — ${errBody.detail ?? errBody.error ?? "unknown"}`);
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (err) {
      micStream?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
      throw err;
    }
  }, [sendEvent, handleDataChannelMessage]);

  const disconnect = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    dcRef.current = null;
    pcRef.current = null;
    micStreamRef.current = null;
    greetingDoneRef.current = false;
    hybridModeRef.current = false;

    setIsConnected(false);
    setError(null);
    setAgentState("idle");
    setAgentAudioStream(null);
    setMessages([]);
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    sendEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    sendEvent({ type: "response.create" });
  }, [sendEvent]);

  const cancelResponse = useCallback(() => {
    sendEvent({ type: "response.cancel" });
  }, [sendEvent]);

  const muteMic = useCallback((muted: boolean) => {
    const stream = micStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }, []);

  const sendText = useCallback((text: string) => {
    if (!dcRef.current || dcRef.current.readyState !== "open") return;
    sendEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    sendEvent({ type: "response.create" });
    setMessages((prev) => [...prev, { role: "user", content: text }]);
  }, [sendEvent]);

  const interrupt = useCallback(() => {
    sendEvent({ type: "response.cancel" });
    setAgentState("idle");
  }, [sendEvent]);

  useEffect(() => {
    return () => {
      dcRef.current?.close();
      pcRef.current?.close();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    connect,
    disconnect,
    isConnected,
    error,
    agentState,
    messages,
    agentAudioStream,
    sendTextMessage,
    cancelResponse,
    muteMic,
    sendText,
    interrupt,
  };
}
