/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react"
import { useInworldRealtime } from "../useInworldRealtime"

global.fetch = jest.fn()
global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
	addTrack: jest.fn(),
	createDataChannel: jest.fn().mockReturnValue({
		onopen: null,
		onmessage: null,
		send: jest.fn(),
		close: jest.fn(),
		readyState: "open",
	}),
	createOffer: jest.fn().mockResolvedValue({ sdp: "v=0\r\n", type: "offer" }),
	setLocalDescription: jest.fn().mockResolvedValue(undefined),
	setRemoteDescription: jest.fn().mockResolvedValue(undefined),
	ontrack: null,
	onicecandidate: null,
	close: jest.fn(),
})) as unknown as typeof RTCPeerConnection

// navigator.mediaDevices is read-only, so define it rather than assigning.
Object.defineProperty(global.navigator, "mediaDevices", {
	value: {
		getUserMedia: jest.fn().mockResolvedValue({
			getAudioTracks: jest.fn().mockReturnValue([{ kind: "audio" }]),
			getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
		}),
	},
	writable: true,
	configurable: true,
})

describe("useInworldRealtime", () => {
	afterEach(() => {
		jest.clearAllMocks()
	})

	it("starts with default state", () => {
		const { result } = renderHook(() => useInworldRealtime())

		expect(result.current.isConnected).toBe(false)
		expect(result.current.agentState).toBe("idle")
		expect(result.current.messages).toEqual([])
	})

	it("calls /api/realtime/config then /api/realtime/connect on connect", async () => {
		;(global.fetch as jest.Mock)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ iceServers: [] }),
			})
			.mockResolvedValueOnce({
				ok: true,
				text: async () => "v=0\r\ntype=answer",
			})

		const { result } = renderHook(() => useInworldRealtime())

		await act(async () => {
			await result.current.connect({
				sessionId: "session-1",
				instructions: "You are Luna, a friendly Spanish conversation partner.",
				voice: "Dennis",
				model: "google-ai-studio/gemini-3.8-flash",
			})
		})

		expect(global.fetch).toHaveBeenCalledWith(
			"/api/realtime/config?sessionId=session-1",
		)
		expect(global.fetch).toHaveBeenCalledWith(
			"/api/realtime/connect",
			expect.objectContaining({ method: "POST" }),
		)
	})
})
