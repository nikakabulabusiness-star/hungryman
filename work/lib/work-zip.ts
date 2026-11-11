export type WorkZipEntry = { name: string; data: Uint8Array };
export class WorkZipLimitError extends Error {}

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}
function crc32(data: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of data) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

/** Portable stored ZIP: no dependencies, compression buffers, filesystem access or unsafe entry paths. */
export function buildWorkZip(entries: WorkZipEntry[], options: { maxBytes?: number; date?: Date } = {}): Uint8Array<ArrayBuffer> {
  if (entries.length > 65535) throw new WorkZipLimitError('ZIP contains too many files.');
  const encoder = new TextEncoder(), names = new Set<string>();
  const prepared = entries.map(entry => {
    if (!entry.name || entry.name.startsWith('/') || entry.name.includes('\\') || entry.name.includes('\0') || entry.name.split('/').some(part => !part || part === '..' || part === '.') || /^[a-z]:/i.test(entry.name)) throw new Error('Unsafe ZIP path.');
    if (names.has(entry.name)) throw new Error('Duplicate ZIP path.');
    names.add(entry.name);
    const name = encoder.encode(entry.name);
    if (name.length > 65535 || entry.data.length > 0xffffffff) throw new WorkZipLimitError('ZIP entry is too large.');
    return { ...entry, nameBytes: name, crc: crc32(entry.data), offset: 0 };
  });
  const size = prepared.reduce((sum, entry) => sum + 30 + entry.nameBytes.length + entry.data.length + 46 + entry.nameBytes.length, 22);
  if (size > (options.maxBytes ?? 24 * 1024 * 1024) || size > 0xffffffff) throw new WorkZipLimitError('ZIP is too large.');
  const result = new Uint8Array(size), view = new DataView(result.buffer), requestedDate = options.date || new Date();
  const date = Number.isFinite(requestedDate.getTime()) ? requestedDate : new Date('1980-01-01T00:00:00Z');
  const year = Math.max(1980, Math.min(2107, date.getUTCFullYear()));
  const dosDate = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  const dosTime = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
  let offset = 0;
  for (const entry of prepared) {
    entry.offset = offset;
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true); view.setUint16(offset + 6, 0x0800, true);
    view.setUint16(offset + 10, dosTime, true); view.setUint16(offset + 12, dosDate, true);
    view.setUint32(offset + 14, entry.crc, true);
    view.setUint32(offset + 18, entry.data.length, true); view.setUint32(offset + 22, entry.data.length, true);
    view.setUint16(offset + 26, entry.nameBytes.length, true);
    result.set(entry.nameBytes, offset + 30); result.set(entry.data, offset + 30 + entry.nameBytes.length);
    offset += 30 + entry.nameBytes.length + entry.data.length;
  }
  const centralOffset = offset;
  for (const entry of prepared) {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true); view.setUint16(offset + 6, 20, true); view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 12, dosTime, true); view.setUint16(offset + 14, dosDate, true);
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, entry.data.length, true); view.setUint32(offset + 24, entry.data.length, true);
    view.setUint16(offset + 28, entry.nameBytes.length, true); view.setUint32(offset + 42, entry.offset, true);
    result.set(entry.nameBytes, offset + 46); offset += 46 + entry.nameBytes.length;
  }
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, prepared.length, true); view.setUint16(offset + 10, prepared.length, true);
  view.setUint32(offset + 12, offset - centralOffset, true); view.setUint32(offset + 16, centralOffset, true);
  return result;
}
