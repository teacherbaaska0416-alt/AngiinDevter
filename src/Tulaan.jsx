import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Crown, Loader2, RotateCcw, Swords } from "lucide-react";
import { supabase } from "./supabaseClient";
import archerUrl from "./assets/hero-archer.jpg";
import heavyUrl from "./assets/hero-heavy.jpg";
import shamanUrl from "./assets/hero-shaman.jpg";
import shadowUrl from "./assets/hero-shadow.jpg";
import {
  TYPING_LESSONS,
  KEY_ROWS,
  FINGER_COLOR,
  FINGER_LABEL,
  fingerFor,
  shiftSideFor,
  matchesPromptChar,
} from "./typingCourse.js";

const HEROES = [
  {
    id: "archer",
    name: "Нумт баатар",
    title: "Харваач",
    blurb: "Сүнсний нумаар онилж, алдаагүй харвана.",
    src: archerUrl,
    accent: "#2C7CC4",
  },
  {
    id: "heavy",
    name: "Их Монголын хүнд цэрэг",
    title: "Хүнд цэрэг",
    blurb: "Бат бэх зогсож, үсгээ алдалгүй хамгаална.",
    src: heavyUrl,
    accent: "#B86A28",
  },
  {
    id: "shaman",
    name: "Тэнгэрийн бөө",
    title: "Бөө",
    blurb: "Тэнгэрийн хүчээр хурууны замыг цэвэрлэнэ.",
    src: shamanUrl,
    accent: "#1F8A78",
  },
  {
    id: "shadow",
    name: "Сүүдрийн гэтэгч",
    title: "Сүүдэр",
    blurb: "Чимээгүй ойртож, нэг ч алдаа үлдээлгүй цохино.",
    src: shadowUrl,
    accent: "#3A4454",
  },
];

function battlePrompts(course) {
  const source = course?.length ? course : TYPING_LESSONS;
  const home = source.filter((lesson) => lesson.section === "home" && String(lesson.prompt || "").trim());
  if (home.length) return home;
  const rows = source.filter((lesson) => String(lesson.prompt || "").trim());
  return rows.length ? rows : TYPING_LESSONS.filter((lesson) => lesson.section === "home");
}

function lessonList(live, prompts) {
  if (Array.isArray(live?.lessons) && live.lessons.length) return live.lessons;
  if (Array.isArray(prompts) && prompts.length) return prompts;
  return TYPING_LESSONS.filter((lesson) => lesson.section === "home" && String(lesson.prompt || "").trim());
}

function lessonIndexOf(row, live) {
  if (row && row.lesson != null && row.lesson !== "") return Number(row.lesson) || 0;
  return Number(live?.lesson) || 0;
}

function promptOf(live, prompts, lessonIndex) {
  const list = lessonList(live, prompts);
  const item = list[lessonIndex] || list[0];
  return item?.prompt || "";
}

function taskLabel(live, prompts, lessonIndex) {
  const list = lessonList(live, prompts);
  const index = lessonIndex == null ? (Number(live?.lesson) || 0) : (Number(lessonIndex) || 0);
  const item = list[index] || list[0];
  if (!item) return "Дасгал 1";
  const title = item.title ? `. ${item.title}` : "";
  return `Дасгал ${Math.min(index + 1, list.length)}/${list.length || 1}${title}`;
}

const HERO_IDS = new Set(HEROES.map((hero) => hero.id));

function battleMissing(error) {
  const msg = String(error?.message || error || "");
  return /create_battle|get_teacher_battle|get_student_battle|respond_battle|cancel_battle|set_battle_live|push_battle_progress|schema cache|does not exist/i.test(msg);
}

function mapBattle(payload) {
  const battle = payload?.battle;
  if (!battle?.id) return null;
  return {
    id: battle.id,
    status: battle.status,
    prompt: battle.prompt || "",
    live: battle.live && typeof battle.live === "object" ? battle.live : {},
    slots: (battle.slots || []).map((slot) => ({
      side: slot.side,
      studentId: slot.student_id,
      studentName: slot.student_name || "",
      status: slot.status,
      heroId: slot.hero_id || "",
    })),
  };
}

function slotStatusText(status) {
  if (status === "accepted") return "Зөвшөөрөөд баатраа сонгосон";
  if (status === "declined") return "Татгалзсан";
  return "Хүсэлт очсон, хүлээж байна";
}

function fighterName(student) {
  if (!student) return "";
  const last = student.lastName && student.lastName !== "Овог" ? student.lastName : "";
  const first = student.firstName || "";
  const joined = [last, first].filter(Boolean).join(" ");
  return joined || student.name || student.username || "Сурагч";
}

function formatSeconds(ms) {
  const safe = Math.max(0, Number(ms) || 0);
  const total = safe / 1000;
  if (total < 60) return `${total.toFixed(1)} сек`;
  const min = Math.floor(total / 60);
  const sec = Math.floor(total % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function rankOf(result) {
  if (result?.ko) return [3, 9999, 999999999];
  if (!result?.done) return [2, 9999, 999999999];
  if (result.errors === 0) return [0, 0, result.ms];
  return [1, result.errors, result.ms];
}

function laneWin(fighters) {
  const left = fighters[0]?.result;
  const right = fighters[1]?.result;
  if (!left || !right) return -1;
  return winnerIndex(left, right);
}

function winnerIndex(a, b) {
  const sa = rankOf(a);
  const sb = rankOf(b);
  for (let i = 0; i < 3; i += 1) {
    if (sa[i] < sb[i]) return 0;
    if (sa[i] > sb[i]) return 1;
  }
  return -1;
}

function verdictText(a, b, win) {
  if (a?.ko || b?.ko) return "Амь нь түрүүлж дууссан нь ялагдлаа.";
  if (!a?.done && !b?.done) return "Хэн ч бичвэрийг дуусгаагүй.";
  if (win < 0) return "Хоёулаа алдаагүй, адилхан хурдан бичлээ.";
  const winner = win === 0 ? a : b;
  const loser = win === 0 ? b : a;
  if (!loser.done) return "Нөгөө тулаанч бичвэрийг дуусгаагүй.";
  if (winner.errors === 0 && loser.errors > 0) return "Алдаагүй бичсэн нь яллаа.";
  if (winner.errors < loser.errors) return "Цөөн алдаатай бичсэн нь яллаа.";
  return "Алдаа тэнцүү тул хурдан дуусгасан нь яллаа.";
}

function battleHp(fighter, foe) {
  const errors = Number(fighter?.result ? fighter.result.errors : fighter?.errors) || 0;
  const correct = (Number(fighter?.bank) || 0) + (Number(fighter?.result ? fighter.result.index : fighter?.index) || 0);
  const incoming = (Number(foe?.bank) || 0) + (Number(foe?.result ? foe.result.index : foe?.index) || 0);
  const value = 100 - errors * 8 + correct * 0.55 - incoming * 0.22;
  return Math.max(0, Math.min(100, value));
}

function HeroPortrait({ hero, frame = "thumb" }) {
  const height = frame === "arena" ? 320 : 148;
  const width = Math.round(height * (696 / 1024));
  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{ height, width, background: "#1C2430" }}
    >
      <img
        src={hero.src}
        alt=""
        draggable={false}
        className="h-full w-full object-cover select-none pointer-events-none"
      />
    </div>
  );
}

