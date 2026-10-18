import { sseData } from "../sse";

function streamOf(...chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>) {
  const out: string[] = [];
  for await (const payload of sseData(body)) out.push(payload);
  return out;
}

describe("sseData", () => {
  it("yields trimmed data payloads and ignores other lines", async () => {
    const body = streamOf('event: msg\ndata: {"a":1} \r\n\n: comment\ndata: [DONE]\n');
    expect(await collect(body)).toEqual(['{"a":1}', "[DONE]"]);
  });

  it("joins lines split across chunks", async () => {
    const body = streamOf('data: {"te', 'xt":"hi"}\n', "data: two\n");
    expect(await collect(body)).toEqual(['{"text":"hi"}', "two"]);
  });

  it("drops an unterminated trailing line", async () => {
    expect(await collect(streamOf("data: one\ndata: partial"))).toEqual(["one"]);
  });
});
