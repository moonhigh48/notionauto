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

const INTERPERSONAL_SKILLS = ["말재주", "매혹", "설득", "위협"];

// 직업 리스트 (첨부해준 문서 기준으로 재구성).
// skills 항목 표기법:
//   "이름"                    -> 고정 기능 1개 (없으면 사용자 지정 기능으로 자동 생성)
//   { and:[...] }             -> 나열된 기능 전부 필수
//   { choice:[...], count }   -> 나열된 것 중 count개(기본 1개) 선택 (선택창 표시)
//   { interpersonal: n }      -> 대인 관계 기능(말재주/매혹/설득/위협) 중 n개 선택
//   { freeText: "안내문" }    -> 직접 기능 이름을 입력 (예술/공예 등 '선택' 항목)
const OCCUPATIONS = [
  {
    name: "간호사", formula: (a) => a.EDU * 4, formulaLabel: "교육×4", wealth: [9, 30],
    skills: [{ and: ["과학(생물학)", "과학(화학)"] }, "관찰력", { interpersonal: 1 }, "듣기", "심리학", "응급처치", "의료"],
  },
  {
    name: "고고학자", formula: (a) => a.EDU * 4, formulaLabel: "교육×4", wealth: [10, 40],
    skills: ["감정", "고고학", { choice: ["과학(물리학)", "과학(지질학)", "과학(화학)", "항법"], label: "과학 분야 또는 항법 중 하나 선택" }, "관찰력", "기계수리", "언어(외국어)", "역사", "자료조사"],
  },
  {
    name: "골동품 연구가", formula: (a) => a.EDU * 4, formulaLabel: "교육×4", wealth: [30, 70],
    skills: ["감정", "관찰력", { interpersonal: 1 }, "언어(외국어)", "역사", { freeText: "예술/공예 분야를 입력해줘 (예: 회화, 도자기 등)" }, "자료조사"],
  },
  {
    name: "교수", formula: (a) => a.EDU * 4, formulaLabel: "교육×4", wealth: [20, 70],
    skills: ["심리학", "언어(모국어)", "언어(외국어)", "자료조사"],
  },
  {
    name: "기자", formula: (a) => a.EDU * 4, formulaLabel: "교육×4", wealth: [9, 30],
    subs: [
      { name: "탐사기자", skills: [{ interpersonal: 1 }, "심리학", "언어(모국어)", "역사", { choice: ["예술/공예(미술)", "예술/공예(사진)"], label: "예술/공예: 미술 또는 사진" }, "자료조사"] },
      { name: "리포터", skills: ["관찰력", { interpersonal: 1 }, "듣기", "심리학", "언어(모국어)", "역사", "예술/공예(연기)", "은밀행동"] },
    ],
  },
  {
    name: "딜레탕트", formula: (a) => a.EDU * 2 + a.APP * 2, formulaLabel: "교육×2+외모×2", wealth: [50, 99],
    skills: [{ interpersonal: 1 }, { choice: ["사격(권총)", "사격(라이플/산탄총)"], label: "사격 종류 선택" }, "승마", "언어(외국어)", { freeText: "예술/공예 분야를 입력해줘 (예: 회화, 조각 등)" }],
  },
  {
    name: "범죄자",
    subs: [
      {
        name: "건달", formula: (a) => a.EDU * 2 + Math.max(a.STR, a.DEX) * 2, formulaLabel: "교육×2+(근력×2 또는 민첩성×2)", wealth: [3, 10],
        skills: ["근접전(격투)", { interpersonal: 1 }, "도약", { choice: ["사격(권총)", "사격(라이플/산탄총)"], label: "사격 종류 선택" }, "손놀림", "오르기", "은밀행동", "투척"],
      },
      {
        name: "건 몰 (고전)", formula: (a) => a.EDU * 2 + a.APP * 2, formulaLabel: "교육×2+외모×2", wealth: [10, 80],
        skills: [{ choice: ["근접전(격투)", "사격(권총)"], label: "근접전(격투) 또는 사격(권총)" }, { interpersonal: 2 }, "듣기", { freeText: "예술/공예 분야를 입력해줘" }, "은밀행동", "자동차 운전"],
      },
      {
        name: "단독/프리랜스 범죄자", formula: (a) => a.EDU * 2 + Math.max(a.DEX, a.APP) * 2, formulaLabel: "교육×2+(민첩성×2 또는 외모×2)", wealth: [5, 65],
        skills: ["감정", "관찰력", { choice: ["근접전(격투)", "사격(권총)", "사격(라이플/산탄총)"], label: "근접전 또는 사격 종류 선택" }, { choice: ["기계수리", "열쇠공"], label: "기계수리 또는 열쇠공" }, { interpersonal: 1 }, { choice: ["변장", "예술/공예(연기)"], label: "변장 또는 예술/공예(연기)" }, "심리학", "은밀행동"],
      },
      {
        name: "도둑", formula: (a) => a.EDU * 2 + a.DEX * 2, formulaLabel: "교육×2+민첩성×2", wealth: [5, 40],
        skills: ["감정", "관찰력", { choice: ["기계수리", "전기수리"], label: "기계수리 또는 전기수리" }, "듣기", "손놀림", "열쇠공", "오르기", "은밀행동"],
      },
    ],
  },
  {
    name: "사서", formula: (a) => a.EDU * 4, formulaLabel: "교육×4", wealth: [9, 35],
    skills: ["언어(모국어)", "언어(외국어)", "자료조사", "회계"],
  },
  {
    name: "신비학자", formula: (a) => a.EDU * 4, formulaLabel: "교육×4", wealth: [9, 65],
    skills: ["과학(천문학)", { interpersonal: 1 }, "언어(외국어)", "역사", "오컬트", "인류학", "자료조사"],
    note: "수호자가 동의하면 크툴루 신화를 선택할 수 있으나 최대 수치는 10%로 제한돼.",
  },
  {
    name: "의사", formula: (a) => a.EDU * 4, formulaLabel: "교육×4", wealth: [30, 80],
    skills: [{ and: ["과학(생물학)", "과학(약학)"] }, "심리학", "언어(라틴어)", "응급처치", "의료"],
  },
  {
    name: "인부", formula: (a) => a.EDU * 2 + Math.max(a.STR, a.DEX) * 2, formulaLabel: "교육×2+(근력×2 또는 민첩성×2)", wealth: [9, 30],
    subs: [
      { name: "광부", skills: ["과학(지질학)", "관찰력", "기계수리", "도약", "오르기", "은밀행동", "중장비 조작"] },
      { name: "벌목꾼", skills: [{ choice: ["과학(생물학)", "과학(식물학)", "자연"], label: "과학(생물학/식물학) 또는 자연 중 선택" }, "근접전(동력톱)", "기계수리", "도약", "오르기", "응급처치", "투척", "회피"] },
      { name: "비숙련공", skills: ["근접전(격투)", "기계수리", "응급처치", "자동차 운전", "전기수리", "중장비 조작", "투척"] },
    ],
  },
  {
    name: "작가", formula: (a) => a.EDU * 4, formulaLabel: "교육×4", wealth: [9, 30],
    skills: ["심리학", "언어(모국어)", "언어(외국어)", "역사", "예술/공예(문학)", { choice: ["오컬트", "자연"], label: "오컬트 또는 자연" }, "자료조사"],
  },
  {
    name: "형사/경관", formula: (a) => a.EDU * 2 + Math.max(a.STR, a.DEX) * 2, formulaLabel: "교육×2+(근력×2 또는 민첩성×2)",
    subs: [
      {
        name: "형사", wealth: [20, 50],
        skills: ["관찰력", { interpersonal: 1 }, "듣기", { choice: ["사격(권총)", "사격(라이플/산탄총)"], label: "사격 종류 선택" }, "법률", { choice: ["변장", "예술/공예(연기)"], label: "변장 또는 예술/공예(연기)" }, "심리학"],
      },
      {
        name: "경관", wealth: [9, 30],
        skills: ["관찰력", "근접전(격투)", { interpersonal: 1 }, "법률", { choice: ["사격(권총)", "사격(라이플/산탄총)"], label: "사격 종류 선택" }, "심리학", "응급처치", { choice: ["승마", "자동차 운전"], label: "승마 또는 자동차 운전" }],
      },
    ],
  },
];

