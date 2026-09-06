export const IMAGE_BYTES = 2 * 1024 * 1024;
export async function imageBody(request: Request) {
  if (!request.body) throw new Error('Image data is missing.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > IMAGE_BYTES) {
      await reader.cancel();
      throw new Error('The resized image exceeds 2 MiB.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
