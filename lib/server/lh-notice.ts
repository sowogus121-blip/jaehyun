/** Official LH housing-purchase board. No third-party search index, no invented legal approvals. */
import { parseUploadedDocument } from "./document-parser";
export interface LhNotice {
  id: string;
  title: string;
  url: string;
  pdfUrl: string | null;
  guideUrl: string | null;
  publishedAt: string;
  closesAt: string;
  matchedDistrict: string;
  official: true;
  isCurrent: boolean;
  rules: LhVerifiedNoticeRules | null;
  warnings: string[];
  extractedCriteria?: Array<{topic:string;quote:string;value:number|null;unit:string|null;verified:false}>;
  textAnalysisStatus?: "verified-original"|"text-extracted"|"not-extracted";
}
export interface LhVerifiedNoticeRules {
  excerptSource: string;
  minimumHomes: number;
  regulatedMinimumHomes: number;
  newlywedMinimumArea: number;
  youthMinimumArea: number;
  youthMaximumArea: number;
  youthRooms: number;
  newlywedRooms: number;
  communityThreshold: number;
  managementOfficeThreshold: number;
  mechanicalMaxPercent: number;
  mechanicalTransitMaxMeters: number;
  parking03MaxArea: number;
  parking03YouthMaxMeters: number;
}
const BASE = "https://apply.lh.or.kr";
const BOARD_URL = BASE + "/lhapply/apply/pch/list.do?mi=1076";
const CURRENT_PDF = BASE + "/lhapply/lhFile.do?fileid=68899892";
const CURRENT_ID = "1730";
const CACHED_MS = 30 * 60 * 1000;
const boardCache = new Map<string,{time:number;notice:LhNotice|null}>();