// 노션 동기화: 대상 데이터베이스에 미리 준비돼 있어야 하는 속성 목록.
const NOTION_REQUIRED_PROPS = [
  { name: "이름", type: "제목(Title)", note: "데이터베이스 기본 제목 속성. 이름이 다르면 설정에서 바꿔줘." },
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
  const store = useRef({
    attrs: { STR: 0, CON: 0, DEX: 0, APP: 0, POW: 0, LUK: 0, SIZ: 0, INT: 0, EDU: 0 },
    skills: BASE_SKILLS.map((s, i) => ({
      id: "s" + i,
      name: s[0],
      base: s[1],
      special: s[1] === "EDU" || s[1] === "DEX/2",
      checked: false,
      alloc: 0,
      growth: 0,
      memo: "",
      custom: false,
    })),
  }).current;
  const [, forceRender] = useReducer((x) => x + 1, 0);

  const [info, setInfo] = useState({ name: "", pl: "", occupation: "", gender: "", birthplace: "", residence: "" });

  const [age, setAge] = useState(25);
  const [ageBracket, setAgeBracket] = useState(null);
  const [reduceValues, setReduceValues] = useState({});

  const [poolOcc, setPoolOcc] = useState(0);
  const [poolInt, setPoolInt] = useState(0);
  const [poolGrowth, setPoolGrowth] = useState(0);
  const [skillSearch, setSkillSearch] = useState("");

  const [hpCur, setHpCur] = useState(null);
  const [mpCur, setMpCur] = useState(null);
  const [sanCur, setSanCur] = useState(null);

  const [diceStage, setDiceStage] = useState({ dice: [], rolling: false });
  const [notation, setNotation] = useState("1d100");
  const [log, setLog] = useState([]);
  const busyRef = useRef(false);

  const [openMemoIds, setOpenMemoIds] = useState({});
  const [mode, setMode] = useState("create"); // "create" | "growth"
  const [improvingSkillId, setImprovingSkillId] = useState(null);
  const [occParentName, setOccParentName] = useState("");
  const [occSubName, setOccSubName] = useState("");
  const [choiceModal, setChoiceModal] = useState(null); // { title, options, count, picked, resolve }

  const [notion, setNotion] = useState({
    apiKey: "",        // 사용자가 직접 입력한 노션 API Key
    databaseId: "",    // 사용자가 직접 입력한 데이터베이스 ID
    titleProp: "제목"  // 노션 데이터베이스의 제목 속성 이름
  });
  const [notionOpen, setNotionOpen] = useState(false);
  const [notionReqOpen, setNotionReqOpen] = useState(false);
  const [notionStatus, setNotionStatus] = useState({ state: "idle", msg: "" });
  const [currentPageId, setCurrentPageId] = useState(null);

  // 탐사자 불러오기 서랍(drawer)
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserList, setBrowserList] = useState([]);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState("");
  const [browserSearch, setBrowserSearch] = useState("");

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
    return skillBaseValue(sk) + (parseInt(sk.alloc) || 0) + (parseInt(sk.growth) || 0);
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
      growth: 0,
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

  /* ---------- growth (성장) ---------- */

  async function improveSkill(sk) {
    if (improvingSkillId) return;
    setImprovingSkillId(sk.id);
    const before = skillTotal(sk);
    const res = await animateAndRoll(1, 100, `성장 판정 · ${sk.name} (현재 ${before})`);
    if (res.total > before) {
      const inc = await animateAndRoll(1, 10, `${sk.name} 성장 성공 → 증가량`);
      sk.growth = (sk.growth || 0) + inc.total;
      addLog("성장 판정 결과", `${sk.name} +${inc.total} → ${skillTotal(sk)}`, true);
      forceRender();
    } else {
      addLog("성장 판정 결과", `${sk.name} 변화 없음 (판정 실패, ${res.total} ≤ ${before})`, true);
    }
    setImprovingSkillId(null);
  }

  /* ---------- occupation preset ---------- */

  function ensureSkillExists(name) {
    let sk = store.skills.find((s) => s.name === name);
    if (!sk) {
      sk = { id: "occ-" + Date.now() + "-" + Math.random().toString(36).slice(2), name, base: 0, special: false, checked: false, alloc: 0, growth: 0, memo: "", custom: true };
      store.skills.push(sk);
    }
    return sk;
  }

  function askChoice(title, options, count) {
    return new Promise((resolve) => {
      setChoiceModal({ title, options, count: count || 1, picked: [], resolve });
    });
  }

  function toggleChoicePick(name) {
    setChoiceModal((prev) => {
      if (!prev) return prev;
      let picked;
      if (prev.picked.includes(name)) {
        picked = prev.picked.filter((n) => n !== name);
      } else if (prev.picked.length < prev.count) {
        picked = [...prev.picked, name];
      } else {
        picked = prev.picked;
      }
      return { ...prev, picked };
    });
  }

  function confirmChoice() {
    setChoiceModal((prev) => {
      if (!prev || prev.picked.length !== prev.count) return prev;
      prev.resolve(prev.picked);
      return null;
    });
  }

  function skipChoice() {
    setChoiceModal((prev) => {
      if (!prev) return prev;
      prev.resolve([]);
      return null;
    });
  }

  async function resolveSkillEntries(entries) {
    const names = [];
    for (const entry of entries || []) {
      if (typeof entry === "string") {
        names.push(entry);
      } else if (entry.and) {
        names.push(...entry.and);
      } else if (entry.choice) {
        const picked = await askChoice(entry.label || "기능 선택", entry.choice, entry.count || 1);
        names.push(...picked);
      } else if (entry.interpersonal) {
        const picked = await askChoice("대인 관계 기능 선택", INTERPERSONAL_SKILLS, entry.interpersonal);
        names.push(...picked);
      } else if (entry.freeText) {
        const typed = window.prompt(entry.freeText);
        if (typed && typed.trim()) names.push(typed.trim());
      }
    }
    return names;
  }

  async function applyOccupation(parentName, subName) {
    setOccParentName(parentName);
    if (!parentName) {
      setOccSubName("");
      return;
    }
    const occ = OCCUPATIONS.find((o) => o.name === parentName);
    if (!occ) return;

    if (occ.subs) {
      setOccSubName(subName || "");
      if (!subName) return; // 세부 직업 선택 대기
    }

    const sub = occ.subs ? occ.subs.find((s) => s.name === subName) : null;
    const def = sub ? { ...occ, ...sub } : occ;
    const label = sub ? `${occ.name} · ${sub.name}` : occ.name;

    const names = await resolveSkillEntries(def.skills);

    store.skills.forEach((sk) => {
      sk.checked = false;
    });
    names.slice(0, 8).forEach((n) => {
      ensureSkillExists(n).checked = true;
    });

    const pts = def.formula ? def.formula(store.attrs) : 0;
    setPoolOcc(pts || 0);
    // 관심 기능 점수는 직업과 무관하게 항상 교육×2
    setPoolInt(store.attrs.EDU * 2);
    setInfo((prev) => ({ ...prev, occupation: label }));

    let detail = `${label} · 직업 기능 점수 ${def.formulaLabel || ""} = ${pts} · 관심 기능 점수(교육×2) = ${store.attrs.EDU * 2}`;
    if (def.wealth) {
      ensureSkillExists("재력").alloc = def.wealth[0];
      detail += ` · 재력 범위 ${def.wealth[0]}~${def.wealth[1]} (일단 최소값 적용, 범위 내에서 직접 조정해줘)`;
    }
    addLog("직업 프리셋 적용", detail, true);
    if (occ.note) addLog("참고", occ.note, true);
    forceRender();
  }

  /* ---------- notion sync (via Cloudflare Worker proxy) ---------- */

  function buildNotionProperties() {
    const skillDump = store.skills
      .filter((sk) => sk.checked || (parseInt(sk.alloc) || 0) > 0 || (parseInt(sk.growth) || 0) > 0 || sk.memo)
      .map((sk) => ({ 이름: sk.name, 직업기능: sk.checked, 합계: skillTotal(sk), 배분: sk.alloc || 0, 성장: sk.growth || 0, 메모: sk.memo || "" }));
    return {
      [notion.titleProp || "이름"]: { title: [{ text: { content: info.name || "이름 없는 탐사자" } }] },
      "직업": { rich_text: [{ text: { content: info.occupation || "" } }] },
      "나이": { number: age || 0 },
      "HP": { number: hpCur ?? hpMax },
      "MP": { number: mpCur ?? mpMax },
      "SAN": { number: sanCur ?? store.attrs.POW },
      "특성치": { rich_text: [{ text: { content: JSON.stringify({ attrs: store.attrs, info, pools: { poolOcc, poolInt, poolGrowth } }) } }] },
      "기능치": { rich_text: [{ text: { content: JSON.stringify(skillDump).slice(0, 1900) } }] },
      "최종 동기화": { date: { start: new Date().toISOString() } },
    };
  }

  async function syncToNotion() {
    if (!notion.apiKey || !notion.databaseId) {
      setNotionStatus({ state: "error", msg: "API Key와 데이터베이스 ID를 입력해줘." });
      return;
    }
    setNotionStatus({ state: "busy", msg: "동기화 중…" });
    try {
      // 우리가 만든 Next.js API Route로 요청 전송
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: notion.apiKey,
          databaseId: notion.databaseId,
          pageId: currentPageId || null, // 수정 시 pageId 전달, 신규 생성 시 null
          properties: buildNotionProperties(), // 기존에 작성하신 속성 생성 함수
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "동기화 실패");
      }
      setCurrentPageId(data.pageId);
      setNotionStatus({ state: "ok", msg: isUpdate ? "노션 페이지를 갱신했어." : "노션에 새 탐사자로 저장했어." });
      addLog("노션 동기화", isUpdate ? "기존 탐사자 정보를 갱신함" : "새 탐사자로 노션에 저장함", true);
    } catch (e) {
      setNotionStatus({
        state: "error",
        msg: `동기화 실패: ${e.message}. 데이터베이스가 이 연동에 "연결(Connect)"돼 있는지 확인해줘.`,
      });
    }
  }

  function startNewCharacterLink() {
    setCurrentPageId(null);
    setNotionStatus({ state: "idle", msg: "" });
    addLog("노션 연동 해제", "다음 저장부터는 새 탐사자로 생성돼", true);
  }

  async function loadNotionList() {
    if (!notion.apiKey || !notion.databaseId) {
      setBrowserError("먼저 ⚙ 노션 연동에서 데이터베이스 ID를 설정해줘.");
      return;
    }
    setBrowserLoading(true);
    setBrowserError("");
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "query", apiKey: notion.apiKey,databaseId: notion.databaseId, page_size: 50 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      const titleProp = notion.titleProp || "이름";
      const list = (data.results || []).map((page) => {
        const props = page.properties || {};
        const nameArr = props[titleProp]?.title || [];
        const name = nameArr.map((t) => t.plain_text).join("") || "이름 없음";
        const occ = props["직업"]?.rich_text?.map((t) => t.plain_text).join("") || "";
        const ageVal = props["나이"]?.number ?? "";
        return { id: page.id, name, occupation: occ, age: ageVal, editedAt: page.last_edited_time };
      });
      setBrowserList(list);
    } catch (e) {
      setBrowserError(`목록을 불러오지 못했어: ${e.message}`);
    } finally {
      setBrowserLoading(false);
    }
  }

  async function loadCharacterFromNotion(pageId) {
    setBrowserLoading(true);
    setBrowserError("");
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getPage", apiKey: notion.apiKey, pageId }),
      });
      const page = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(page?.error || page?.message || `HTTP ${res.status}`);
      const props = page.properties || {};
      const titleProp = notion.titleProp || "이름";
      const name = (props[titleProp]?.title || []).map((t) => t.plain_text).join("");
      const occupation = (props["직업"]?.rich_text || []).map((t) => t.plain_text).join("");
      const ageVal = props["나이"]?.number ?? 25;
      const rawAttrs = (props["특성치"]?.rich_text || []).map((t) => t.plain_text).join("");
      const rawSkills = (props["기능치"]?.rich_text || []).map((t) => t.plain_text).join("");

      let parsedAttrs = null,
        parsedInfo = null,
        parsedPools = null;
      try {
        const j = JSON.parse(rawAttrs);
        parsedAttrs = j.attrs || j;
        parsedInfo = j.info || null;
        parsedPools = j.pools || null;
      } catch (e) {}
      let parsedSkills = [];
      try {
        parsedSkills = JSON.parse(rawSkills);
      } catch (e) {}

      if (parsedAttrs) Object.assign(store.attrs, parsedAttrs);
      store.skills.forEach((sk) => {
        const found = parsedSkills.find((p) => p.이름 === sk.name);
        sk.checked = found ? !!found.직업기능 : false;
        sk.alloc = found ? found.배분 || 0 : 0;
        sk.growth = found ? found.성장 || 0 : 0;
        sk.memo = found ? found.메모 || "" : "";
      });
      setInfo({
        name,
        occupation,
        pl: parsedInfo?.pl || "",
        gender: parsedInfo?.gender || "",
        birthplace: parsedInfo?.birthplace || "",
        residence: parsedInfo?.residence || "",
      });
      setAge(ageVal || 25);
      if (parsedPools) {
        setPoolOcc(parsedPools.poolOcc || 0);
        setPoolInt(parsedPools.poolInt || 0);
        setPoolGrowth(parsedPools.poolGrowth || 0);
      }
      setHpCur(props["HP"]?.number ?? null);
      setMpCur(props["MP"]?.number ?? null);
      setSanCur(props["SAN"]?.number ?? null);
      setCurrentPageId(pageId);
      setOccPreset("");
      forceRender();
      addLog("탐사자 불러오기", `"${name}" 정보를 노션에서 불러옴`, true);
      setBrowserOpen(false);
    } catch (e) {
      setBrowserError(`불러오기 실패: ${e.message}`);
    } finally {
      setBrowserLoading(false);
    }
  }

  let occUsed = 0,
    intUsed = 0;
  store.skills.forEach((sk) => {
    if (sk.name === "재력") return; // 재력은 별도 범위 배분이라 직업/관심 점수 풀에서 제외
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

  const latestLogId = log.length ? log[log.length - 1].id : null;

  return (
    <div className="app">
      <style>{`
:root{
  --void:#0c0f0d;
  --void-2:#121613;
  --panel:#e8e1c9;
  --panel-2:#dcd3b4;
  --ink:#1c1a13;
  --moss:#5c7a52;
  --moss-dim:#3e5638;
  --sick:#8faa5c;
  --blood:#7a3131;
  --blood-bright:#a84343;
  --gold:#a5883f;
  --line: rgba(20,20,15,0.18);
  --font-display: Georgia, 'Nanum Myeongjo', 'Noto Serif KR', serif;
  --font-body: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
  --font-mono: 'Consolas', monospace;
}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{
  background:
    radial-gradient(ellipse at 20% -10%, rgba(92,122,82,0.12), transparent 45%),
    radial-gradient(ellipse at 90% 10%, rgba(122,49,49,0.10), transparent 40%),
    var(--void);
  color:var(--panel);
  font-family:var(--font-body);
  min-height:100vh;
}
.app{max-width:1400px;margin:0 auto;padding:28px 20px 80px;}

.masthead{
  text-align:center;
  padding:18px 0 26px;
  border-bottom:1px solid rgba(232,225,201,0.15);
  margin-bottom:26px;
  position:relative;
}
.masthead .eyebrow{
  font-family:var(--font-mono);
  letter-spacing:0.35em;
  font-size:11px;
  color:var(--sick);
  text-transform:uppercase;
  opacity:0.8;
}
.masthead h1{
  font-family:var(--font-display);
  font-size:36px;
  letter-spacing:0.06em;
  margin:8px 0 6px;
  color:var(--panel);
  text-shadow:0 0 24px rgba(143,170,92,0.25);
}
.masthead .sub{
  font-size:13px;
  color:rgba(232,225,201,0.55);
  letter-spacing:0.02em;
}
.tentacle-rule{
  width:120px;height:10px;margin:14px auto 0;
  opacity:0.55;
}

.layout{
  display:grid;
  grid-template-columns: 1fr 360px;
  gap:22px;
  align-items:start;
}
@media (max-width: 980px){
  .layout{grid-template-columns:1fr;}
  aside.dice-panel{position:static !important;}
}

main{display:flex;flex-direction:column;gap:20px;}

.card{
  background:linear-gradient(180deg, var(--panel), var(--panel-2));
  color:var(--ink);
  border-radius:6px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(20,20,15,0.08);
  overflow:hidden;
}
.card-head{
  background:linear-gradient(180deg, #232823, #171c17);
  color:var(--panel);
  padding:10px 16px;
  font-family:var(--font-display);
  font-size:15px;
  letter-spacing:0.08em;
  display:flex;
  align-items:center;
  justify-content:space-between;
}
.card-head .tag{
  font-family:var(--font-mono);
  font-size:10px;
  color:var(--sick);
  letter-spacing:0.15em;
  opacity:0.85;
}
.card-body{padding:16px;}

/* ---- form grid ---- */
.grid{display:grid;gap:10px;}
.grid.cols-2{grid-template-columns:1fr 1fr;}
.grid.cols-3{grid-template-columns:1fr 1fr 1fr;}
.grid.cols-4{grid-template-columns:1fr 1fr 1fr 1fr;}
@media (max-width:640px){ .grid.cols-3,.grid.cols-4{grid-template-columns:1fr 1fr;} }

.field label{
  display:block;font-size:11px;color:var(--ink);opacity:0.65;
  margin-bottom:3px;letter-spacing:0.03em;
}
.field input[type=text], .field input[type=number], .field select{
  width:100%;
  padding:7px 8px;
  border:1px solid rgba(20,20,15,0.25);
  border-radius:3px;
  background:#fbf8ee;
  font-family:var(--font-body);
  font-size:13px;
  color:var(--ink);
}
.field input:focus, .field select:focus{outline:2px solid var(--moss);outline-offset:1px;}

/* ---- attributes ---- */
.attr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
@media (max-width:640px){ .attr-grid{grid-template-columns:repeat(2,1fr);} }
.attr-box{
  background:#fbf8ee;
  border:1px solid rgba(20,20,15,0.2);
  border-radius:4px;
  padding:8px 10px;
}
.attr-box .attr-name{
  font-family:var(--font-display);
  font-weight:bold;
  font-size:13px;
  display:flex;justify-content:space-between;align-items:center;
  margin-bottom:6px;
}
.attr-box .attr-name small{font-family:var(--font-mono);font-size:9px;color:#6b6b5e;}
.attr-values{display:flex;gap:6px;align-items:center;}
.attr-values input{
  width:56px;text-align:center;font-weight:bold;font-size:16px;
  padding:5px 2px;border:1px solid rgba(20,20,15,0.25);border-radius:3px;background:#fff;color:var(--ink);
}
.attr-sub{display:flex;flex-direction:column;font-family:var(--font-mono);font-size:10px;color:#5c5c50;gap:2px;}
.roll-btn{
  border:none;cursor:pointer;
  background:var(--moss-dim);
  color:#eef3e6;
  font-family:var(--font-mono);
  font-size:10px;
  letter-spacing:0.05em;
  padding:6px 8px;
  border-radius:3px;
  transition:background .15s, transform .1s;
}
.roll-btn:hover{background:var(--moss);}
.roll-btn:active{transform:scale(0.96);}
.roll-btn.small{padding:4px 7px;font-size:9px;}
.roll-btn.blood{background:var(--blood);}
.roll-btn.blood:hover{background:var(--blood-bright);}
.roll-btn:disabled{opacity:0.4;cursor:not-allowed;}

.note{font-size:11px;color:#5b5b4f;line-height:1.5;margin-top:6px;}
.note b{color:var(--blood);}

/* ---- age panel ---- */
.age-adjust-box{
  margin-top:12px;padding:12px;
  background:rgba(122,49,49,0.06);
  border:1px dashed rgba(122,49,49,0.35);
  border-radius:4px;
  font-size:12px;
}
.age-adjust-box h4{margin:0 0 8px;font-family:var(--font-display);font-size:13px;color:var(--blood);}
.row-inline{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px;}
.row-inline label{font-size:11px;}
.row-inline input[type=number]{width:64px;padding:5px;border:1px solid rgba(20,20,15,0.25);border-radius:3px;}
.pill{
  font-family:var(--font-mono);font-size:10px;padding:2px 8px;border-radius:20px;
  background:var(--moss-dim);color:#eef3e6;
}
.pill.warn{background:var(--blood);}

/* ---- derived stats ---- */
.derived-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;}
@media (max-width:900px){ .derived-grid{grid-template-columns:repeat(3,1fr);} }
@media (max-width:640px){ .derived-grid{grid-template-columns:repeat(2,1fr);} }
.derived-box{
  background:#fbf8ee;border:1px solid rgba(20,20,15,0.2);border-radius:4px;
  padding:8px 10px;text-align:center;
}
.derived-box .dname{font-family:var(--font-mono);font-size:9px;letter-spacing:0.1em;color:#6b6b5e;text-transform:uppercase;}
.derived-box .dval{font-family:var(--font-display);font-size:18px;font-weight:bold;margin-top:3px;}
.derived-box .dval input{width:44px;text-align:center;border:none;background:transparent;font-family:var(--font-display);font-size:18px;font-weight:bold;color:var(--ink);}
.derived-box .dsub{font-size:10px;color:#8a8a7a;}

/* ---- skills ---- */
.pool-bar{
  display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;
}
@media (max-width:700px){ .pool-bar{grid-template-columns:repeat(2,1fr);} }
.pool-box{background:#fbf8ee;border:1px solid rgba(20,20,15,0.2);border-radius:4px;padding:8px 10px;}
.pool-box label{font-size:10px;color:#6b6b5e;display:block;margin-bottom:4px;}
.pool-box input{width:100%;border:none;background:transparent;font-family:var(--font-display);font-size:17px;font-weight:bold;color:var(--ink);}
.pool-box.remain{background:rgba(92,122,82,0.12);}
.pool-box.remain.negative{background:rgba(122,49,49,0.15);}
.pool-box.remain .rval{font-family:var(--font-display);font-size:17px;font-weight:bold;}

.skill-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:10px;flex-wrap:wrap;}
.skill-toolbar .search input{
  padding:6px 10px;border:1px solid rgba(20,20,15,0.25);border-radius:20px;font-size:12px;width:200px;background:#fbf8ee;
}
.add-skill-btn{
  background:var(--gold);color:#2a2410;border:none;padding:6px 12px;border-radius:20px;font-size:11px;cursor:pointer;font-family:var(--font-mono);
}
.skills-columns{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 18px;}
@media (max-width:900px){ .skills-columns{grid-template-columns:1fr;} }

.skill-row{
  display:grid;
  grid-template-columns: 20px 1fr 30px 44px 26px 26px 26px 20px;
  gap:5px;align-items:center;
  padding:4px 2px;
  border-bottom:1px solid rgba(20,20,15,0.08);
  font-size:11.5px;
}
.skill-row .sname{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.skill-row .sbase{color:#7a7a6a;font-family:var(--font-mono);font-size:10px;text-align:right;}
.skill-row input[type=checkbox]{accent-color:var(--moss);width:14px;height:14px;}
.skill-row input.alloc{
  width:100%;padding:3px 2px;text-align:center;border:1px solid rgba(20,20,15,0.2);border-radius:3px;background:#fff;font-size:11px;
}
.skill-row .stot,.skill-row .shalf,.skill-row .sfifth{
  text-align:center;font-family:var(--font-mono);font-size:10.5px;background:#f1ecda;border-radius:3px;padding:3px 0;
}
.skill-row .stot{font-weight:bold;}
.skill-row .sdel{cursor:pointer;color:var(--blood);text-align:center;font-size:12px;opacity:0.5;}
.skill-row .sdel:hover{opacity:1;}
.skill-header{
  display:grid;grid-template-columns: 20px 1fr 30px 44px 26px 26px 26px 20px;gap:5px;
  font-family:var(--font-mono);font-size:9px;color:#6b6b5e;letter-spacing:0.05em;
  padding:2px 2px 6px;border-bottom:1px solid rgba(20,20,15,0.25);
  text-align:center;
}
.skill-header span:nth-child(2){text-align:left;}

/* ---- dice panel ---- */
aside.dice-panel{
  position:sticky;top:20px;
  display:flex;flex-direction:column;gap:16px;
}
.roller-card{
  background:linear-gradient(180deg,#171c17,#0e120e);
  border-radius:6px;
  box-shadow:0 10px 30px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(143,170,92,0.15);
  padding:18px;
}
.roller-card h3{
  font-family:var(--font-display);font-size:14px;letter-spacing:0.08em;margin:0 0 12px;
  color:var(--sick);text-align:center;
}
.dice-stage{
  height:120px;
  display:flex;align-items:center;justify-content:center;gap:26px;
  margin-bottom:12px;
  perspective:600px;
}
.die3d{
  width:52px;height:52px;
  position:relative;
  transform-style:preserve-3d;
  transform:rotateX(-18deg) rotateY(24deg);
}
.die3d .face{
  position:absolute;inset:0;
  width:52px;height:52px;
  background:linear-gradient(145deg,#f2ecd6,#c9c09a);
  border:1px solid rgba(20,20,15,0.35);
  border-radius:8px;
  display:flex;align-items:center;justify-content:center;
  font-family:var(--font-display);font-weight:bold;font-size:20px;color:var(--ink);
  box-shadow:inset 0 0 10px rgba(0,0,0,0.18);
  backface-visibility:hidden;
}
.die3d .f-front{ transform:translateZ(26px); }
.die3d .f-back{ transform:rotateY(180deg) translateZ(26px); }
.die3d .f-right{ transform:rotateY(90deg) translateZ(26px); }
.die3d .f-left{ transform:rotateY(-90deg) translateZ(26px); }
.die3d .f-top{ transform:rotateX(90deg) translateZ(26px); }
.die3d .f-bottom{ transform:rotateX(-90deg) translateZ(26px); }
.die3d.rolling{ animation:die-tumble .55s linear infinite; }
.die3d.landed{ transition:transform .5s cubic-bezier(.2,.8,.3,1); transform:rotateX(-18deg) rotateY(24deg); }
@keyframes die-tumble{
  0%{ transform:rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
  100%{ transform:rotateX(360deg) rotateY(720deg) rotateZ(180deg); }
}
.dice-input-row{display:flex;gap:8px;margin-bottom:8px;}
.dice-input-row input{
  flex:1;padding:8px 10px;border-radius:4px;border:1px solid rgba(143,170,92,0.35);
  background:#0b0f0b;color:var(--panel);font-family:var(--font-mono);font-size:14px;text-align:center;
}
.dice-input-row button{
  padding:8px 16px;border:none;border-radius:4px;background:var(--moss);color:#0e120e;font-weight:bold;
  cursor:pointer;font-family:var(--font-mono);font-size:12px;
}
.dice-input-row button:hover{background:var(--sick);}
.quick-dice{display:flex;flex-wrap:wrap;gap:6px;}
.quick-dice button{
  flex:1;min-width:44px;padding:6px 4px;background:rgba(143,170,92,0.12);border:1px solid rgba(143,170,92,0.3);
  color:var(--sick);border-radius:4px;font-family:var(--font-mono);font-size:11px;cursor:pointer;
}
.quick-dice button:hover{background:rgba(143,170,92,0.25);}

.log-card{
  background:linear-gradient(180deg,#171c17,#0e120e);
  border-radius:6px;
  box-shadow:0 10px 30px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(143,170,92,0.1);
  padding:16px;
  max-height:520px;display:flex;flex-direction:column;
}
.log-card h3{font-family:var(--font-display);font-size:14px;color:var(--sick);margin:0 0 10px;letter-spacing:0.06em;}
.log-list{overflow-y:auto;display:flex;flex-direction:column-reverse;gap:8px;padding-right:4px;}
.log-entry{
  border-left:2px solid var(--moss);
  padding:6px 10px;
  background:rgba(232,225,201,0.04);
  border-radius:0 4px 4px 0;
  font-size:12px;
}
.log-entry .lhead{display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:10px;color:var(--sick);margin-bottom:2px;}
.log-entry .lbody{color:var(--panel);}
.log-entry .ltotal{font-weight:bold;color:var(--gold);}
.log-entry.event{border-left-color:var(--blood);}
.log-entry.event .lhead{color:var(--blood-bright);}
.log-empty{color:rgba(232,225,201,0.35);font-size:12px;text-align:center;padding:20px 0;font-family:var(--font-mono);}

.footer-note{
  text-align:center;color:rgba(232,225,201,0.3);font-size:11px;margin-top:30px;font-family:var(--font-mono);
}

/* ---- .field 내부의 모든 input/select/textarea 기본 스타일 (password 등 타입 무관 포함) ---- */
.field input, .field select, .field textarea{
  width:100%; padding:7px 8px; border:1px solid rgba(20,20,15,0.25); border-radius:3px;
  background:#fbf8ee; font-family:var(--font-body); font-size:13px; color:var(--ink);
}

*{ scrollbar-width:thin; scrollbar-color: var(--moss) var(--void-2); }
*::-webkit-scrollbar{ width:9px; height:9px; }
*::-webkit-scrollbar-track{ background: var(--void-2); border-radius:8px; }
*::-webkit-scrollbar-thumb{
  background: linear-gradient(180deg, var(--sick), var(--moss-dim));
  border-radius:8px;
  border:2px solid var(--void-2);
}
*::-webkit-scrollbar-thumb:hover{ background: var(--sick); }

/* ---- 기능 행: 메모 컬럼 추가 (8칸 -> 9칸) ---- */
.skill-row{ grid-template-columns: 20px 1fr 30px 44px 26px 26px 26px 18px 20px; }
.skill-header{ grid-template-columns: 20px 1fr 30px 44px 26px 26px 26px 18px 20px; }
.skill-row .smemo{ text-align:center; font-size:12px; cursor:pointer; opacity:0.35; }
.skill-row .smemo:hover{ opacity:1; }
.skill-row .smemo.filled{ opacity:1; color:var(--blood); }
.skill-memo-panel{
  width:100%; margin:2px 0 6px; padding:6px 8px;
  font-size:11px; font-family:var(--font-body); color:var(--ink);
  background:#fbf8ee; border:1px dashed rgba(122,49,49,0.4); border-radius:4px;
  resize:vertical; min-height:38px;
}

/* ---- 로그: 새 항목이 위로 등장하는 애니메이션 ---- */
@keyframes log-in{
  0%{ opacity:0; transform:translateY(-10px) scale(.98); }
  60%{ opacity:1; transform:translateY(1px) scale(1.005); }
  100%{ opacity:1; transform:translateY(0) scale(1); }
}
.log-entry.new-entry{ animation: log-in .38s cubic-bezier(.2,.8,.3,1); }

/* ---- 카드 헤더 액션 버튼 (노션 연동) ---- */
.card-head-actions{ display:flex; align-items:center; gap:8px; }
.notion-btn{
  border:1px solid rgba(143,170,92,0.45);
  background:rgba(143,170,92,0.12);
  color:var(--sick);
  font-family:var(--font-mono);
  font-size:10px; letter-spacing:0.05em;
  padding:4px 10px; border-radius:20px; cursor:pointer;
}
.notion-btn:hover{ background:rgba(143,170,92,0.25); }

/* ---- 직업 프리셋 셀렉트가 grid.cols-3 마지막 줄에서 전체 폭 차지 ---- */
.field.wide{ grid-column: 1 / -1; }

/* ---- 모달 ---- */
.modal-overlay{
  position:fixed; inset:0; background:rgba(6,8,6,0.72);
  display:flex; align-items:center; justify-content:center;
  z-index:50; padding:20px; backdrop-filter:blur(2px);
}
.modal{
  width:min(540px,100%); max-height:86vh; overflow-y:auto;
  background:linear-gradient(180deg, var(--panel), var(--panel-2));
  color:var(--ink); border-radius:6px;
  box-shadow:0 20px 60px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(20,20,15,0.08);
  animation: log-in .25s ease-out;
}
.modal-head{
  background:linear-gradient(180deg,#232823,#171c17); color:var(--panel);
  padding:12px 16px; display:flex; align-items:center; justify-content:space-between;
  position:sticky; top:0; font-family:var(--font-display); font-size:15px; letter-spacing:0.06em;
}
.modal-close{ background:none; border:none; color:var(--panel); opacity:0.6; cursor:pointer; font-size:16px; }
.modal-close:hover{ opacity:1; }
.modal-body{ padding:16px; display:flex; flex-direction:column; gap:12px; font-size:12px; line-height:1.6; }
.modal-body .field{ margin:0; }
.modal-link{ color:var(--blood); font-weight:bold; cursor:pointer; text-decoration:underline; }
.modal-status{ font-size:11px; padding:8px; border-radius:4px; }
.modal-status.err{ background:rgba(122,49,49,0.12); color:var(--blood); }
.modal-status.ok{ background:rgba(92,122,82,0.15); color:var(--moss-dim); }
.modal-hint{ font-size:10.5px; color:#5b5b4f; line-height:1.6; }
.req-table{ width:100%; border-collapse:collapse; font-size:11.5px; }
.req-table th,.req-table td{ border:1px solid rgba(20,20,15,0.2); padding:5px 7px; text-align:left; }
.req-table th{ background:rgba(20,20,15,0.08); font-family:var(--font-mono); font-size:10px; }

/* ---- 햄버거 메뉴 버튼 ---- */
.hamburger-btn{
  position:absolute; top:14px; right:4px;
  width:36px; height:30px; padding:6px 7px;
  display:flex; flex-direction:column; justify-content:space-between;
  background:rgba(143,170,92,0.1); border:1px solid rgba(143,170,92,0.35); border-radius:5px;
  cursor:pointer;
}
.hamburger-btn span{ display:block; height:2px; background:var(--sick); border-radius:2px; }
.hamburger-btn:hover{ background:rgba(143,170,92,0.22); }

/* ---- 탐사자 불러오기 서랍 ---- */
.drawer-overlay{
  position:fixed; inset:0; background:rgba(6,8,6,0.6);
  opacity:0; pointer-events:none; transition:opacity .2s ease; z-index:40;
}
.drawer-overlay.open{ opacity:1; pointer-events:auto; }
.browser-drawer{
  position:fixed; top:0; right:0; height:100vh; width:min(360px,88vw);
  background:linear-gradient(180deg,#171c17,#0e120e); color:var(--panel);
  box-shadow:-14px 0 40px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(143,170,92,0.12);
  transform:translateX(100%); transition:transform .25s cubic-bezier(.2,.8,.3,1);
  z-index:41; display:flex; flex-direction:column;
}
.browser-drawer.open{ transform:translateX(0); }
.drawer-head{
  padding:14px 16px; display:flex; align-items:center; justify-content:space-between;
  font-family:var(--font-display); font-size:15px; letter-spacing:0.06em; color:var(--sick);
  border-bottom:1px solid rgba(143,170,92,0.18);
}
.drawer-body{ padding:14px 16px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; }
.drawer-toolbar{ display:flex; gap:8px; }
.drawer-search{
  flex:1; padding:7px 10px; border-radius:20px; border:1px solid rgba(143,170,92,0.35);
  background:#0b0f0b; color:var(--panel); font-size:12px;
}
.browser-list{ display:flex; flex-direction:column; gap:8px; }
.browser-row{
  padding:9px 11px; border-radius:5px; cursor:pointer;
  background:rgba(232,225,201,0.04); border-left:2px solid var(--moss);
}
.browser-row:hover{ background:rgba(232,225,201,0.09); }
.browser-row.active{ border-left-color:var(--gold); background:rgba(165,136,63,0.12); }
.brow-name{ font-family:var(--font-display); font-size:13.5px; }
.brow-sub{ font-family:var(--font-mono); font-size:10.5px; color:var(--sick); margin-top:2px; }
.brow-time{ font-family:var(--font-mono); font-size:9.5px; color:rgba(232,225,201,0.4); margin-top:3px; }

/* ---- 생성/성장 모드 스위치 ---- */
.mode-switch{ display:flex; border:1px solid rgba(143,170,92,0.4); border-radius:20px; overflow:hidden; }
.mode-btn{
  border:none; background:transparent; color:rgba(232,225,201,0.55);
  font-family:var(--font-mono); font-size:10px; letter-spacing:0.04em;
  padding:4px 10px; cursor:pointer;
}
.mode-btn.active{ background:rgba(143,170,92,0.28); color:var(--sick); }

/* ---- 성장 판정 주사위 아이콘 ---- */
.skill-row .sroll{ text-align:center; font-size:12px; cursor:pointer; opacity:0.55; }
.skill-row .sroll:hover{ opacity:1; }
.skill-row .sroll.busy{ animation: spin .3s linear infinite; opacity:1; }
.skill-row .sroll.disabled{ opacity:0.2; pointer-events:none; }

/* ---- 직업 기능 선택창 ---- */
.choice-grid{ display:flex; flex-wrap:wrap; gap:7px; }
.choice-pill{
  border:1px solid rgba(20,20,15,0.3); background:#fbf8ee; color:var(--ink);
  font-size:12px; padding:6px 12px; border-radius:20px; cursor:pointer;
}
.choice-pill.picked{ background:var(--moss); border-color:var(--moss); color:#f6f3e6; font-weight:bold; }
.roll-btn:disabled{ opacity:0.4; cursor:not-allowed; }

      `}</style>

      <div className="masthead">
        <button
          className="hamburger-btn"
          title="저장된 탐사자 불러오기"
          onClick={() => {
            setBrowserOpen(true);
            loadNotionList();
          }}
        >
          <span></span><span></span><span></span>
        </button>
        <div className="eyebrow">Call of Cthulhu · 7th Edition</div>
        <h1>탐사자 생성 의식</h1>
        <div className="sub">미스카토닉의 서고에서 — 이름 없는 것들을 마주할 자를 빚는다</div>
        <svg className="tentacle-rule" viewBox="0 0 120 10">
          <path d="M0 5 Q20 0 40 5 T80 5 T120 5" stroke="#8faa5c" fill="none" strokeWidth="1.5" />
        </svg>
      </div>

      <div className="layout">
        <main>
          {/* 탐사자 정보 */}
          <Card title="탐사자 정보" tag="INVESTIGATOR" action={
            <button className="notion-btn" onClick={() => setNotionOpen(true)}>⚙ 노션 연동</button>
          }>
            <div className="grid cols-3">
              <Field label="이름"><input type="text" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></Field>
              <Field label="PL"><input type="text" value={info.pl} onChange={(e) => setInfo({ ...info, pl: e.target.value })} /></Field>
              <Field label="직업"><input type="text" value={info.occupation} onChange={(e) => setInfo({ ...info, occupation: e.target.value })} /></Field>
              <Field label="성별"><input type="text" value={info.gender} onChange={(e) => setInfo({ ...info, gender: e.target.value })} /></Field>
              <Field label="출생지"><input type="text" value={info.birthplace} onChange={(e) => setInfo({ ...info, birthplace: e.target.value })} /></Field>
              <Field label="거주지"><input type="text" value={info.residence} onChange={(e) => setInfo({ ...info, residence: e.target.value })} /></Field>
              <Field className="wide" label="직업 프리셋 (선택 시 직업 기능 자동 체크 + 점수 계산)">
                <div className="row-inline" style={{ gap: 8, flexWrap: "nowrap" }}>
                  <select style={{ flex: 1 }} value={occParentName} onChange={(e) => applyOccupation(e.target.value, "")}>
                    <option value="">— 직접 입력 —</option>
                    {OCCUPATIONS.map((o) => (
                      <option key={o.name} value={o.name}>{o.name}{o.formulaLabel ? ` (${o.formulaLabel})` : ""}</option>
                    ))}
                  </select>
                  {occParentName && OCCUPATIONS.find((o) => o.name === occParentName)?.subs && (
                    <select style={{ flex: 1 }} value={occSubName} onChange={(e) => applyOccupation(occParentName, e.target.value)}>
                      <option value="">— 세부 직업 선택 —</option>
                      {OCCUPATIONS.find((o) => o.name === occParentName).subs.map((s) => (
                        <option key={s.name} value={s.name}>{s.name}{s.formulaLabel ? ` (${s.formulaLabel})` : ""}</option>
                      ))}
                    </select>
                  )}
                </div>
              </Field>
            </div>
          </Card>

          {/* 특성치 */}
          <Card title="특성치" tag="CHARACTERISTICS">
            <div className="attr-grid">
              {ATTR_DEFS.map((def) => (
                <div key={def.key} className="attr-box">
                  <div className="attr-name">
                    <span>{def.name}</span>
                    <small>{def.type === "3d6" ? "3D6×5" : "(2D6+6)×5"}</small>
                  </div>
                  <div className="attr-values">
                    <input type="number" value={store.attrs[def.key]} onChange={(e) => setAttrDirect(def.key, e.target.value)} />
                    <div className="attr-sub">
                      <span>half <b>{Math.floor(store.attrs[def.key] / 2)}</b></span>
                      <span>fifth <b>{Math.floor(store.attrs[def.key] / 5)}</b></span>
                    </div>
                    <button className="roll-btn small" onClick={() => rollAttribute(def.key, def.type)}>굴리기</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="note">근력·건강·민첩성·외모·정신력·운 = <b>3d6 × 5</b> &nbsp;|&nbsp; 크기·지능·교육 = <b>(2d6+6) × 5</b></div>
            <button className="roll-btn" style={{ marginTop: 10 }} onClick={rollAllAttributes}>전체 특성치 한 번에 굴리기</button>
          </Card>

          {/* 나이 */}
          <Card title="나이 & 조정" tag="AGE">
            <div className="grid cols-2">
              <Field label="나이 (15~89)">
                <input type="number" min={15} max={89} value={age} onChange={(e) => setAge(parseInt(e.target.value) || 0)} />
              </Field>
              <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
                <button className="roll-btn blood" style={{ width: "100%", padding: 9 }} onClick={pickAgeBracket}>
                  이 나이의 조정 적용하기
                </button>
              </div>
            </div>

            {ageBracket && (
              <div className="age-adjust-box">
                <h4>
                  {ageBracket.min}~{ageBracket.max}세 조정{" "}
                  <span className="pill warn">참고: 50세 이상 구간은 정식 규칙표를 바탕으로 한 확장 적용</span>
                </h4>

                {ageBracket.statReduce && (
                  <>
                    <div className="row-inline" style={{ fontWeight: "bold" }}>
                      {ageBracket.statReduce.options.map(labelOf).join(" / ")} 중 총 {ageBracket.statReduce.points}점 감소 배분
                    </div>
                    <div className="row-inline">
                      {ageBracket.statReduce.options.map((k) => (
                        <label key={k}>
                          {labelOf(k)}{" "}
                          <input
                            type="number"
                            value={reduceValues[k] ?? 0}
                            onChange={(e) => setReduceValues({ ...reduceValues, [k]: e.target.value })}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="row-inline">
                      배분 합계: {Object.values(reduceValues).reduce((a, b) => a + (parseInt(b) || 0), 0)} / {ageBracket.statReduce.points}
                    </div>
                  </>
                )}
                {ageBracket.eduReduce > 0 && <div className="row-inline">교육 <b>-{ageBracket.eduReduce}</b> 자동 적용</div>}
                {ageBracket.appReduce > 0 && <div className="row-inline">외모 <b>-{ageBracket.appReduce}</b> 자동 적용</div>}
                {ageBracket.luckTwice && <div className="row-inline">운 수치는 3D6×5를 <b>두 번</b> 굴려 높은 값을 채택 (적용 버튼에서 자동 진행)</div>}
                {ageBracket.eduChecks > 0 && <div className="row-inline">교육 향상 판정 <b>{ageBracket.eduChecks}회</b> 자동 진행 (적용 버튼에서 순차 진행)</div>}

                <button className="roll-btn blood" style={{ marginTop: 6 }} onClick={confirmAgeAdjustment}>
                  위 내용대로 조정 확정 적용
                </button>
              </div>
            )}
          </Card>

          {/* 파생치 */}
          <Card title="파생치" tag="DERIVED">
            <div className="derived-grid">
              <div className="derived-box">
                <div className="dname">체력 HP</div>
                <div className="dval"><input type="number" value={hpCur ?? hpMax} onChange={(e) => setHpCur(parseInt(e.target.value) || 0)} />/{hpMax}</div>
              </div>
              <div className="derived-box">
                <div className="dname">마력 MP</div>
                <div className="dval"><input type="number" value={mpCur ?? mpMax} onChange={(e) => setMpCur(parseInt(e.target.value) || 0)} />/{mpMax}</div>
              </div>
              <div className="derived-box">
                <div className="dname">이성 SAN</div>
                <div className="dval"><input type="number" value={sanCur ?? store.attrs.POW} onChange={(e) => setSanCur(parseInt(e.target.value) || 0)} />/{sanMax}</div>
              </div>
              <div className="derived-box">
                <div className="dname">이동력 MOV</div>
                <div className="dval">{movVal}</div>
              </div>
              <div className="derived-box">
                <div className="dname">체구 / 피해보너스</div>
                <div className="dval" style={{ fontSize: 14 }}>{bd.build} / {bd.db}</div>
              </div>
            </div>
          </Card>

          {/* 기능 */}
          <Card
            title="탐사자 기능"
            tag="SKILLS"
            action={
              <div className="mode-switch">
                <button className={`mode-btn${mode === "create" ? " active" : ""}`} onClick={() => setMode("create")}>🛠 생성</button>
                <button className={`mode-btn${mode === "growth" ? " active" : ""}`} onClick={() => setMode("growth")}>📈 성장</button>
              </div>
            }
          >
            <div className="pool-bar">
              <div className="pool-box"><label>직업 기능 점수</label><input type="number" value={poolOcc} onChange={(e) => setPoolOcc(parseInt(e.target.value) || 0)} /></div>
              <div className="pool-box">
                <label>관심 기능 점수</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" value={poolInt} onChange={(e) => setPoolInt(parseInt(e.target.value) || 0)} />
                  <button
                    className="roll-btn small"
                    style={{ flexShrink: 0 }}
                    title="관심 기능 점수 = 교육(EDU) × 2"
                    onClick={() => {
                      const v = store.attrs.EDU * 2;
                      setPoolInt(v);
                      addLog("관심 기능 점수 계산", `교육×2 = ${v}`, true);
                    }}
                  >
                    교육×2
                  </button>
                </div>
              </div>
              <div className="pool-box"><label>성장치</label><input type="number" value={poolGrowth} onChange={(e) => setPoolGrowth(parseInt(e.target.value) || 0)} /></div>
              <div className={`pool-box remain${remainOcc < 0 || remainInt < 0 ? " negative" : ""}`}>
                <label>잔여 점수 (직업 / 관심)</label>
                <div className="rval">{remainOcc} / {remainInt}</div>
              </div>
            </div>

            <div className="skill-toolbar">
              <div className="search"><input type="text" placeholder="기능 검색…" value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} /></div>
              <button className="add-skill-btn" onClick={addCustomSkill}>+ 사용자 기능 추가</button>
            </div>

            <div className="skills-columns">
              {cols.map((col, ci) => (
                <div key={ci}>
                  <div className="skill-header">
                    <span>직업</span><span>기능</span><span>기본</span><span>배분</span><span>합계</span><span>½</span><span>⅕</span><span></span><span></span>
                  </div>
                  {col.map((sk) => {
                    const base = skillBaseValue(sk);
                    const total = skillTotal(sk);
                    const memoOpen = !!openMemoIds[sk.id];
                    return (
                      <div key={sk.id}>
                        <div className="skill-row">
                          <input type="checkbox" className="chk" checked={sk.checked} onChange={() => toggleSkillChecked(sk.id)} />
                          <span className="sname" title={sk.name}>{sk.name}</span>
                          <span className="sbase">{base}</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={3}
                            className="alloc"
                            value={sk.alloc}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, "");
                              setSkillAlloc(sk.id, raw);
                              if (raw.length >= 2) e.target.blur();
                            }}
                          />
                          <span className="stot" title={`기본 ${base} + 배분 ${sk.alloc || 0}${sk.growth ? ` + 성장 ${sk.growth}` : ""}`}>{total}</span>
                          <span className="shalf">{Math.floor(total / 2)}</span>
                          <span className="sfifth">{Math.floor(total / 5)}</span>
                          {mode === "growth" ? (
                            <span
                              className={`sroll${improvingSkillId && improvingSkillId !== sk.id ? " disabled" : ""}${improvingSkillId === sk.id ? " busy" : ""}`}
                              title="성장 판정: 1D100 > 현재 기능치면 1D10만큼 증가"
                              onClick={() => improveSkill(sk)}
                            >
                              🎲
                            </span>
                          ) : (
                            <span
                              className={`smemo${sk.memo ? " filled" : ""}`}
                              title="기능 메모"
                              onClick={() => toggleMemoOpen(sk.id)}
                            >
                              📝
                            </span>
                          )}
                          <span className="sdel" onClick={() => sk.custom && removeSkill(sk.id)}>
                            {sk.custom ? "✕" : ""}
                          </span>
                        </div>
                        {memoOpen && (
                          <textarea
                            className="skill-memo-panel"
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
            <div className="note">
              ☑ 체크 = 직업 기능 · 미체크 = 관심 기능. 배분 칸에 추가로 넣을 점수를 입력하면 <b>합계</b>가 자동 계산돼.
              언어(모국어)는 교육치, 회피는 민첩성/2 를 기본치로 자동 반영해. 📝 아이콘을 눌러 기능별 메모를 남길 수 있어.
            </div>
          </Card>
        </main>

        {/* Dice sidebar */}
        <aside className="dice-panel">
          <div className="roller-card">
            <h3>주사위 의식</h3>
            <div className="dice-stage">
              {diceStage.dice.length === 0 && <span style={{ color: "rgba(143,170,92,0.3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>— 대기 중 —</span>}
              {diceStage.dice.map((v, i) => (
                <div key={i} className={`die3d${diceStage.rolling ? " rolling" : " landed"}`}>
                  {["front", "back", "right", "left", "top", "bottom"].map((f) => (
                    <div key={f} className={`face f-${f}`}>{v}</div>
                  ))}
                </div>
              ))}
            </div>
            <div className="dice-input-row">
              <input value={notation} onChange={(e) => setNotation(e.target.value)} placeholder="예: 3d6, 1d100" />
              <button onClick={handleCustomRoll}>굴리기</button>
            </div>
            <div className="quick-dice">
              {["1d4", "1d6", "1d10", "2d6", "3d6", "1d100"].map((n) => (
                <button key={n} onClick={() => handleQuickRoll(n)}>{n}</button>
              ))}
            </div>
          </div>

          <div className="log-card">
            <h3>기록</h3>
            <div className="log-list">
              {log.length === 0 && <div className="log-empty">아직 굴려진 주사위가 없다…</div>}
              {[...log].reverse().map((entry) => (
                <div key={entry.id} className={`log-entry${entry.isEvent ? " event" : ""}${entry.id === latestLogId ? " new-entry" : ""}`}>
                  <div className="lhead"><span>{entry.label}</span><span>{entry.time}</span></div>
                  <div className="lbody">
                    {entry.detail}{" "}
                    {entry.total !== null && <span className="ltotal">= {entry.total}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div className="footer-note">
        m D n = m번, n면체 주사위 · 1d100은 십의 자리·일의 자리 십면체 두 개로 처리됨
      </div>

      {notionOpen && (
        <div className="modal-overlay" onClick={() => setNotionOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>노션 연동 설정</span>
              <button className="modal-close" onClick={() => setNotionOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div>
                노션 데이터베이스를 이 시트의 외부 저장소로 사용해. 아래 API 프록시(서버)가 대신 노션 API를
                호출해주기 때문에 브라우저에 연동 키를 넣을 필요가 없어 — 키는 서버에만 안전하게 보관돼.{" "}
                <span className="modal-link" onClick={() => setNotionReqOpen(true)}>→ 데이터베이스 필수 요건 보기</span>
              </div>
              <Field label="API 프록시 주소">
                <input placeholder="notion API key를 입력하세요" value={notion.apiKey} onChange={(e) => setNotion({ ...notion, apiKey: e.target.value })} />
              </Field>
              <Field label="데이터베이스 ID">
                <input placeholder="32자리 ID (데이터베이스 URL에서 확인)" value={notion.databaseId} onChange={(e) => setNotion({ ...notion, databaseId: e.target.value })} />
              </Field>
              <Field label="제목(Title) 속성 이름">
                <input value={notion.titleProp} onChange={(e) => setNotion({ ...notion, titleProp: e.target.value })} />
              </Field>
              <div className="row-inline" style={{ gap: 8 }}>
                <button className="roll-btn" onClick={syncToNotion}>
                  {notionStatus.state === "busy" ? "동기화 중…" : currentPageId ? "현재 탐사자 갱신 저장" : "새 탐사자로 저장"}
                </button>
                {currentPageId && (
                  <button className="roll-btn small" onClick={startNewCharacterLink} title="지금 불러온 탐사자와의 연결을 끊고, 다음 저장부터 새 페이지로 생성해">
                    링크 해제 (새로 저장)
                  </button>
                )}
              </div>
              {currentPageId && <div className="modal-hint">현재 이 시트는 노션의 기존 탐사자 페이지와 연결돼 있어. 저장하면 그 페이지가 갱신돼.</div>}
              {notionStatus.msg && (
                <div className={`modal-status ${notionStatus.state === "error" ? "err" : "ok"}`}>{notionStatus.msg}</div>
              )}
              <div className="modal-hint">
                기본값 <code>/api/notion</code>은 이 앱이 Vercel(Next.js)에 배포돼 있고, 함께 받은
                <code> app/api/notion/[...path]/route.js</code>를 넣고 Vercel 환경변수에 <code>NOTION_API_KEY</code>를
                등록했다는 전제로 동작해. 별도 서버 없이 정적으로만 호스팅한다면, 대신 Cloudflare Worker
                (notion-proxy-worker 폴더)를 배포하고 그 주소를 여기 입력해줘.
              </div>
            </div>
          </div>
        </div>
      )}

      {notionReqOpen && (
        <div className="modal-overlay" onClick={() => setNotionReqOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>노션 데이터베이스 필수 요건</span>
              <button className="modal-close" onClick={() => setNotionReqOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div>
                <b>완전히 빈 데이터베이스로는 동기화가 안 돼.</b> 노션 API는 데이터베이스 스키마에 이미 존재하는 속성에만 값을 넣을 수 있어서,
                아래 속성들을 미리 만들어 둬야 해. (제목 속성은 모든 데이터베이스에 기본으로 있으니 이름만 맞춰주면 돼.)
              </div>
              <table className="req-table">
                <thead><tr><th>속성 이름</th><th>속성 유형</th><th>비고</th></tr></thead>
                <tbody>
                  {NOTION_REQUIRED_PROPS.map((p) => (
                    <tr key={p.name}><td style={{ fontFamily: "var(--font-mono)" }}>{p.name}</td><td>{p.type}</td><td style={{ color: "#5b5b4f" }}>{p.note || ""}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="modal-hint">이 연동(Integration)을 대상 데이터베이스에 "연결(Connect)"해두는 것도 잊지 마 — 노션 설정 화면 우측 상단 ⋯ 메뉴에서 연결할 수 있어.</div>
              <button className="roll-btn" onClick={() => setNotionReqOpen(false)}>확인했어</button>
            </div>
          </div>
        </div>
      )}

      <div className={`drawer-overlay${browserOpen ? " open" : ""}`} onClick={() => setBrowserOpen(false)} />
      <aside className={`browser-drawer${browserOpen ? " open" : ""}`}>
        <div className="drawer-head">
          <span>저장된 탐사자들</span>
          <button className="modal-close" onClick={() => setBrowserOpen(false)}>✕</button>
        </div>
        <div className="drawer-body">
          {(!notion.apiKey || !notion.databaseId) ? (
            <div className="modal-hint">
              먼저 <span className="modal-link" onClick={() => { setBrowserOpen(false); setNotionOpen(true); }}>⚙ 노션 연동</span>에서
              데이터베이스 ID를 설정해줘.
            </div>
          ) : (
            <>
              <div className="drawer-toolbar">
                <input
                  className="drawer-search"
                  placeholder="이름/직업 검색…"
                  value={browserSearch}
                  onChange={(e) => setBrowserSearch(e.target.value)}
                />
                <button className="roll-btn small" onClick={loadNotionList} disabled={browserLoading}>
                  {browserLoading ? "불러오는 중…" : "↻ 새로고침"}
                </button>
              </div>
              {browserError && <div className="modal-status err">{browserError}</div>}
              {!browserError && !browserLoading && browserList.length === 0 && (
                <div className="modal-hint">아직 노션에 저장된 탐사자가 없어.</div>
              )}
              <div className="browser-list">
                {browserList
                  .filter(
                    (c) =>
                      !browserSearch ||
                      c.name.toLowerCase().includes(browserSearch.toLowerCase()) ||
                      c.occupation.toLowerCase().includes(browserSearch.toLowerCase())
                  )
                  .map((c) => (
                    <div key={c.id} className={`browser-row${c.id === currentPageId ? " active" : ""}`} onClick={() => loadCharacterFromNotion(c.id)}>
                      <div className="brow-name">{c.name}</div>
                      <div className="brow-sub">
                        {c.occupation || "직업 미상"} {c.age ? `· ${c.age}세` : ""}
                      </div>
                      <div className="brow-time">{c.editedAt ? new Date(c.editedAt).toLocaleString("ko-KR") : ""}</div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </aside>

      {choiceModal && (
        <div className="modal-overlay" onClick={skipChoice}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>{choiceModal.title}</span>
              <button className="modal-close" onClick={skipChoice}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-hint">
                {choiceModal.count}개를 선택해줘 ({choiceModal.picked.length}/{choiceModal.count})
              </div>
              <div className="choice-grid">
                {choiceModal.options.map((opt) => (
                  <button
                    key={opt}
                    className={`choice-pill${choiceModal.picked.includes(opt) ? " picked" : ""}`}
                    onClick={() => toggleChoicePick(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="row-inline" style={{ gap: 8 }}>
                <button className="roll-btn" disabled={choiceModal.picked.length !== choiceModal.count} onClick={confirmChoice}>
                  확인
                </button>
                <button className="roll-btn small" onClick={skipChoice}>건너뛰기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== SMALL PIECES ===================== */

function Card({ title, tag, action, children }) {
  return (
    <section className="card">
      <div className="card-head">
        <span>{title}</span>
        <div className="card-head-actions">
          {action}
          <span className="tag">{tag}</span>
        </div>
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

function Field({ label, className, children }) {
  return (
    <div className={`field${className ? " " + className : ""}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}
