/** Official LH housing-purchase board. No third-party search index, no invented legal approvals. */
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
  const seen=new Set<string>();
  const candidates=found.filter(c=>!seen.has(c.id)&&Boolean(seen.add(c.id)));
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
  const notice:LhNotice={
    id:entry.id,title:entry.title,url:detailUrl,
    pdfUrl:attachments.pdfUrl,guideUrl:attachments.guideUrl,
    publishedAt:entry.publishedAt,closesAt:entry.closesAt,
    matchedDistrict:district,official:true,isCurrent:entry.publishedAt<=today&&entry.closesAt>=today,
    rules:identified?verifiedFourth:null,
    warnings:identified?["면적·세대규모의 일반 공고기준과 입지·주차 특례는 별도 조건을 구분해 적용합니다.","역세권 500m, 인허가 가능 용도, 규제지역 및 LH 매입 여부는 해당 필지에 대해 아직 검증되지 않았습니다."]:
      ["공식 공고 링크는 확보했으나 변경·정정 공고의 본문 규칙을 확인하지 않아 숫자를 자동 반영하지 않습니다."],
  };
  boardCache.set(cacheKey,{time:Date.now(),notice});
  return notice;
}
