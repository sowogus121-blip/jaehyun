/**
 * 한글(HWP 5.0, OLE 복합문서) 본문 텍스트 추출 — 외부 패키지 없이.
 * 조례 별표(부설주차장 설치기준 등)가 HWP로만 제공되는 경우가 많아 표 셀 텍스트를 순서대로 읽는다.
 * inflateRaw 는 환경별로 주입한다(Node: zlib.inflateRawSync).
 */
export type InflateRaw = (data: Uint8Array) => Uint8Array | Promise<Uint8Array>;

const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;

function u16(b: Uint8Array, o: number) { return b[o] | (b[o + 1] << 8); }
function u32(b: Uint8Array, o: number) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

interface DirEntry { name: string; type: number; start: number; size: number; left: number; right: number; child: number }

/** 최소 CFB 리더: 디렉터리·FAT·MiniFAT 를 읽어 스트림 바이트를 돌려준다. */
export function readCfb(buf: Uint8Array) {
  if (u32(buf, 0) !== 0xe011cfd0 || u32(buf, 4) !== 0xe11ab1a1) throw new Error("HWP(OLE) 형식이 아닙니다");
  const sectorSize = 1 << u16(buf, 30);
  const miniSectorSize = 1 << u16(buf, 32);
  const numFatSectors = u32(buf, 44);
  const firstDirSector = u32(buf, 48);
  const miniCutoff = u32(buf, 56);
  const firstMiniFat = u32(buf, 60);
  const firstDifat = u32(buf, 68);
  const sectorOffset = (s: number) => (s + 1) * sectorSize;

  // DIFAT → FAT sector list
  const fatSectors: number[] = [];
  for (let i = 0; i < 109 && fatSectors.length < numFatSectors; i++) {
    const s = u32(buf, 76 + i * 4);
    if (s !== FREESECT) fatSectors.push(s);
  }
  let difat = firstDifat;
  let guard = 0;
  while (difat !== ENDOFCHAIN && difat !== FREESECT && fatSectors.length < numFatSectors && guard++ < 1000) {
    const off = sectorOffset(difat);
    for (let i = 0; i < sectorSize / 4 - 1 && fatSectors.length < numFatSectors; i++) {
      const s = u32(buf, off + i * 4);
      if (s !== FREESECT) fatSectors.push(s);
    }
    difat = u32(buf, off + sectorSize - 4);
  }
  const fat: number[] = [];
  for (const s of fatSectors) {
    const off = sectorOffset(s);
    for (let i = 0; i < sectorSize / 4; i++) fat.push(u32(buf, off + i * 4));
  }
  const chain = (start: number) => {
    const out: number[] = [];
    let s = start;
    let n = 0;
    while (s !== ENDOFCHAIN && s !== FREESECT && s < fat.length && n++ < 200000) { out.push(s); s = fat[s]; }
    return out;
  };
  const readChain = (start: number) => {
    const sectors = chain(start);
    const out = new Uint8Array(sectors.length * sectorSize);
    sectors.forEach((s, i) => out.set(buf.subarray(sectorOffset(s), sectorOffset(s) + sectorSize), i * sectorSize));
    return out;
  };

  // Directory
  const dirBytes = readChain(firstDirSector);
  const entries: DirEntry[] = [];
  for (let off = 0; off + 128 <= dirBytes.length; off += 128) {
    const nameLen = u16(dirBytes, off + 64);
    let name = "";
    for (let i = 0; i < Math.max(0, nameLen / 2 - 1); i++) name += String.fromCharCode(u16(dirBytes, off + i * 2));
    entries.push({ name, type: dirBytes[off + 66], left: u32(dirBytes, off + 68), right: u32(dirBytes, off + 72), child: u32(dirBytes, off + 76), start: u32(dirBytes, off + 116), size: u32(dirBytes, off + 120) });
  }
  const root = entries[0];
  const miniStream = root ? readChain(root.start) : new Uint8Array();
  const miniFatBytes = firstMiniFat !== ENDOFCHAIN ? readChain(firstMiniFat) : new Uint8Array();
  const miniFat: number[] = [];
  for (let i = 0; i + 4 <= miniFatBytes.length; i += 4) miniFat.push(u32(miniFatBytes, i));

  const readStream = (e: DirEntry): Uint8Array => {
    if (e.size < miniCutoff) {
      const out = new Uint8Array(e.size);
      let s = e.start;
      let pos = 0;
      let n = 0;
      while (s !== ENDOFCHAIN && s !== FREESECT && pos < e.size && n++ < 200000) {
        const len = Math.min(miniSectorSize, e.size - pos);
        out.set(miniStream.subarray(s * miniSectorSize, s * miniSectorSize + len), pos);
        pos += len;
        s = miniFat[s];
      }
      return out;
    }
    return readChain(e.start).subarray(0, e.size);
  };

  // 경로 탐색: 스토리지(type 1)의 child 트리를 순회
  const childrenOf = (e: DirEntry) => {
    const out: DirEntry[] = [];
    const walk = (i: number, depth = 0) => {
      if (i === FREESECT || i >= entries.length || depth > 500) return;
      const c = entries[i];
      walk(c.left, depth + 1);
      out.push(c);
      walk(c.right, depth + 1);
    };
    walk(e.child);
    return out;
  };
  return {
    entries,
    get(path: string): Uint8Array | null {
      let cur: DirEntry | undefined = root;
      for (const part of path.split("/")) {
        cur = cur ? childrenOf(cur).find((c) => c.name === part) : undefined;
        if (!cur) return null;
      }
      return cur && cur.type === 2 ? readStream(cur) : null;
    },
    list(path: string): string[] {
      let cur: DirEntry | undefined = root;
      for (const part of path.split("/").filter(Boolean)) cur = cur ? childrenOf(cur).find((c) => c.name === part) : undefined;
      return cur ? childrenOf(cur).map((c) => c.name) : [];
    },
  };
}

