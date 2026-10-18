"use client"

import { FC, FormEvent, useState, useRef, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useTimer } from "@/lib/hooks/useTimer"
import { useSpeechRecognition } from "@/lib/hooks/useSpeechRecognition"
import { useSpeechSynthesis } from "@/lib/hooks/useSpeechSynthesis"
import { useAudioVisualizer } from "@/lib/hooks/useAudioVisualizer"
import { VideoArea } from "./VideoArea"
import { TranscriptPanel } from "./TranscriptPanel"
import { ControlBar } from "./ControlBar"
import { HintOverlay } from "./HintOverlay"
import { NotesPanel } from "./NotesPanel"
import { SessionTimer } from "./SessionTimer"
import { CallStatusPill } from "./CallStatusPill"
import { CallUnavailable } from "./CallUnavailable"
import { EndCallDialog } from "./EndCallDialog"
import {
	GoalReachedBanner,
	MicDeniedBanner,
	SendReplyButton,
	SpeechErrorBanner,
} from "./CallBanners"
import { YOUR_TURN } from "./callTheme"
import type { ConversationState, Message } from "@/lib/types/conversation"
import type { RoleplayScenario } from "@/lib/types/roleplay"
import { useInworldRealtime } from "@/lib/hooks/useInworldRealtime"
import { buildConversationInstructions } from "@/lib/utils/buildConversationInstructions"
import { getTutorById, tutorVoice, type TutorId } from "@/lib/tutors"
import { getLanguage, speechLocale, type LanguageId } from "@/lib/languages"
import type { UserLevel } from "@/lib/levels"
import { sseData } from "@/lib/sse"

interface VoiceCallViewProps {
	roleplay: RoleplayScenario
	tutorId: TutorId
	language: LanguageId
	level: UserLevel
	nativeLanguage: LanguageId
	dailyGoalMinutes: number
	sessionId: string | null
	onComplete: (messages: Message[], durationSeconds: number) => void
	onReset: () => void
}

const BEGIN_RE = /^\[BEGIN\]/i

/** Wait this long after the last final transcript before auto-sending. */
const AUTO_SEND_SILENCE_MS = 2000

/** Drops the auto-sent "[BEGIN]" greeting trigger so it never reaches the UI, the analysis or the saved count. */
function stripBeginMarker(msgs: Message[]): Message[] {
	return msgs.filter(
		(m) => !(m.role === "user" && BEGIN_RE.test(m.content.trim())),
	)
}

/** User-facing explanation for a failed getUserMedia({ audio }) call. */
function micErrorMessage(err: unknown): string {
	const name = (err as DOMException)?.name
	if (name === "NotFoundError" || name === "DevicesNotFoundError")
		return "No microphone detected — plug one in and refresh."
	if (name === "NotAllowedError" || name === "PermissionDeniedError")
		return "Microphone access denied — allow it in your browser settings."
	if (name === "NotReadableError")
		return "Microphone is in use by another app — close it and refresh."
	return "Could not access microphone — please refresh and try again."
}

/** Body for POST /api/ai/voice — the next tutor turn, or hints when `isHint`. */
function voiceRequestBody(
	msgs: Message[],
	ctx: {
		sessionId?: string | null
		language: LanguageId
		level: UserLevel
		tutorId: TutorId
		roleplay: RoleplayScenario
	},
	isHint: boolean,
) {
	const { title, userRole, aiRole, scenario } = ctx.roleplay
	return JSON.stringify({
		...(ctx.sessionId !== undefined && { sessionId: ctx.sessionId }),
		messages: msgs,
		language: ctx.language,
		level: ctx.level,
		tutorId: ctx.tutorId,
		roleplay: { title, userRole, aiRole, scenario },
		isHint,
	})
}

