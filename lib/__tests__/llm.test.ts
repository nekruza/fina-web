import { streamLLM, type StreamLLMOptions } from "../llm"

global.fetch = jest.fn()
const mockFetch = () => global.fetch as jest.Mock

/** Build a Response-like object whose body streams the given SSE lines. */
function sseResponse(chunks: string[], ok = true, status = 200) {
	const encoder = new TextEncoder()
	let index = 0

	return {
		ok,
		status,
		text: async () => chunks.join(""),
		body: {
			getReader: () => ({
				read: async () =>
					index < chunks.length ?
						{ done: false, value: encoder.encode(chunks[index++]) }
					:	{ done: true, value: undefined },
			}),
		},
	}
}

function geminiChunk(text: string) {
	return `data: ${JSON.stringify({
		candidates: [{ content: { parts: [{ text }] } }],
	})}\n`
}

function openAiChunk(content: string) {
	return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`
}

async function collect(gen: AsyncGenerator<string>) {
	const out: string[] = []
	for await (const chunk of gen) out.push(chunk)
	return out
}

const OPTIONS: StreamLLMOptions = {
	systemPrompt: "You are a helpful tutor.",
	messages: [{ role: "user", content: "Hello" }],
	maxTokens: 512,
}

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
	process.env.GOOGLE_GEMINI_API_KEY = "gemini-key"
	process.env.OPENAI_API_KEY = "openai-key"
})

afterEach(() => {
	process.env = { ...ORIGINAL_ENV }
})

describe("Gemini primary path", () => {
	it("yields the streamed text chunks in order", async () => {
		mockFetch().mockResolvedValue(
			sseResponse([geminiChunk("Hello"), geminiChunk(" there")]),
		)

		await expect(collect(streamLLM(OPTIONS))).resolves.toEqual([
			"Hello",
			" there",
		])
	})

	it("calls Gemini with the api key and streaming enabled", async () => {
		mockFetch().mockResolvedValue(sseResponse([geminiChunk("Hi")]))

		await collect(streamLLM(OPTIONS))

		const url = mockFetch().mock.calls[0][0] as string
		expect(url).toContain("generativelanguage.googleapis.com")
		expect(url).toContain("streamGenerateContent")
		expect(url).toContain("alt=sse")
		expect(url).toContain("key=gemini-key")
	})

	it("uses the flash-lite model by default", async () => {
		mockFetch().mockResolvedValue(sseResponse([geminiChunk("Hi")]))

		await collect(streamLLM(OPTIONS))

		expect(mockFetch().mock.calls[0][0]).toContain("gemini-3.8-flash-lite")
	})

	it("honours an explicit gemini model", async () => {
		mockFetch().mockResolvedValue(sseResponse([geminiChunk("Hi")]))

		await collect(streamLLM({ ...OPTIONS, geminiModel: "gemini-2.5-pro" }))

		expect(mockFetch().mock.calls[0][0]).toContain("gemini-2.5-pro")
	})

	it("sends the system prompt and generation config", async () => {
		mockFetch().mockResolvedValue(sseResponse([geminiChunk("Hi")]))

		await collect(streamLLM({ ...OPTIONS, temperature: 0.2 }))

		const body = JSON.parse(mockFetch().mock.calls[0][1].body)
		expect(body.system_instruction.parts[0].text).toBe(
			"You are a helpful tutor.",
		)
		expect(body.generationConfig).toEqual({
			maxOutputTokens: 512,
			temperature: 0.2,
		})
	})

	it("defaults the temperature to 0.7", async () => {
		mockFetch().mockResolvedValue(sseResponse([geminiChunk("Hi")]))

		await collect(streamLLM(OPTIONS))

		expect(
			JSON.parse(mockFetch().mock.calls[0][1].body).generationConfig
				.temperature,
		).toBe(0.7)
	})

	it("maps the assistant role to Gemini's model role", async () => {
		mockFetch().mockResolvedValue(sseResponse([geminiChunk("Hi")]))

		await collect(
			streamLLM({
				...OPTIONS,
				messages: [
					{ role: "user", content: "Question" },
					{ role: "assistant", content: "Answer" },
					{ role: "user", content: "Follow up" },
				],
			}),
		)

		const { contents } = JSON.parse(mockFetch().mock.calls[0][1].body)
		expect(contents.map((c: { role: string }) => c.role)).toEqual([
			"user",
			"model",
			"user",
		])
	})

	it("trims trailing model turns because Gemini requires a user turn last", async () => {
		mockFetch().mockResolvedValue(sseResponse([geminiChunk("Hi")]))

		await collect(
			streamLLM({
				...OPTIONS,
				messages: [
					{ role: "user", content: "Question" },
					{ role: "assistant", content: "Answer" },
				],
			}),
		)

		const { contents } = JSON.parse(mockFetch().mock.calls[0][1].body)
		expect(contents).toHaveLength(1)
		expect(contents[0].role).toBe("user")
	})

	it("injects a synthetic user turn when the history has none", async () => {
		mockFetch().mockResolvedValue(sseResponse([geminiChunk("Hi")]))

		await collect(
			streamLLM({
				...OPTIONS,
				messages: [{ role: "assistant", content: "Welcome" }],
			}),
		)

		const { contents } = JSON.parse(mockFetch().mock.calls[0][1].body)
		expect(contents).toEqual([{ role: "user", parts: [{ text: "Begin." }] }])
	})

	it("skips malformed SSE payloads rather than aborting the stream", async () => {
		mockFetch().mockResolvedValue(
			sseResponse([
				geminiChunk("Hello"),
				"data: {not json}\n",
				geminiChunk(" world"),
			]),
		)

		await expect(collect(streamLLM(OPTIONS))).resolves.toEqual([
			"Hello",
			" world",
		])
	})

	it("ignores non-data lines", async () => {
		mockFetch().mockResolvedValue(
			sseResponse([": keepalive\n", "\n", geminiChunk("Hello")]),
		)

		await expect(collect(streamLLM(OPTIONS))).resolves.toEqual(["Hello"])
	})

	it("reassembles a payload split across two reads", async () => {
		const full = geminiChunk("Hello")
		const split = Math.floor(full.length / 2)
		mockFetch().mockResolvedValue(
			sseResponse([full.slice(0, split), full.slice(split)]),
		)

		await expect(collect(streamLLM(OPTIONS))).resolves.toEqual(["Hello"])
	})

	it("skips chunks that carry no text", async () => {
		mockFetch().mockResolvedValue(
			sseResponse([
				`data: ${JSON.stringify({ candidates: [{ content: { parts: [] } }] })}\n`,
				geminiChunk("Hello"),
			]),
		)

		await expect(collect(streamLLM(OPTIONS))).resolves.toEqual(["Hello"])
	})
})

describe("fallback to OpenAI", () => {
	function geminiFailsThenOpenAi(openAiChunks: string[]) {
		mockFetch()
			.mockResolvedValueOnce(sseResponse([], false, 500))
			.mockResolvedValueOnce(sseResponse(openAiChunks))
	}

	it("switches to OpenAI when Gemini returns an error status", async () => {
		geminiFailsThenOpenAi([openAiChunk("Fallback")])

		await expect(collect(streamLLM(OPTIONS))).resolves.toEqual(["Fallback"])
		expect(mockFetch().mock.calls[1][0]).toBe(
			"https://api.openai.com/v1/chat/completions",
		)
	})

	it("switches to OpenAI when the Gemini request throws", async () => {
		mockFetch()
			.mockRejectedValueOnce(new Error("network down"))
			.mockResolvedValueOnce(sseResponse([openAiChunk("Fallback")]))

		await expect(collect(streamLLM(OPTIONS))).resolves.toEqual(["Fallback"])
	})

	it("switches to OpenAI when Gemini is not configured", async () => {
		delete process.env.GOOGLE_GEMINI_API_KEY
		mockFetch().mockResolvedValue(sseResponse([openAiChunk("Fallback")]))

		await expect(collect(streamLLM(OPTIONS))).resolves.toEqual(["Fallback"])
		expect(mockFetch().mock.calls[0][0]).toBe(
			"https://api.openai.com/v1/chat/completions",
		)
	})

	it("authenticates to OpenAI with a bearer token", async () => {
		geminiFailsThenOpenAi([openAiChunk("Hi")])

		await collect(streamLLM(OPTIONS))

		expect(mockFetch().mock.calls[1][1].headers.Authorization).toBe(
			"Bearer openai-key",
		)
	})

	it("prepends the system prompt to the OpenAI message list", async () => {
		geminiFailsThenOpenAi([openAiChunk("Hi")])

		await collect(streamLLM(OPTIONS))

		const body = JSON.parse(mockFetch().mock.calls[1][1].body)
		expect(body.messages[0]).toEqual({
			role: "system",
			content: "You are a helpful tutor.",
		})
		expect(body.messages[1]).toEqual({ role: "user", content: "Hello" })
		expect(body.stream).toBe(true)
	})

	it("stops at the OpenAI [DONE] sentinel", async () => {
		geminiFailsThenOpenAi([
			openAiChunk("Hello"),
			"data: [DONE]\n",
			openAiChunk(" ignored"),
		])

		await expect(collect(streamLLM(OPTIONS))).resolves.toEqual(["Hello"])
	})

	it("skips malformed OpenAI chunks", async () => {
		geminiFailsThenOpenAi([
			openAiChunk("Hello"),
			"data: {bad}\n",
			openAiChunk("!"),
		])

		await expect(collect(streamLLM(OPTIONS))).resolves.toEqual(["Hello", "!"])
	})

	it("skips OpenAI chunks with an empty delta", async () => {
		geminiFailsThenOpenAi([
			`data: ${JSON.stringify({ choices: [{ delta: {} }] })}\n`,
			openAiChunk("Hello"),
		])

		await expect(collect(streamLLM(OPTIONS))).resolves.toEqual(["Hello"])
	})

	it("throws when neither provider is configured", async () => {
		delete process.env.GOOGLE_GEMINI_API_KEY
		delete process.env.OPENAI_API_KEY

		await expect(collect(streamLLM(OPTIONS))).rejects.toThrow(
			"OPENAI_API_KEY not configured",
		)
	})

	it("throws when the OpenAI fallback also fails", async () => {
		mockFetch()
			.mockResolvedValueOnce(sseResponse([], false, 500))
			.mockResolvedValueOnce(sseResponse([], false, 429))

		await expect(collect(streamLLM(OPTIONS))).rejects.toThrow(
			/OpenAI API error: 429/,
		)
	})

	it("reports a timeout distinctly when the OpenAI request aborts", async () => {
		const abortError = new Error("aborted")
		abortError.name = "AbortError"
		mockFetch()
			.mockResolvedValueOnce(sseResponse([], false, 500))
			.mockRejectedValueOnce(abortError)

		await expect(collect(streamLLM(OPTIONS))).rejects.toThrow(
			"OpenAI timed out",
		)
	})
})
