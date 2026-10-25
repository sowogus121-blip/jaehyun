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
export function parseLhAttachments(html:string):{pdfUrl:string|null;guideUrl:string|null} {
  const anchor=[...html.matchAll(/<a\s+href=["'](\/lhapply\/lhFile\.do\?fileid=\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(m=>({url:ensureOfficial(m[1]),title:stripTags(m[2])}));
  return {
    pdfUrl:anchor.find(a=>/공고문.*\.pdf|\.pdf/.test(a.title))?.url??null,
    guideUrl:anchor.find(a=>/가이드라인|설계|신청서식/.test(a.title))?.url??null,
  };
}
async function getHtml(url:string,timeout=7500):Promise<string> {
  const res=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(timeout),headers:{Accept:"text/html","User-Agent":"LH-Plan-Lab/1.0"}});
  if(!res.ok)throw new Error("LH 공식 게시판 HTTP "+res.status);
  const type=res.headers.get("content-type")||"";
  if(!type.toLowerCase().includes("text/html"))throw new Error("LH 게시판이 HTML을 반환하지 않음");
  const html=await res.text();
  return html.slice(0,500_000);
}
export async function findLatestLhPurchaseNotice(district:string):Promise<LhNotice|null> {
  if(!district)return null;
  const old=boardCache.get(district);
  if(old&&Date.now()-old.time<CACHED_MS)return old.notice;
  const list=await getHtml(BOARD_URL);
  const candidates=parseLhPurchaseList(list,district);
  if(!candidates.length){boardCache.set(district,{time:Date.now(),notice:null});return null;}
  const entry=candidates[0];
  const detailUrl=BASE+"/lhapply/apply/pch/view.do?mi=1076&pchPanSn="+entry.id;
  const html=await getHtml(detailUrl);
  const attachments=parseLhAttachments(html);
  // Verified values are anchored to the exact PDF. A changed/new notice NEVER inherits them.
  const identified=entry.id===CURRENT_ID && attachments.pdfUrl===CURRENT_PDF;
  const today=new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"}).replace(/-/g,".");
  const notice:LhNotice={
    id:entry.id,title:entry.title,url:detailUrl,
    pdfUrl:attachments.pdfUrl,guideUrl:attachments.guideUrl,
    publishedAt:entry.publishedAt,closesAt:entry.closesAt,
    matchedDistrict:district,official:true,isCurrent:entry.closesAt>=today,
    rules:identified?verifiedFourth:null,
    warnings:identified?["면적·세대규모의 일반 공고기준과 입지·주차 특례는 별도 조건을 구분해 적용합니다.","역세권 500m, 인허가 가능 용도, 규제지역 및 LH 매입 여부는 해당 필지에 대해 아직 검증되지 않았습니다."]:
      ["공식 공고 링크는 확보했으나 변경·정정 공고의 본문 규칙을 확인하지 않아 숫자를 자동 반영하지 않습니다."],
  };
  boardCache.set(district,{time:Date.now(),notice});
  return notice;
}
