import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Lock, RotateCcw, Star, X } from "lucide-react";
import {
  FINGER_COLOR,
  FINGER_LABEL,
  KEY_ROWS,
  PASS_ACCURACY,
  TYPING_LESSONS,
  TYPING_SECTIONS,
  fingerFor,
  isLessonUnlocked,
  isUpperCyr,
  loadTypingProgress,
  passedCount,
  saveTypingResult,
  shiftSideFor,
  starsFor,
  typingScore,
} from "./typingCourse.js";

function pad(n) {
  return String(n).padStart(2, "0");
}

export function TypingCourseWindow({ course, onSave, onReset, savingId, tableMissing, error, onClose }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-center overflow-y-auto p-3 sm:p-6"
      style={{ background: "rgba(22, 28, 45, 0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Дасгал засах"
    >
      <div
        className="w-full max-w-6xl h-fit rounded-2xl p-4 sm:p-5 my-2"
        style={{ background: "#F4F6FB", border: "1px solid #E6EAF2", boxShadow: "0 24px 60px rgba(16,28,58,0.28)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-xs font-semibold" style={{ color: "#64748B" }}>Багшийн засвар</div>
            <div className="text-lg font-semibold" style={{ color: "#243044" }}>Арван хурууны дасгал</div>
          </div>
          <button type="button" onClick={onClose} className="cn-btn-secondary rounded-md px-3 py-1.5 text-sm font-medium inline-flex items-center gap-1.5">
            <X size={16} /> Хаах
          </button>
        </div>
        {tableMissing ? (
          <div className="mb-3 text-sm px-3 py-2 rounded-md" style={{ background: "#FBF3D8", color: "#8A5A12" }}>
            Засвар хадгалахын тулд Supabase SQL Editor-т supabase-typing-drills.sql файлыг Run хийнэ үү.
          </div>
        ) : null}
        {error ? (
          <div className="mb-3 text-sm px-3 py-2 rounded-md" style={{ background: "#FBE7E4", color: "#9A3324" }}>{error}</div>
        ) : null}
        <TypingEditor course={course} onSave={onSave} onReset={onReset} savingId={savingId} />
      </div>
    </div>
  );
}

function draftFrom(lesson) {
  return {
    title: lesson?.title || "",
    focus: lesson?.focus || "",
    tip: lesson?.tip || "",
    prompt: lesson?.prompt || "",
    goalWpm: lesson?.goalWpm || 12,
  };
}

export function TypingEditor({ course, onSave, onReset, savingId }) {
  const [selectedId, setSelectedId] = useState(course[0]?.id || "");
  const selected = course.find((lesson) => lesson.id === selectedId) || course[0];
  const original = TYPING_LESSONS.find((lesson) => lesson.id === selected?.id);
  const [draft, setDraft] = useState(() => draftFrom(selected));

  useEffect(() => {
    setDraft(draftFrom(selected));
  }, [selected?.id, selected?.title, selected?.focus, selected?.tip, selected?.prompt, selected?.goalWpm, selected?.edited]);

  if (!selected) return null;
  const saving = savingId === selected.id;
  const canSave = draft.title.trim() && draft.prompt.trim() && !saving;
  const changedFromOriginal = original && (
    draft.title.trim() !== original.title
    || draft.focus.trim() !== (original.focus || "")
    || draft.tip.trim() !== (original.tip || "")
    || draft.prompt.trim() !== original.prompt
    || Number(draft.goalWpm) !== Number(original.goalWpm)
  );

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-4">
        {TYPING_SECTIONS.map((section) => {
          const items = course.filter((lesson) => lesson.section === section.id);
          if (!items.length) return null;
          return (
            <div key={section.id}>
              <div className="text-xs font-semibold mb-1.5" style={{ color: "#64748B" }}>{section.title}</div>
              <div className="space-y-1">
                {items.map((lesson) => {
                  const active = lesson.id === selected.id;
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => setSelectedId(lesson.id)}
                      className="w-full text-left rounded-lg px-3 py-2"
                      style={{
                        background: active ? "#EAEFF8" : "#FFFEFA",
                        border: "1px solid " + (active ? "#24478F" : "#E6EAF2"),
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: "#243044" }}>{pad(lesson.n)}. {lesson.title}</span>
                        {lesson.edited ? <span className="cn-tag shrink-0">Зассан</span> : null}
                      </div>
                      <div className="text-xs mt-0.5 truncate" style={{ color: "#64748B" }}>{lesson.prompt}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <form
        className="cn-card rounded-xl p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave) return;
          onSave?.({
            id: selected.id,
            title: draft.title,
            focus: draft.focus,
            tip: draft.tip,
            prompt: draft.prompt,
            goalWpm: Number(draft.goalWpm) || original?.goalWpm || 12,
          });
        }}
      >
        <div className="text-xs font-semibold mb-3" style={{ color: "#64748B" }}>Дасгал {pad(selected.n)}</div>
        <label className="text-sm font-medium block mb-1" style={{ color: "#0F172A" }}>Гарчиг</label>
        <input
          className="cn-input w-full px-3 py-2 text-sm mb-3"
          value={draft.title}
          maxLength={80}
          onChange={(event) => setDraft((row) => ({ ...row, title: event.target.value }))}
        />
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: "#0F172A" }}>Картан дээрх үсэг</label>
            <input
              className="cn-input w-full px-3 py-2 text-sm"
              value={draft.focus}
              maxLength={12}
              onChange={(event) => setDraft((row) => ({ ...row, focus: event.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: "#0F172A" }}>Зорилт, үг/мин</label>
            <input
              className="cn-input w-full px-3 py-2 text-sm"
              type="number"
              min={1}
              max={120}
              value={draft.goalWpm}
              onChange={(event) => setDraft((row) => ({ ...row, goalWpm: event.target.value }))}
            />
          </div>
        </div>
        <label className="text-sm font-medium block mb-1" style={{ color: "#0F172A" }}>Зөвлөгөө</label>
        <textarea
          className="cn-textarea w-full px-3 py-2 text-sm mb-3"
          rows={2}
          maxLength={240}
          value={draft.tip}
          onChange={(event) => setDraft((row) => ({ ...row, tip: event.target.value }))}
        />
        <label className="text-sm font-medium block mb-1" style={{ color: "#0F172A" }}>Сурагчийн бичих текст</label>
        <textarea
          className="cn-textarea w-full px-3 py-2 text-sm"
          rows={6}
          maxLength={800}
          value={draft.prompt}
          onChange={(event) => setDraft((row) => ({ ...row, prompt: event.target.value }))}
        />
        <p className="text-xs mt-1 mb-4" style={{ color: "#64748B" }}>
          {draft.prompt.trim().length} үсэг. Сурагч энэ текстийг яг энэ дарааллаар бичнэ.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!canSave} className="cn-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40">
            {saving ? "Хадгалж байна..." : "Хадгалах"}
          </button>
          <button
            type="button"
            disabled={!changedFromOriginal && !selected.edited}
            onClick={() => {
              if (original) setDraft(draftFrom(original));
              if (selected.edited) onReset?.(selected.id);
            }}
            className="cn-btn-secondary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Анхны дасгал
          </button>
        </div>
      </form>
    </div>
  );
}

export default function TypingCourse({ studentId, materials = [], materialGroups = [], onOpenMaterial, course = TYPING_LESSONS, showKeyboard = true }) {
  const [progress, setProgress] = useState(() => loadTypingProgress(studentId));
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    setProgress(loadTypingProgress(studentId));
    setActiveId(null);
  }, [studentId]);

  const active = course.find((lesson) => lesson.id === activeId) || null;

  function handleDone(lesson, result) {
    setProgress(saveTypingResult(studentId, lesson.id, { ...result, goalWpm: lesson.goalWpm }));
  }

  if (active) {
    const index = course.findIndex((lesson) => lesson.id === active.id);
    const next = course[index + 1] || null;
    return (
      <TypingPractice
        key={active.id}
        lesson={active}
        nextLesson={next}
        showKeyboard={showKeyboard}
        onBack={() => setActiveId(null)}
        onOpen={(id) => setActiveId(id)}
        onDone={(result) => handleDone(active, result)}
      />
    );
  }

  return (
    <TypingMap
      progress={progress}
      materials={materials}
      materialGroups={materialGroups}
      course={course}
      onOpen={setActiveId}
      onOpenMaterial={onOpenMaterial}
    />
  );
}

function materialSections(materials, groups) {
  const ordered = [...(groups || [])].sort((a, b) => (a.position || 0) - (b.position || 0) || String(a.name || "").localeCompare(String(b.name || ""), "mn"));
  const placed = new Set();
  const sections = [];
  ordered.forEach((group) => {
    const items = materials.filter((item) => item.groupId === group.id);
    if (!items.length) return;
    items.forEach((item) => placed.add(item.id));
    sections.push({ id: group.id, name: group.name, items });
  });
  const loose = materials.filter((item) => !placed.has(item.id));
  if (loose.length) sections.push({ id: "loose", name: sections.length ? "Бусад материал" : "", items: loose });
  return sections;
}

function TypingMap({ progress, materials, materialGroups = [], onOpen, onOpenMaterial, course = TYPING_LESSONS }) {
  const done = passedCount(progress, course);
  const total = course.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const score = typingScore(progress);
  const current = course.find((lesson, index) => isLessonUnlocked(index, progress, course) && !progress[lesson.id]?.passed);

  return (
    <div>
      <div
        className="rounded-2xl p-4 sm:p-6"
        style={{
          background: "linear-gradient(180deg, #E4F1F4 0%, #F3F6F1 42%, #FFFFFF 100%)",
          border: "1px solid #D5E2E4",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-xs font-semibold tracking-wide" style={{ color: "#5E7C86" }}>Монгол хэл</div>
            <h2 className="text-2xl sm:text-3xl font-semibold leading-tight" style={{ color: "#243044" }}>Арван хуруу</h2>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium" style={{ color: "#3E4A55" }}>
            <span className="inline-flex items-center gap-1.5">
              <Star size={15} color="#C8962E" fill="#C8962E" />
              Оноо {score}
            </span>
            <span>Явц {pct}%</span>
          </div>
        </div>

        <div className="rounded-xl bg-white px-4 py-3 sm:px-5 sm:py-4 flex flex-wrap items-center gap-4 shadow-sm" style={{ border: "1px solid #E3E8EA" }}>
          <div
            className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center text-lg font-semibold"
            style={{ background: "#E7F3F1", color: "#1F6B4A" }}
          >
            ӨР
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold" style={{ color: "#243044" }}>
              {current ? "Дараагийн дасгалаа үргэлжлүүлнэ үү." : "Бүх дасгалаа дуусгалаа."}
            </div>
            <p className="text-sm mt-0.5" style={{ color: "#5C6770" }}>
              {current
                ? `${pad(current.n)} ${current.title}. Гар руу харалгүй, дэлгэц рүү харж бич.`
                : "Хүсвэл аль ч дасгалаа нээж одоо давтаж болно."}
            </p>
          </div>
          {current ? (
            <button
              type="button"
              onClick={() => onOpen(current.id)}
              className="cn-btn-primary rounded-full px-4 py-2 text-sm font-medium"
            >
              {done === 0 ? "Эхэл" : "Үргэлжлүүлэх"}
            </button>
          ) : null}
        </div>

        {TYPING_SECTIONS.map((section) => {
          const lessons = course.filter((lesson) => lesson.section === section.id);
          const sectionDone = lessons.filter((lesson) => progress[lesson.id]?.passed).length;
          return (
            <section key={section.id} className="mt-8">
              <div className="flex items-end justify-between gap-3 mb-1">
                <div>
                  <h3 className="font-semibold" style={{ color: "#243044" }}>{section.title}</h3>
                  <p className="text-xs mt-0.5" style={{ color: "#5C6770" }}>{section.blurb}</p>
                </div>
                <span className="text-xs font-semibold tabular-nums" style={{ color: "#24478F" }}>{sectionDone}/{lessons.length}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-8">
                {lessons.map((lesson) => {
                  const index = lesson.n - 1;
                  const unlocked = isLessonUnlocked(index, progress, course);
                  const row = progress[lesson.id];
                  const isCurrent = current?.id === lesson.id;
                  return (
                    <div key={lesson.id} className="relative">
                      {isCurrent ? (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center">
                          <div className="px-2.5 py-1 rounded-md text-xs font-semibold text-white whitespace-nowrap" style={{ background: "#1C2430" }}>
                            Эхэл
                          </div>
                          <div className="w-2 h-2 rotate-45 -mt-1" style={{ background: "#1C2430" }} />
                        </div>
                      ) : null}
                      <button
                        type="button"
                        disabled={!unlocked}
                        onClick={() => unlocked && onOpen(lesson.id)}
                        className="w-full h-full min-h-[132px] rounded-xl px-2 py-2 text-center transition-transform disabled:cursor-not-allowed"
                        style={{
                          background: "#FFFEFA",
                          border: isCurrent ? "2px solid #1C2430" : "1px solid #E6EAF2",
                          boxShadow: unlocked ? "0 8px 18px rgba(36,71,143,0.06)" : "none",
                          opacity: unlocked ? 1 : 0.55,
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-bold tabular-nums" style={{ color: "#8A93A3" }}>{pad(lesson.n)}</span>
                          {!unlocked ? <Lock size={13} color="#8A93A3" /> : <span className="w-3" />}
                        </div>
                        <div className="mt-2 text-lg font-semibold tracking-wide" style={{ color: "#243044" }}>{lesson.focus}</div>
                        <div className="mt-1 text-[11px] leading-snug min-h-[2rem]" style={{ color: "#4E5963" }}>{lesson.title}</div>
                        {row?.passed ? (
                          <div className="flex justify-center gap-0.5 mt-1">
                            {[1, 2, 3].map((star) => (
                              <Star
                                key={star}
                                size={12}
                                color={star <= row.stars ? "#C8962E" : "#E6EAF2"}
                                fill={star <= row.stars ? "#C8962E" : "transparent"}
                              />
                            ))}
                          </div>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {materials.length > 0 ? (
        <div className="mt-8 space-y-5">
          <h3 className="font-semibold" style={{ color: "#0F172A" }}>Багшийн материал</h3>
          {materialSections(materials, materialGroups).map((section) => (
            <div key={section.id}>
              {section.name ? (
                <div className="text-sm font-semibold mb-2" style={{ color: "#24478F" }}>{section.name}</div>
              ) : null}
              <div className="grid sm:grid-cols-2 gap-3">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenMaterial?.(item)}
                    className="cn-card rounded-lg p-4 text-left transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="cn-tag">{item.grade ? `${item.grade}-р · ${item.subject}` : item.subject}</span>
                      {item.fileUrl ? <span className="cn-tag">PPT</span> : null}
                    </div>
                    <div className="font-semibold mt-2">{item.title}</div>
                    <div className="text-xs mt-1 line-clamp-2" style={{ color: "#64748B" }}>
                      {item.fileName ? `PPT · ${item.fileName}` : `${(item.content || "").slice(0, 90)}`}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TypingPractice({ lesson, nextLesson, onBack, onOpen, onDone, showKeyboard = true }) {
  const prompt = lesson.prompt;
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [wrong, setWrong] = useState(false);
  const [latin, setLatin] = useState(false);
  const [caps, setCaps] = useState(false);
  const [focused, setFocused] = useState(true);
  const [result, setResult] = useState(null);
  const boxRef = useRef(null);
  const indexRef = useRef(0);
  const errorsRef = useRef(0);
  const startedRef = useRef(null);
  const doneRef = useRef(false);

  useEffect(() => {
    boxRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!startedAt || result) return undefined;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [startedAt, result]);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    const elapsed = Math.max(Date.now() - (startedRef.current || Date.now()), 1000);
    const minutes = elapsed / 60000;
    const wpm = Math.round((prompt.length / 5) / minutes);
    const accuracy = prompt.length / (prompt.length + errorsRef.current);
    const next = {
      accuracy,
      wpm,
      errors: errorsRef.current,
      passed: accuracy >= PASS_ACCURACY,
      stars: starsFor({ accuracy, wpm }, lesson.goalWpm),
    };
    setResult(next);
    onDone(next);
  }

  function onKeyDown(event) {
    if (doneRef.current) return;
    if (event.repeat) return;
    const key = event.key;
    if (key === "Tab") return;
    if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onBack();
      return;
    }
    if (key === "CapsLock" || event.getModifierState?.("CapsLock")) setCaps(Boolean(event.getModifierState?.("CapsLock")));
    if (["Shift", "Control", "Alt", "Meta", "CapsLock", "Dead"].includes(key)) return;
    event.preventDefault();
    if (key.length !== 1) return;

    const expected = prompt[indexRef.current];
    if (/^[a-zA-Z]$/.test(key)) setLatin(true);
    else setLatin(false);

    if (!startedRef.current) {
      startedRef.current = Date.now();
      setStartedAt(startedRef.current);
    }

    if (key === expected) {
      const nextIndex = indexRef.current + 1;
      indexRef.current = nextIndex;
      setIndex(nextIndex);
      setWrong(false);
      if (nextIndex >= prompt.length) finish();
      return;
    }

    errorsRef.current += 1;
    setErrors(errorsRef.current);
    setWrong(true);
  }

  function retry() {
    indexRef.current = 0;
    errorsRef.current = 0;
    startedRef.current = null;
    doneRef.current = false;
    setIndex(0);
    setErrors(0);
    setStartedAt(null);
    setWrong(false);
    setLatin(false);
    setResult(null);
    boxRef.current?.focus();
  }

  const elapsedMin = startedAt ? Math.max((now - startedAt) / 60000, 1 / 60) : 0;
  const liveWpm = startedAt ? Math.round((index / 5) / elapsedMin) : 0;
  const liveAccuracy = index + errors > 0 ? index / (index + errors) : 1;
  const expected = prompt[index] || "";
  const finger = fingerFor(expected);
  const shiftSide = shiftSideFor(expected);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button type="button" onClick={onBack} className="cn-btn-secondary rounded-md px-2 py-1.5" aria-label="Буцах">
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0">
          <div className="text-xs font-semibold" style={{ color: "#64748B" }}>Дасгал {pad(lesson.n)}</div>
          <h2 className="text-xl sm:text-2xl font-semibold leading-tight" style={{ color: "#243044" }}>{lesson.title}</h2>
        </div>
      </div>

      {lesson.steps ? (
        <ol className="cn-card rounded-xl p-4 mb-4 space-y-2 text-sm list-decimal list-inside" style={{ color: "#3E4A55" }}>
          {lesson.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      ) : null}

      <p className="text-sm mb-3" style={{ color: "#5C6770" }}>{lesson.tip}</p>

      {latin ? (
        <div className="mb-3 text-sm px-3 py-2 rounded-md" style={{ background: "#FBE7E4", color: "#9A3324" }}>
          Гарын хэлийг монгол кирилл болгоно уу. Windows дээр Mongolian (Mongolia) гэж сонгоно.
        </div>
      ) : null}
      {caps && !result ? (
        <div className="mb-3 text-sm px-3 py-2 rounded-md" style={{ background: "#FBF3D8", color: "#8A5A12" }}>
          Caps Lock асаалттай байна. Унтраагаад жижиг үсгээр бич.
        </div>
      ) : null}
      {!focused && !result ? (
        <div className="mb-3 text-sm px-3 py-2 rounded-md" style={{ background: "#EAEFF8", color: "#24478F" }}>
          Үсэг бичихийн тулд доорх цагаан талбар дээр дарна уу.
        </div>
      ) : null}

      <div
        ref={boxRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="rounded-2xl px-4 py-6 sm:px-8 sm:py-8 outline-none"
        style={{
          background: "#FFFEFA",
          border: "1px solid #E6EAF2",
          boxShadow: "0 10px 24px rgba(36,71,143,0.06)",
        }}
      >
        <div className="text-2xl sm:text-[2rem] leading-relaxed tracking-wide break-words" aria-label="Бичих үсэг">
          {prompt.split("").map((ch, i) => {
            const typed = i < index;
            const current = i === index && !result;
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

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Stat label="Алдаа" value={String(result ? result.errors : errors)} />
          <Stat
            label="Нарийвчлал"
            value={
              result
                ? `${Math.round(result.accuracy * 100)}%`
                : index + errors === 0
                  ? "—"
                  : `${Math.round(liveAccuracy * 100)}%`
            }
          />
          <Stat label="Үг/мин" value={String(result ? result.wpm : liveWpm)} />
          <Stat label="Үсэг" value={`${Math.min(index, prompt.length)}/${prompt.length}`} />
        </div>
      </div>

      {result ? (
        <ResultCard lesson={lesson} result={result} nextLesson={nextLesson} onRetry={retry} onOpen={onOpen} onBack={onBack} />
      ) : (
        <>
          <div className="mt-4 text-sm font-medium" style={{ color: finger ? FINGER_COLOR[finger] : "#24478F" }}>
            {expected === " "
              ? "Дараагийнх: зай · Эрхий хуруу"
              : `Дараагийнх: ${expected} · ${finger ? FINGER_LABEL[finger] : "товч"}`}
            {shiftSide ? ` · ${shiftSide === "left" ? "Зүүн" : "Баруун"} Shift дарж байгаад үсгээ дар` : ""}
          </div>
          {showKeyboard ? <Keyboard nextChar={expected} /> : null}
          <p className="text-xs mt-3" style={{ color: "#64748B" }}>
            Энд дарж бичнэ. Буруу үсэг тоологдоод зөв үсгийг хүлээнэ. 90% хүрвэл дараагийн дасгал нээгдэнэ.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs" style={{ color: "#64748B" }}>{label}</div>
      <div className="font-semibold tabular-nums" style={{ color: "#243044" }}>{value}</div>
    </div>
  );
}

function ResultCard({ lesson, result, nextLesson, onRetry, onOpen, onBack }) {
  const pct = Math.round(result.accuracy * 100);
  const passed = result.passed;
  return (
    <div className="cn-card rounded-xl p-5 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold" style={{ color: passed ? "#2F6F4E" : "#9A3324" }}>
            {passed ? "Дасгал бүтлээ." : "90% нарийвчлалд хүрээгүй байна."}
          </div>
          <div className="text-sm mt-1" style={{ color: "#5C6770" }}>
            {pct}% · {result.wpm} үг/мин · алдаа {result.errors}
            {passed && result.stars < 3 ? ` · 3 од авахын тулд 98% ба ${lesson.goalWpm} үг/мин` : ""}
          </div>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map((star) => (
            <Star
              key={star}
              size={22}
              color={star <= result.stars ? "#C8962E" : "#E6EAF2"}
              fill={star <= result.stars ? "#C8962E" : "transparent"}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {passed && nextLesson ? (
          <button type="button" onClick={() => onOpen(nextLesson.id)} className="cn-btn-primary rounded-md px-4 py-2 text-sm font-medium inline-flex items-center gap-2">
            Дараагийн дасгал <ArrowRight size={16} />
          </button>
        ) : null}
        {passed && !nextLesson ? (
          <button type="button" onClick={onBack} className="cn-btn-primary rounded-md px-4 py-2 text-sm font-medium">
            Хичээл рүү буцах
          </button>
        ) : null}
        <button type="button" onClick={onRetry} className="cn-btn-secondary rounded-md px-4 py-2 text-sm font-medium inline-flex items-center gap-2">
          <RotateCcw size={15} /> Дахин
        </button>
      </div>
    </div>
  );
}

function Keyboard({ nextChar }) {
  const shiftSide = shiftSideFor(nextChar);
  return (
    <div className="mt-4 w-full max-w-3xl overflow-x-auto" onMouseDown={(event) => event.preventDefault()}>
      <div className="min-w-[560px] select-none">
        {KEY_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex justify-center gap-1 mb-1" style={{ paddingLeft: rowIndex === 2 ? 18 : rowIndex === 1 ? 10 : 0 }}>
            {row.map((key) => {
              const hot = (key.chars || []).includes(nextChar);
              const shiftHot = key.shift && key.shift === shiftSide;
              return (
                <div
                  key={key.id}
                  className="h-11 rounded-md flex items-center justify-center text-sm font-semibold relative"
                  style={{
                    width: key.wide ? 72 : key.space ? undefined : 40,
                    flex: key.space ? 1 : undefined,
                    background: hot ? "#24478F" : "#FFFEFA",
                    color: hot ? "#FFFFFF" : "#243044",
                    border: shiftHot ? "2px solid #C8962E" : "1px solid #E6EAF2",
                    boxShadow: hot ? "none" : `inset 0 -3px 0 ${FINGER_COLOR[key.finger] || "#E6EAF2"}`,
                  }}
                >
                  {key.label}
                  {key.bump ? (
                    <span
                      className="absolute bottom-1.5 w-1 h-1 rounded-full"
                      style={{ background: hot ? "#FFFFFF" : "#243044" }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex justify-center mt-1">
          <div
            className="h-11 rounded-md flex items-center justify-center text-sm font-semibold"
            style={{
              width: 220,
              background: nextChar === " " ? "#24478F" : "#FFFEFA",
              color: nextChar === " " ? "#FFFFFF" : "#243044",
              border: "1px solid #E6EAF2",
              boxShadow: nextChar === " " ? "none" : "inset 0 -3px 0 #64748B",
            }}
          >
            Зай
          </div>
        </div>
      </div>
    </div>
  );
}
