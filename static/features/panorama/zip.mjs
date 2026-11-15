const MAX_ARCHIVE = 20 * 1024 * 1024;
const MAX_CONTENT = 40 * 1024 * 1024;

export async function* readZip(file) {
  if (file.size > MAX_ARCHIVE || file.size < 22) throw new Error('O ZIP deve ter entre 22 bytes e 20 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const u16 = offset => view.getUint16(offset, true);
  const u32 = offset => view.getUint32(offset, true);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let end = bytes.length - 22;
  const minimumEnd = Math.max(0, end - 65535);
  while (end >= minimumEnd && (u32(end) !== 0x06054b50 || end + 22 + u16(end + 20) !== bytes.length)) end--;
  if (end < minimumEnd || u16(end + 4) || u16(end + 6)) throw new Error('ZIP inválido ou dividido em volumes.');
  const count = u16(end + 10);
  let offset = u32(end + 16);
  if (count > 200 || count !== u16(end + 8) || offset + u32(end + 12) !== end) {
    throw new Error('Diretório ZIP inválido ou fora dos limites.');
  }
  const directory = offset;
  let totalSize = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || u32(offset) !== 0x02014b50) throw new Error('Entrada ZIP inválida.');
    const flags = u16(offset + 8);
    const method = u16(offset + 10);
    let compressed = u32(offset + 20);
    let size = u32(offset + 24);
    const nameEnd = offset + 46 + u16(offset + 28);
    let local = u32(offset + 42);
    const next = nameEnd + u16(offset + 30) + u16(offset + 32);
    if (next > end) throw new Error('Nome de arquivo ZIP inválido.');
    if ([size, compressed, local].includes(0xffffffff)) {
      const extraEnd = nameEnd + u16(offset + 30);
      let field = nameEnd;
      while (field + 4 <= extraEnd && u16(field) !== 1) field += 4 + u16(field + 2);
      if (field + 4 > extraEnd || field + 4 + u16(field + 2) > extraEnd) {
        throw new Error('Campo ZIP64 ausente ou inválido.');
      }
      const zip64End = field + 4 + u16(field + 2);
      field += 4;
      const value64 = () => {
        if (field + 8 > zip64End || u32(field + 4) !== 0) throw new Error('Campo ZIP64 fora dos limites.');
        const value = u32(field);
        field += 8;
        return value;
      };
      if (size === 0xffffffff) size = value64();
      if (compressed === 0xffffffff) compressed = value64();
      if (local === 0xffffffff) local = value64();
    }
    const name = decoder.decode(bytes.subarray(offset + 46, nameEnd));
    offset = next;
    if (!/\.csv$/i.test(name) || name.startsWith('__MACOSX/')) continue;
    totalSize += size;
    if (totalSize > MAX_CONTENT || flags & 1 || (method !== 0 && method !== 8)) {
      throw new Error('ZIP criptografado, grande demais ou com compressão incompatível.');
    }
    if (local + 30 > directory || u32(local) !== 0x04034b50) throw new Error('Cabeçalho ZIP inválido.');
    const start = local + 30 + u16(local + 26) + u16(local + 28);
    if (start + compressed > directory) throw new Error('Dados ZIP truncados.');
    const data = bytes.subarray(start, start + compressed);
    if (method === 0) {
      if (data.length !== size) throw new Error('Tamanho do CSV inválido.');
      yield { name, text: decoder.decode(data) };
      continue;
    }
    const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const output = new Uint8Array(size);
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (length + value.length > size) throw new Error('Tamanho descompactado excede o declarado.');
        output.set(value, length);
        length += value.length;
      }
    } finally {
      await reader.cancel();
    }
    if (length !== size) throw new Error('CSV descompactado incompleto.');
    yield { name, text: decoder.decode(output) };
  }
  if (offset !== end) throw new Error('Diretório ZIP incompleto.');
}
