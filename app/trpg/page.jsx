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

// 직업 프리셋: 자주 쓰이는 크툴루 7판 직업들을 간략화해 재구성한 참고용 데이터.
// formula(attrs)는 직업 기능 점수 계산식, skills는 자동 체크될 직업 기능 이름(기본 기능표 이름과 일치해야 함).
const OCCUPATIONS = [
  { name: "사립탐정", formula: (a) => a.EDU * 2 + a.DEX * 2, formulaLabel: "EDU×2 + DEX×2", skills: ["관찰력", "법률", "은밀행동", "심리학", "사격(권총)", "자료조사", "위협", "설득"] },
  { name: "의사", formula: (a) => a.EDU * 4, formulaLabel: "EDU×4", skills: ["의료", "응급처치", "심리학", "자료조사", "설득", "언어(모국어)", "인류학", "회계"] },
  { name: "기자", formula: (a) => a.EDU * 2 + a.APP * 2, formulaLabel: "EDU×2 + APP×2", skills: ["자료조사", "역사", "손놀림", "말재주", "설득", "심리학", "자동차 운전", "언어(모국어)"] },
  { name: "교수", formula: (a) => a.EDU * 4, formulaLabel: "EDU×4", skills: ["역사", "고고학", "자료조사", "언어(모국어)", "오컬트", "인류학", "회계", "설득"] },
  { name: "경찰관", formula: (a) => a.EDU * 2 + a.STR * 2, formulaLabel: "EDU×2 + STR×2", skills: ["사격(권총)", "사격(라이플/산탄총)", "근접전(격투)", "관찰력", "법률", "심리학", "자동차 운전", "추적"] },
  { name: "골동품상", formula: (a) => a.EDU * 2 + a.APP * 2, formulaLabel: "EDU×2 + APP×2", skills: ["역사", "감정", "자료조사", "회계", "말재주", "설득", "언어(모국어)", "오컬트"] },
  { name: "군인", formula: (a) => a.EDU * 2 + a.STR * 2, formulaLabel: "EDU×2 + STR×2", skills: ["사격(라이플/산탄총)", "근접전(격투)", "응급처치", "항법", "전기수리", "기계수리", "추적", "오르기"] },
  { name: "범죄자", formula: (a) => a.DEX * 2 + a.APP * 2, formulaLabel: "DEX×2 + APP×2", skills: ["은밀행동", "손놀림", "열쇠공", "변장", "위협", "자료조사", "회계", "법률"] },
  { name: "부유한 방랑자", formula: (a) => a.EDU * 2 + a.APP * 2, formulaLabel: "EDU×2 + APP×2", skills: ["감정", "말재주", "매혹", "승마", "법률", "회계", "자료조사", "언어(모국어)"] },
  { name: "선원", formula: (a) => a.DEX * 2 + a.STR * 2, formulaLabel: "DEX×2 + STR×2", skills: ["항법", "수영", "기계수리", "전기수리", "응급처치", "자연", "오르기", "투척"] },
  { name: "오컬티스트", formula: (a) => a.EDU * 2 + a.POW * 2, formulaLabel: "EDU×2 + POW×2", skills: ["오컬트", "크툴루 신화", "자료조사", "역사", "인류학", "심리학", "언어(모국어)", "매혹"] },
];

