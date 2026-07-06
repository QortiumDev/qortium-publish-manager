const EOCD_SIG = 0x06054b50;
const CD_SIG   = 0x02014b50;

async function listZipEntries(file: File): Promise<string[]> {
  const buf  = await file.arrayBuffer();
  const view = new DataView(buf);
  const u8   = new Uint8Array(buf);

  // Scan backwards for the End of Central Directory record.
  // EOCD is at least 22 bytes; comment can be up to 65535 bytes.
  const scanFrom = Math.max(0, u8.length - 22 - 65535);
  let eocd = -1;
  for (let i = u8.length - 22; i >= scanFrom; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd === -1) return [];

  const cdOffset = view.getUint32(eocd + 16, true);
  const cdSize   = view.getUint32(eocd + 12, true);
  const decoder  = new TextDecoder();
  const names: string[] = [];
  let pos = cdOffset;

  while (pos + 46 <= cdOffset + cdSize) {
    if (view.getUint32(pos, true) !== CD_SIG) break;
    const nameLen    = view.getUint16(pos + 28, true);
    const extraLen   = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    names.push(decoder.decode(u8.subarray(pos + 46, pos + 46 + nameLen)));
    pos += 46 + nameLen + extraLen + commentLen;
  }

  return names;
}

const ROOT_INDEX_RE = /^(index\.html?|index\.php)$/i;

export async function zipContainsRootIndex(file: File): Promise<boolean> {
  try {
    const entries = await listZipEntries(file);
    return entries.some(n => ROOT_INDEX_RE.test(n));
  } catch {
    return true; // can't verify - don't block the user
  }
}
