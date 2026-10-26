import type { SiteReviewResult } from "./types";

/**
 * 2026.10.01 Hanam City Urban Planning Ordinance §53(1)(6,8), §56:
 * general commercial 1300%, quasi-residential 500%; for residential/commercial
 * or officetel commercial mix, use weighted use shares.
 * Not a final parcel-specific approval. No allowance for +100pp donation review.
 */
export const HANAM_CITY_ORDINANCE_URL="https://www.law.go.kr/ordinSc.do?menuId=3&query=%ED%95%98%EB%82%A8%EC%8B%9C+%EB%8F%84%EC%8B%9C%EA%B3%84%ED%9A%8D+%EC%A1%B0%EB%A1%80";
export function isHanamCommercialSite(review:SiteReviewResult|null):boolean {
 if(!review?.location)return false;
 const place=review.location.parcelAddress||review.location.address;
 return /(?:경기도\s*)?하남시/.test(place) && !review.mixedUseZones &&
  review.landUse.some(z=>z.category==="용도지역"&&z.name==="일반상업지역") &&
  review.ordinances.some(z=>z.name==="하남시 도시계획 조례");
}
export function calculateHanamCommercialMix(commercialShare:number) {
 const commercial=Math.min(90,Math.max(15,Number.isFinite(commercialShare)?commercialShare:20));
 const housing=100-commercial;
 // Percent of *total* FAR-counted floor area, not of the site.
 const totalFar=(commercial*1300+housing*500)/100;
 return {commercialShare:commercial,housingShare:housing,totalFar,
  commercialMaximumFar:totalFar*commercial/100,housingMaximumFar:totalFar*housing/100,
  statutoryCommercialFar:1300,statutoryResidentialFar:500};
}
