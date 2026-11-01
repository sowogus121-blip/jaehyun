"use client";

import { useMemo, useState } from "react";
import {
  METRO_ORDINANCE_CATALOG_UPDATED_AT,
  METRO_ORDINANCE_RULES,
  METRO_ORDINANCE_SOURCES,
  type MetroRuleKind,
  type MetroRegion,
} from "@/lib/metro-ordinance-catalog";
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
  return <main className="metro-root">
    <header className="metro-header">
      <div className="metro-topbar"><a href="/" className="metro-back">← LH Plan Lab 돌아가기</a><span>LEGAL EVIDENCE LIBRARY</span></div>
      <h1>수도권 법규·특례 근거DB</h1>
      <p>서울·인천·경기도의 조례를 지자체별로 누적했습니다. 시행일·조문·완화요건·원문을 함께 관리하며, <strong>지구단위계획과 필지별 적법성 확인 전 자동 적용하지 않습니다.</strong></p>
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
    <footer className="metro-footer"><b>적용 우선순위</b> — 용도지역과 건축물 허용용도 → 해당 필지 지구단위계획·특수구역 → 해당 시 조례·별표 → 임대주택/LH 인수조건 → 심의·승인. 이 데이터는 근거 열람용이며 건축허가 또는 완화 승인을 대신하지 않습니다.</footer>
  </main>;
}