function HpBar({ value, accent }) {
  return (
    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#E6EAF2" }}>
      <div
        className="h-full rounded-full transition-all duration-200"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: accent }}
      />
    </div>
  );
}

function PromptText({ prompt, index, wrong, done }) {
  return (
    <div className="text-2xl sm:text-3xl leading-relaxed tracking-wide break-words" aria-label="Бичих үсэг">
      {prompt.split("").map((ch, i) => {
        const typed = i < index;
        const current = i === index && !done;
        const space = ch === " ";
        return (
          <span
            key={`${i}-${ch}`}
            style={{
              color: typed ? "#2F6F4E" : "#8A8678",
              background: current ? (wrong ? "#FBE7E4" : "#EAEFF8") : "transparent",
              borderBottom: current ? "2px solid #24478F" : space ? "1px solid #E6EAF2" : "2px solid transparent",
              borderRadius: 4,
              display: space ? "inline-block" : undefined,
              width: space ? "0.55em" : undefined,
              marginRight: space ? "0.15em" : undefined,
            }}
          >
            {space ? "" : ch}
          </span>
        );
      })}
    </div>
  );
}

function BattleKeyboard({ nextChar }) {
  const shiftSide = shiftSideFor(nextChar);
  return (
    <div className="mt-4 w-full overflow-x-auto" onMouseDown={(event) => event.preventDefault()}>
      <div className="min-w-[560px] select-none">
        {KEY_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex justify-center gap-1 mb-1" style={{ paddingLeft: rowIndex === 2 ? 18 : rowIndex === 1 ? 10 : 0 }}>
            {row.map((key) => {
              const hot = (key.chars || []).includes(nextChar);
              const shiftHot = key.shift && key.shift === shiftSide;
              return (
                <div
                  key={key.id}
                  className="h-10 rounded-md flex items-center justify-center text-sm font-semibold relative"
                  style={{
                    width: key.wide ? 68 : 36,
                    background: hot ? "#24478F" : "#FFFEFA",
                    color: hot ? "#FFFFFF" : "#243044",
                    border: shiftHot ? "2px solid #C8962E" : "1px solid #E6EAF2",
                    boxShadow: hot ? "none" : `inset 0 -3px 0 ${FINGER_COLOR[key.finger] || "#E6EAF2"}`,
                  }}
                >
                  {key.label}
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex justify-center mt-1">
          <div
            className="h-10 rounded-md flex items-center justify-center text-sm font-semibold"
            style={{
              width: 220,
              background: nextChar === " " ? "#24478F" : "#FFFEFA",
              color: nextChar === " " ? "#FFFFFF" : "#243044",
              border: "1px solid #E6EAF2",
              boxShadow: nextChar === " " ? "none" : `inset 0 -3px 0 ${FINGER_COLOR.th}`,
            }}
          >
            зай
          </div>
        </div>
      </div>
    </div>
  );
}

function emptyBoard() {
  return [null, null];
}

function blankRacer() {
  return { index: 0, errors: 0, bank: 0, lesson: 0, startedAt: null, result: null };
}

function lanesFromLive(live) {
  const rows = Array.isArray(live?.racers) ? live.racers : [];
  return [0, 1].map((slot) => {
    const row = rows[slot] && typeof rows[slot] === "object" ? rows[slot] : {};
    const result = row.result && typeof row.result === "object" ? row.result : null;
    return {
      index: Number(row.index) || 0,
      errors: Number(row.errors) || 0,
      bank: Number(row.bank) || 0,
      lesson: row.lesson == null || row.lesson === "" ? null : (Number(row.lesson) || 0),
      startedAt: row.startedAt == null || row.startedAt === "" ? null : Number(row.startedAt),
      result,
    };
  });
}

const LIVE_KEY = "angiin-tulaan-live";
const LIVE_PHASES = new Set(["lobby", "countdown", "type", "between", "result"]);

function readLiveBattle() {
  try {
    const raw = sessionStorage.getItem(LIVE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!data?.battleId || !LIVE_PHASES.has(data.phase)) return null;
    return data;
  } catch {
    return null;
  }
}

function writeLiveBattle(value) {
  try {
    if (!value) sessionStorage.removeItem(LIVE_KEY);
    else sessionStorage.setItem(LIVE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota
  }
}

function fightersFromLive(saved) {
  const rows = (saved?.fighters || []).map((row) => ({
    name: row.name || "",
    hero: HEROES.find((hero) => hero.id === row.heroId) || null,
  }));
  if (rows.length !== 2 || rows.some((row) => !row.hero)) return null;
  return rows;
}

export default function TulaanPage({ students = [], classes = [], typingCourse = [] }) {
  const prompts = useMemo(() => battlePrompts(typingCourse), [typingCourse]);
  const [classId, setClassId] = useState("");
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [promptId, setPromptId] = useState("");
  const [phase, setPhase] = useState("setup");
  const [battleId, setBattleId] = useState("");
  const [battle, setBattle] = useState(null);
  const [lockedFighters, setLockedFighters] = useState(null);
  const [sending, setSending] = useState(false);
  const [battleError, setBattleError] = useState("");
  const [turn, setTurn] = useState(0);
  const [count, setCount] = useState(3);
  const [results, setResults] = useState(emptyBoard);
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [latin, setLatin] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [countdownStartedAt, setCountdownStartedAt] = useState(null);
  const [lanes, setLanes] = useState(() => [blankRacer(), blankRacer()]);
  const [now, setNow] = useState(() => Date.now());

  const indexRef = useRef(0);
  const errorsRef = useRef(0);
  const startedRef = useRef(null);
  const doneRef = useRef(false);
  const turnRef = useRef(0);
  const promptRef = useRef("");
  const battleIdRef = useRef("");
  const resumeRef = useRef(null);
  const livePublishRef = useRef(null);
  const liveErrorRef = useRef(false);
  const roundRef = useRef(0);
  turnRef.current = turn;
  battleIdRef.current = battleId;

  const sortedClasses = useMemo(
    () => [...classes].sort((a, b) => (Number(a.grade) || 99) - (Number(b.grade) || 99) || String(a.name).localeCompare(String(b.name), "mn")),
    [classes]
  );

  useEffect(() => {
    if (classId && sortedClasses.some((row) => row.id === classId)) return;
    const grade6 = sortedClasses.find((row) => Number(row.grade) === 6);
    setClassId((grade6 || sortedClasses[0])?.id || "");
  }, [sortedClasses, classId]);

  useEffect(() => {
    if (!prompts.length) return;
    if (promptId === prompts[0].id) return;
    setPromptId(prompts[0].id);
  }, [prompts, promptId]);

  const roster = useMemo(() => {
    const list = students.filter((student) => !classId || student.classId === classId);
    return [...list].sort(
      (a, b) =>
        (a.studentNo ?? 9999) - (b.studentNo ?? 9999) ||
        String(a.lastName || "").localeCompare(String(b.lastName || ""), "mn") ||
        String(a.firstName || "").localeCompare(String(b.firstName || ""), "mn")
    );
  }, [students, classId]);

  useEffect(() => {
    if (phase === "lobby") return;
    if (leftId && !roster.some((student) => student.id === leftId)) setLeftId("");
    if (rightId && !roster.some((student) => student.id === rightId)) setRightId("");
  }, [roster, leftId, rightId, phase]);

  const promptLesson = prompts.find((row) => row.id === promptId) || prompts[0] || null;
  const prompt = promptLesson?.prompt || "";
  const duelPrompt = phase !== "setup" && battle?.prompt ? battle.prompt : prompt;
  promptRef.current = duelPrompt;

  const pairReady = Boolean(leftId && rightId && leftId !== rightId && prompt);
  const fighters = (lockedFighters || []).map((fighter, slot) => {
    const lesson = lessonIndexOf(lanes[slot], battle?.live);
    return {
      ...fighter,
      index: lanes[slot]?.index || 0,
      errors: lanes[slot]?.errors || 0,
      bank: lanes[slot]?.bank || 0,
      lesson,
      prompt: promptOf(battle?.live, prompts, lesson) || duelPrompt,
      task: taskLabel(battle?.live, prompts, lesson),
      startedAt: lanes[slot]?.startedAt || null,
      result: lanes[slot]?.result || results[slot] || null,
    };
  });

  useEffect(() => {
    if (phase !== "countdown") return undefined;
    setCountdownStartedAt(Date.now());
    setCount(3);
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(id);
        setCount(0);
        resumeRef.current = null;
        setPhase("type");
        return;
      }
      setCount(n);
    }, 700);
    return () => clearInterval(id);
  }, [phase, turn]);

  useEffect(() => {
    if (phase !== "type") return undefined;
    const resume = resumeRef.current;
    if (resume && resume.turn === turn) {
      indexRef.current = resume.index || 0;
      errorsRef.current = resume.errors || 0;
      startedRef.current = resume.startedAt || null;
      doneRef.current = false;
      setIndex(resume.index || 0);
      setErrors(resume.errors || 0);
      setStartedAt(resume.startedAt || null);
      setWrong(false);
      document.activeElement?.blur?.();
      return undefined;
    }
    indexRef.current = 0;
    errorsRef.current = 0;
    startedRef.current = null;
    doneRef.current = false;
    setIndex(0);
    setErrors(0);
    setWrong(false);
    setLatin(false);
    setStartedAt(null);
    setNow(Date.now());
    document.activeElement?.blur?.();
    return undefined;
  }, [phase, turn]);

  useEffect(() => {
    if (phase !== "type" && phase !== "countdown") return undefined;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  function snapshot(forfeit) {
    const started = startedRef.current || Date.now();
    const ms = Math.max(Date.now() - started, 1);
    const typed = indexRef.current;
    const misses = errorsRef.current;
    const done = !forfeit && typed >= promptRef.current.length && promptRef.current.length > 0;
    const minutes = Math.max(ms, 1000) / 60000;
    const wpm = done ? Math.round((promptRef.current.length / 5) / minutes) : 0;
    return {
      ms,
      errors: misses,
      index: typed,
      done,
      forfeit: Boolean(forfeit),
      wpm,
    };
  }

  useEffect(() => {
    if (!supabase) return undefined;
    let stop = false;
    (async () => {
      const { data: rows, error } = await supabase
        .from("battles")
        .select("id, status, prompt, prompt_id, class_id")
        .in("status", ["inviting", "ready"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (stop || error || !rows?.[0] || battleIdRef.current) return;
      const row = rows[0];
      const { data: slotRows } = await supabase
        .from("battle_slots")
        .select("side, student_id, student_name, status, hero_id")
        .eq("battle_id", row.id);
      if (stop || battleIdRef.current) return;
      const next = mapBattle({ battle: { ...row, slots: slotRows || [] } });
      if (!next) return;
      const saved = readLiveBattle();
      const resumed = saved && saved.battleId === next.id ? fightersFromLive(saved) : null;
      setBattle(next);
      setBattleId(next.id);
      if (row.class_id) setClassId(row.class_id);
      if (row.prompt_id) setPromptId(row.prompt_id);
      const left = next.slots.find((slot) => slot.side === "left");
      const right = next.slots.find((slot) => slot.side === "right");
      if (left?.studentId) setLeftId(left.studentId);
      if (right?.studentId) setRightId(right.studentId);
      if (resumed && saved.phase !== "lobby") {
        resumeRef.current = {
          turn: saved.turn || 0,
          index: saved.index || 0,
          errors: saved.errors || 0,
          startedAt: saved.startedAt || null,
        };
        setLockedFighters(resumed);
        setTurn(saved.turn || 0);
        setResults(Array.isArray(saved.results) ? [saved.results[0] || null, saved.results[1] || null] : emptyBoard());
        setIndex(saved.index || 0);
        setErrors(saved.errors || 0);
        setStartedAt(saved.startedAt || null);
        setCountdownStartedAt(saved.countdownStartedAt || null);
        setPhase(saved.phase);
        return;
      }
      setPhase("lobby");
    })();
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (phase === "setup" || !battleId || !supabase) return undefined;
    let stop = false;
    const tick = async () => {
      const { data, error } = await supabase.rpc("get_teacher_battle", { p_battle_id: battleId });
      if (stop) return;
      if (error) {
        if (battleMissing(error)) setBattleError("Тулааны хүснэгт байхгүй. Supabase SQL Editor-т supabase-battles.sql-ийг Run хийнэ үү.");
        return;
      }
      const next = mapBattle(data);
      if (!next) return;
      setBattle(next);
      const serverRound = Number(next.live?.countdownStartedAt) || 0;
      const staleRound = roundRef.current > serverRound;
      if (!staleRound && (phase === "type" || phase === "result")) {
        setLanes(lanesFromLive(next.live));
        if (phase === "type" && next.live?.phase === "result") setPhase("result");
      }
    };
    tick();
    const id = setInterval(tick, phase === "lobby" ? 1500 : 400);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [phase, battleId]);

  async function startBattle() {
    if (!pairReady || sending) return;
    if (!supabase) {
      setBattleError("Supabase холболт алга.");
      return;
    }
    setSending(true);
    setBattleError("");
    const first = prompts[0];
    const { data, error } = await supabase.rpc("create_battle", {
      p_class_id: classId,
      p_left_student_id: leftId,
      p_right_student_id: rightId,
      p_prompt_id: first?.id || "",
      p_prompt: first?.prompt || prompt,
    });
    setSending(false);
    if (error || data?.ok === false) {
      setBattleError(
        battleMissing(error)
          ? "Тулааны хүснэгт байхгүй. Supabase SQL Editor-т supabase-battles.sql-ийг Run хийнэ үү."
          : "Хүсэлт илгээж чадсангүй. Сурагчид энэ ангид байгаа эсэхийг шалгана уу."
      );
      return;
    }
    const next = mapBattle(data);
    setBattle(next);
    setBattleId(next?.id || "");
    setLockedFighters(null);
    setTurn(0);
    setResults(emptyBoard());
    setIndex(0);
    setErrors(0);
    setStartedAt(null);
    setCountdownStartedAt(null);
    setPhase("lobby");
  }

  function beginFight() {
    const slots = battle?.slots || [];
    const left = slots.find((slot) => slot.side === "left");
    const right = slots.find((slot) => slot.side === "right");
    const leftHero = HEROES.find((hero) => hero.id === left?.heroId);
    const rightHero = HEROES.find((hero) => hero.id === right?.heroId);
    if (!leftHero || !rightHero) return;
    resumeRef.current = null;
    setLockedFighters([
      { name: left.studentName, hero: leftHero },
      { name: right.studentName, hero: rightHero },
    ]);
    setTurn(0);
    setResults(emptyBoard());
    const started = Date.now();
    roundRef.current = started;
    setLanes([blankRacer(), blankRacer()]);
    setCountdownStartedAt(started);
    setPhase("countdown");
    if (supabase && battle?.id) {
      supabase.rpc("set_battle_live", {
        p_battle_id: battle.id,
        p_live: {
          phase: "countdown",
          countdownStartedAt: started,
          lesson: 0,
          lessons: prompts.map((row) => ({ id: row.id, title: row.title, prompt: row.prompt })),
          racers: [blankRacer(), blankRacer()],
        },
      });
    }
  }

  async function backToSetup() {
    if (battleId && supabase) {
      if (phase === "result") await supabase.rpc("finish_battle", { p_battle_id: battleId });
      else await supabase.rpc("cancel_battle", { p_battle_id: battleId });
    }
    writeLiveBattle(null);
    if (battleId && supabase) supabase.rpc("set_battle_live", { p_battle_id: battleId, p_live: {} });
    setBattleId("");
    setBattle(null);
    setLockedFighters(null);
    setPhase("setup");
    setTurn(0);
    setResults(emptyBoard());
  }

  function rematch() {
    resumeRef.current = null;
    setTurn((value) => value + 1);
    setResults(emptyBoard());
    const started = Date.now();
    roundRef.current = started;
    setLanes([blankRacer(), blankRacer()]);
    setCountdownStartedAt(started);
    setPhase("countdown");
    if (supabase && battleId) {
      supabase.rpc("set_battle_live", {
        p_battle_id: battleId,
        p_live: {
          phase: "countdown",
          countdownStartedAt: started,
          lesson: 0,
          lessons: prompts.map((row) => ({ id: row.id, title: row.title, prompt: row.prompt })),
          racers: [blankRacer(), blankRacer()],
        },
      });
    }
  }

  useEffect(() => {
    if (!battleId || !LIVE_PHASES.has(phase)) return undefined;
    const payload = {
      phase,
      countdownStartedAt,
      lessons: prompts.map((row) => ({ id: row.id, title: row.title, prompt: row.prompt })),
    };
    if (phase === "countdown") {
      payload.lesson = 0;
      payload.racers = [blankRacer(), blankRacer()];
    }
    writeLiveBattle({
      battleId,
      ...payload,
      fighters: (lockedFighters || []).map((fighter) => ({
        name: fighter.name,
        heroId: fighter.hero?.id || "",
      })),
    });
    livePublishRef.current = { battleId, payload };
    if (!supabase) return undefined;
    const delay = phase === "type" ? 100 : 0;
    const timer = setTimeout(() => {
      supabase.rpc("set_battle_live", { p_battle_id: battleId, p_live: payload }).then(({ error }) => {
        if (error && battleMissing(error) && !liveErrorRef.current) {
          liveErrorRef.current = true;
          setBattleError("Сурагчийн цонх багштай зэрэгцэхийн тулд supabase-battles.sql-ийг дахин Run хийнэ үү.");
        }
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [battleId, phase, turn, results, index, errors, startedAt, countdownStartedAt, lockedFighters, prompts]);

  useEffect(() => () => {
    const latest = livePublishRef.current;
    if (!latest || !supabase) return;
    supabase.rpc("set_battle_live", { p_battle_id: latest.battleId, p_live: latest.payload });
  }, []);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="cn-hand text-3xl" style={{ color: "#24478F" }}>Тулаан</h2>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: "#64748B" }}>
            Багш хоёр сурагч сонгоод хүсэлт илгээнэ. Тулаан арван хурууны суурь мөрийн 1-р дасгалаас эхэлнэ. Дасгал дуусмагц өрсөлдөгчөө хүлээлгүй дараагийнх руу орно. Амь дуусвал тулаан дуусаж, ялагч тодорно.
          </p>
        </div>
        {phase !== "setup" ? (
          <button type="button" onClick={backToSetup} className="cn-btn-secondary rounded-md px-3 py-2 text-sm font-medium">
            Болих
          </button>
        ) : null}
      </div>

      {phase === "setup" ? (
        <Setup
          classes={sortedClasses}
          classId={classId}
          setClassId={setClassId}
          roster={roster}
          leftId={leftId}
          rightId={rightId}
          setLeftId={setLeftId}
          setRightId={setRightId}
          lessonCount={prompts.length}
          firstTitle={prompts[0]?.title || ""}
          canStart={pairReady}
          sending={sending}
          error={battleError}
          onStart={startBattle}
        />
      ) : null}

      {phase === "lobby" ? (
        <Lobby battle={battle} onBegin={beginFight} />
      ) : null}

      {phase !== "setup" && phase !== "lobby" ? (
        <BattleStage
          fighters={fighters}
          phase={phase}
          win={laneWin(fighters)}
          count={count}
          prompt={duelPrompt}
          taskLabel=""
          now={now}
          onRematch={rematch}
          onSetup={backToSetup}
        />
      ) : null}
    </section>
  );
}

function BattleStage({
  fighters,
  phase,
  win,
  count,
  prompt,
  taskLabel = "",
  now = Date.now(),
  mineSlot = null,
  wrong = false,
  latin = false,
  onForfeit,
  onRematch,
  onSetup,
}) {
  if (fighters.some((fighter) => !fighter?.hero)) return null;
  const mine = mineSlot == null ? null : fighters[mineSlot];
  const opponent = mineSlot == null ? null : fighters[1 - mineSlot];
  return (
    <div className="cn-card rounded-2xl p-4 sm:p-6">
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
        {fighters.map((fighter, slot) => {
          const typingNow = phase === "type" && !fighter.result;
          const shownErrors = fighter.result ? fighter.result.errors : fighter.errors || 0;
          const hp = fighter.result || typingNow ? battleHp(fighter, fighters[1 - slot]) : 100;
          const elapsed = fighter.startedAt ? Math.max(0, now - fighter.startedAt) : 0;
          const lanePrompt = fighter.prompt || prompt;
          const dim = phase === "result" && win >= 0 && win !== slot;
          const focused = mineSlot == null || mineSlot === slot;
          return (
            <div
              key={slot}
              className={(slot === 1 ? "md:order-3 " : "") + "flex flex-col items-center text-center"}
              style={{ opacity: dim ? 0.55 : 1 }}
            >
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  border: `2px solid ${typingNow || phase === "countdown" || win === slot ? fighter.hero.accent : "#E6EAF2"}`,
                }}
              >
                <HeroPortrait hero={fighter.hero} frame="arena" />
              </div>
              <div className="mt-2 w-full" style={{ maxWidth: 280 }}>
                <div className="text-xs font-semibold" style={{ color: fighter.hero.accent }}>{fighter.hero.title} · {fighter.hero.name}</div>
                <div className="font-semibold truncate" style={{ color: "#0F172A" }}>{fighter.name}</div>
                {fighter.task ? <div className="text-xs mt-0.5 font-semibold" style={{ color: "#24478F" }}>{fighter.task}</div> : null}
                <div className="mt-2"><HpBar value={hp} accent={fighter.hero.accent} /></div>
                <div className="mt-1 text-xs tabular-nums" style={{ color: "#64748B" }}>
                  {fighter.result
                    ? `${fighter.result.errors} алдаа · ${formatSeconds(fighter.result.ms)} · ${fighter.result.wpm} үг/мин`
                    : typingNow
                      ? `${shownErrors} алдаа · ${fighter.startedAt ? formatSeconds(elapsed) : "0.0 сек"} · ${fighter.index || 0}/${lanePrompt.length}`
                      : focused ? "Бэлэн" : "Хүлээж байна"}
                </div>
              </div>
            </div>
          );
        })}
        <div className="md:order-2 flex md:flex-col items-center justify-center gap-2 py-2">
          <Swords size={28} color="#24478F" />
          {phase === "result" && win >= 0 ? <Crown size={22} color="#C8962E" /> : null}
        </div>
      </div>

      {taskLabel ? (
        <div className="mt-6 text-sm font-semibold" style={{ color: "#24478F" }}>{taskLabel}</div>
      ) : null}

      {phase === "countdown" ? (
        <div className="mt-6 text-center">
          <div className="text-sm font-medium" style={{ color: "#64748B" }}>Хоёулаа зэрэг бичнэ</div>
          <div className="text-2xl font-semibold mt-1" style={{ color: "#0F172A" }}>{fighters.map((fighter) => fighter.name).join(" · ")}</div>
          <div className="text-6xl font-semibold mt-3 tabular-nums" style={{ color: "#24478F" }}>{count}</div>
          <p className="text-sm mt-2" style={{ color: "#64748B" }}>Гарын хэлийг монгол кирилл болгоод бэлтгэ.</p>
        </div>
      ) : null}

      {phase === "type" && mine ? (
        <TypingLane fighter={mine} opponent={opponent} prompt={mine.prompt || prompt} wrong={wrong} latin={latin} onForfeit={fighterCanForfeit(mine) ? onForfeit : null} />
      ) : null}

      {phase === "type" && mineSlot == null ? (
        <div className="grid md:grid-cols-2 gap-3 mt-6">
          {fighters.map((fighter, slot) => (
            <LaneWatch key={slot} fighter={fighter} prompt={fighter.prompt || prompt} />
          ))}
        </div>
      ) : null}

      {phase === "result" && fighters[0]?.result && fighters[1]?.result ? (
        <Result
          fighters={fighters}
          win={win}
          reason={verdictText(fighters[0].result, fighters[1].result, win)}
          onRematch={onRematch}
          onSetup={onSetup}
        />
      ) : null}
    </div>
  );
}

function fighterCanForfeit(fighter) {
  return Boolean(fighter) && !fighter.result;
}

function LaneWatch({ fighter, prompt }) {
  const text = fighter.prompt || prompt;
  return (
    <div className="rounded-2xl px-4 py-4" style={{ background: "#FFFEFA", border: "1px solid #E6EAF2" }}>
      <div className="text-sm font-medium mb-2" style={{ color: fighter.hero.accent }}>
        {fighter.result
          ? `${fighter.name} дуусгасан`
          : (fighter.index || 0) >= text.length && text.length > 0
            ? `${fighter.name} дараагийн дасгал руу орж байна`
            : `${fighter.name} бичиж байна`}
      </div>
      {fighter.task ? <div className="text-xs font-semibold mb-2" style={{ color: "#24478F" }}>{fighter.task}</div> : null}
      <PromptText key={text} prompt={text} index={fighter.result ? text.length : fighter.index || 0} wrong={false} done={Boolean(fighter.result)} />
      <div className="mt-3 text-sm" style={{ color: "#64748B" }}>{fighter.index || 0}/{text.length} үсэг</div>
    </div>
  );
}

function TypingLane({ fighter, opponent, prompt, wrong, latin, onForfeit }) {
  const index = fighter.index || 0;
  const expected = prompt[index] || "";
  const finger = fingerFor(expected);
  return (
    <div className="mt-6">
      <div className="text-sm font-medium mb-3" style={{ color: fighter.hero.accent }}>
        {fighter.result
          ? "Тулаан дууслаа."
          : index >= prompt.length && prompt.length > 0
            ? "Дасгал дууслаа. Дараагийн дасгал руу орж байна."
            : "Та бичиж байна. Өрсөлдөгч зэрэг өөрийн дасгалаа бичиж байна."}
      </div>
      {fighter.task ? <div className="text-sm font-semibold mb-3" style={{ color: "#24478F" }}>{fighter.task}</div> : null}
      {opponent ? (
        <p className="text-sm mb-3" style={{ color: "#64748B" }}>
          {opponent.name}: {opponent.result ? "дуусгасан" : `${opponent.task ? `${opponent.task} · ` : ""}${opponent.index || 0}/${(opponent.prompt || prompt).length} үсэг · ${opponent.errors || 0} алдаа`}
        </p>
      ) : null}
      {latin ? (
        <div className="mb-3 text-sm px-3 py-2 rounded-md" style={{ background: "#FBE7E4", color: "#9A3324" }}>
          Гарын хэлийг монгол кирилл болгоно уу.
        </div>
      ) : null}
      <div className="rounded-2xl px-4 py-6 sm:px-6" style={{ background: "#FFFEFA", border: "1px solid #E6EAF2" }}>
        <PromptText key={prompt} prompt={prompt} index={index} wrong={wrong} done={Boolean(fighter.result)} />
        <div className="mt-4 text-sm" style={{ color: "#64748B" }}>
          {index}/{prompt.length} үсэг
          {expected && !fighter.result ? ` · дараагийнх: ${expected === " " ? "зай" : expected}` : ""}
          {finger && !fighter.result ? ` · ${FINGER_LABEL[finger]}` : ""}
        </div>
      </div>
      {fighter.result ? null : <BattleKeyboard nextChar={expected} />}
      {onForfeit ? (
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onForfeit} className="text-sm underline" style={{ color: "#64748B" }}>
            Бууж өгөх
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Setup({
  classes,
  classId,
  setClassId,
  roster,
  leftId,
  rightId,
  setLeftId,
  setRightId,
  lessonCount,
  firstTitle,
  canStart,
  sending,
  error,
  onStart,
}) {
  return (
    <div className="space-y-4">
      <div className="cn-card rounded-2xl p-4 sm:p-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-medium" style={{ color: "#0F172A" }}>Анги</span>
            <select className="cn-select w-full px-3 py-2 text-sm mt-1" value={classId} onChange={(event) => setClassId(event.target.value)}>
              {classes.length === 0 ? <option value="">Анги алга</option> : null}
              {classes.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}{Number(row.grade) === 6 ? " · 6-р анги" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="block text-sm">
            <span className="font-medium" style={{ color: "#0F172A" }}>Дасгал</span>
            <p className="mt-1 text-sm" style={{ color: "#334155" }}>
              {lessonCount
                ? `Суурь мөрийн 1-р дасгалаас эхэлнэ${firstTitle ? ` · ${firstTitle}` : ""}. Нийт ${lessonCount} дасгал. Хэн дуусгасан нь өрсөлдөгчөө хүлээлгүй дараагийнх руу орно.`
                : "Арван хурууны дасгал олдсонгүй."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <StudentSelect side="Зүүн тал" roster={roster} studentId={leftId} otherId={rightId} setStudentId={setLeftId} />
        <StudentSelect side="Баруун тал" roster={roster} studentId={rightId} otherId={leftId} setStudentId={setRightId} />
      </div>

      {roster.length < 2 ? (
        <p className="text-sm" style={{ color: "#9A3324" }}>
          {classes.length === 0 ? "Эхлээд анги, сурагч нэмнэ үү." : "Энэ ангид тулалдах хоёр сурагч хэрэгтэй."}
        </p>
      ) : (
        <p className="text-sm" style={{ color: "#64748B" }}>Баатраа сурагч өөрөө сонгоно. Хүсэлт тэдний самбар дээр очно.</p>
      )}
      {error ? <p className="text-sm" style={{ color: "#9A3324" }}>{error}</p> : null}

      <button type="button" disabled={!canStart || sending} onClick={onStart} className="cn-btn-primary rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-2">
        {sending ? <Loader2 size={16} className="animate-spin" /> : <Swords size={16} />}
        Тулаан эхлүүлэх
      </button>
    </div>
  );
}

function StudentSelect({ side, roster, studentId, otherId, setStudentId }) {
  return (
    <div className="cn-card rounded-2xl p-4">
      <label className="block text-sm">
        <span className="font-medium" style={{ color: "#0F172A" }}>{side}</span>
        <select className="cn-select w-full px-3 py-2 text-sm mt-1" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
          <option value="">Сурагч сонгох</option>
          {roster.map((student) => (
            <option key={student.id} value={student.id} disabled={student.id === otherId}>
              {student.studentNo ? `${student.studentNo}. ` : ""}{fighterName(student)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Lobby({ battle, onBegin }) {
  const slots = [...(battle?.slots || [])].sort((a, b) => a.side.localeCompare(b.side));
  const declined = slots.some((slot) => slot.status === "declined");
  const ready = slots.length === 2 && slots.every((slot) => slot.status === "accepted" && HERO_IDS.has(slot.heroId));
  return (
    <div className="cn-card rounded-2xl p-4 sm:p-6">
      <h3 className="text-lg font-semibold" style={{ color: "#0F172A" }}>Хүсэлт илгээгдлээ</h3>
      <p className="text-sm mt-1" style={{ color: "#64748B" }}>
        Сурагчид өөрийн самбар дээрээс зөвшөөрч баатраа сонгоно. Хоёулаа бэлэн болсон үед зэрэг бичиж эхэлнэ.
      </p>
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {slots.map((slot) => {
          const hero = HEROES.find((row) => row.id === slot.heroId) || null;
          return (
            <div key={slot.side} className="rounded-2xl p-4 flex flex-col items-center text-center" style={{ background: "#F4F6FB" }}>
              {hero ? <HeroPortrait hero={hero} frame="arena" /> : (
                <div className="rounded-xl flex items-center justify-center text-sm" style={{ height: 220, width: 150, background: "#E6EAF2", color: "#64748B" }}>
                  Баатар сонгоогүй
                </div>
              )}
              <div className="font-semibold mt-3" style={{ color: "#0F172A" }}>{slot.studentName}</div>
              <div className="text-sm mt-1" style={{ color: slot.status === "declined" ? "#9A3324" : slot.status === "accepted" ? "#2F6F4E" : "#64748B" }}>
                {hero ? `${hero.name} · ` : ""}{slotStatusText(slot.status)}
              </div>
            </div>
          );
        })}
      </div>
      {declined ? (
        <p className="text-sm mt-4" style={{ color: "#9A3324" }}>
          {onBegin ? "Нэг сурагч татгалзсан. Болих дарж өөр хос сонгоно уу." : "Нэг сурагч татгалзсан. Багш өөр хос сонгоно."}
        </p>
      ) : null}
      {onBegin ? (
        <button type="button" disabled={!ready} onClick={onBegin} className="cn-btn-primary rounded-md px-4 py-2.5 text-sm font-semibold mt-4 disabled:opacity-40">
          Бичиж эхлэх
        </button>
      ) : (
        <p className="text-sm mt-4" style={{ color: "#64748B" }}>Багш бичиж эхлэхийг хүлээж байна.</p>
      )}
    </div>
  );
}

const FIGHT_PHASES = new Set(["countdown", "type", "between", "result"]);

function countdownNumber(startedAt, now) {
  if (!startedAt) return 3;
  const elapsed = Math.max(0, now - Number(startedAt));
  if (elapsed < 700) return 3;
  if (elapsed < 1400) return 2;
  return 1;
}

function readStudentPack(data) {
  const raw = data?.battle;
  if (!raw?.id) return null;
  if (Array.isArray(raw.slots)) {
    return {
      full: true,
      battle: mapBattle({ battle: raw }),
      slotStatus: data.slot_status || "",
      opponentName: data.opponent_name || "",
      battleId: raw.id,
      status: raw.status || "",
    };
  }
  return {
    full: false,
    battle: null,
    slotStatus: raw.slot_status || "",
    opponentName: raw.opponent_name || "",
    battleId: raw.id,
    status: raw.status || "",
    heroId: raw.hero_id || "",
  };
}

function useStudentRace({ active, battleId, studentId, prompt, lessons = [], lesson = 0, round = 0, reset = false, seed, onSync, foeIndex = 0, foeErrors = 0, foeBank = 0 }) {
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [wrong, setWrong] = useState(false);
  const [latin, setLatin] = useState(false);
  const [result, setResult] = useState(null);
  const [cursor, setCursor] = useState(lesson);
  const indexRef = useRef(0);
  const errorsRef = useRef(0);
  const startedRef = useRef(null);
  const doneRef = useRef(false);
  const lessonsRef = useRef(lessons);
  if (Array.isArray(lessons) && lessons.length) lessonsRef.current = lessons;
  const cursorRef = useRef(lesson);
  const ackedLesson = useRef(lesson);
  if (lesson === cursorRef.current) ackedLesson.current = lesson;
  const shownPrompt = lessonsRef.current[cursor]?.prompt || prompt;
  const promptRef = useRef(shownPrompt);
  promptRef.current = shownPrompt;
  const lessonRef = useRef(cursor);
  lessonRef.current = cursorRef.current;
  const seedRef = useRef(seed);
  seedRef.current = seed;
  const serverLessonRef = useRef(lesson);
  serverLessonRef.current = lesson;
  const foeIndexRef = useRef(foeIndex);
  const foeErrorsRef = useRef(foeErrors);
  const foeBankRef = useRef(foeBank);
  foeIndexRef.current = foeIndex;
  foeErrorsRef.current = foeErrors;
  foeBankRef.current = foeBank;

  function advanceDrill() {
    const list = lessonsRef.current || [];
    if (!list.length) return false;
    const next = cursorRef.current + 1 >= list.length ? 0 : cursorRef.current + 1;
    const nextPrompt = list[next]?.prompt || "";
    if (!nextPrompt) return false;
    cursorRef.current = next;
    lessonRef.current = next;
    promptRef.current = nextPrompt;
    indexRef.current = 0;
    startedRef.current = null;
    doneRef.current = false;
    setCursor(next);
    setIndex(0);
    setStartedAt(null);
    setWrong(false);
    setResult(null);
    return true;
  }

  const appliedRound = useRef(null);
  useLayoutEffect(() => {
    if (!round || appliedRound.current === round) return;
    if (!active && !reset) return;
    const restarted = appliedRound.current != null;
    appliedRound.current = round;
    const start = restarted || reset ? blankRacer() : (seedRef.current || blankRacer());
    const nextLesson = start.lesson == null ? (Number(serverLessonRef.current) || 0) : (Number(start.lesson) || 0);
    cursorRef.current = nextLesson;
    lessonRef.current = nextLesson;
    ackedLesson.current = nextLesson;
    indexRef.current = start.index || 0;
    errorsRef.current = start.errors || 0;
    startedRef.current = start.startedAt || null;
    doneRef.current = Boolean(start.result);
    setCursor(nextLesson);
    setIndex(indexRef.current);
    setErrors(errorsRef.current);
    setStartedAt(startedRef.current);
    setResult(start.result || null);
    setWrong(false);
    setLatin(false);
  }, [round, active, reset]);

  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const push = useCallback((done, forfeit) => {
    if (!supabase || !battleId || !studentId) return;
    const ms = startedRef.current ? Math.max(1, Date.now() - startedRef.current) : 1;
    let sendLesson = lessonRef.current;
    let sendIndex = indexRef.current;
    const acked = ackedLesson.current;
    if (sendLesson !== acked) {
      const donePrompt = lessonsRef.current[acked]?.prompt || "";
      if (donePrompt) {
        sendLesson = acked;
        sendIndex = donePrompt.length;
      }
    }
    supabase.rpc("push_battle_progress", {
      p_student_id: studentId,
      p_battle_id: battleId,
      p_index: sendIndex,
      p_errors: errorsRef.current,
      p_started_at: startedRef.current,
      p_ms: ms,
      p_done: Boolean(done),
      p_forfeit: Boolean(forfeit),
      p_lesson: sendLesson,
    }).then(({ data }) => {
      if (data?.battle) onSyncRef.current?.(data);
    });
  }, [battleId, studentId]);

  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => {
      if (!doneRef.current) push(false, false);
    }, 200);
    return () => clearInterval(id);
  }, [active, push]);

  const finish = useCallback((forfeit) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const ms = startedRef.current ? Math.max(1, Date.now() - startedRef.current) : 1;
    const typed = indexRef.current;
    const done = !forfeit && typed >= promptRef.current.length && promptRef.current.length > 0;
    const minutes = Math.max(ms, 1000) / 60000;
    const wpm = done ? Math.round((promptRef.current.length / 5) / minutes) : 0;
    setResult({ ms, errors: errorsRef.current, index: typed, done, forfeit: Boolean(forfeit), wpm });
    push(done, Boolean(forfeit));
  }, [push]);

  useEffect(() => {
    if (!active || result) return undefined;
    function onKey(event) {
      if (doneRef.current) return;
      if (event.repeat) return;
      const key = event.key;
      if (key === "Tab") return;
      if (["Shift", "Control", "Alt", "Meta", "CapsLock", "Dead"].includes(key)) return;
      event.preventDefault();
      event.stopPropagation();
      const expected = promptRef.current[indexRef.current];
      if (!startedRef.current) {
        startedRef.current = Date.now();
        setStartedAt(startedRef.current);
      }
      if (promptRef.current.length > 0 && indexRef.current >= promptRef.current.length) {
        advanceDrill();
        return;
      }
      const matched = matchesPromptChar(event, expected);
      setLatin(!matched && /^[a-zA-Z]$/.test(key));
      if (matched) {
        const nextIndex = indexRef.current + 1;
        indexRef.current = nextIndex;
        setIndex(nextIndex);
        setWrong(false);
        if (nextIndex >= promptRef.current.length && promptRef.current.length > 0) {
          push(false, false);
          advanceDrill();
        }
      } else if (key.length === 1) {
        errorsRef.current += 1;
        setErrors(errorsRef.current);
        setWrong(true);
      }
      push(false, false);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, result, finish]);

  const forfeit = useCallback(() => finish(true), [finish]);
  return {
    index,
    errors,
    startedAt,
    wrong,
    latin,
    result,
    forfeit,
    lesson: cursor,
    prompt: shownPrompt,
    lessons: lessonsRef.current,
  };
}

function StudentMirror({ battle, studentId }) {
  const live = battle.live || {};
  const phase = FIGHT_PHASES.has(live.phase) ? live.phase : "lobby";
  const [now, setNow] = useState(() => Date.now());
  const lanes = lanesFromLive(live);
  const mySlot = (battle.slots || []).findIndex((slot) => slot.studentId === studentId);
  const serverMine = mySlot >= 0 ? lanes[mySlot] : blankRacer();
  const serverFoe = mySlot >= 0 ? (lanes[1 - mySlot] || blankRacer()) : blankRacer();
  const myLesson = lessonIndexOf(serverMine, live);
  const foeLesson = lessonIndexOf(serverFoe, live);
  const drillList = lessonList(live, null);
  const myPrompt = promptOf(live, null, myLesson) || battle.prompt || "";
  const race = useStudentRace({
    active: phase === "type" && mySlot >= 0 && !serverMine.result,
    battleId: battle.id,
    studentId,
    prompt: myPrompt,
    lessons: drillList,
    lesson: myLesson,
    round: Number(live.countdownStartedAt) || 0,
    reset: phase === "countdown",
    seed: serverMine,
    onSync: battle.onSync,
    foeIndex: serverFoe.index,
    foeErrors: serverFoe.errors,
    foeBank: serverFoe.bank || 0,
  });
  useEffect(() => {
    if (phase !== "countdown" && phase !== "type") return undefined;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  const fighters = ["left", "right"].map((side, slot) => {
    const row = (battle.slots || []).find((item) => item.side === side);
    const hero = HEROES.find((item) => item.id === row?.heroId) || null;
    if (!row || !hero) return null;
    const lane = lanes[slot] || blankRacer();
    const mine = slot === mySlot;
    const lesson = mine && phase === "type" ? race.lesson : (slot === 1 - mySlot ? foeLesson : lessonIndexOf(lane, live));
    const drillLessons = race.lessons?.length ? race.lessons : live.lessons;
    return {
      name: row.studentName,
      hero,
      index: mine && phase === "type" ? race.index : lane.index,
      errors: mine && phase === "type" ? race.errors : lane.errors,
      bank: lane.bank || 0,
      lesson,
      prompt: (mine && phase === "type" ? race.prompt : promptOf(live, drillLessons, lesson)) || battle.prompt || "",
      task: taskLabel(live, drillLessons, lesson),
      startedAt: mine && phase === "type" ? (race.startedAt || lane.startedAt) : lane.startedAt,
      result: phase === "countdown" ? null : (lane.result || (mine ? race.result : null)),
    };
  });
  const ready = fighters.every(Boolean);

  return (
    <section>
      <div className="mb-4">
        <h2 className="cn-hand text-3xl" style={{ color: "#24478F" }}>Тулаан</h2>
        <p className="text-sm mt-1 max-w-2xl" style={{ color: "#64748B" }}>
          Хоёулаа зэрэг өөрийн дэлгэц дээр бичнэ. Суурь мөрийн 1-р дасгалаас эхэлж, дуусмагц өрсөлдөгчөө хүлээлгүй дараагийн дасгал руу орно. Амь дуусвал тулаан дуусаж, ялагч тодорно.
        </p>
      </div>
      {phase === "lobby" || !ready ? <Lobby battle={battle} /> : (
        <BattleStage
          fighters={fighters}
          phase={phase}
          win={laneWin(fighters)}
          count={countdownNumber(live.countdownStartedAt, now)}
          prompt={race.prompt || myPrompt}
          taskLabel=""
          now={now}
          mineSlot={mySlot >= 0 ? mySlot : null}
          wrong={race.wrong}
          latin={race.latin}
          onForfeit={race.forfeit}
        />
      )}
    </section>
  );
}

export function StudentBattleScreen({ studentId, page = false, onActivity, children }) {
  const [pack, setPack] = useState(null);
  const [heroId, setHeroId] = useState(HEROES[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase || !studentId) {
      setPack(null);
      return undefined;
    }
    let stop = false;
    const tick = async () => {
      const { data, error: rpcError } = await supabase.rpc("get_student_battle", { p_student_id: studentId });
      if (stop || rpcError) return;
      setPack(readStudentPack(data));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [studentId]);

  useEffect(() => {
    const active = Boolean(pack && (pack.slotStatus === "pending" || pack.slotStatus === "accepted"));
    onActivity?.(active);
  }, [pack, onActivity]);

  const mirror = pack?.full && pack.slotStatus === "accepted" ? (
    <StudentMirror
      battle={{ ...pack.battle, onSync: (data) => setPack(readStudentPack(data)) }}
      studentId={studentId}
    />
  ) : null;
  if (page && mirror) return mirror;

  let card = null;
  if (pack && pack.slotStatus === "accepted" && !pack.full) {
    const chosen = HEROES.find((hero) => hero.id === pack.heroId) || null;
    card = (
      <div className="cn-card rounded-2xl p-4 mb-4">
        <div className="font-semibold" style={{ color: "#2F6F4E" }}>Тулаанд орлоо</div>
        <p className="text-sm mt-1" style={{ color: "#334155" }}>
          {chosen ? `${chosen.name} баатараар ` : ""}{pack.opponentName ? `${pack.opponentName}-тай ` : ""}тулалдана. Багшийн цонхтой адил харахын тулд supabase-battles.sql-ийг дахин Run хийнэ үү.
        </p>
      </div>
    );
  } else if (pack && pack.slotStatus === "pending" && pack.status === "inviting") {
    const hero = HEROES.find((row) => row.id === heroId) || HEROES[0];
    async function respond(accept) {
      if (!supabase || busy) return;
      setBusy(true);
      setError("");
      const { data, error: rpcError } = await supabase.rpc("respond_battle", {
        p_student_id: studentId,
        p_battle_id: pack.battleId,
        p_accept: accept,
        p_hero_id: accept ? heroId : null,
      });
      setBusy(false);
      if (rpcError || data?.ok === false) {
        setError("Хариу илгээж чадсангүй. Дахин оролдоно уу.");
        return;
      }
      setPack(readStudentPack(data));
    }
    card = (
      <div className="cn-card rounded-2xl p-4 sm:p-5 mb-4" style={{ borderColor: "#1D4ED8" }}>
        <div className="text-xs font-semibold" style={{ color: "#1D4ED8" }}>Тулааны хүсэлт</div>
        <h3 className="text-xl font-semibold mt-1" style={{ color: "#0F172A" }}>
          {pack.opponentName ? `${pack.opponentName}-тай тулалдах уу?` : "Тулаанд орох уу?"}
        </h3>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>Зөвшөөрөөд баатраа сонгоно. Дараа нь багшийн цонхтой адил тулаан нээгдэнэ.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 justify-items-center">
          {HEROES.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setHeroId(row.id)}
              className="rounded-xl overflow-hidden text-left w-fit"
              style={{ border: row.id === heroId ? `2px solid ${row.accent}` : "2px solid transparent" }}
              title={row.name}
            >
              <HeroPortrait hero={row} />
            </button>
          ))}
        </div>
        <div className="mt-2 text-sm font-semibold" style={{ color: hero.accent }}>{hero.name}</div>
        <div className="text-xs" style={{ color: "#64748B" }}>{hero.blurb}</div>
        {error ? <p className="text-sm mt-2" style={{ color: "#9A3324" }}>{error}</p> : null}
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" disabled={busy} onClick={() => respond(true)} className="cn-btn-primary rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-40">
            Зөвшөөрөх
          </button>
          <button type="button" disabled={busy} onClick={() => respond(false)} className="cn-btn-secondary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40">
            Татгалзах
          </button>
        </div>
      </div>
    );
  }

  if (!page) return children;
  if (card) return card;
  return (
    <div className="cn-card rounded-2xl p-8 text-center text-sm" style={{ color: "#64748B", borderStyle: "dashed" }}>
      Одоогоор тулаан алга. Багш хоёр сурагч сонгож хүсэлт илгээсний дараа энд гарна.
    </div>
  );
}

export function StudentBattleInvite(props) {
  return <StudentBattleScreen {...props} />;
}

function Between({ name, result, onNext }) {
  return (
    <div className="mt-6 rounded-2xl p-4 sm:p-5" style={{ background: "#F4F6FB" }}>
      <div className="font-semibold" style={{ color: "#0F172A" }}>{name} дууслаа</div>
      <p className="text-sm mt-1" style={{ color: "#334155" }}>
        {result.done
          ? `${result.errors === 0 ? "Алдаагүй." : `${result.errors} алдаа.`} ${formatSeconds(result.ms)}, ${result.wpm} үг/мин.`
          : "Бичвэрийг дуусгалгүй бууж өгсөн."}
      </p>
      <p className="text-sm mt-2" style={{ color: "#64748B" }}>
        Дараагийн сурагч суугаад гараа бэлдэнэ. Алдаагүй бичвэл ялах боломжтой. Хоёулаа алдаагүй бол хугацаа шийднэ.
      </p>
      {onNext ? (
        <button type="button" onClick={onNext} className="cn-btn-primary rounded-md px-4 py-2 text-sm font-semibold mt-4">
          Дараагийн сурагч
        </button>
      ) : (
        <p className="text-sm mt-3" style={{ color: "#64748B" }}>Дараагийн сурагчийг багш дуудна.</p>
      )}
    </div>
  );
}

function Result({ fighters, win, reason, onRematch, onSetup }) {
  const winner = win >= 0 ? fighters[win] : null;
  return (
    <div className="mt-6 rounded-2xl p-4 sm:p-5" style={{ background: "#F4F6FB" }}>
      <div className="flex items-center gap-2">
        <Crown size={20} color="#C8962E" />
        <div className="text-xl font-semibold" style={{ color: "#0F172A" }}>
          {winner ? `${winner.name} яллаа` : "Тэнцээ"}
        </div>
      </div>
      <p className="text-sm mt-1" style={{ color: "#334155" }}>{reason}</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {fighters.map((fighter, slot) => (
          <div key={slot} className="rounded-xl bg-white px-3 py-3" style={{ border: "1px solid #E6EAF2" }}>
            <div className="text-sm font-semibold" style={{ color: "#0F172A" }}>{fighter.name}</div>
            <div className="text-xs mt-0.5" style={{ color: fighter.hero.accent }}>{fighter.hero.name}</div>
            <div className="text-sm mt-2 tabular-nums" style={{ color: "#334155" }}>
              {fighter.result?.done
                ? `${fighter.result.errors} алдаа · ${formatSeconds(fighter.result.ms)} · ${fighter.result.wpm} үг/мин`
                : "Дуусаагүй"}
            </div>
          </div>
        ))}
      </div>
      {onRematch || onSetup ? (
        <div className="flex flex-wrap gap-2 mt-4">
          {onRematch ? (
            <button type="button" onClick={onRematch} className="cn-btn-primary rounded-md px-4 py-2 text-sm font-semibold inline-flex items-center gap-2">
              <RotateCcw size={15} />
              Дахин тулалдах
            </button>
          ) : null}
          {onSetup ? (
            <button type="button" onClick={onSetup} className="cn-btn-secondary rounded-md px-4 py-2 text-sm font-medium">
              Шинэ хос
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