export const VoiceCallView: FC<VoiceCallViewProps> = ({
	roleplay,
	tutorId,
	language,
	level,
	nativeLanguage,
	dailyGoalMinutes,
	sessionId,
	onComplete,
	onReset,
}) => {
	const tutor = getTutorById(tutorId)
	const voice = tutorVoice(tutor, language)
	const locale = speechLocale(language)
	const languageInfo = getLanguage(language)

	const [messages, setMessages] = useState<Message[]>([])
	const [convState, setConvState] = useState<ConversationState>("initializing")
	const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null)
	const [showCaptions, setShowCaptions] = useState(false)
	const [showNotes, setShowNotes] = useState(false)
	const [hints, setHints] = useState<string[] | null>(null)
	const [hintLoading, setHintLoading] = useState(false)
	const [showEndModal, setShowEndModal] = useState(false)
	const [micPermission, setMicPermission] = useState<boolean | null>(null)
	const [micError, setMicError] = useState<string | null>(null)
	const [connectionFailed, setConnectionFailed] = useState(false)
	const [cameraOn, setCameraOn] = useState(true)
	const [autoSend, setAutoSend] = useState(false)
	const [typedInputOpen, setTypedInputOpen] = useState(false)
	const [typedText, setTypedText] = useState("")
	const [goalDismissed, setGoalDismissed] = useState(false)

	const timer = useTimer()
	const speech = useSpeechRecognition(locale)
	const tts = useSpeechSynthesis()
	const visualizer = useAudioVisualizer()

	// ── Inworld Realtime ──
	const useRealtime =
		process.env.NEXT_PUBLIC_INWORLD_REALTIME_ENABLED === "true" &&
		typeof RTCPeerConnection !== "undefined"

	const realtime = useInworldRealtime()

	// Ref so cleanup effects always see the live stream regardless of closure capture
	const webcamStreamRef = useRef<MediaStream | null>(null)

	const messagesRef = useRef(messages)
	messagesRef.current = messages

	const convStateRef = useRef(convState)
	convStateRef.current = convState

	// Silence detection: when user stops speaking
	const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const lastFinalTranscriptRef = useRef("")

	const clearSilenceTimer = useCallback(() => {
		if (silenceTimerRef.current) {
			clearTimeout(silenceTimerRef.current)
			silenceTimerRef.current = null
		}
	}, [])

	/** Stops every camera/mic track so the browser's recording indicator goes off. */
	const releaseMedia = useCallback(() => {
		webcamStreamRef.current?.getTracks().forEach((t) => t.stop())
		webcamStreamRef.current = null
	}, [])

	/** What the learner has said so far this turn (final + interim). */
	const liveTranscript = (speech.finalTranscript + speech.transcript).trim()

	// ── Initialize: request media, start session ──
	useEffect(() => {
		let mounted = true

		const init = async () => {
			if (!sessionId) throw new Error("Start a conversation before connecting")

			// Mic + camera acquisition. Strategy:
			// - In realtime mode the Inworld SDK acquires its own mic — we MUST NOT call
			//   getUserMedia({audio}) here or the SDK's later call can hit NotReadableError.
			//   We only need the camera for the user pane in that case.
			// - In non-realtime mode we need both: the mic stream powers the visualizer
			//   and Web Speech recognition driver, and the camera is for the user pane.
			let micAcquired = false
			let audioStream: MediaStream | null = null

			if (!useRealtime) {
				try {
					audioStream = await navigator.mediaDevices.getUserMedia({
						audio: true,
					})
					setMicPermission(true)
					micAcquired = true
					if (mounted) {
						webcamStreamRef.current = audioStream
						visualizer.startAnalyser(audioStream)
					} else {
						audioStream.getTracks().forEach((t) => t.stop())
						audioStream = null
					}
				} catch (err) {
					setMicError(micErrorMessage(err))
					setMicPermission((prev) => (prev === true ? true : false))
				}
			} else {
				// Realtime mode: assume mic will be granted by the SDK; let the rest of init proceed.
				setMicPermission(true)
				micAcquired = true
			}

			// Camera is optional — never fail the flow if it's missing/blocked
			if (micAcquired && mounted) {
				try {
					const videoStream = await navigator.mediaDevices.getUserMedia({
						video: true,
					})
					if (!mounted) {
						videoStream.getTracks().forEach((t) => t.stop())
					} else {
						const combined = new MediaStream()
						audioStream?.getAudioTracks().forEach((t) => combined.addTrack(t))
						videoStream.getVideoTracks().forEach((t) => combined.addTrack(t))
						setWebcamStream(combined)
						webcamStreamRef.current = combined
					}
				} catch {
					// No camera or denied — keep audio-only. UI already handles the no-webcam case.
				}
			}

			// Abort session start if mic was never acquired
			if (!micAcquired || !mounted) return

			// Start timer
			timer.start()

			if (useRealtime) {
				const instructions = buildConversationInstructions({
					language,
					level,
					tutorName: tutor.name,
					roleplay,
				})
				await realtime.connect({
					sessionId,
					instructions,
					voice,
					model: "google-ai-studio/gemini-3.8-flash",
					hybridMode: true,
				})
			} else {
				await sendToAI([{ role: "user", content: "[BEGIN]" }])
			}
		}

		void init().catch(() => {
			if (!mounted) return
			timer.pause()
			realtime.disconnect()
			releaseMedia()
			setWebcamStream(null)
			setConnectionFailed(true)
		})

		return () => {
			mounted = false
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// A WebRTC connection can succeed before the provider rejects a response.
	useEffect(() => {
		if (!useRealtime || !realtime.error) return
		timer.pause()
		speech.stopListening()
		realtime.disconnect()
		visualizer.stopAnalyser()
		releaseMedia()
		setWebcamStream(null)
		setConnectionFailed(true)
		// The error event triggers teardown once, rather than on every hook render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [useRealtime, realtime.error])

	// ── Stream AI response ──
	const sendToAI = useCallback(
		async (msgs: Message[], isHint = false) => {
			if (!isHint) {
				setConvState("processing")
			}

			const assistantPlaceholder: Message = { role: "assistant", content: "" }
			if (!isHint) {
				setMessages((prev) => [...prev, assistantPlaceholder])
			}

			let fullText = ""

			try {
				const res = await fetch("/api/ai/voice", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: voiceRequestBody(
						msgs,
						{ sessionId, language, level, tutorId, roleplay },
						isHint,
					),
				})

				if (!res.ok || !res.body)
					throw new Error(`Stream failed: HTTP ${res.status}`)

				for await (const payload of sseData(res.body)) {
					if (payload === "[DONE]") break

					let parsed: { text?: string; error?: string } | null = null
					try {
						parsed = JSON.parse(payload)
					} catch {
						// skip malformed JSON chunks
						continue
					}
					if (parsed?.error) throw new Error(parsed.error)
					const chunk = parsed?.text
					if (chunk) {
						fullText += chunk
						if (!isHint) {
							// Append the chunk to the streaming assistant placeholder
							setMessages((prev) => {
								const updated = [...prev]
								updated[updated.length - 1] = {
									role: "assistant",
									content: updated[updated.length - 1].content + chunk,
								}
								return updated
							})
						}
					}
				}

				if (isHint) {
					return fullText
				}

				// Speak the response via TTS
				const stateBeforeSpeak = convStateRef.current as ConversationState
				if (fullText && stateBeforeSpeak !== "ending") {
					setConvState("ai_speaking")
					await speakAndWait(fullText)
					// After AI finishes speaking, start listening
					const stateAfterSpeak = convStateRef.current as ConversationState
					if (stateAfterSpeak !== "ending" && stateAfterSpeak !== "paused") {
						startListeningToUser()
					}
				} else if (stateBeforeSpeak !== "ending") {
					// Empty response — recover so we don't stay stuck in "processing"
					startListeningToUser()
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : "AI error"
				toast.error(msg)
				if (!isHint) {
					setMessages((prev) => prev.slice(0, -1))
				}
				// Try to recover to listening state
				const stateOnError = convStateRef.current as ConversationState
				if (stateOnError !== "ending") {
					startListeningToUser()
				}
			}

			return fullText
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[language, level, tutorId, roleplay, sessionId],
	)

	// ── Speak and wait for completion (promise-based) ──
	const speakAndWait = useCallback(
		async (text: string): Promise<void> => {
			// Stop recognition BEFORE TTS to prevent mic picking up AI voice
			speech.stopListening()
			await tts.speakAsync(text, voice, locale)
		},
		[tts, speech, voice, locale],
	)

	// ── Start listening to user ──
	const startListeningToUser = useCallback(() => {
		setConvState("listening")
		speech.resetTranscript()
		lastFinalTranscriptRef.current = ""
		speech.startListening()
	}, [speech])

	// ── Legacy STT path: commit the learner's reply and request the tutor's next turn ──
	const submitUserTurn = useCallback(
		(text: string) => {
			clearSilenceTimer()
			speech.stopListening()
			const userMsg: Message = { role: "user", content: text }
			const updatedMsgs = [...messagesRef.current, userMsg]
			setMessages(updatedMsgs)
			sendToAI(updatedMsgs)
		},
		[clearSilenceTimer, speech, sendToAI],
	)

	// Keep refs for values needed inside silence timeout callback
	const speechRef = useRef(speech)
	speechRef.current = speech
	const submitUserTurnRef = useRef(submitUserTurn)
	submitUserTurnRef.current = submitUserTurn

	// ── Toggle auto-send (clears pending timer when turning off) ──
	const handleToggleAutoSend = useCallback(() => {
		setAutoSend((prev) => {
			if (prev) clearSilenceTimer()
			return !prev
		})
	}, [clearSilenceTimer])

	// ── Watch for user finishing speaking (silence detection) ──
	useEffect(() => {
		if (convState !== "listening") return
		if (!autoSend) return

		const currentFinal = speech.finalTranscript

		// When we get new final transcript text, reset silence timer
		if (currentFinal && currentFinal !== lastFinalTranscriptRef.current) {
			lastFinalTranscriptRef.current = currentFinal

			clearSilenceTimer()
			silenceTimerRef.current = setTimeout(() => {
				const latestTranscript = speechRef.current.finalTranscript.trim()
				if (convStateRef.current === "listening" && latestTranscript) {
					submitUserTurnRef.current(latestTranscript)
				}
			}, AUTO_SEND_SILENCE_MS)
		}

		// Only clean up on unmount or when convState leaves "listening"
		// Do NOT clean up when finalTranscript changes (that would kill the timer)
	}, [convState, speech.finalTranscript, autoSend, clearSilenceTimer])

	// Clean up silence timer when leaving listening state
	useEffect(() => {
		if (convState !== "listening") clearSilenceTimer()
	}, [convState, clearSilenceTimer])

	// ── Sync Realtime agentState → convState ──
	useEffect(() => {
		if (!useRealtime || realtime.error || connectionFailed) return
		if (realtime.agentState === "speaking") setConvState("ai_speaking")
		else if (realtime.agentState === "listening") setConvState("listening")
		else if (realtime.agentState === "processing") setConvState("processing")
		else if (
			realtime.agentState === "idle" &&
			convState !== "paused" &&
			convState !== "ending" &&
			convState !== "initializing"
		) {
			setConvState("listening")
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [realtime.agentState, realtime.error, connectionFailed, useRealtime])

	// ── Detect AI speaking from agent audio stream (fallback when datachannel events are missing) ──
	useEffect(() => {
		if (!useRealtime || !realtime.agentAudioStream) return
		const audioCtx = new AudioContext()
		const source = audioCtx.createMediaStreamSource(realtime.agentAudioStream)
		const analyser = audioCtx.createAnalyser()
		analyser.fftSize = 256
		analyser.smoothingTimeConstant = 0.5
		source.connect(analyser)
		const dataArray = new Uint8Array(analyser.frequencyBinCount)
		const THRESHOLD = 15
		const SILENCE_DELAY = 500 // ms of silence before switching to listening
		let silenceStart = 0

		let rafId: number
		const detect = () => {
			analyser.getByteFrequencyData(dataArray)
			let sum = 0
			for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
			const avg = sum / dataArray.length
			const isSpeaking = avg > THRESHOLD
			const now = performance.now()

			if (isSpeaking) {
				silenceStart = 0
				if (
					convStateRef.current !== "ai_speaking" &&
					convStateRef.current !== "ending" &&
					convStateRef.current !== "paused"
				) {
					setConvState("ai_speaking")
				}
			} else if (convStateRef.current === "ai_speaking") {
				if (silenceStart === 0) {
					silenceStart = now
				} else if (now - silenceStart > SILENCE_DELAY) {
					setConvState("listening")
					silenceStart = 0
				}
			}
			rafId = requestAnimationFrame(detect)
		}
		rafId = requestAnimationFrame(detect)

		return () => {
			cancelAnimationFrame(rafId)
			audioCtx.close()
		}
	}, [useRealtime, realtime.agentAudioStream])

	// ── Hybrid mode: auto-start/stop local STT based on convState ──
	useEffect(() => {
		if (!useRealtime) return
		if (convState === "listening" && !realtime.error && !connectionFailed) {
			speech.resetTranscript()
			speech.startListening()
		} else {
			speech.stopListening()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [convState, useRealtime, realtime.error, connectionFailed])

	// ── Start visualizer with Realtime agent audio ──
	useEffect(() => {
		if (!useRealtime || !realtime.agentAudioStream) return
		visualizer.startAnalyser(realtime.agentAudioStream)
		return () => visualizer.stopAnalyser()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [realtime.agentAudioStream, useRealtime])

	// ── Manual send (fallback when silence detection doesn't fire) ──
	const handleManualSend = useCallback(() => {
		if (!liveTranscript || convStateRef.current !== "listening") return
		submitUserTurn(liveTranscript)
	}, [liveTranscript, submitUserTurn])

	// ── Realtime hybrid: inject text as a user message ──
	const sendRealtimeText = useCallback(
		(text: string) => {
			speech.stopListening()
			speech.resetTranscript()
			realtime.sendText(text)
		},
		[speech, realtime],
	)

	const handleRealtimeSend = useCallback(() => {
		if (liveTranscript) sendRealtimeText(liveTranscript)
	}, [liveTranscript, sendRealtimeText])

	// ── Typed reply: same routing as a spoken turn ──
	const handleTypedSubmit = useCallback(
		(e: FormEvent<HTMLFormElement>) => {
			e.preventDefault()
			const text = typedText.trim()
			if (!text || convStateRef.current !== "listening") return
			setTypedText("")
			setTypedInputOpen(false)

			if (useRealtime) sendRealtimeText(text)
			else submitUserTurn(text)
		},
		[typedText, useRealtime, sendRealtimeText, submitUserTurn],
	)

	// ── Interrupt AI mid-response ──
	const handleInterrupt = useCallback(() => {
		realtime.interrupt()
		const audio = document.getElementById(
			"inworld-agent-audio",
		) as HTMLAudioElement | null
		if (audio) {
			audio.pause()
		}
	}, [realtime])

	// ── Hint handler: /api/ai/voice (isHint) → { hints: string[] } ──
	const handleHint = useCallback(async () => {
		setHintLoading(true)
		try {
			const msgs = useRealtime ? realtime.messages : messagesRef.current

			// Hints are not a session turn, so no sessionId.
			const res = await fetch("/api/ai/voice", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: voiceRequestBody(msgs, { language, level, tutorId, roleplay }, true),
			})
			const { hints: nextHints, error } = await res.json()
			if (error) throw new Error(error)
			if (Array.isArray(nextHints) && nextHints.length > 0) {
				setHints(nextHints.slice(0, 4).map((h: unknown) => String(h)))
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Hint failed")
		} finally {
			setHintLoading(false)
		}
	}, [language, level, tutorId, roleplay, useRealtime, realtime])

	const dismissHints = useCallback(() => setHints(null), [])

	// ── Speak a hint aloud — never during an active AI turn ──
	const handleSpeakHint = useCallback(
		async (hint: string) => {
			const state = convStateRef.current
			if (
				state === "ai_speaking" ||
				state === "processing" ||
				state === "initializing" ||
				state === "ending"
			) {
				return
			}
			// Pause local STT so the hint audio isn't transcribed as the learner's reply.
			const wasListening = state === "listening"
			if (wasListening) speech.stopListening()
			await tts.speakAsync(hint, voice, locale)
			if (wasListening && convStateRef.current === "listening")
				speech.startListening()
		},
		[speech, tts, voice, locale],
	)

	// ── Stop / End session ──
	const handleStop = useCallback(() => {
		setConvState("ending")
		timer.pause()
		if (useRealtime) {
			realtime.cancelResponse()
			realtime.muteMic(true)
		} else {
			speech.stopListening()
			tts.cancel()
		}
		setShowEndModal(true)
	}, [timer, speech, tts, useRealtime, realtime])

	const handleCancelEnd = useCallback(() => {
		setShowEndModal(false)
		setConvState("listening")
		timer.start()
		startListeningToUser()
	}, [timer, startListeningToUser])

	const handleConfirmEnd = useCallback(() => {
		releaseMedia()
		visualizer.stopAnalyser()
		if (useRealtime) realtime.disconnect()
		onComplete(
			stripBeginMarker(useRealtime ? realtime.messages : messagesRef.current),
			timer.seconds,
		)
	}, [releaseMedia, visualizer, useRealtime, realtime, onComplete, timer.seconds])

	// ── Toggle camera ──
	const handleToggleCamera = useCallback(() => {
		const stream = webcamStreamRef.current
		if (!stream) return
		const videoTracks = stream.getVideoTracks()
		if (videoTracks.length === 0) return
		const enabled = !videoTracks[0].enabled
		videoTracks.forEach((t) => (t.enabled = enabled))
		setCameraOn(enabled)
	}, [])

	// ── Cleanup on unmount ──
	useEffect(() => {
		return () => {
			// Stop all active processes
			speech.stopListening()
			tts.cancel()
			if (useRealtime) {
				realtime.disconnect()
			}
			visualizer.stopAnalyser()
			timer.pause()

			clearSilenceTimer()
			releaseMedia()

			// Reset refs
			lastFinalTranscriptRef.current = ""

			// Reset state
			setWebcamStream(null)
			setHints(null)
			setHintLoading(false)
			setConvState("initializing")
			setMessages([])
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// ── Daily goal (derived: fires once, the first time the clock passes the goal) ──
	const goalReached =
		dailyGoalMinutes > 0 && timer.seconds >= dailyGoalMinutes * 60
	const showGoalBanner = goalReached && !goalDismissed && !showEndModal

	// ── Compute caption for video overlay ──
	const visibleMessages = stripBeginMarker(
		useRealtime ? realtime.messages : messages,
	)
	const captionLastMsg = visibleMessages[visibleMessages.length - 1]
	const captionInterim = convState === "listening" ? liveTranscript : ""
	const videoCaption =
		captionInterim ? { text: captionInterim, role: "user" as const }
		: captionLastMsg ?
			{
				text: captionLastMsg.content,
				role: captionLastMsg.role as "user" | "assistant",
			}
		:	null

	const canSpeakHint = convState === "listening" || convState === "paused"

	// Something has been heard this turn that the learner can send.
	const hasSpokenReply =
		convState === "listening" && !!(speech.finalTranscript || speech.transcript)

	// Shared by the mobile transcript sheet and the md+ side panel.
	const transcriptProps = {
		messages: visibleMessages,
		interimTranscript: captionInterim,
		isActivelyListening: convState === "listening" && !!speech.transcript,
		isVisible: showCaptions,
		tutorName: tutor.name,
		nativeLanguage,
	}

	// ── Startup failure or unsupported browser ──
	if (connectionFailed || (!useRealtime && !speech.isSupported)) {
		return (
			<CallUnavailable
				reason={connectionFailed ? "connection" : "unsupported"}
				tutorName={tutor.name}
				onBack={onReset}
			/>
		)
	}

	return (
		<div className="fixed inset-0 z-50 bg-[#0a0d14] flex flex-col">
			{/* Header */}
			<header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 shrink-0">
				<div className="flex items-center gap-3 min-w-0">
					<span
						aria-hidden
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-xl"
					>
						{roleplay.emoji}
					</span>
					<div className="min-w-0">
						<p className="text-[11px] font-semibold text-white/50 uppercase tracking-[0.14em] truncate max-w-[14rem] md:max-w-md">
							{roleplay.title}
						</p>
						<p className="text-sm text-white/85 truncate">
							{tutor.name} · {languageInfo.label} {languageInfo.flag}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 md:gap-3">
					<CallStatusPill state={convState} tutorName={tutor.name} />
					<SessionTimer
						formatted={timer.formatted}
						isRunning={timer.isRunning}
					/>
				</div>
			</header>

			{/* Main content area */}
			<div
				className="flex-1 flex gap-4 px-4 md:px-6 pb-4 min-h-0 relative"
				style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
			>
				{/* Video + controls column */}
				<div className="flex-1 flex flex-col gap-4 min-w-0 min-h-0 relative">
					{micPermission === false && <MicDeniedBanner message={micError} />}
					{speech.error && <SpeechErrorBanner message={speech.error} />}

					{showGoalBanner && (
						<GoalReachedBanner
							minutes={dailyGoalMinutes}
							onKeepTalking={() => setGoalDismissed(true)}
							onFinish={() => {
								setGoalDismissed(true)
								handleStop()
							}}
						/>
					)}

					<VideoArea
						webcamStream={webcamStream}
						isAISpeaking={convState === "ai_speaking"}
						isUserSpeaking={convState === "listening" && speech.isListening}
						analyserData={visualizer.analyserData}
						caption={videoCaption}
						tutor={tutor}
					/>

					{/* Hint overlay (positioned inside video area) */}
					<div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none z-20">
						<div className="pointer-events-auto w-full flex justify-center">
							<HintOverlay
								hints={hints}
								onDismiss={dismissHints}
								onSpeak={handleSpeakHint}
								canSpeak={canSpeakHint}
							/>
						</div>
					</div>

					{/* Send button — realtime hybrid mode */}
					{useRealtime && hasSpokenReply && (
						<div className="shrink-0 flex items-center justify-center">
							<SendReplyButton onClick={handleRealtimeSend} />
						</div>
					)}

					{/* Auto-send toggle + manual send button (legacy STT path only) */}
					{convState === "listening" && !useRealtime && (
						<div className="shrink-0 flex items-center justify-center gap-3">
							<button
								type="button"
								onClick={handleToggleAutoSend}
								aria-pressed={autoSend}
								title={
									autoSend ?
										"Auto-send is on — your reply sends after 2 s of silence. Click to send manually."
									:	"Auto-send is off — click Send to submit your reply. Click to turn auto-send on."
								}
								className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
								style={{
									background:
										autoSend ?
											"rgba(74,222,128,0.12)"
										:	"rgba(255,255,255,0.05)",
									borderColor:
										autoSend ?
											"rgba(74,222,128,0.35)"
										:	"rgba(255,255,255,0.15)",
									color: autoSend ? YOUR_TURN : "rgba(255,255,255,0.5)",
								}}
							>
								<span
									className="w-2 h-2 rounded-full shrink-0"
									style={{
										background: autoSend ? YOUR_TURN : "rgba(255,255,255,0.3)",
									}}
								/>
								Auto-send {autoSend ? "on" : "off"}
							</button>

							{hasSpokenReply && <SendReplyButton onClick={handleManualSend} />}
						</div>
					)}

					{/* Transcript bottom sheet — below md only (the side panel covers md+) */}
					<TranscriptPanel
						variant="sheet"
						{...transcriptProps}
						onClose={() => setShowCaptions(false)}
					/>

					{/* Control bar */}
					<div className="shrink-0 flex justify-center">
						<ControlBar
							onToggleCaptions={() => setShowCaptions((v) => !v)}
							captionsOn={showCaptions}
							onHint={handleHint}
							hintLoading={hintLoading}
							onToggleCamera={handleToggleCamera}
							cameraOn={cameraOn}
							onStop={handleStop}
							onToggleNotes={() => setShowNotes((v) => !v)}
							notesOpen={showNotes}
							onToggleTypedInput={() => setTypedInputOpen((v) => !v)}
							typedInputOpen={typedInputOpen}
							typedInputDisabled={convState !== "listening"}
							onInterrupt={useRealtime ? handleInterrupt : undefined}
							isAISpeaking={convState === "ai_speaking"}
						/>
					</div>

					{/* Typed reply — an alternative to speaking */}
					{typedInputOpen && convState === "listening" && (
						<form
							onSubmit={handleTypedSubmit}
							className="shrink-0 mx-auto flex w-full max-w-md items-center gap-2"
						>
							<input
								type="text"
								value={typedText}
								onChange={(e) => setTypedText(e.target.value)}
								aria-label="Type a message"
								placeholder="Type instead…"
								lang={locale}
								autoComplete="off"
								autoFocus
								maxLength={500}
								className="h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-[#4ade80]/50 focus-visible:ring-2 focus-visible:ring-[#4ade80]/25"
							/>
							<button
								type="submit"
								disabled={!typedText.trim()}
								className="h-10 shrink-0 rounded-full bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
							>
								Send
							</button>
						</form>
					)}
				</div>

				{/* Transcript side panel */}
				<TranscriptPanel {...transcriptProps} />
			</div>

			<NotesPanel isOpen={showNotes} onClose={() => setShowNotes(false)} />

			{showEndModal && (
				<EndCallDialog onCancel={handleCancelEnd} onConfirm={handleConfirmEnd} />
			)}
		</div>
	)
}
