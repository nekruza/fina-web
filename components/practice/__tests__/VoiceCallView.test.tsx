/** @jest-environment jsdom */
import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { VoiceCallView } from "../VoiceCallView"

jest.mock("@/lib/hooks/useInworldRealtime", () => ({
	useInworldRealtime: jest.fn(),
}))
jest.mock("@/lib/hooks/useTimer", () => ({ useTimer: jest.fn() }))
jest.mock("@/lib/hooks/useSpeechRecognition", () => ({
	useSpeechRecognition: () => ({
		isSupported: true,
		transcript: "",
		finalTranscript: "",
		stopListening: jest.fn(),
		startListening: jest.fn(),
		resetTranscript: jest.fn(),
	}),
}))
jest.mock("@/lib/hooks/useSpeechSynthesis", () => ({
	useSpeechSynthesis: () => ({ cancel: jest.fn(), speakAsync: jest.fn() }),
}))
jest.mock("@/lib/hooks/useAudioVisualizer", () => ({
	useAudioVisualizer: () => ({
		startAnalyser: jest.fn(),
		stopAnalyser: jest.fn(),
	}),
}))
jest.mock("../VideoArea", () => ({ VideoArea: () => null }))
jest.mock("../TranscriptPanel", () => ({ TranscriptPanel: () => null }))
jest.mock("../ControlBar", () => ({ ControlBar: () => null }))
jest.mock("../HintOverlay", () => ({ HintOverlay: () => null }))
jest.mock("../NotesPanel", () => ({ NotesPanel: () => null }))

const { useInworldRealtime } = jest.requireMock(
	"@/lib/hooks/useInworldRealtime",
)
const { useTimer } = jest.requireMock("@/lib/hooks/useTimer")
const connect = jest.fn()
const disconnect = jest.fn()
const pause = jest.fn()
const stopTrack = jest.fn()
const getUserMedia = jest.fn()
const originalRealtimeFlag = process.env.NEXT_PUBLIC_INWORLD_REALTIME_ENABLED

function renderCall(sessionId: string | null = "session-1") {
	const onReset = jest.fn()
	const call = () => (
		<VoiceCallView
			roleplay={{
				id: "cafe",
				title: "At the cafe",
				description: "Order a drink",
				difficulty: "Beginner",
				emoji: "☕",
				category: "food",
				userRole: "Customer",
				aiRole: "Barista",
				scenario: "Order a coffee",
			}}
			tutorId="luna"
			language="english"
			level="beginner"
			nativeLanguage="english"
			dailyGoalMinutes={10}
			sessionId={sessionId}
			onComplete={jest.fn()}
			onReset={onReset}
		/>
	)
	const view = render(call())
	return { onReset, rerender: () => view.rerender(call()) }
}

beforeEach(() => {
	process.env.NEXT_PUBLIC_INWORLD_REALTIME_ENABLED = "true"
	global.RTCPeerConnection = jest.fn() as unknown as typeof RTCPeerConnection
	global.MediaStream = jest.fn(() => ({
		addTrack: jest.fn(),
		getTracks: () => [{ stop: stopTrack }],
	})) as unknown as typeof MediaStream
	getUserMedia.mockResolvedValue({
		getVideoTracks: () => [{ stop: stopTrack }],
		getAudioTracks: () => [],
		getTracks: () => [{ stop: stopTrack }],
	})
	Object.defineProperty(navigator, "mediaDevices", {
		configurable: true,
		value: { getUserMedia },
	})
	connect.mockReset().mockResolvedValue(undefined)
	useInworldRealtime.mockReturnValue({
		connect,
		disconnect,
		messages: [],
		agentState: "idle",
		agentAudioStream: null,
	})
	useTimer.mockReturnValue({
		seconds: 0,
		formatted: "00:00",
		start: jest.fn(),
		pause,
	})
})

afterAll(() => {
	if (originalRealtimeFlag === undefined)
		delete process.env.NEXT_PUBLIC_INWORLD_REALTIME_ENABLED
	else process.env.NEXT_PUBLIC_INWORLD_REALTIME_ENABLED = originalRealtimeFlag
})

it("passes the started conversation session into realtime setup", async () => {
	renderCall()
	await waitFor(() =>
		expect(connect).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: "session-1",
				model: "google-ai-studio/gemini-3.8-flash",
			}),
		),
	)
})

it("shows recovery when the provider rejects a response after connecting", async () => {
	const realtime = {
		connect,
		disconnect,
		messages: [],
		agentState: "processing",
		agentAudioStream: null,
		error: null as string | null,
	}
	useInworldRealtime.mockReturnValue(realtime)
	const { rerender } = renderCall()
	await waitFor(() => expect(connect).toHaveBeenCalled())
	realtime.error = "The requested model is not supported"
	rerender()
	expect(
		await screen.findByRole("heading", {
			name: "Couldn’t connect to your tutor",
		}),
	).toBeVisible()
	expect(pause).toHaveBeenCalled()
	expect(disconnect).toHaveBeenCalled()
	expect(stopTrack).toHaveBeenCalled()
})

it("handles a rejected connection and releases the camera", async () => {
	connect.mockRejectedValue(
		new Error("Failed to fetch realtime config: 403 — invalid_session"),
	)
	const { onReset } = renderCall()
	expect(
		await screen.findByRole("heading", {
			name: "Couldn’t connect to your tutor",
		}),
	).toBeVisible()
	expect(pause).toHaveBeenCalled()
	expect(disconnect).toHaveBeenCalled()
	expect(stopTrack).toHaveBeenCalled()
	fireEvent.click(screen.getByRole("button", { name: "Go back" }))
	expect(onReset).toHaveBeenCalled()
})

it("does not request media or connect without a conversation session", async () => {
	renderCall(null)
	expect(
		await screen.findByRole("heading", {
			name: "Couldn’t connect to your tutor",
		}),
	).toBeVisible()
	expect(getUserMedia).not.toHaveBeenCalled()
	expect(connect).not.toHaveBeenCalled()
})

it("includes the conversation session in fallback voice requests", async () => {
	process.env.NEXT_PUBLIC_INWORLD_REALTIME_ENABLED = "false"
	global.fetch = jest
		.fn()
		.mockResolvedValue({
			ok: true,
			body: { getReader: () => ({ read: async () => ({ done: true }) }) },
		})
	renderCall()
	await waitFor(() =>
		expect(global.fetch).toHaveBeenCalledWith(
			"/api/ai/voice",
			expect.any(Object),
		),
	)
	const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
	expect(body.sessionId).toBe("session-1")
})
