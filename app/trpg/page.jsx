"use client";

import { useState, useRef, useReducer, useEffect } from "react";

/* ===================== STATIC DATA ===================== */

const ATTR_DEFS = [
  { key: "STR", name: "근력", type: "3d6" },
  { key: "CON", name: "건강", type: "3d6" },
  { key: "DEX", name: "민첩성", type: "3d6" },
  { key: "APP", name: "외모", type: "3d6" },
  { key: "POW", name: "정신력", type: "3d6" },
  { key: "LUK", name: "운", type: "3d6" },
  { key: "SIZ", name: "크기", type: "2d6+6" },
  { key: "INT", name: "지능", type: "2d6+6" },
  { key: "EDU", name: "교육", type: "2d6+6" },
];

const BASE_SKILLS = [
  ["감정", 5], ["고고학", 1], ["관찰력", 25], ["근접전(격투)", 25], ["기계수리", 10],
  ["도약", 20], ["듣기", 20], ["말재주", 5], ["매혹", 15], ["법률", 5],
  ["변장", 5], ["사격(권총)", 20], ["사격(라이플/산탄총)", 25], ["설득", 10], ["손놀림", 10],
  ["수영", 20], ["승마", 5], ["심리학", 10],
  ["언어(모국어)", "EDU"], ["역사", 5], ["열쇠공", 1], ["오르기", 20], ["오컬트", 5],
  ["위협", 15], ["은밀행동", 20], ["응급처치", 30], ["의료", 1], ["인류학", 1],
  ["자동차 운전", 20], ["자료조사", 20], ["자연", 10], ["재력", 0], ["전기수리", 10],
  ["정신분석", 1], ["중장비 조작", 1], ["추적", 10],
  ["크툴루 신화", 0], ["투척", 20], ["항법", 10], ["회계", 5], ["회피", "DEX/2"],
];

const AGE_TABLE = [
  { min: 15, max: 19, statReduce: { points: 5, options: ["STR", "SIZ"] }, eduReduce: 5, luckTwice: true },
  { min: 20, max: 39, eduChecks: 1 },
  { min: 40, max: 49, eduChecks: 2, statReduce: { points: 5, options: ["STR", "CON", "DEX"] }, appReduce: 5 },
  { min: 50, max: 59, eduChecks: 3, statReduce: { points: 10, options: ["STR", "CON", "DEX"] }, appReduce: 10 },
  { min: 60, max: 69, eduChecks: 4, statReduce: { points: 20, options: ["STR", "CON", "DEX"] }, appReduce: 15 },
  { min: 70, max: 79, eduChecks: 4, statReduce: { points: 40, options: ["STR", "CON", "DEX"] }, appReduce: 20 },
  { min: 80, max: 89, eduChecks: 4, statReduce: { points: 80, options: ["STR", "CON", "DEX"] }, appReduce: 25 },
];

function labelOf(key) {
  const d = ATTR_DEFS.find((a) => a.key === key);
  return d ? d.name : key;
}

/* ===================== SMALL HELPERS ===================== */

function rollDie(n) {
  return Math.floor(Math.random() * n) + 1;
}

function rollNotation(m, n) {
  if (n === 100) {
    const tensRoll = Math.floor(Math.random() * 10);
    const onesRoll = Math.floor(Math.random() * 10);
    let total = tensRoll * 10 + onesRoll;
    if (total === 0) total = 100;
    return {
      parts: [tensRoll === 0 ? "00" : String(tensRoll * 10), String(onesRoll)],
      detail: `십의자리 ${tensRoll === 0 ? "00" : tensRoll * 10} + 일의자리 ${onesRoll}`,
      total,
    };
  }
  const arr = [];
  for (let i = 0; i < m; i++) arr.push(rollDie(n));
  return { parts: arr.map(String), detail: arr.join(" + "), total: arr.reduce((a, b) => a + b, 0) };
}

function fmtTime() {
  return new Date().toTimeString().slice(0, 8);
}

function parseNotation(str) {
  const m = String(str).trim().match(/^(\d+)\s*[dD]\s*(\d+)$/);
  if (!m) return null;
  return { m: parseInt(m[1], 10), n: parseInt(m[2], 10) };
}

/* ===================== COMPONENT ===================== */

