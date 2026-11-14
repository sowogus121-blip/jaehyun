import { inflateRawSync, constants } from "node:zlib";
import { hwpToText } from "./hwp-core";

/** HWP 5.0 본문 텍스트 (서버용). 압축 스트림 뒤 패딩이 있어도 끝까지 읽는다. */
export function extractHwpText(data: Uint8Array) {
  return hwpToText(data, (d) => new Uint8Array(inflateRawSync(d, { finishFlush: constants.Z_SYNC_FLUSH })));
}
