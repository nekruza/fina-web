/**
 * Yields the trimmed payload of every `data:` line in a Server-Sent Events
 * body. Works in the browser and on the server. Callers decide what a payload
 * means (JSON chunk, `[DONE]` sentinel, …); breaking out of the loop stops
 * reading.
 */
export async function* sseData(
	body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
	const reader = body.getReader()
	const decoder = new TextDecoder()
	let buffer = ""

	while (true) {
		const { done, value } = await reader.read()
		if (done) return

		buffer += decoder.decode(value, { stream: true })
		const lines = buffer.split("\n")
		buffer = lines.pop() ?? ""

		for (const line of lines) {
			if (line.startsWith("data: ")) yield line.slice(6).trim()
		}
	}
}