// 노션 동기화용: 캐릭터 페이지를 만들려면 대상 데이터베이스에 미리 준비돼 있어야 하는 속성 목록.
// (빈 데이터베이스로는 값 매핑이 불가능 — Notion API는 스키마에 없는 속성엔 값을 못 넣음)
const NOTION_REQUIRED_PROPS = [
  { name: "이름", type: "제목(Title)", note: "데이터베이스 기본 제목 속성. 이름이 다르면 아래 설정에서 바꿔줘." },
  { name: "직업", type: "텍스트" },
  { name: "나이", type: "숫자" },
  { name: "HP", type: "숫자" },
  { name: "MP", type: "숫자" },
  { name: "SAN", type: "숫자" },
  { name: "특성치", type: "텍스트", note: "특성치 전체를 JSON 문자열로 저장" },
  { name: "기능치", type: "텍스트", note: "기능치+메모 전체를 JSON 문자열로 저장" },
  { name: "최종 동기화", type: "날짜" },
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
      memo: "",
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

  // 기능 메모 (어느 기능의 메모창이 열려있는지)
  const [openMemoIds, setOpenMemoIds] = useState({});

  // 직업 프리셋
  const [occPreset, setOccPreset] = useState("");

  // 노션 연동
  const [notion, setNotion] = useState({ apiKey: "", databaseId: "", titleProp: "이름" });
  const [notionOpen, setNotionOpen] = useState(false);
  const [notionReqOpen, setNotionReqOpen] = useState(false);
  const [notionStatus, setNotionStatus] = useState({ state: "idle", msg: "" }); // idle | busy | ok | error

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
      memo: "",
      custom: true,
    });
    forceRender();
  }
  function setSkillMemo(id, value) {
    const sk = store.skills.find((s) => s.id === id);
    sk.memo = value;
    forceRender();
  }
  function toggleMemoOpen(id) {
    setOpenMemoIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  /* ---------- occupation preset ---------- */

  function applyOccupation(name) {
    setOccPreset(name);
    if (!name) return;
    const occ = OCCUPATIONS.find((o) => o.name === name);
    if (!occ) return;
    store.skills.forEach((sk) => {
      sk.checked = occ.skills.includes(sk.name);
    });
    const pts = occ.formula(store.attrs);
    setPoolOcc(pts || 0);
    setInfo((prev) => ({ ...prev, occupation: name }));
    addLog("직업 프리셋 적용", `${name} · 직업 기능 점수 ${occ.formulaLabel} = ${pts}`, true);
    forceRender();
  }

  /* ---------- notion sync ---------- */

  function buildNotionProperties() {
    const skillDump = store.skills
      .filter((sk) => sk.checked || (parseInt(sk.alloc) || 0) > 0 || sk.memo)
      .map((sk) => ({ 이름: sk.name, 직업기능: sk.checked, 합계: skillTotal(sk), 메모: sk.memo || "" }));
    return {
      [notion.titleProp || "이름"]: { title: [{ text: { content: info.name || "이름 없는 탐사자" } }] },
      "직업": { rich_text: [{ text: { content: info.occupation || "" } }] },
      "나이": { number: age || 0 },
      "HP": { number: hpCur ?? hpMax },
      "MP": { number: mpCur ?? mpMax },
      "SAN": { number: sanCur ?? store.attrs.POW },
      "특성치": { rich_text: [{ text: { content: JSON.stringify(store.attrs) } }] },
      "기능치": { rich_text: [{ text: { content: JSON.stringify(skillDump).slice(0, 1900) } }] },
      "최종 동기화": { date: { start: new Date().toISOString() } },
    };
  }

  async function syncToNotion() {
    if (!notion.apiKey || !notion.databaseId) {
      setNotionStatus({ state: "error", msg: "연동 키와 데이터베이스 ID를 먼저 입력해줘." });
      return;
    }
    setNotionStatus({ state: "busy", msg: "동기화 중…" });
    try {
      const res = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${notion.apiKey}`,
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          parent: { database_id: notion.databaseId },
          properties: buildNotionProperties(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `HTTP ${res.status}`);
      }
      setNotionStatus({ state: "ok", msg: "노션에 저장했어." });
      addLog("노션 동기화", "탐사자 정보를 노션 데이터베이스에 저장함", true);
    } catch (e) {
      setNotionStatus({
        state: "error",
        msg: `동기화 실패: ${e.message}. 브라우저에서 노션 API를 직접 호출하면 CORS 정책에 막힐 수 있어 — 그럴 땐 이 요청을 대신 전달해줄 작은 프록시 서버(Cloudflare Worker 등)가 필요해.`,
      });
    }
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

        /* 페이지 전체 드래그바(스크롤바) 커스텀 디자인 */
        * { scrollbar-width: thin; scrollbar-color: #5c7a52 #12160f; }
        *::-webkit-scrollbar { width: 9px; height: 9px; }
        *::-webkit-scrollbar-track { background: #12160f; border-radius: 8px; }
        *::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #8faa5c, #3e5638);
          border-radius: 8px;
          border: 2px solid #12160f;
        }
        *::-webkit-scrollbar-thumb:hover { background: #8faa5c; }

        .coc-log-list::-webkit-scrollbar { width: 6px; }
        .coc-log-list::-webkit-scrollbar-thumb { background: #3e5638; border-radius: 4px; }

        @keyframes coc-log-in {
          0% { opacity: 0; transform: translateY(-10px) scale(0.98); }
          60% { opacity: 1; transform: translateY(1px) scale(1.005); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .coc-log-entry-new { animation: coc-log-in .38s cubic-bezier(.2,.8,.3,1); }

        .coc-notion-btn {
          border: 1px solid rgba(143,170,92,0.45);
          background: rgba(143,170,92,0.12);
          color: #8faa5c;
          font-family: monospace;
          font-size: 10px;
          letter-spacing: 0.05em;
          padding: 4px 9px;
          border-radius: 999px;
          cursor: pointer;
        }
        .coc-notion-btn:hover { background: rgba(143,170,92,0.25); }

        .coc-modal-overlay {
          position: fixed; inset: 0; background: rgba(6,8,6,0.72);
          display: flex; align-items: center; justify-content: center;
          z-index: 50; padding: 20px; backdrop-filter: blur(2px);
        }
        .coc-modal {
          width: min(520px, 100%);
          max-height: 86vh;
          overflow-y: auto;
          background: linear-gradient(180deg, #e8e1c9, #dcd3b4);
          color: #1c1a13;
          border-radius: 8px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(20,20,15,0.08);
          animation: coc-log-in .25s ease-out;
        }
        .coc-modal-head {
          background: linear-gradient(180deg, #232823, #171c17);
          color: #e8e1c9;
          padding: 12px 16px;
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0;
        }
        .coc-modal-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .coc-modal-close {
          background: none; border: none; color: #e8e1c9; opacity: 0.6; cursor: pointer; font-size: 16px;
        }
        .coc-modal-close:hover { opacity: 1; }
        .coc-req-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
        .coc-req-table th, .coc-req-table td {
          border: 1px solid rgba(20,20,15,0.2); padding: 5px 7px; text-align: left;
        }
        .coc-req-table th { background: rgba(20,20,15,0.08); font-family: monospace; font-size: 10px; }
        .coc-skill-row {
          display: grid;
          grid-template-columns: 20px 1fr 30px 44px 26px 26px 26px 18px 20px;
          gap: 5px;
          align-items: center;
          padding: 4px 2px;
          border-bottom: 1px solid rgba(20,20,15,0.08);
          font-size: 11.5px;
        }
        .coc-skill-memo {
          width: 100%;
          margin: 2px 0 4px;
          padding: 5px 7px;
          font-size: 11px;
          font-family: Georgia, serif;
          color: #1c1a13;
          background: #fbf8ee;
          border: 1px dashed rgba(122,49,49,0.4);
          border-radius: 4px;
          resize: vertical;
          min-height: 40px;
        }
        .coc-skill-header {
          display: grid;
          grid-template-columns: 20px 1fr 30px 44px 26px 26px 26px 18px 20px;
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
            <Card
              title="탐사자 정보"
              tag="INVESTIGATOR"
              action={
                <button className="coc-notion-btn" onClick={() => setNotionOpen(true)}>
                  ⚙ 노션 연동
                </button>
              }
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                <Field label="이름"><input className="coc-input" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></Field>
                <Field label="PL"><input className="coc-input" value={info.pl} onChange={(e) => setInfo({ ...info, pl: e.target.value })} /></Field>
                <Field label="직업"><input className="coc-input" value={info.occupation} onChange={(e) => setInfo({ ...info, occupation: e.target.value })} /></Field>
                <Field label="성별"><input className="coc-input" value={info.gender} onChange={(e) => setInfo({ ...info, gender: e.target.value })} /></Field>
                <Field label="출생지"><input className="coc-input" value={info.birthplace} onChange={(e) => setInfo({ ...info, birthplace: e.target.value })} /></Field>
                <Field label="거주지"><input className="coc-input" value={info.residence} onChange={(e) => setInfo({ ...info, residence: e.target.value })} /></Field>
                <Field label="직업 프리셋 (선택 시 직업 기능 자동 체크 + 점수 계산)">
                  <select className="coc-input" value={occPreset} onChange={(e) => applyOccupation(e.target.value)}>
                    <option value="">— 직접 입력 —</option>
                    {OCCUPATIONS.map((o) => (
                      <option key={o.name} value={o.name}>{o.name} ({o.formulaLabel})</option>
                    ))}
                  </select>
                </Field>
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
                <PoolBox label="관심 기능 점수">
                  <div className="flex items-center gap-1.5">
                    <input type="number" className="coc-pool-input" value={poolInt} onChange={(e) => setPoolInt(parseInt(e.target.value) || 0)} />
                    <button
                      className="coc-roll-btn-sm shrink-0"
                      title="관심 기능 점수 = 지능(INT) × 2"
                      onClick={() => {
                        const v = store.attrs.INT * 2;
                        setPoolInt(v);
                        addLog("관심 기능 점수 계산", `INT×2 = ${v}`, true);
                      }}
                    >
                      INT×2
                    </button>
                  </div>
                </PoolBox>
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
                      <span>직업</span><span>기능</span><span>기본</span><span>배분</span><span>합계</span><span>½</span><span>⅕</span><span></span><span></span>
                    </div>
                    {col.map((sk) => {
                      const base = skillBaseValue(sk);
                      const total = skillTotal(sk);
                      const memoOpen = !!openMemoIds[sk.id];
                      return (
                        <div key={sk.id}>
                          <div className="coc-skill-row">
                            <input type="checkbox" checked={sk.checked} onChange={() => toggleSkillChecked(sk.id)} style={{ accentColor: "#5c7a52", width: 14, height: 14 }} />
                            <span className="whitespace-nowrap overflow-hidden text-ellipsis" title={sk.name}>{sk.name}</span>
                            <span className="font-mono text-[10px] text-[#7a7a6a] text-right">{base}</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={3}
                              className="w-full py-0.5 px-0.5 text-center border border-black/20 rounded bg-white text-[11px]"
                              value={sk.alloc}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^0-9]/g, "");
                                setSkillAlloc(sk.id, raw);
                                if (raw.length >= 2) e.target.blur();
                              }}
                            />
                            <span className="text-center font-mono text-[10.5px] bg-[#f1ecda] rounded py-0.5 font-bold">{total}</span>
                            <span className="text-center font-mono text-[10.5px] bg-[#f1ecda] rounded py-0.5">{Math.floor(total / 2)}</span>
                            <span className="text-center font-mono text-[10.5px] bg-[#f1ecda] rounded py-0.5">{Math.floor(total / 5)}</span>
                            <span
                              className="text-center text-[12px] cursor-pointer hover:opacity-100"
                              style={{ opacity: sk.memo ? 1 : 0.35, color: sk.memo ? "#7a3131" : "#5b5b4f" }}
                              title="기능 메모"
                              onClick={() => toggleMemoOpen(sk.id)}
                            >
                              📝
                            </span>
                            <span className="text-center text-[12px] text-[#7a3131] opacity-50 cursor-pointer hover:opacity-100" onClick={() => sk.custom && removeSkill(sk.id)}>
                              {sk.custom ? "✕" : ""}
                            </span>
                          </div>
                          {memoOpen && (
                            <textarea
                              className="coc-skill-memo"
                              placeholder={`${sk.name} 메모 (판정 결과, 습득 경위 등)`}
                              value={sk.memo}
                              onChange={(e) => setSkillMemo(sk.id, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-[#5b5b4f] leading-relaxed mt-1.5">
                ☑ 체크 = 직업 기능 · 미체크 = 관심 기능. 배분 칸에 추가로 넣을 점수를 입력하면 <b className="text-[#7a3131]">합계</b>가 자동 계산돼.
                언어(모국어)는 교육치, 회피는 민첩성/2 를 기본치로 자동 반영해. 📝 아이콘을 눌러 기능별 메모를 남길 수 있어.
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
              <div className="coc-log-list overflow-y-auto flex flex-col gap-2 pr-1">
                {log.length === 0 && <div className="text-[#e8e1c9]/35 text-xs text-center py-5 font-mono">아직 굴려진 주사위가 없다…</div>}
                {[...log].reverse().map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`rounded-r px-2.5 py-1.5 text-xs ${idx === 0 ? "coc-log-entry-new" : ""}`}
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

      {notionOpen && (
        <div className="coc-modal-overlay" onClick={() => setNotionOpen(false)}>
          <div className="coc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="coc-modal-head">
              <span className="font-serif text-sm tracking-wide">노션 연동 설정</span>
              <button className="coc-modal-close" onClick={() => setNotionOpen(false)}>✕</button>
            </div>
            <div className="coc-modal-body">
              <div className="text-[11.5px] leading-relaxed">
                노션 데이터베이스를 이 시트의 외부 저장소로 사용해. 캐릭터 정보를 노션 페이지 하나로 저장하고,
                필요할 때 다시 불러올 수 있어.{" "}
                <span className="text-[#7a3131] font-bold cursor-pointer underline" onClick={() => setNotionReqOpen(true)}>
                  → 데이터베이스 필수 요건 보기
                </span>
              </div>
              <Field label="노션 연동(Integration) 키">
                <input
                  className="coc-input"
                  type="password"
                  placeholder="secret_..."
                  value={notion.apiKey}
                  onChange={(e) => setNotion({ ...notion, apiKey: e.target.value })}
                />
              </Field>
              <Field label="데이터베이스 ID">
                <input
                  className="coc-input"
                  placeholder="32자리 ID (데이터베이스 URL에서 확인)"
                  value={notion.databaseId}
                  onChange={(e) => setNotion({ ...notion, databaseId: e.target.value })}
                />
              </Field>
              <Field label="제목(Title) 속성 이름">
                <input
                  className="coc-input"
                  value={notion.titleProp}
                  onChange={(e) => setNotion({ ...notion, titleProp: e.target.value })}
                />
              </Field>
              <button className="coc-roll-btn" onClick={syncToNotion}>
                {notionStatus.state === "busy" ? "동기화 중…" : "지금 노션에 저장"}
              </button>
              {notionStatus.msg && (
                <div
                  className="text-[11px] p-2 rounded"
                  style={{
                    background: notionStatus.state === "error" ? "rgba(122,49,49,0.12)" : "rgba(92,122,82,0.15)",
                    color: notionStatus.state === "error" ? "#7a3131" : "#3e5638",
                  }}
                >
                  {notionStatus.msg}
                </div>
              )}
              <div className="text-[10.5px] text-[#5b5b4f] leading-relaxed">
                참고: 이 시트가 별도 서버 없이 브라우저에서만 동작하는 경우, 노션 API 특유의 CORS 정책 때문에
                직접 호출이 막힐 수 있어. 그럴 땐 이 저장 요청을 그대로 전달해주는 작은 프록시(예: Cloudflare
                Worker, Vercel 서버리스 함수)를 하나 두면 해결돼.
              </div>
            </div>
          </div>
        </div>
      )}

      {notionReqOpen && (
        <div className="coc-modal-overlay" onClick={() => setNotionReqOpen(false)}>
          <div className="coc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="coc-modal-head">
              <span className="font-serif text-sm tracking-wide">노션 데이터베이스 필수 요건</span>
              <button className="coc-modal-close" onClick={() => setNotionReqOpen(false)}>✕</button>
            </div>
            <div className="coc-modal-body">
              <div className="text-[11.5px] leading-relaxed">
                <b>완전히 빈 데이터베이스로는 동기화가 안 돼.</b> 노션 API는 데이터베이스 스키마에 이미 존재하는
                속성에만 값을 넣을 수 있어서, 아래 속성들을 미리 만들어 둬야 해. (제목 속성은 모든 데이터베이스에
                기본으로 있으니 이름만 맞춰주면 돼.)
              </div>
              <table className="coc-req-table">
                <thead>
                  <tr><th>속성 이름</th><th>속성 유형</th><th>비고</th></tr>
                </thead>
                <tbody>
                  {NOTION_REQUIRED_PROPS.map((p) => (
                    <tr key={p.name}>
                      <td className="font-mono">{p.name}</td>
                      <td>{p.type}</td>
                      <td className="text-[#5b5b4f]">{p.note || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[11px] text-[#5b5b4f] leading-relaxed">
                이 연동(Integration)을 대상 데이터베이스에 "연결(Connect)"해두는 것도 잊지 마 — 노션 설정 화면
                우측 상단 ⋯ 메뉴에서 연결할 수 있어.
              </div>
              <button className="coc-roll-btn" onClick={() => setNotionReqOpen(false)}>
                확인했어
              </button>
            </div>
          </div>
        </div>
      )}

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

function Card({ title, tag, action, children }) {
  return (
    <section className="rounded-md overflow-hidden" style={{ background: "linear-gradient(180deg, #e8e1c9, #dcd3b4)", boxShadow: "0 10px 30px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(20,20,15,0.08)" }}>
      <div className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ background: "linear-gradient(180deg, #232823, #171c17)", color: "#e8e1c9" }}>
        <span className="font-serif text-[15px] tracking-wide">{title}</span>
        <div className="flex items-center gap-2">
          {action}
          <span className="font-mono text-[10px] text-[#8faa5c] tracking-widest opacity-85">{tag}</span>
        </div>
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
