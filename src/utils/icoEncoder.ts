/**
 * Encode multiple PNG blobs into a single ICO file.
 * ICO format: 6-byte header + 16-byte directory per image + concatenated PNG data.
 */
export async function encodePngsToIco(pngBlobs: Blob[]): Promise<Blob> {
  const count = pngBlobs.length;
  const pngBuffers: ArrayBuffer[] = [];

  for (const blob of pngBlobs) {
    pngBuffers.push(await blob.arrayBuffer());
  }

  // Header: 6 bytes
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * count;
  let dataOffset = headerSize + dirSize;

  const totalSize = dataOffset + pngBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const ico = new ArrayBuffer(totalSize);
  const view = new DataView(ico);

  // ICO header
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type = 1 (ICO)
  view.setUint16(4, count, true); // image count

  // Directory entries + data
  for (let i = 0; i < count; i++) {
    const pngBuf = pngBuffers[i];
    // Parse width/height from PNG IHDR (bytes 16-23)
    const pngView = new DataView(pngBuf);
    const w = pngView.getUint32(16, false);
    const h = pngView.getUint32(20, false);

    const offset = headerSize + i * dirEntrySize;
    view.setUint8(offset, w >= 256 ? 0 : w); // width (0 = 256)
    view.setUint8(offset + 1, h >= 256 ? 0 : h); // height (0 = 256)
    view.setUint8(offset + 2, 0); // color palette
    view.setUint8(offset + 3, 0); // reserved
    view.setUint16(offset + 4, 1, true); // color planes
    view.setUint16(offset + 6, 32, true); // bits per pixel
    view.setUint32(offset + 8, pngBuf.byteLength, true); // image size
    view.setUint32(offset + 12, dataOffset, true); // data offset

    // Copy PNG data
    new Uint8Array(ico, dataOffset, pngBuf.byteLength).set(new Uint8Array(pngBuf));
    dataOffset += pngBuf.byteLength;
  }

  return new Blob([ico], { type: 'image/x-icon' });
}