export default function CoCCharacterSheet() {
  // "store" mimics an imperative mutable model so all the character-generation
  // rules can be written straightforwardly; forceRender() repaints the UI.
  const store = useRef({
    attrs: { STR: 0, CON: 0, DEX: 0, APP: 0, POW: 0, LUK: 0, SIZ: 0, INT: 0, EDU: 0 },
    skills: BASE_SKILLS.map((s, i) => ({
      id: "s" + i,
      name: s[0],
      base: s[1],
      special: s[1] === "EDU" || s[1] === "DEX/2",
      checked: false,
      alloc: 0,
      custom: false,
    })),
  }).current;
  const [, forceRender] = useReducer((x) => x + 1, 0);

  // Investigator info
  const [info, setInfo] = useState({ name: "", pl: "", occupation: "", gender: "", birthplace: "", residence: "" });

  // Age
  const [age, setAge] = useState(25);
  const [ageBracket, setAgeBracket] = useState(null);
  const [reduceValues, setReduceValues] = useState({});

  // Skill pools
  const [poolOcc, setPoolOcc] = useState(0);
  const [poolInt, setPoolInt] = useState(0);
  const [poolGrowth, setPoolGrowth] = useState(0);
  const [skillSearch, setSkillSearch] = useState("");

  // Derived editable current values
  const [hpCur, setHpCur] = useState(null);
  const [mpCur, setMpCur] = useState(null);
  const [sanCur, setSanCur] = useState(null);

  // Dice visuals
  const [diceStage, setDiceStage] = useState({ dice: [], rolling: false });
  const [notation, setNotation] = useState("1d100");
  const [log, setLog] = useState([]);
  const busyRef = useRef(false);

  function addLog(label, resultOrText, isEvent) {
    setLog((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        label,
        time: fmtTime(),
        isEvent: !!isEvent,
        detail: isEvent ? resultOrText : resultOrText.detail,
        total: isEvent ? null : resultOrText.total,
      },
    ]);
  }

  function animateAndRoll(m, n, label) {
    return new Promise((resolve) => {
      const count = n === 100 ? 2 : Math.min(m, 6);
      setDiceStage({ dice: Array(count).fill("?"), rolling: true });
      let ticks = 0;
      const maxTicks = 9;
      const iv = setInterval(() => {
        setDiceStage({ dice: Array(count).fill(0).map(() => rollDie(n === 100 ? 10 : n)), rolling: true });
        ticks++;
        if (ticks >= maxTicks) {
          clearInterval(iv);
          const result = rollNotation(m, n);
          setDiceStage({ dice: result.parts, rolling: false });
          addLog(label, result, false);
          resolve(result);
        }
      }, 70);
    });
  }

  async function handleCustomRoll() {
    const parsed = parseNotation(notation);
    if (!parsed) {
      alert("mDn 형식으로 입력해줘 (예: 3d6, 1d100)");
      return;
    }
    await animateAndRoll(parsed.m, parsed.n, notation.trim());
  }

  async function handleQuickRoll(n) {
    setNotation(n);
    const parsed = parseNotation(n);
    await animateAndRoll(parsed.m, parsed.n, n);
  }

  /* ---------- attributes ---------- */

  async function rollAttribute(key, type) {
    if (type === "3d6") {
      const res = await animateAndRoll(3, 6, `특성치 굴림 · ${labelOf(key)}`);
      store.attrs[key] = res.total * 5;
      forceRender();
    } else {
      const res = await animateAndRoll(2, 6, `특성치 굴림 · ${labelOf(key)}`);
      store.attrs[key] = (res.total + 6) * 5;
      addLog(`${labelOf(key)} 계산`, `(2D6=${res.total} + 6) × 5`, true);
      forceRender();
    }
  }

  async function rollAllAttributes() {
    for (const def of ATTR_DEFS) {
      await rollAttribute(def.key, def.type);
    }
  }

  function setAttrDirect(key, value) {
    store.attrs[key] = parseInt(value) || 0;
    forceRender();
  }

  /* ---------- age adjustment ---------- */

  function pickAgeBracket() {
    const bracket = AGE_TABLE.find((b) => age >= b.min && age <= b.max);
    if (!bracket) {
      alert("15~89 사이 나이를 입력해줘.");
      return;
    }
    setAgeBracket(bracket);
    const init = {};
    if (bracket.statReduce) bracket.statReduce.options.forEach((k) => (init[k] = 0));
    setReduceValues(init);
  }

  async function improvementCheck(key) {
    const res = await animateAndRoll(1, 100, `향상 판정 · ${labelOf(key)} 현재 ${store.attrs[key]}`);
    if (res.total > store.attrs[key]) {
      const inc = await animateAndRoll(1, 10, "향상 성공 → 증가량");
      store.attrs[key] += inc.total;
      addLog("향상 판정 결과", `${labelOf(key)} +${inc.total} → ${store.attrs[key]}`, true);
      forceRender();
    } else {
      addLog("향상 판정 결과", `${labelOf(key)} 변화 없음 (판정 실패)`, true);
    }
  }

  async function confirmAgeAdjustment() {
    if (busyRef.current) return;
    busyRef.current = true;
    const bracket = ageBracket;

    if (bracket.statReduce) {
      const sum = Object.values(reduceValues).reduce((a, b) => a + (parseInt(b) || 0), 0);
      if (sum !== bracket.statReduce.points) {
        alert(`감소 배분 합계가 정확히 ${bracket.statReduce.points}점이 되어야 해.`);
        busyRef.current = false;
        return;
      }
      bracket.statReduce.options.forEach((k) => {
        const v = parseInt(reduceValues[k]) || 0;
        store.attrs[k] = Math.max(0, store.attrs[k] - v);
      });
      addLog("나이 조정", `${bracket.statReduce.options.map(labelOf).join("/")} 총 ${bracket.statReduce.points}점 감소 적용`, true);
      forceRender();
    }
    if (bracket.eduReduce) {
      store.attrs.EDU = Math.max(0, store.attrs.EDU - bracket.eduReduce);
      addLog("나이 조정", `교육 -${bracket.eduReduce}`, true);
      forceRender();
    }
    if (bracket.appReduce) {
      store.attrs.APP = Math.max(0, store.attrs.APP - bracket.appReduce);
      addLog("나이 조정", `외모 -${bracket.appReduce}`, true);
      forceRender();
    }
    if (bracket.luckTwice) {
      const r1 = await animateAndRoll(3, 6, "운 굴림 (1/2)");
      const v1 = r1.total * 5;
      const r2 = await animateAndRoll(3, 6, "운 굴림 (2/2)");
      const v2 = r2.total * 5;
      const chosen = Math.max(v1, v2);
      store.attrs.LUK = chosen;
      addLog("운 결정", `${v1}과 ${v2} 중 높은 값 ${chosen} 채택`, true);
      forceRender();
    }
    if (bracket.eduChecks) {
      for (let i = 0; i < bracket.eduChecks; i++) {
        await improvementCheck("EDU");
      }
    }
    busyRef.current = false;
  }

  /* ---------- derived stats ---------- */

  function computeMOV() {
    const { STR, DEX, SIZ } = store.attrs;
    let mov;
    if (STR < SIZ && DEX < SIZ) mov = 7;
    else if (STR > SIZ && DEX > SIZ) mov = 9;
    else mov = 8;
    if (age >= 80) mov -= 5;
    else if (age >= 70) mov -= 4;
    else if (age >= 60) mov -= 3;
    else if (age >= 50) mov -= 2;
    else if (age >= 40) mov -= 1;
    return Math.max(mov, 1);
  }

  function computeBuildDB() {
    const sum = store.attrs.STR + store.attrs.SIZ;
    if (sum <= 64) return { db: "-2", build: -2 };
    if (sum <= 84) return { db: "-1", build: -1 };
    if (sum <= 124) return { db: "0", build: 0 };
    if (sum <= 164) return { db: "+1D4", build: 1 };
    if (sum <= 204) return { db: "+1D6", build: 2 };
    if (sum <= 284) return { db: "+2D6", build: 3 };
    if (sum <= 364) return { db: "+3D6", build: 4 };
    if (sum <= 444) return { db: "+4D6", build: 5 };
    const extra = Math.floor((sum - 444) / 80) + 1;
    return { db: `+${4 + extra}D6`, build: 5 + extra };
  }

  function skillBaseValue(sk) {
    if (sk.base === "EDU") return store.attrs.EDU;
    if (sk.base === "DEX/2") return Math.floor(store.attrs.DEX / 2);
    return sk.base;
  }
  function skillTotal(sk) {
    return skillBaseValue(sk) + (parseInt(sk.alloc) || 0);
  }

  const hpMax = Math.floor((store.attrs.CON + store.attrs.SIZ) / 10);
  const mpMax = Math.floor(store.attrs.POW / 5);
  const mythos = store.skills.find((s) => s.name === "크툴루 신화");
  const mythosVal = mythos ? skillTotal(mythos) : 0;
  const sanMax = 99 - mythosVal;
  const movVal = computeMOV();
  const bd = computeBuildDB();

  /* ---------- skills ---------- */

  function toggleSkillChecked(id) {
    const sk = store.skills.find((s) => s.id === id);
    sk.checked = !sk.checked;
    forceRender();
  }
  function setSkillAlloc(id, value) {
    const sk = store.skills.find((s) => s.id === id);
    sk.alloc = parseInt(value) || 0;
    forceRender();
  }
  function removeSkill(id) {
    store.skills = store.skills.filter((s) => s.id !== id);
    forceRender();
  }
  function addCustomSkill() {
    const name = prompt("추가할 기능 이름을 입력해줘 (예: 과학(생물학))");
    if (!name) return;
    const baseStr = prompt("기본치를 입력해줘 (숫자, 예: 1)", "1");
    const base = parseInt(baseStr);
    store.skills.push({
      id: "custom-" + Date.now(),
      name,
      base: isNaN(base) ? 0 : base,
      special: false,
      checked: false,
      alloc: 0,
      custom: true,
    });
    forceRender();
  }

  let occUsed = 0,
    intUsed = 0;
  store.skills.forEach((sk) => {
    const a = parseInt(sk.alloc) || 0;
    if (sk.checked) occUsed += a;
    else intUsed += a;
  });
  const remainOcc = poolOcc - occUsed;
  const remainInt = poolInt - intUsed;

  const visibleSkills = store.skills.filter(
    (sk) => !skillSearch || sk.name.toLowerCase().includes(skillSearch.toLowerCase())
  );
  const cols = [[], [], []];
  visibleSkills.forEach((sk, i) => cols[i % 3].push(sk));

  /* ===================== RENDER ===================== */

  return (
    <div className="min-h-screen bg-[#0c0f0d] text-[#e8e1c9] font-sans">
      <style>{`
        @keyframes coc-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.08); }
          100% { transform: rotate(360deg) scale(1); }
        }
        .coc-die-rolling { animation: coc-spin .25s linear infinite; }
        .coc-log-list::-webkit-scrollbar { width: 6px; }
        .coc-log-list::-webkit-scrollbar-thumb { background: #3e5638; border-radius: 4px; }
        .coc-skill-row {
          display: grid;
          grid-template-columns: 20px 1fr 30px 44px 26px 26px 26px 20px;
          gap: 5px;
          align-items: center;
          padding: 4px 2px;
          border-bottom: 1px solid rgba(20,20,15,0.08);
          font-size: 11.5px;
        }
        .coc-skill-header {
          display: grid;
          grid-template-columns: 20px 1fr 30px 44px 26px 26px 26px 20px;
          gap: 5px;
          font-family: monospace;
          font-size: 9px;
          color: #6b6b5e;
          letter-spacing: 0.05em;
          padding: 2px 2px 6px;
          border-bottom: 1px solid rgba(20,20,15,0.25);
          text-align: center;
        }
        .coc-skill-header span:nth-child(2) { text-align: left; }
      `}</style>

      <div className="max-w-[1400px] mx-auto px-5 pt-7 pb-20">
        {/* Masthead */}
        <div className="text-center pb-6 mb-6 border-b border-[#e8e1c9]/15 relative">
          <div className="font-mono tracking-[0.35em] text-[11px] text-[#8faa5c] uppercase opacity-80">
            Call of Cthulhu · 7th Edition
          </div>
          <h1 className="font-serif text-4xl tracking-wide mt-2 mb-1.5 text-[#e8e1c9]" style={{ textShadow: "0 0 24px rgba(143,170,92,0.25)" }}>
            탐사자 생성 의식
          </h1>
          <div className="text-[13px] text-[#e8e1c9]/55">미스카토닉의 서고에서 — 이름 없는 것들을 마주할 자를 빚는다</div>
          <svg className="w-[120px] h-[10px] mx-auto mt-3.5 opacity-55" viewBox="0 0 120 10">
            <path d="M0 5 Q20 0 40 5 T80 5 T120 5" stroke="#8faa5c" fill="none" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
          <main className="flex flex-col gap-5">
            {/* Investigator info */}
            <Card title="탐사자 정보" tag="INVESTIGATOR">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                <Field label="이름"><input className="coc-input" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></Field>
                <Field label="PL"><input className="coc-input" value={info.pl} onChange={(e) => setInfo({ ...info, pl: e.target.value })} /></Field>
                <Field label="직업"><input className="coc-input" value={info.occupation} onChange={(e) => setInfo({ ...info, occupation: e.target.value })} /></Field>
                <Field label="성별"><input className="coc-input" value={info.gender} onChange={(e) => setInfo({ ...info, gender: e.target.value })} /></Field>
                <Field label="출생지"><input className="coc-input" value={info.birthplace} onChange={(e) => setInfo({ ...info, birthplace: e.target.value })} /></Field>
                <Field label="거주지"><input className="coc-input" value={info.residence} onChange={(e) => setInfo({ ...info, residence: e.target.value })} /></Field>
              </div>
            </Card>

            {/* Characteristics */}
            <Card title="특성치" tag="CHARACTERISTICS">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {ATTR_DEFS.map((def) => (
                  <div key={def.key} className="bg-[#fbf8ee] border border-black/20 rounded p-2 text-[#1c1a13]">
                    <div className="font-serif font-bold text-[13px] flex justify-between items-center mb-1.5">
                      <span>{def.name}</span>
                      <small className="font-mono text-[9px] text-[#6b6b5e]">{def.type === "3d6" ? "3D6×5" : "(2D6+6)×5"}</small>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="number"
                        className="w-14 text-center font-bold text-base py-1 px-0.5 border border-black/25 rounded bg-white text-[#1c1a13]"
                        value={store.attrs[def.key]}
                        onChange={(e) => setAttrDirect(def.key, e.target.value)}
                      />
                      <div className="flex flex-col font-mono text-[10px] text-[#5c5c50] gap-0.5">
                        <span>half <b>{Math.floor(store.attrs[def.key] / 2)}</b></span>
                        <span>fifth <b>{Math.floor(store.attrs[def.key] / 5)}</b></span>
                      </div>
                      <button className="coc-roll-btn-sm" onClick={() => rollAttribute(def.key, def.type)}>
                        굴리기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-[#5b5b4f] leading-relaxed mt-1.5">
                근력·건강·민첩성·외모·정신력·운 = <b className="text-[#7a3131]">3d6 × 5</b> &nbsp;|&nbsp; 크기·지능·교육 = <b className="text-[#7a3131]">(2d6+6) × 5</b>
              </div>
              <button className="coc-roll-btn mt-2.5" onClick={rollAllAttributes}>
                전체 특성치 한 번에 굴리기
              </button>
            </Card>

            {/* Age */}
            <Card title="나이 & 조정" tag="AGE">
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="나이 (15~89)">
                  <input type="number" min={15} max={89} className="coc-input" value={age} onChange={(e) => setAge(parseInt(e.target.value) || 0)} />
                </Field>
                <div className="flex items-end">
                  <button className="coc-roll-btn-blood w-full py-2" onClick={pickAgeBracket}>
                    이 나이의 조정 적용하기
                  </button>
                </div>
              </div>

              {ageBracket && (
                <div className="mt-3 p-3 bg-[#7a3131]/[.06] border border-dashed border-[#7a3131]/35 rounded text-[12px] text-[#1c1a13]">
                  <h4 className="font-serif text-[13px] text-[#7a3131] mb-2 flex items-center gap-2 flex-wrap">
                    {ageBracket.min}~{ageBracket.max}세 조정
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#7a3131] text-[#eef3e6]">
                      참고: 50세 이상 구간은 정식 규칙표를 바탕으로 한 확장 적용
                    </span>
                  </h4>

                  {ageBracket.statReduce && (
                    <>
                      <div className="mb-2 font-bold">
                        {ageBracket.statReduce.options.map(labelOf).join(" / ")} 중 총 {ageBracket.statReduce.points}점 감소 배분
                      </div>
                      <div className="flex gap-2.5 flex-wrap mb-2">
                        {ageBracket.statReduce.options.map((k) => (
                          <label key={k} className="text-[11px] flex items-center gap-1">
                            {labelOf(k)}{" "}
                            <input
                              type="number"
                              className="w-16 p-1 border border-black/25 rounded"
                              value={reduceValues[k] ?? 0}
                              onChange={(e) => setReduceValues({ ...reduceValues, [k]: e.target.value })}
                            />
                          </label>
                        ))}
                      </div>
                      <div className="mb-2">
                        배분 합계: {Object.values(reduceValues).reduce((a, b) => a + (parseInt(b) || 0), 0)} / {ageBracket.statReduce.points}
                      </div>
                    </>
                  )}
                  {ageBracket.eduReduce > 0 && <div className="mb-2">교육 <b>-{ageBracket.eduReduce}</b> 자동 적용</div>}
                  {ageBracket.appReduce > 0 && <div className="mb-2">외모 <b>-{ageBracket.appReduce}</b> 자동 적용</div>}
                  {ageBracket.luckTwice && <div className="mb-2">운 수치는 3D6×5를 <b>두 번</b> 굴려 높은 값을 채택 (적용 버튼에서 자동 진행)</div>}
                  {ageBracket.eduChecks > 0 && <div className="mb-2">교육 향상 판정 <b>{ageBracket.eduChecks}회</b> 자동 진행 (적용 버튼에서 순차 진행)</div>}

                  <button className="coc-roll-btn-blood mt-1.5" onClick={confirmAgeAdjustment}>
                    위 내용대로 조정 확정 적용
                  </button>
                </div>
              )}
            </Card>

            {/* Derived */}
            <Card title="파생치" tag="DERIVED">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                <DerivedBox name="체력 HP">
                  <input type="number" className="w-11 text-center bg-transparent font-serif text-lg font-bold" value={hpCur ?? hpMax} onChange={(e) => setHpCur(parseInt(e.target.value) || 0)} />/{hpMax}
                </DerivedBox>
                <DerivedBox name="마력 MP">
                  <input type="number" className="w-11 text-center bg-transparent font-serif text-lg font-bold" value={mpCur ?? mpMax} onChange={(e) => setMpCur(parseInt(e.target.value) || 0)} />/{mpMax}
                </DerivedBox>
                <DerivedBox name="이성 SAN">
                  <input type="number" className="w-11 text-center bg-transparent font-serif text-lg font-bold" value={sanCur ?? store.attrs.POW} onChange={(e) => setSanCur(parseInt(e.target.value) || 0)} />/{sanMax}
                </DerivedBox>
                <DerivedBox name="이동력 MOV">{movVal}</DerivedBox>
                <DerivedBox name="체구 / 피해보너스" small>{bd.build} / {bd.db}</DerivedBox>
              </div>
            </Card>

            {/* Skills */}
            <Card title="탐사자 기능" tag="SKILLS">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3.5">
                <PoolBox label="직업 기능 점수"><input type="number" className="coc-pool-input" value={poolOcc} onChange={(e) => setPoolOcc(parseInt(e.target.value) || 0)} /></PoolBox>
                <PoolBox label="관심 기능 점수"><input type="number" className="coc-pool-input" value={poolInt} onChange={(e) => setPoolInt(parseInt(e.target.value) || 0)} /></PoolBox>
                <PoolBox label="성장치"><input type="number" className="coc-pool-input" value={poolGrowth} onChange={(e) => setPoolGrowth(parseInt(e.target.value) || 0)} /></PoolBox>
                <div className={`rounded p-2 border border-black/20 text-[#1c1a13] ${remainOcc < 0 || remainInt < 0 ? "bg-[#7a3131]/15" : "bg-[#5c7a52]/12"}`}>
                  <label className="text-[10px] text-[#6b6b5e] block mb-1">잔여 점수 (직업 / 관심)</label>
                  <div className="font-serif font-bold text-[17px]">{remainOcc} / {remainInt}</div>
                </div>
              </div>

              <div className="flex justify-between items-center gap-2.5 flex-wrap mb-2.5">
                <input
                  className="px-2.5 py-1.5 border border-black/25 rounded-full text-[12px] w-52 bg-[#fbf8ee] text-[#1c1a13]"
                  placeholder="기능 검색…"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                />
                <button className="bg-[#a5883f] text-[#2a2410] border-none px-3 py-1.5 rounded-full text-[11px] font-mono cursor-pointer" onClick={addCustomSkill}>
                  + 사용자 기능 추가
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
                {cols.map((col, ci) => (
                  <div key={ci} className="text-[#1c1a13]">
                    <div className="coc-skill-header">
                      <span>직업</span><span>기능</span><span>기본</span><span>배분</span><span>합계</span><span>½</span><span>⅕</span><span></span>
                    </div>
                    {col.map((sk) => {
                      const base = skillBaseValue(sk);
                      const total = skillTotal(sk);
                      return (
                        <div className="coc-skill-row" key={sk.id}>
                          <input type="checkbox" checked={sk.checked} onChange={() => toggleSkillChecked(sk.id)} style={{ accentColor: "#5c7a52", width: 14, height: 14 }} />
                          <span className="whitespace-nowrap overflow-hidden text-ellipsis" title={sk.name}>{sk.name}</span>
                          <span className="font-mono text-[10px] text-[#7a7a6a] text-right">{base}</span>
                          <input
                            type="number"
                            className="w-full py-0.5 px-0.5 text-center border border-black/20 rounded bg-white text-[11px]"
                            value={sk.alloc}
                            onChange={(e) => setSkillAlloc(sk.id, e.target.value)}
                          />
                          <span className="text-center font-mono text-[10.5px] bg-[#f1ecda] rounded py-0.5 font-bold">{total}</span>
                          <span className="text-center font-mono text-[10.5px] bg-[#f1ecda] rounded py-0.5">{Math.floor(total / 2)}</span>
                          <span className="text-center font-mono text-[10.5px] bg-[#f1ecda] rounded py-0.5">{Math.floor(total / 5)}</span>
                          <span className="text-center text-[12px] text-[#7a3131] opacity-50 cursor-pointer hover:opacity-100" onClick={() => sk.custom && removeSkill(sk.id)}>
                            {sk.custom ? "✕" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-[#5b5b4f] leading-relaxed mt-1.5">
                ☑ 체크 = 직업 기능 · 미체크 = 관심 기능. 배분 칸에 추가로 넣을 점수를 입력하면 <b className="text-[#7a3131]">합계</b>가 자동 계산돼.
                언어(모국어)는 교육치, 회피는 민첩성/2 를 기본치로 자동 반영해.
              </div>
            </Card>
          </main>

          {/* Dice sidebar */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-5">
            <div className="rounded-md p-4.5 bg-gradient-to-b from-[#171c17] to-[#0e120e]" style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(143,170,92,0.15)", padding: 18 }}>
              <h3 className="font-serif text-sm tracking-wide text-[#8faa5c] text-center mb-3">주사위 의식</h3>
              <div className="h-[110px] flex items-center justify-center gap-3.5 mb-3">
                {diceStage.dice.length === 0 && <span className="text-[#8faa5c]/30 font-mono text-xs">— 대기 중 —</span>}
                {diceStage.dice.map((v, i) => (
                  <div
                    key={i}
                    className={`w-14 h-14 rounded-[10px] flex items-center justify-center font-serif font-bold text-xl text-[#1c1a13] ${diceStage.rolling ? "coc-die-rolling" : ""}`}
                    style={{ background: "linear-gradient(145deg,#f2ecd6,#c9c09a)", boxShadow: "0 6px 14px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(0,0,0,0.15)" }}
                  >
                    {v}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  className="flex-1 py-2 px-2.5 rounded border border-[#8faa5c]/35 bg-[#0b0f0b] text-[#e8e1c9] font-mono text-sm text-center"
                  value={notation}
                  onChange={(e) => setNotation(e.target.value)}
                  placeholder="예: 3d6, 1d100"
                />
                <button className="py-2 px-4 rounded border-none bg-[#5c7a52] text-[#0e120e] font-bold font-mono text-xs cursor-pointer hover:bg-[#8faa5c]" onClick={handleCustomRoll}>
                  굴리기
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["1d4", "1d6", "1d10", "2d6", "3d6", "1d100"].map((n) => (
                  <button
                    key={n}
                    className="flex-1 min-w-[44px] py-1.5 px-1 rounded border border-[#8faa5c]/30 bg-[#8faa5c]/10 text-[#8faa5c] font-mono text-[11px] cursor-pointer hover:bg-[#8faa5c]/25"
                    onClick={() => handleQuickRoll(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-gradient-to-b from-[#171c17] to-[#0e120e] p-4 max-h-[520px] flex flex-col" style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(143,170,92,0.1)" }}>
              <h3 className="font-serif text-sm text-[#8faa5c] mb-2.5 tracking-wide">기록</h3>
              <div className="coc-log-list overflow-y-auto flex flex-col-reverse gap-2 pr-1">
                {log.length === 0 && <div className="text-[#e8e1c9]/35 text-xs text-center py-5 font-mono">아직 굴려진 주사위가 없다…</div>}
                {[...log].reverse().map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-r px-2.5 py-1.5 text-xs"
                    style={{ borderLeft: `2px solid ${entry.isEvent ? "#7a3131" : "#5c7a52"}`, background: "rgba(232,225,201,0.04)" }}
                  >
                    <div className="flex justify-between font-mono text-[10px] mb-0.5" style={{ color: entry.isEvent ? "#a84343" : "#8faa5c" }}>
                      <span>{entry.label}</span>
                      <span>{entry.time}</span>
                    </div>
                    <div className="text-[#e8e1c9]">
                      {entry.detail}{" "}
                      {entry.total !== null && <span className="font-bold text-[#a5883f]">= {entry.total}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="text-center text-[#e8e1c9]/30 text-[11px] mt-8 font-mono">
          m D n = m번, n면체 주사위 · 1d100은 십의 자리·일의 자리 십면체 두 개로 처리됨
        </div>
      </div>

      <style>{`
        .coc-input {
          width: 100%; padding: 7px 8px; border: 1px solid rgba(20,20,15,0.25); border-radius: 3px;
          background: #fbf8ee; font-size: 13px; color: #1c1a13;
        }
        .coc-pool-input {
          width: 100%; border: none; background: transparent; font-family: Georgia, serif; font-size: 17px; font-weight: bold; color: #1c1a13;
        }
        .coc-roll-btn {
          border: none; cursor: pointer; background: #3e5638; color: #eef3e6; font-family: monospace;
          font-size: 10px; letter-spacing: 0.05em; padding: 8px 10px; border-radius: 3px; width: 100%;
        }
        .coc-roll-btn:hover { background: #5c7a52; }
        .coc-roll-btn-sm {
          border: none; cursor: pointer; background: #3e5638; color: #eef3e6; font-family: monospace;
          font-size: 9px; letter-spacing: 0.05em; padding: 4px 7px; border-radius: 3px;
        }
        .coc-roll-btn-sm:hover { background: #5c7a52; }
        .coc-roll-btn-blood {
          border: none; cursor: pointer; background: #7a3131; color: #eef3e6; font-family: monospace;
          font-size: 11px; letter-spacing: 0.05em; padding: 8px 10px; border-radius: 3px;
        }
        .coc-roll-btn-blood:hover { background: #a84343; }
      `}</style>
    </div>
  );
}

/* ===================== SMALL PIECES ===================== */

function Card({ title, tag, children }) {
  return (
    <section className="rounded-md overflow-hidden" style={{ background: "linear-gradient(180deg, #e8e1c9, #dcd3b4)", boxShadow: "0 10px 30px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(20,20,15,0.08)" }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "linear-gradient(180deg, #232823, #171c17)", color: "#e8e1c9" }}>
        <span className="font-serif text-[15px] tracking-wide">{title}</span>
        <span className="font-mono text-[10px] text-[#8faa5c] tracking-widest opacity-85">{tag}</span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] text-[#1c1a13] opacity-65 mb-0.5 tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function DerivedBox({ name, small, children }) {
  return (
    <div className="bg-[#fbf8ee] border border-black/20 rounded p-2 text-center text-[#1c1a13]">
      <div className="font-mono text-[9px] tracking-widest text-[#6b6b5e] uppercase">{name}</div>
      <div className={`font-serif font-bold mt-0.5 ${small ? "text-sm" : "text-lg"}`}>{children}</div>
    </div>
  );
}

function PoolBox({ label, children }) {
  return (
    <div className="bg-[#fbf8ee] border border-black/20 rounded p-2">
      <label className="text-[10px] text-[#6b6b5e] block mb-1">{label}</label>
      {children}
    </div>
  );
}
