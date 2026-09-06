import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { IMAGE_BYTES } from './image-body';
export const IMAGE_PIXELS = 4_000_000;
export function decodeImage(bytes: Uint8Array, claimed: string) {
  if (bytes.length > IMAGE_BYTES || bytes.length < 24)
    throw new Error('Images must be valid and no larger than 2 MiB after resizing.');
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if ((png && claimed !== 'image/png') || (jpg && claimed !== 'image/jpeg') || (!png && !jpg))
    throw new Error(
      'Only decoded PNG and JPEG uploads are accepted. The browser converts WebP before uploading.'
    );
  let width: number, height: number;
  if (png) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    width = view.getUint32(16);
    height = view.getUint32(20);
    dimensions(width, height);
    const decoded = PNG.sync.read(Buffer.from(bytes), { checkCRC: true });
    if (decoded.width !== width || decoded.height !== height)
      throw new Error('Invalid PNG dimensions.');
  } else {
    const decoded = jpeg.decode(bytes, {
      useTArray: true,
      maxResolutionInMP: 4,
      maxMemoryUsageInMB: 48,
      tolerantDecoding: false
    });
    width = decoded.width;
    height = decoded.height;
    dimensions(width, height);
  }
  return { width, height, mime: png ? 'image/png' : 'image/jpeg' };
}
function dimensions(width: number, height: number) {
  if (!width || !height || width > 2000 || height > 2000 || width * height > IMAGE_PIXELS)
    throw new Error('Images must be at most 2000 pixels on either edge.');
}
