import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { expect, it } from 'vitest';
import { decodeImage } from './images';

it('fully decodes normalized images and rejects mismatched MIME or corrupt files', () => {
  const bytes = jpeg.encode({ width: 2, height: 2, data: Buffer.alloc(16, 255) }, 80).data;
  expect(decodeImage(bytes, 'image/jpeg')).toMatchObject({ width: 2, height: 2 });
  expect(() => decodeImage(bytes, 'image/png')).toThrow();
  expect(() => decodeImage(bytes.subarray(0, 30), 'image/jpeg')).toThrow();
  const png = PNG.sync.write({ width: 2, height: 2, data: Buffer.alloc(16, 255) } as PNG);
  expect(decodeImage(png, 'image/png').mime).toBe('image/png');
});
it('rejects oversized pixel claims before decompressing PNG payload', () => {
  const png = PNG.sync.write({ width: 2, height: 2, data: Buffer.alloc(16, 255) } as PNG);
  png.writeUInt32BE(30000, 16);
  expect(() => decodeImage(png, 'image/png')).toThrow('2000');
  expect(() => decodeImage(new Uint8Array(3 * 1024 * 1024), 'image/jpeg')).toThrow('2 MiB');
});
