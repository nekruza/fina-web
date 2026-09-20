// Server-only LLM provider helper.
// Default: Google Gemini 2.5 Flash Lite with automatic fallback to OpenAI GPT-4.1 mini on error.

export interface LLMMessage {
	role: string
	content: string
}

export interface StreamLLMOptions {
	systemPrompt: string
	messages: LLMMessage[]
	maxTokens: number
	temperature?: number
	model?: string
	geminiModel?: string
}

export async function* streamLLM(
	opts: StreamLLMOptions,
): AsyncGenerator<string> {
	try {
		yield* streamGemini(opts)
	} catch (err) {
		yield* streamOpenAI(opts)
	}
}

// ── OpenAI — gpt-5.4-mini-2026-03-17 (fallback) ──────────────────────────────

async function* streamOpenAI(opts: StreamLLMOptions): AsyncGenerator<string> {
	const apiKey = process.env.OPENAI_API_KEY
	if (!apiKey) throw new Error("OPENAI_API_KEY not configured")

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), 30_000)

	let res: Response
	try {
		res = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			signal: controller.signal,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "gpt-5.4-mini-2026-03-17",
				messages: [
					{ role: "system", content: opts.systemPrompt },
					...opts.messages.map((m) => ({ role: m.role, content: m.content })),
				],
				stream: true,
			}),
		})
	} catch (err) {
		clearTimeout(timeout)
		const isTimeout = err instanceof Error && err.name === "AbortError"
		throw new Error(isTimeout ? "OpenAI timed out" : String(err))
	}
	clearTimeout(timeout)

	if (!res.ok || !res.body) {
		const err = await res.text().catch(() => "Unknown error")
		throw new Error(`OpenAI API error: ${res.status} ${err}`)
	}

	const reader = res.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ""

	while (true) {
		const { done, value } = await reader.read()
		if (done) break

		buffer += decoder.decode(value, { stream: true })
		const lines = buffer.split("\n")
		buffer = lines.pop() ?? ""

		for (const line of lines) {
			if (!line.startsWith("data: ")) continue
			const payload = line.slice(6).trim()
			if (payload === "[DONE]") return

			try {
				const parsed = JSON.parse(payload)
				const content = parsed.choices?.[0]?.delta?.content
				if (content) yield content
			} catch {
				// skip malformed chunks
			}
		}
	}
}

// ── Chutes AI — Mistral-Small-3.1-24B-Instruct-2503 (fallback) ───────────────

async function* streamChutes(opts: StreamLLMOptions): AsyncGenerator<string> {
	const apiKey = process.env.CHUTES_API_KEY
	if (!apiKey) throw new Error("CHUTES_API_KEY not configured")

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), 30_000)

	let res: Response
	try {
		res = await fetch("https://llm.chutes.ai/v1/chat/completions", {
			method: "POST",
			signal: controller.signal,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				// model: "chutesai/Mistral-Small-3.1-24B-Instruct-2503",
				model: "Qwen/Qwen2.5-72B-Instruct",
				messages: [
					{ role: "system", content: opts.systemPrompt },
					...opts.messages.map((m) => ({ role: m.role, content: m.content })),
				],
				stream: true,
				max_tokens: opts.maxTokens,
				temperature: opts.temperature ?? 0.7,
			}),
		})
	} catch (err) {
		clearTimeout(timeout)
		const isTimeout = err instanceof Error && err.name === "AbortError"
		throw new Error(isTimeout ? "Chutes AI timed out — try again" : String(err))
	}
	clearTimeout(timeout)

	if (!res.ok || !res.body) {
		const err = await res.text().catch(() => "Unknown error")
		throw new Error(`Chutes API error: ${res.status} ${err}`)
	}

	const reader = res.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ""

	while (true) {
		const { done, value } = await reader.read()
		if (done) break

		buffer += decoder.decode(value, { stream: true })
		const lines = buffer.split("\n")
		buffer = lines.pop() ?? ""

		for (const line of lines) {
			if (!line.startsWith("data: ")) continue
			const payload = line.slice(6).trim()
			if (payload === "[DONE]") return

			try {
				const parsed = JSON.parse(payload)
				const content = parsed.choices?.[0]?.delta?.content
				if (content) yield content
			} catch {
				// skip malformed chunks
			}
		}
	}
}

// ── Google Gemini 2.5 Flash Lite ─────────────────────────────────────────────

async function* streamGemini(opts: StreamLLMOptions): AsyncGenerator<string> {
	const apiKey = process.env.GOOGLE_GEMINI_API_KEY
	if (!apiKey) throw new Error("GOOGLE_GEMINI_API_KEY not configured")

	// Map OpenAI roles to Gemini roles ("assistant" → "model").
	// Gemini requires the last turn to be "user" — trim trailing model turns.
	// If no user turn exists at all (e.g. first AI greeting), inject a synthetic one.
	const mapped = opts.messages.map((m) => ({
		role: m.role === "assistant" ? "model" : "user",
		parts: [{ text: m.content }],
	}))
	const lastUserIdx = mapped.map((m) => m.role).lastIndexOf("user")
	const contents =
		lastUserIdx === -1 ?
			[{ role: "user", parts: [{ text: "Begin." }] }]
		:	mapped.slice(0, lastUserIdx + 1)

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), 30_000)

	let res: Response
	try {
		res = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${opts.geminiModel ?? "gemini-3.8-flash-lite"}:streamGenerateContent?alt=sse&key=${apiKey}`,
			{
				method: "POST",
				signal: controller.signal,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					system_instruction: { parts: [{ text: opts.systemPrompt }] },
					contents,
					generationConfig: {
						maxOutputTokens: opts.maxTokens,
						temperature: opts.temperature ?? 0.7,
					},
				}),
			},
		)
	} catch (err) {
		clearTimeout(timeout)
		const isTimeout = err instanceof Error && err.name === "AbortError"
		throw new Error(isTimeout ? "Gemini timed out — try again" : String(err))
	}
	clearTimeout(timeout)

	if (!res.ok || !res.body) {
		const err = await res.text().catch(() => "Unknown error")
		throw new Error(`Gemini API error: ${res.status} ${err}`)
	}

	const reader = res.body.getReader()
	const decoder = new TextDecoder()
	let buffer = ""

	while (true) {
		const { done, value } = await reader.read()
		if (done) break

		buffer += decoder.decode(value, { stream: true })
		const lines = buffer.split("\n")
		buffer = lines.pop() ?? ""

		for (const line of lines) {
			if (!line.startsWith("data: ")) continue
			const payload = line.slice(6).trim()
			if (!payload) continue

			try {
				const parsed = JSON.parse(payload)
				const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
				if (text) {
					yield text
				} else if (parsed.error) {
					throw new Error(
						`Gemini stream error: ${JSON.stringify(parsed.error)}`,
					)
				}
			} catch (e) {
				if (e instanceof SyntaxError) {
					// skip malformed chunks
				} else {
					throw e
				}
			}
		}
	}
}