const HWPTAG_PARA_HEADER = 66;
const HWPTAG_PARA_TEXT = 67;

/** PARA_TEXT 레코드(UTF-16LE)에서 제어문자를 걷어내고 문단 텍스트만 남긴다. */
function paraText(rec: Uint8Array) {
  let out = "";
  for (let i = 0; i + 1 < rec.length; i += 2) {
    const c = u16(rec, i);
    if (c < 32) {
      // 확장/인라인 제어문자는 8 WCHAR(16바이트) 차지. 9(tab)는 공백으로.
      // 인라인·확장 제어문자(8 WCHAR): 1~9, 11, 12, 14~23 / 나머지(0,10,13,24~31)는 1 WCHAR
      if ((c >= 1 && c <= 9) || c === 11 || c === 12 || (c >= 14 && c <= 23)) {
        if (c === 9) out += " ";
        i += 14;
      } else if (c === 10 || c === 13) out += "\n";
      continue;
    }
    out += String.fromCharCode(c);
  }
  return out;
}

/** HWP 바이트 → 문단 단위 텍스트 (표 셀도 문단 순서대로 나온다). */
export async function hwpToText(buf: Uint8Array, inflateRaw: InflateRaw): Promise<string> {
  const cfb = readCfb(buf);
  const header = cfb.get("FileHeader");
  if (!header) throw new Error("HWP FileHeader 없음");
  const compressed = (u32(header, 36) & 1) === 1;
  const encrypted = (u32(header, 36) & 2) === 2;
  if (encrypted) throw new Error("암호화된 HWP");
  const sections = cfb.list("BodyText").filter((n) => /^Section\d+$/.test(n)).sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)));
  const paragraphs: string[] = [];
  for (const name of sections) {
    let data = cfb.get("BodyText/" + name);
    if (!data) continue;
    if (compressed) data = await inflateRaw(data);
    let off = 0;
    while (off + 4 <= data.length) {
      const h = u32(data, off);
      const tag = h & 0x3ff;
      let size = (h >>> 20) & 0xfff;
      off += 4;
      if (size === 0xfff) { size = u32(data, off); off += 4; }
      if (tag === HWPTAG_PARA_TEXT) {
        const t = paraText(data.subarray(off, off + size)).replace(/\s+$/g, "");
        if (t.trim()) paragraphs.push(t.trim());
      }
      void HWPTAG_PARA_HEADER;
      off += size;
    }
  }
  return paragraphs.join("\n");
}
