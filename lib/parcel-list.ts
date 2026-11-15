/**
 * 합필 필지 입력 파서.
 * "867, 869, 870" 처럼 번지만 적으면 대표 필지 주소의 동·리를 붙여 완전한 지번 주소로 만든다.
 * 줄바꿈·쉼표·가운뎃점·세미콜론으로 구분. 대표 필지와 중복은 제거.
 */
const LOT_ONLY = /^(산\s*)?\d+(-\d+)?(번지)?$/;
const LOT_TAIL = /\s*(산\s*)?\d+(-\d+)?(번지)?\s*$/;

export function parcelBase(address: string): string {
  return address.trim().replace(LOT_TAIL, "").trim();
}

export function parseParcelList(text: string, baseAddress: string): string[] {
  const base = parcelBase(baseAddress);
  const norm = (s: string) => s.replace(/\s+/g, "").replace(/번지$/, "");
  const self = norm(baseAddress);
  const out: string[] = [];
  for (const raw of text.split(/[\n,，;·、]+/)) {
    const t = raw.trim().replace(/번지$/, "");
    if (!t) continue;
    const full = LOT_ONLY.test(t) && base ? `${base} ${t.replace(/\s+/g, "")}` : t;
    if (norm(full) === self || out.some((o) => norm(o) === norm(full))) continue;
    out.push(full);
  }
  return out;
}