const verifiedFourth: LhVerifiedNoticeRules = {
  excerptSource: "2026-10-07 LH 경기북부 4차 신축매입약정 공고 PDF p.1, p.3, p.9, p.11 (2026-10-25 직접 확인)",
  minimumHomes: 30, regulatedMinimumHomes: 10,
  newlywedMinimumArea: 36, youthMinimumArea: 19, youthMaximumArea: 60,
  newlywedRooms: 2, youthRooms: 1,
  communityThreshold: 50, managementOfficeThreshold: 150,
  mechanicalMaxPercent: 50, mechanicalTransitMaxMeters: 500,
  parking03MaxArea: 30, parking03YouthMaxMeters: 500,
};
const stripTags=(v:string)=>v.replace(/<[^>]*>/g," ").replace(/&(?:nbsp|amp|quot);/g," ").replace(/\s+/g," ").trim();
function ensureOfficial(href: string):string|null {
  try {
    const uri=new URL(href, BASE);
    if(uri.origin!==BASE || uri.protocol!=="https:")return null;
    return uri.href;
  }catch{return null;}
}
export function parseLhPurchaseList(html:string,district:string) {
  const items: Array<{id:string;title:string;publishedAt:string;closesAt:string}>=[];
  for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const text=stripTags(tr[1]);
    if(!text.includes("민간신축 매입약정") && !text.includes("민간 신축 매입약정"))continue;
    if(!text.includes(district))continue;
    // Search the title link only. The attachments have the same ID but are not the title.
    const m=tr[1].match(/data-id1=["'](\d+)["']\s+class=["']slpaInfoBtn["'][^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/i);
    if(!m)continue;
    const dates=[...text.matchAll(/20\d{2}\.\d{2}\.\d{2}/g)].map(x=>x[0]);
    if(dates.length<2)continue;
    items.push({id:m[1],title:stripTags(m[2]),publishedAt:dates[0],closesAt:dates[1]});
  }
  return items.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
}
const REPEATED_DISTRICTS = new Set(["중구","동구","서구","남구","북구","강서구"]);
const PROVINCE_NOTICE_TERMS: Array<[string,string[]]> = [
  ["서울", ["서울"]], ["부산", ["부산","부울경"]],
  ["대구", ["대구","대구경북"]], ["인천", ["인천","인천부천"]],
  ["광주", ["광주","광주전남"]], ["대전", ["대전","대전충남"]],
  ["울산", ["울산","부산울산","부울경"]], ["세종", ["세종","대전충남"]],
  ["경기", ["경기","수도권"]], ["강원", ["강원"]],
  ["충북", ["충북"]], ["충남", ["충남","대전충남"]],
  ["전북", ["전북"]], ["전남", ["전남","광주전남"]],
  ["경북", ["경북","대구경북"]], ["경남", ["경남","부울경"]],
  ["제주", ["제주"]],
];
export function isSameProvinceNotice(title:string,district:string,regionContext=""):boolean {
  if(!REPEATED_DISTRICTS.has(district) || !regionContext) return true;
  const province=regionContext.split(/\s+/)[0];
  const terms=PROVINCE_NOTICE_TERMS.find(([word])=>province.includes(word))?.[1];
  if(!terms)return false;
  const compact=title.replace(/\s+/g,"");
  return terms.some(term=>compact.includes(term));
}

export function countLhListPages(html:string):number {
  const numbers=[...html.matchAll(/goPaging\((\d+)\)/g)].map(x=>Number(x[1]));
  return Math.min(5,Math.max(1,...numbers.filter(n=>Number.isFinite(n)&&n>=1)));
}
export function buildLhPagingBody(html:string,page:number):URLSearchParams|null {
  // LH uses POST currPage with the original paging form state, not pageIndex.
  const form=html.match(/<form\b[^>]*name=["']pagingForm["'][^>]*>([\s\S]*?)<\/form>/i)?.[1];
  if(!form || page<2 || page>5)return null;
  const fields=new URLSearchParams();
  for(const tag of form.matchAll(/<input\b[^>]*>/gi)){
    const name=tag[0].match(/\bname=["']([^"']+)["']/i)?.[1];
    const value=tag[0].match(/\bvalue=["']([^"']*)["']/i)?.[1]??"";
    if(name && /^(?:currPage|xssChk|panEdDt|maxSn|listCo|prevListCo|panSs|pchPanSn|panStDt|mi|srchY|minSn)$/.test(name))fields.set(name,value);
  }
  if(!fields.has("currPage"))return null;
  fields.set("currPage",String(page));
  return fields;
}

export function parseLhAttachments(html:string):{pdfUrl:string|null;guideUrl:string|null} {
  const anchor=[...html.matchAll(/<a\s+href=["'](\/lhapply\/lhFile\.do\?fileid=\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(m=>({url:ensureOfficial(m[1]),title:stripTags(m[2])}));
  return {
    pdfUrl:anchor.find(a=>/공고문.*\.pdf|\.pdf/.test(a.title))?.url??null,
    guideUrl:anchor.find(a=>/가이드라인|설계|신청서식/.test(a.title))?.url??null,
  };
}
async function getHtml(url:string,timeout=7500,body?:URLSearchParams):Promise<string> {
  const res=await fetch(url,{method:body?"POST":"GET",body:body?.toString(),cache:"no-store",signal:AbortSignal.timeout(timeout),headers:{Accept:"text/html","User-Agent":"LH-Plan-Lab/1.0",...(body?{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"}:{})}});
  if(!res.ok)throw new Error("LH 공식 게시판 HTTP "+res.status);
  const type=res.headers.get("content-type")||"";
  if(!type.toLowerCase().includes("text/html"))throw new Error("LH 게시판이 HTML을 반환하지 않음");
  const html=await res.text();
  return html.slice(0,500_000);
}
/** Read up to 7 MB of an *exactly* LH-hosted PDF; raw extracted clauses are NEVER application-approved. */
async function extractUnverifiedLhPdfClauses(pdfUrl:string):Promise<NonNullable<LhNotice["extractedCriteria"]>> {
  if(!/^https:\/\/apply\.lh\.or\.kr\/lhapply\/lhFile\.do\?fileid=\d+$/.test(pdfUrl))return [];
  const res=await fetch(pdfUrl,{
    cache:"no-store",redirect:"error",signal:AbortSignal.timeout(9000),
    headers:{Accept:"application/pdf,application/octet-stream"},
  });
  if(!res.ok || Number(res.headers.get("content-length")||0)>7*1024*1024)return [];
  if(!res.body)return [];
  const reader=res.body.getReader();
  let total=0;const pieces:Uint8Array[]=[];
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>7*1024*1024)throw new Error("LH PDF 용량 상한 초과");
      pieces.push(value);
    }
  } finally {await reader.cancel().catch(()=>undefined);}
  const bytes=new Uint8Array(total);let offset=0;
  for(const part of pieces){bytes.set(part,offset);offset+=part.length;}
  if(bytes[0]!==37||bytes[1]!==80||bytes[2]!==68||bytes[3]!==70)return [];
  const doc=new File([bytes],"latest-lh-regional-notice.pdf",{type:"application/pdf"});
  const analysis=await parseUploadedDocument(doc);
  return analysis.candidates.filter(c=>/매입약정|전용|주차|기계식|청년|신혼|의무|완화|커뮤니티|용적률|건폐율/.test(c.quote))
    .slice(0,14).map(c=>({topic:c.topic,quote:c.quote,value:c.value,unit:c.unit,verified:false as const}));
}

export async function findLatestLhPurchaseNotice(district:string,regionContext=""):Promise<LhNotice|null> {
  if(!district)return null;
  const cacheKey=regionContext+"|"+district;
  const old=boardCache.get(cacheKey);
  if(old&&Date.now()-old.time<CACHED_MS)return old.notice;
  const list=await getHtml(BOARD_URL);
  // Search the complete official notice list, not just the first 15 rows.
  const pages=Array.from({length:countLhListPages(list)-1},(_,i)=>buildLhPagingBody(list,i+2)).filter((body):body is URLSearchParams=>Boolean(body));
  const pageResults=await Promise.allSettled(pages.map(body=>getHtml(BOARD_URL,7500,body)));
  const failures=pageResults.filter((x)=>x.status==="rejected");
  const allPages=[list,...pageResults.flatMap(x=>x.status==="fulfilled"?[x.value]:[])];
  const found=allPages.flatMap(html=>parseLhPurchaseList(html,district)).filter(c=>isSameProvinceNotice(c.title,district,regionContext));
  // Seoul's official LH board abbreviates its 25-borough coverage list with
  // '...' in a single row. Thus 강남구/마포구 may be absent from the rendered
  // list even though the entry is labelled [서울지역]. Use an explicitly
  // 서울지역 notice only as a regional *candidate*, without asserting borough eligibility.
  const seoulRegionalFallback=found.length===0 && /^서울(?:특별시)?(?:\s|$)/.test(regionContext)
    ? allPages.flatMap(html=>parseLhPurchaseList(html,"서울")).filter(c=>/서울지역(?:본부)?/.test(c.title)) : [];
  const matchedByRegion=seoulRegionalFallback.length>0;
  const seen=new Set<string>();
  const candidates=[...found,...seoulRegionalFallback].filter(c=>!seen.has(c.id)&&Boolean(seen.add(c.id)));
  if(!candidates.length){
    if(failures.length)throw new Error("LH 공식 공고 목록 추가 페이지 조회 실패");
    boardCache.set(cacheKey,{time:Date.now(),notice:null});return null;
  }
  const today=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"}).replace(/-/g,".");
  // Prefer an active municipality-specific notice; otherwise link the latest closed notice with an explicit status.
  candidates.sort((a,b)=>Number(b.publishedAt<=today&&b.closesAt>=today)-Number(a.publishedAt<=today&&a.closesAt>=today)
    || b.publishedAt.localeCompare(a.publishedAt));
  const entry=candidates[0];
  const detailUrl=BASE+"/lhapply/apply/pch/view.do?mi=1076&pchPanSn="+entry.id;
  const html=await getHtml(detailUrl);
  const attachments=parseLhAttachments(html);
  // Verified values are anchored to the exact PDF. A changed/new notice NEVER inherits them.
  const identified=entry.id===CURRENT_ID && attachments.pdfUrl===CURRENT_PDF;
  let extractedCriteria: NonNullable<LhNotice["extractedCriteria"]> = [];
  let textAnalysisStatus: NonNullable<LhNotice["textAnalysisStatus"]> = identified ? "verified-original" : "not-extracted";
  let automaticPdfWarning: string | null = null;
  if(!identified && attachments.pdfUrl){
    try {
      extractedCriteria=await extractUnverifiedLhPdfClauses(attachments.pdfUrl);
      if(extractedCriteria.length>0)textAnalysisStatus="text-extracted";
      else automaticPdfWarning="공고문 PDF의 적용 가능한 숫자를 자동 추출하지 못했습니다.";
    }catch(error) {
      automaticPdfWarning="공고문 자동 분석 실패: "+(error instanceof Error?error.message:"알 수 없는 오류");
    }
  }
  const notice:LhNotice={
    id:entry.id,title:entry.title,url:detailUrl,
    pdfUrl:attachments.pdfUrl,guideUrl:attachments.guideUrl,
    publishedAt:entry.publishedAt,closesAt:entry.closesAt,
    matchedDistrict:district,official:true,isCurrent:entry.publishedAt<=today&&entry.closesAt>=today,
    rules:identified?verifiedFourth:null, extractedCriteria, textAnalysisStatus,
    warnings:identified?["면적·세대규모의 일반 공고기준과 입지·주차 특례는 별도 조건을 구분해 적용합니다.","역세권 500m, 인허가 가능 용도, 규제지역 및 LH 매입 여부는 해당 필지에 대해 아직 검증되지 않았습니다."]:
      [...(matchedByRegion?["서울지역 공식 공고를 지역명으로 찾았으나 해당 자치구의 실제 공고 대상 여부는 공고문에서 확인해야 합니다."]:[]),
      "해당 지역 공고에서 발췌한 문구는 검토 후보이며 적용요건을 검증하기 전 숫자를 계산에 확정 적용하지 않습니다.",...(automaticPdfWarning?[automaticPdfWarning]:[])],
  };
  boardCache.set(cacheKey,{time:Date.now(),notice});
  return notice;
}
