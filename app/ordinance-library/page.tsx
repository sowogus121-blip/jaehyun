"use client";

import { useMemo, useState } from "react";
import {
  METRO_ORDINANCE_CATALOG_UPDATED_AT,
  METRO_ORDINANCE_RULES,
  METRO_ORDINANCE_SOURCES,
  type MetroRuleKind,
  type MetroRegion,
} from "@/lib/metro-ordinance-catalog";
import { METRO_ANNEX_RECORDS, LH_PURCHASE_NOTICES, LH_GUIDELINE_EVIDENCE, matchLhRegion, noticeIsOpen, koreaLocalDay } from "@/lib/metro-annex-lh-catalog";
import "./catalog.css";

const kinds: MetroRuleKind[] = ["일반용적률", "임대주택완화", "역세권·접도완화", "주상복합", "지구단위", "주차·LH", "용도제한", "특별조건", "자료연결"];
const evidenceNames = {
  "clause-checked":"조문 대조",
  "needs-current-recheck":"개정본 재대조",
  "source-indexed":"원문 연결",
};
export default function CapitalAreaOrdinanceCatalogPage() {
  const [keyword, setKeyword] = useState("");
  const [region, setRegion] = useState<MetroRegion | "전체">("전체");
  const [city, setCity] = useState("전체");
  const [kind, setKind] = useState<MetroRuleKind | "전체">("전체");
  const [showNeedsRecheck, setShowNeedsRecheck] = useState(true);
  const cities = useMemo(() => METRO_ORDINANCE_SOURCES.filter(s => region === "전체" || s.region === region), [region]);
  const entries = useMemo(() => METRO_ORDINANCE_RULES.filter(rule => {
    const source = METRO_ORDINANCE_SOURCES.find(s => s.city === rule.city);
    if (!source || (region !== "전체" && source.region !== region) || (city !== "전체" && city !== rule.city)) return false;
    if (kind !== "전체" && rule.kind !== kind) return false;
    if (!showNeedsRecheck && rule.evidence !== "clause-checked") return false;
    const q=keyword.replace(/\s/g,"").toLowerCase();
    return !q || [rule.city,rule.kind,rule.article,rule.title,rule.detail,rule.conditions,source.title].join(" ").replace(/\s/g,"").toLowerCase().includes(q);
  }), [keyword,region,city,kind,showNeedsRecheck]);
  const grouped = useMemo(() => cities.map(source=>({
    source, items: entries.filter(item=>item.city===source.city),
  })).filter(item=>item.items.length>0),[cities,entries]);
  const verified = METRO_ORDINANCE_RULES.filter(r=>r.evidence==="clause-checked").length;
  const annexes = useMemo(()=>METRO_ANNEX_RECORDS.filter(x=>{
    if(region!=="전체" && x.region!==region)return false;
    if(city!=="전체" && x.city!==city)return false;
    if(!showNeedsRecheck && x.evidence==="lookup-only")return false;
    const q=keyword.replace(/\s/g,"").toLowerCase();
    return !q || [x.city,x.topic,x.title,x.appendix||"",x.conditions].join(" ").replace(/\s/g,"").toLowerCase().includes(q);
  }),[region,city,keyword,showNeedsRecheck]);
  const noticeRegion=city==="전체"?null:matchLhRegion(city==="서울특별시"?city:city==="인천광역시"?city:"경기도 "+city);
  const regionNotices=LH_PURCHASE_NOTICES.filter(x=>{
    if(noticeRegion && x.region!==noticeRegion)return false;
    if(region==="서울"&&x.region!=="서울")return false;
    if(region==="인천"&&x.region!=="인천·부천")return false;
    if(region==="경기"&&x.region==="서울")return false;
    return true;
  });
  const today=koreaLocalDay();

  return <main className="metro-root">
    <header className="metro-header">
      <div className="metro-topbar"><a href="/" className="metro-back">← LH Plan Lab 돌아가기</a><span>LEGAL EVIDENCE LIBRARY</span></div>
      <h1>수도권 법규·특례 근거DB</h1>
      <p>서울·인천·경기도의 조례·별표와 LH 지역별 매입공고·설계가이드를 누적했습니다. 시행일·조문·완화요건·원문을 함께 관리하며, <strong>지구단위계획과 필지별 적법성 확인 전 자동 적용하지 않습니다.</strong></p>
      <div className="metro-stats">
        <div><strong>{METRO_ORDINANCE_SOURCES.length}</strong><span>지역 원문</span></div>
        <div><strong>{METRO_ORDINANCE_RULES.length}</strong><span>법규·완화 항목</span></div>
        <div><strong>{verified}</strong><span>조문 발췌 확인</span></div>
        <div><strong>{METRO_ORDINANCE_RULES.length-verified}</strong><span>재대조·원문 연결</span></div>
      </div>
    </header>
    <section className="metro-filters" aria-label="법규 검색 필터">
      <label>법규 검색 <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="예: 임대주택 120%, 주상복합, 파주시..." /></label>
      <label>권역 <select value={region} onChange={e=>{setRegion(e.target.value as MetroRegion | "전체");setCity("전체");}}><option>전체</option><option>서울</option><option>경기</option><option>인천</option></select></label>
      <label>시·군 <select value={city} onChange={e=>setCity(e.target.value)}><option>전체</option>{cities.map(s=><option key={s.city}>{s.city}</option>)}</select></label>
      <label>항목 <select value={kind} onChange={e=>setKind(e.target.value as MetroRuleKind | "전체")}><option>전체</option>{kinds.map(k=><option key={k}>{k}</option>)}</select></label>
      <label className="metro-check"><input type="checkbox" checked={showNeedsRecheck} onChange={e=>setShowNeedsRecheck(e.target.checked)}/> 추가 검증대상 포함</label>
    </section>
    <div className="metro-search-line"><strong>검색결과 {entries.length}건</strong><span>데이터 기준 {METRO_ORDINANCE_CATALOG_UPDATED_AT} · 자동 법규 적용 OFF</span></div>
    <section className="metro-results" aria-label="지자체별 법규 목록">
      {grouped.length===0 && <div className="metro-empty">조건에 맞는 법규가 없습니다. 검색어와 필터를 조정해 주세요.</div>}
      {grouped.map(({source,items})=><article className="metro-city" key={source.city}>
        <div className="metro-city-heading"><div><span>{source.region} / {source.city}</span><h2>{source.title}</h2><p>시행 {source.effectiveDate} · {source.ordinanceNo} · {items.length}개 항목</p></div><a href={source.url} target="_blank" rel="noopener noreferrer">공식 조례 원문 ↗</a></div>
        <div className="metro-rules">{items.map(rule=><div className="metro-rule" key={rule.id}>
          <div className="metro-rule-title"><span>{rule.kind}</span><h3>{rule.title}</h3><small>{evidenceNames[rule.evidence]}</small></div>
          <p className="metro-value">{rule.detail}</p>
          <p className="metro-condition"><b>적용·예외:</b> {rule.conditions}</p>
          <div className="metro-rule-source"><span>{rule.article}</span><a href={source.url} target="_blank" rel="noopener noreferrer">원문 확인 ↗</a></div>
        </div>)}</div>
      </article>)}
    </section>
    <section className="metro-extra" aria-label="별표 원문 색인 및 검증">
      <div className="metro-extra-heading"><div><span>ANNEX INDEX</span><h2>건축·주차·도시계획조례 별표</h2><p>해당 지자체의 별표 원문 위치를 연결했습니다. 번호·표 수치 미확인 항목은 '원문 검색'으로 구분합니다.</p></div><strong>{annexes.length}건</strong></div>
      <div className="metro-annex-list">
        {annexes.length===0 && <div className="metro-empty">해당 조건의 별표 자료가 없습니다.</div>}
        {annexes.map(x=><div className="metro-annex" key={x.id}>
          <div><span className="metro-annex-city">{x.city}</span> <span className="metro-annex-state">{x.evidence==="direct-excerpt"?"원문 일부 대조":x.evidence==="verified-title"?"별표 명칭 확인":"원문 검색 · 본문 미확인"}</span></div>
          <strong>{x.appendix?x.appendix+" · ":""}{x.title}</strong>
          <p>{x.conditions}</p>
          <a href={x.sourceUrl} target="_blank" rel="noopener noreferrer">국가법령정보센터 원문 열기 ↗</a>
        </div>)}
      </div>
    </section>
    <section className="metro-extra" aria-label="LH 지역별 공고와 설계·시공 가이드라인">
      <div className="metro-extra-heading"><div><span>LH SOURCE LIBRARY</span><h2>LH 2026 매입공고·설계 가이드라인</h2><p>서울 정정공고, 경기북부 4차, 경기남부 3차, 인천·부천 3차를 각각 관리합니다. 종료 공고는 참고용으로만 표시합니다.</p></div><strong>{regionNotices.length}개 본부</strong></div>
      <div className="metro-notices">
        {regionNotices.map(n=><article className="metro-notice" key={n.id}>
          <div className="metro-notice-head"><div><span>{n.region} · {n.publishedAt}</span><h3>{n.title}</h3></div><small className={noticeIsOpen(n,today)?"metro-notice-active":"metro-notice-ended"}>{noticeIsOpen(n,today)?"공고기간 내":"접수 종료"}</small></div>
          <div className="metro-notice-facts"><div><span>공고 접수</span><strong>{n.startDate} ~ {n.closeDate}</strong></div><div><span>최소 매입규모(공고기준)</span><strong>일반 {n.normalMinimumHomes}호 / 규제 {n.regulatedMinimumHomes}호</strong></div></div>
          <p>{n.scopeNote}</p><p className="metro-notice-caveat">{n.revisionNote}</p>
          <div className="metro-notice-links"><a href={n.noticeUrl} target="_blank" rel="noopener noreferrer">공고 상세 ↗</a><a href={n.noticePdfUrl} target="_blank" rel="noopener noreferrer">공고 PDF ↗</a><a href={n.guidelineZipUrl} target="_blank" rel="noopener noreferrer">가이드라인·신청서식 ZIP ↗</a></div>
          <details className="metro-guides"><summary>이 본부의 설계 가이드·매입조건 근거 {LH_GUIDELINE_EVIDENCE.filter(g=>g.applicableRegions.includes(n.region)).length}개 보기</summary>
            {LH_GUIDELINE_EVIDENCE.filter(g=>g.applicableRegions.includes(n.region)).map(g=><div key={g.id}><b>{g.topic}</b> — {g.detail}<small>{g.sourceLocation} · {g.evidence==="direct-excerpt"?"원문 일부 확인":"첨부 제목 확인"}</small><p>{g.conditions}</p></div>)}
          </details>
        </article>)}
      </div>
    </section>
    <footer className="metro-footer"><b>적용 우선순위</b> — 용도지역과 건축물 허용용도 → 해당 필지 지구단위계획·특수구역 → 해당 시 조례·별표 → 임대주택/LH 인수조건 → 심의·승인. 이 데이터는 근거 열람용이며 건축허가 또는 완화 승인을 대신하지 않습니다.</footer>
  </main>;
}
