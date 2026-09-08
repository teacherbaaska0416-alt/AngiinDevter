import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  GraduationCap,
  Users,
  BookOpen,
  ClipboardList,
  Trophy,
  PencilLine,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  LogIn,
  School,
  Copy,
  Check,
  FileSpreadsheet,
  Download,
  FileText,
  Image as ImageIcon,
  Clock,
  Lock,
  Unlock,
} from "lucide-react";
import * as XLSX from "xlsx";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

GlobalWorkerOptions.workerSrc = pdfWorker;

const SUBJECTS = [
  "Математик",
  "Физик",
  "Хими",
  "Биологи",
  "Түүх",
  "Газарзүй",
  "Монгол хэл",
  "Англи хэл",
  "Бусад",
];

const LETTERS = ["А", "Б", "В", "Г", "Д", "Е"];
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const CLASS_SECTIONS = ["А", "Б", "В", "Г", "Д", "Е"];

const LAST_NAME_HEADERS = ["овог", "овог нэр", "surname", "last name", "lastname", "family name"];
const FIRST_NAME_HEADERS = ["нэр", "өөрийн нэр", "given name", "first name", "firstname", "name"];
const NO_HEADERS = ["№", "но", "no", "дугаар", "дэс", "дэс дугаар", "number", "student_no", "student no", "#"];

const CYR_TO_LAT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", ө: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ү: "u", ф: "f", х: "kh", ц: "ts", ч: "ch",
  ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function makeJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function normalizeHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findColumnKey(keys, candidates) {
  const normalized = keys.map((k) => ({ raw: k, norm: normalizeHeader(k) }));
  for (const cand of candidates) {
    const hit = normalized.find((k) => k.norm === cand);
    if (hit) return hit.raw;
  }
  for (const cand of candidates) {
    const hit = normalized.find((k) => k.norm.includes(cand));
    if (hit) return hit.raw;
  }
  return null;
}

function slugifyMn(text) {
  const s = String(text || "")
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => {
      if (CYR_TO_LAT[ch] != null) return CYR_TO_LAT[ch];
      if (/[a-z0-9]/.test(ch)) return ch;
      return "";
    })
    .join("");
  return s || "x";
}

/** Овог.Нэр → bat.saraa ; давхцвал bat.saraa2 */
function makeUsername(lastName, firstName, existingUsernames) {
  const base = `${slugifyMn(lastName)}.${slugifyMn(firstName)}`.replace(/^\.|\.$/g, "") || "suragch";
  const taken = new Set([...(existingUsernames || [])].map((u) => String(u).toLowerCase()));
  let candidate = base;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}${n}`;
    n += 1;
  }
  return candidate;
}

function fullStudentName(lastName, firstName) {
  return `${String(lastName || "").trim()} ${String(firstName || "").trim()}`.trim();
}

function sortStudents(list) {
  return [...list].sort(
    (a, b) =>
      (a.studentNo ?? 9999) - (b.studentNo ?? 9999) ||
      (a.lastName || "").localeCompare(b.lastName || "", "mn") ||
      (a.firstName || "").localeCompare(b.firstName || "", "mn")
  );
}

/** Excel мөрүүдээс: [{ lastName, firstName, studentNo }] */
function parseStudentsFromSheet(rows) {
  if (!rows?.length) return [];
  const keys = Object.keys(rows[0] || {});
  let lastKey = findColumnKey(keys, LAST_NAME_HEADERS);
  let firstKey = findColumnKey(keys, FIRST_NAME_HEADERS);
  // «нэр» багана овогтой давхцахгүй байх: firstKey нь lastKey биш байх
  if (firstKey && lastKey && firstKey === lastKey) {
    firstKey = keys.find((k) => k !== lastKey && FIRST_NAME_HEADERS.some((h) => normalizeHeader(k).includes(h) || normalizeHeader(k) === h)) || null;
  }
  // Зөвхөн «Нэр» байвал бүхлэх нэр гэж үзээд задлана
  const legacyNameKey = !lastKey && !firstKey
    ? findColumnKey(keys, ["овог нэр", "сурагч", "сурагчийн нэр", "student", "full name", "fullname", "нэр", "name"])
    : null;
  const noKey = findColumnKey(keys, NO_HEADERS);

  const out = [];
  const seen = new Set();
  rows.forEach((row) => {
    let lastName = "";
    let firstName = "";
    if (lastKey || firstKey) {
      lastName = String(row[lastKey] ?? "").trim();
      firstName = String(row[firstKey] ?? "").trim();
      if (lastName && !firstName) {
        const parts = lastName.split(/\s+/);
        if (parts.length >= 2) {
          lastName = parts[0];
          firstName = parts.slice(1).join(" ");
        }
      }
    } else if (legacyNameKey) {
      const raw = String(row[legacyNameKey] ?? "").trim();
      if (!raw) return;
      const parts = raw.split(/\s+/);
      if (parts.length >= 2) {
        lastName = parts[0];
        firstName = parts.slice(1).join(" ");
      } else {
        lastName = "Овог";
        firstName = raw;
      }
    } else {
      return;
    }
    if (!lastName || !firstName) return;
    if (LAST_NAME_HEADERS.includes(normalizeHeader(lastName)) || FIRST_NAME_HEADERS.includes(normalizeHeader(firstName))) return;
    const key = `${lastName.toLowerCase()}|${firstName.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    let studentNo = null;
    if (noKey != null && row[noKey] !== "" && row[noKey] != null) {
      const n = Number(row[noKey]);
      studentNo = Number.isFinite(n) ? n : null;
    }
    if (studentNo == null) studentNo = out.length + 1;
    out.push({ lastName, firstName, studentNo });
  });
  return out;
}

async function readStudentsFromExcelFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return parseStudentsFromSheet(rows);
}

function downloadStudentTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["№", "Овог", "Нэр"],
    [1, "Бат", "Эрдэнэ"],
    [2, "Дорж", "Сараа"],
    [3, "Ганбат", "Тэмүүлэн"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Сурагчид");
  XLSX.writeFile(wb, "suragchid-zagvar.xlsx");
}

const QUIZ_LETTER_INDEX = {
  А: 0, Б: 1, В: 2, Г: 3,
  A: 0, B: 1, C: 2, D: 3,
  а: 0, б: 1, в: 2, г: 3,
  a: 0, b: 1, c: 2, d: 3,
};

function quizLetterIndex(ch) {
  if (!ch) return null;
  if (QUIZ_LETTER_INDEX[ch] != null) return QUIZ_LETTER_INDEX[ch];
  const up = ch.toUpperCase();
  return QUIZ_LETTER_INDEX[up] != null ? QUIZ_LETTER_INDEX[up] : null;
}

/** Тогтмол форматтай текстээс шалгалтын асуулт гаргана */
function parseQuizFromText(raw) {
  const text = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ");

  let title = "";
  let subject = SUBJECTS[0];
  const titleMatch = text.match(/^\s*Гарчиг\s*[:：]\s*(.+)$/im);
  if (titleMatch) title = titleMatch[1].trim();
  const subjectMatch = text.match(/^\s*Хичээл\s*[:：]\s*(.+)$/im);
  if (subjectMatch) {
    const s = subjectMatch[1].trim();
    subject =
      SUBJECTS.find((x) => x.toLowerCase() === s.toLowerCase()) ||
      SUBJECTS.find((x) => s.toLowerCase().includes(x.toLowerCase())) ||
      SUBJECTS[0];
  }

  const re = /(?:^|\n)\s*(\d+)\s*[\.\)]\s*([\s\S]*?)(?=(?:\n\s*\d+\s*[\.\)]\s*)|$)/g;
  const questions = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    let block = m[2].trim();
    if (!block) continue;

    let correct = 0;
    const correctMatch =
      block.match(/Зөв\s*(?:хариулт)?\s*[:：]\s*([АБВГабвгABCDabcd])/i) ||
      block.match(/Correct\s*[:：]\s*([ABCDabcd])/i);
    if (correctMatch) {
      const idx = quizLetterIndex(correctMatch[1]);
      if (idx != null) correct = idx;
    }

    block = block
      .replace(/\n?\s*Зөв\s*(?:хариулт)?\s*[:：]\s*[АБВГабвгABCDabcd]\s*/gi, "\n")
      .replace(/\n?\s*Correct\s*[:：]\s*[ABCDabcd]\s*/gi, "\n")
      .trim();

    const options = ["", "", "", ""];
    const optRe = /(?:^|\n)\s*([АБВГабвгABCDabcd])\s*[\)\.\-:：]\s*(.+)/g;
    const starts = [];
    let om;
    while ((om = optRe.exec(block)) !== null) {
      const idx = quizLetterIndex(om[1]);
      if (idx == null || idx > 3) continue;
      options[idx] = om[2].replace(/\s+/g, " ").trim();
      starts.push(om.index);
    }

    let qText = block;
    if (starts.length) {
      qText = block.slice(0, starts[0]).replace(/\s+/g, " ").trim();
    } else {
      qText = block.replace(/\s+/g, " ").trim();
    }

    if (!qText) continue;
    questions.push({
      text: qText,
      imageUrl: "",
      options: options.map((t) => ({ text: t, imageUrl: "" })),
      correct,
    });
  }

  return { title, subject, questions };
}

async function extractTextFromPdfFile(file) {
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY = null;
    const lines = [];
    let line = "";
    for (const item of content.items) {
      if (!item.str && !item.hasEOL) continue;
      const y = item.transform?.[5];
      if (lastY != null && y != null && Math.abs(y - lastY) > 4) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
      if (item.str) {
        const needSpace = line && !/\s$/.test(line) && !/^\s/.test(item.str);
        line += (needSpace ? " " : "") + item.str;
      }
      if (item.hasEOL) {
        if (line.trim()) lines.push(line.trim());
        line = "";
        lastY = null;
        continue;
      }
      lastY = y ?? lastY;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join("\n"));
  }
  return pages.join("\n\n");
}

async function readQuizFromFile(file) {
  const name = (file.name || "").toLowerCase();
  let text = "";
  if (name.endsWith(".pdf")) {
    text = await extractTextFromPdfFile(file);
  } else {
    text = await file.text();
  }
  return { text, parsed: parseQuizFromText(text) };
}

function emptyOption() {
  return { text: "", imageUrl: "" };
}

function emptyQuestion() {
  return {
    text: "",
    imageUrl: "",
    options: [emptyOption(), emptyOption(), emptyOption(), emptyOption()],
    correct: 0,
  };
}

function normalizeOption(o) {
  if (typeof o === "string") return { text: o, imageUrl: "" };
  return { text: o?.text || "", imageUrl: o?.imageUrl || "" };
}

function normalizeQuestion(q) {
  const options = (q?.options || []).map(normalizeOption);
  while (options.length < 4) options.push(emptyOption());
  return {
    text: q?.text || "",
    imageUrl: q?.imageUrl || "",
    options: options.slice(0, 4),
    correct: typeof q?.correct === "number" ? q.correct : 0,
  };
}

function optionHasContent(o) {
  const opt = normalizeOption(o);
  return Boolean(opt.text.trim() || opt.imageUrl);
}

function questionHasContent(q) {
  const nq = normalizeQuestion(q);
  return Boolean(nq.text.trim() || nq.imageUrl);
}

function formatCountdown(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function quizDeadlineKey(quizId, username) {
  return `quiz-deadline:${quizId}:${username || "anon"}`;
}

function fmtDate(ts) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("mn-MN", { year: "numeric", month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function ClassroomApp() {
  const [role, setRole] = useState(null); // null | 'teacher' | 'student'
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showTeacherLogin, setShowTeacherLogin] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentSession, setStudentSession] = useState(null); // { id, username, name, classId, className, ... }
  const [studentLoginError, setStudentLoginError] = useState("");
  const [studentLoginLoading, setStudentLoginLoading] = useState(false);
  const [teacherUser, setTeacherUser] = useState(null);
  const [teacherLoginError, setTeacherLoginError] = useState("");
  const [teacherLoginLoading, setTeacherLoginLoading] = useState(false);
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");

  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [activeClassId, setActiveClassId] = useState(null);
  const [studentLastNameInput, setStudentLastNameInput] = useState("");
  const [studentFirstNameInput, setStudentFirstNameInput] = useState("");
  const [studentImportMsg, setStudentImportMsg] = useState("");
  const [studentImportLoading, setStudentImportLoading] = useState(false);

  const [teacherTab, setTeacherTab] = useState("home");
  const [studentTab, setStudentTab] = useState("home");

  const [activeLesson, setActiveLesson] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);

  const [lessonForm, setLessonForm] = useState({ title: "", subject: SUBJECTS[0], content: "" });
  const [quizForm, setQuizForm] = useState({
    title: "",
    subject: SUBJECTS[0],
    durationMinutes: 30,
    questions: [emptyQuestion()],
  });
  const [classForm, setClassForm] = useState({ grade: 7, section: "А" });

  const mapLesson = (l) => ({ id: l.id, title: l.title, subject: l.subject, content: l.content, createdAt: new Date(l.created_at).getTime() });
  const mapQuiz = (q) => ({
    id: q.id,
    title: q.title,
    subject: q.subject,
    questions: (q.questions || []).map(normalizeQuestion),
    durationMinutes: Number(q.duration_minutes) > 0 ? Number(q.duration_minutes) : 30,
    isOpen: Boolean(q.is_open),
    createdAt: new Date(q.created_at).getTime(),
  });
  const mapClass = (c) => ({
    id: c.id,
    name: c.name,
    grade: c.grade,
    section: c.section,
    joinCode: c.join_code,
    teacherId: c.teacher_id,
    createdAt: new Date(c.created_at).getTime(),
  });
  const mapStudent = (s) => ({
    id: s.id,
    classId: s.class_id,
    lastName: s.last_name || "",
    firstName: s.first_name || "",
    name: s.name || fullStudentName(s.last_name, s.first_name),
    username: s.username || "",
    studentNo: s.student_no,
    createdAt: new Date(s.created_at).getTime(),
  });
  const mapAttempt = (a) => ({
    id: a.id,
    studentName: a.student_name,
    quizId: a.quiz_id,
    quizTitle: a.quiz_title,
    subject: a.subject,
    score: a.score,
    total: a.total,
    date: new Date(a.date).getTime(),
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setSaveError("");
    if (!isSupabaseConfigured || !supabase) {
      setSaveError(
        "Supabase тохиргоо дутуу байна. .env.example-ийг .env болгон хуулж, Project URL болон anon key-ээ оруулна уу. Дараа нь dev server-ээ дахин асаана (Ctrl+C, npm run dev)."
      );
      setLoading(false);
      return;
    }
    try {
      const [lessonsRes, quizzesRes, attemptsRes, classesRes, studentsRes] = await Promise.all([
        supabase.from("lessons").select("*").order("created_at", { ascending: false }),
        supabase.from("quizzes").select("*").order("created_at", { ascending: false }),
        supabase.from("attempts").select("*").order("date", { ascending: false }),
        supabase.from("classes").select("*").order("created_at", { ascending: false }),
        supabase.from("students").select("*").order("student_no", { ascending: true }),
      ]);
      if (lessonsRes.error || quizzesRes.error || attemptsRes.error) {
        throw lessonsRes.error || quizzesRes.error || attemptsRes.error;
      }
      setLessons((lessonsRes.data || []).map(mapLesson));
      setQuizzes((quizzesRes.data || []).map(mapQuiz));
      setAttempts((attemptsRes.data || []).map(mapAttempt));
      if (!classesRes.error) {
        setClasses((classesRes.data || []).map(mapClass));
      } else if (classesRes.error.code !== "42P01" && !classesRes.error.message?.includes("does not exist")) {
        setClasses([]);
      }
      if (!studentsRes.error) {
        setStudents((studentsRes.data || []).map(mapStudent));
      } else {
        setStudents([]);
      }
    } catch (e) {
      setSaveError("Дата ачаалахад алдаа гарлаа. Supabase тохиргоогоо шалгана уу.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setTeacherUser({ id: session.user.id, email: session.user.email });
        loadAll();
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setTeacherUser({ id: session.user.id, email: session.user.email });
        if (_event === "SIGNED_IN") loadAll();
      } else {
        setTeacherUser(null);
        setClasses([]);
        setStudents([]);
        setActiveClassId(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadAll]);

  async function handleTeacherClick() {
    setShowNamePrompt(false);
    setTeacherLoginError("");
    if (teacherUser) {
      setRole("teacher");
      loadAll();
      return;
    }
    setShowTeacherLogin(true);
  }

  async function teacherLogin(e) {
    e?.preventDefault();
    if (!supabase || !teacherEmail.trim() || !teacherPassword) return;
    setTeacherLoginLoading(true);
    setTeacherLoginError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: teacherEmail.trim(),
      password: teacherPassword,
    });
    setTeacherLoginLoading(false);
    if (error) {
      setTeacherLoginError(
        error.message.includes("Invalid login")
          ? "Имэйл эсвэл нууц үг буруу байна."
          : "Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу."
      );
      return;
    }
    setTeacherUser({ id: data.user.id, email: data.user.email });
    setTeacherPassword("");
    setShowTeacherLogin(false);
    setRole("teacher");
    // Нэвтэрсний дараа өөрийн ангиудыг дахин ачаална (RLS)
    loadAll();
  }

  async function addLesson() {
    if (!lessonForm.title.trim() || !lessonForm.content.trim()) return;
    const { data, error } = await supabase
      .from("lessons")
      .insert({ title: lessonForm.title, subject: lessonForm.subject, content: lessonForm.content })
      .select()
      .single();
    if (error) {
      setSaveError(error.code === "42501" || error.message?.includes("policy")
        ? "Эрх хүрэлцэхгүй байна. Багшаар нэвтэрсэн эсэхээ шалгана уу."
        : "Хичээл хадгалахад алдаа гарлаа.");
      return;
    }
    setLessons((prev) => [mapLesson(data), ...prev]);
    setLessonForm({ title: "", subject: SUBJECTS[0], content: "" });
  }

  async function deleteLesson(id) {
    const prev = lessons;
    setLessons(lessons.filter((l) => l.id !== id));
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) {
      setSaveError("Хичээл устгахад алдаа гарлаа.");
      setLessons(prev);
    }
  }

  function updateQuestion(idx, field, value) {
    setQuizForm((f) => {
      const questions = f.questions.map((q, i) => (i === idx ? { ...normalizeQuestion(q), [field]: value } : q));
      return { ...f, questions };
    });
  }

  function updateOption(qIdx, optIdx, value) {
    setQuizForm((f) => {
      const questions = f.questions.map((q, i) => {
        if (i !== qIdx) return q;
        const nq = normalizeQuestion(q);
        const options = nq.options.map((o, oi) => (oi === optIdx ? { ...o, text: value } : o));
        return { ...nq, options };
      });
      return { ...f, questions };
    });
  }

  function updateOptionImage(qIdx, optIdx, imageUrl) {
    setQuizForm((f) => {
      const questions = f.questions.map((q, i) => {
        if (i !== qIdx) return q;
        const nq = normalizeQuestion(q);
        const options = nq.options.map((o, oi) => (oi === optIdx ? { ...o, imageUrl: imageUrl || "" } : o));
        return { ...nq, options };
      });
      return { ...f, questions };
    });
  }

  function addQuestionToForm() {
    setQuizForm((f) => ({ ...f, questions: [...f.questions, emptyQuestion()] }));
  }

  function removeQuestionFromForm(idx) {
    setQuizForm((f) => {
      if (f.questions.length <= 1) return f;
      return { ...f, questions: f.questions.filter((_, i) => i !== idx) };
    });
  }

  function quizFormValid() {
    if (!quizForm.title.trim()) return false;
    if (!(Number(quizForm.durationMinutes) > 0)) return false;
    return quizForm.questions.every(
      (q) => questionHasContent(q) && normalizeQuestion(q).options.every(optionHasContent)
    );
  }

  function quizFormMissingHints() {
    const hints = [];
    if (!quizForm.title.trim()) hints.push("Шалгалтын гарчиг оруулна");
    if (!(Number(quizForm.durationMinutes) > 0)) hints.push("Шалгалтын хугацаа (минут) оруулна");
    quizForm.questions.forEach((q, qi) => {
      const nq = normalizeQuestion(q);
      if (!questionHasContent(nq)) {
        hints.push(`Асуулт ${qi + 1}: текст эсвэл зураг оруулна`);
      }
      nq.options.forEach((opt, oi) => {
        if (!optionHasContent(opt)) {
          hints.push(`Асуулт ${qi + 1}: ${LETTERS[oi]} сонголт (текст эсвэл зураг) оруулна`);
        }
      });
    });
    return hints;
  }

  async function uploadQuizImage(file) {
    if (!supabase || !teacherUser?.id) {
      setSaveError("Зураг оруулахын тулд багшаар нэвтэрнэ үү.");
      return null;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setSaveError("Зөвхөн JPG, PNG, WEBP, GIF зураг оруулна.");
      return null;
    }
    if (file.size > 3 * 1024 * 1024) {
      setSaveError("Зургийн хэмжээ 3MB-аас бага байх ёстой.");
      return null;
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${teacherUser.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("quiz-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      const msg = error.message || "";
      if (/bucket|not found|row-level security|policy/i.test(msg)) {
        setSaveError("Зургийн хадгалалт тохироогүй байна. Supabase SQL Editor-т supabase-quiz-images.sql-ийг Run хийнэ үү.");
      } else {
        setSaveError("Зураг байршуулахад алдаа гарлаа.");
      }
      return null;
    }
    setSaveError("");
    const { data } = supabase.storage.from("quiz-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function addQuiz() {
    if (!quizFormValid()) return false;
    const questions = quizForm.questions.map(normalizeQuestion);
    const durationMinutes = Math.max(1, Math.round(Number(quizForm.durationMinutes) || 30));
    const { data, error } = await supabase
      .from("quizzes")
      .insert({
        title: quizForm.title,
        subject: quizForm.subject,
        questions,
        duration_minutes: durationMinutes,
        is_open: false,
      })
      .select()
      .single();
    if (error) {
      if (error.message?.includes("duration_minutes") || error.message?.includes("is_open")) {
        setSaveError("Шалгалтын хугацааны багана байхгүй. Supabase SQL Editor-т supabase-quiz-timing.sql-ийг Run хийнэ үү.");
      } else {
        setSaveError("Шалгалт хадгалахад алдаа гарлаа.");
      }
      return false;
    }
    setQuizzes((prev) => [mapQuiz(data), ...prev]);
    setQuizForm({ title: "", subject: SUBJECTS[0], durationMinutes: 30, questions: [emptyQuestion()] });
    return true;
  }

  async function deleteQuiz(id) {
    const prev = quizzes;
    setQuizzes(quizzes.filter((q) => q.id !== id));
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) {
      setSaveError("Шалгалт устгахад алдаа гарлаа.");
      setQuizzes(prev);
    }
  }

  async function setQuizOpen(id, isOpen) {
    const prev = quizzes;
    setQuizzes((list) => list.map((q) => (q.id === id ? { ...q, isOpen } : q)));
    const { data, error } = await supabase
      .from("quizzes")
      .update({ is_open: isOpen })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      setQuizzes(prev);
      if (error.message?.includes("is_open") || error.code === "PGRST204") {
        setSaveError("Шалгалт нээх багана байхгүй. Supabase SQL Editor-т supabase-quiz-timing.sql-ийг Run хийнэ үү.");
      } else if (error.code === "42501" || error.message?.includes("policy")) {
        setSaveError("Шалгалт нээх эрх хүрэлцэхгүй. supabase-quiz-timing.sql-ийг Run хийнэ үү.");
      } else {
        setSaveError("Шалгалтын төлөв шинэчлэхэд алдаа гарлаа.");
      }
      return;
    }
    setQuizzes((list) => list.map((q) => (q.id === id ? mapQuiz(data) : q)));
  }

  async function addClass() {
    if (!teacherUser?.id) {
      setSaveError("Анги үүсгэхийн тулд багшаар нэвтэрнэ үү.");
      return;
    }
    const name = `${classForm.grade}${classForm.section}`;
    const payload = {
      name,
      grade: classForm.grade,
      section: classForm.section,
      join_code: makeJoinCode(),
      teacher_id: teacherUser.id,
    };
    const { data, error } = await supabase.from("classes").insert(payload).select().single();
    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        setSaveError("Анги хүснэгт байхгүй байна. Supabase SQL Editor-т supabase-classes.sql-ийг Run хийнэ үү.");
      } else if (error.code === "42501" || error.message?.includes("policy")) {
        setSaveError("Эрх хүрэлцэхгүй байна. Багшаар нэвтэрсэн эсэхээ шалгана уу.");
      } else if (error.code === "23505") {
        // join_code давхцвал дахин оролдоно
        const retry = { ...payload, join_code: makeJoinCode() };
        const { data: data2, error: err2 } = await supabase.from("classes").insert(retry).select().single();
        if (err2) {
          setSaveError("Анги хадгалахад алдаа гарлаа.");
          return;
        }
        setClasses((prev) => [mapClass(data2), ...prev]);
        setClassForm({ grade: 7, section: "А" });
        return;
      } else {
        setSaveError("Анги хадгалахад алдаа гарлаа.");
      }
      return;
    }
    setClasses((prev) => [mapClass(data), ...prev]);
    setClassForm({ grade: 7, section: "А" });
  }

  async function deleteClass(id) {
    const prevClasses = classes;
    const prevStudents = students;
    setClasses(classes.filter((c) => c.id !== id));
    setStudents(students.filter((s) => s.classId !== id));
    if (activeClassId === id) setActiveClassId(null);
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) {
      setSaveError("Анги устгахад алдаа гарлаа.");
      setClasses(prevClasses);
      setStudents(prevStudents);
    }
  }

  async function addStudent(classId, lastName, firstName, studentNo, usernamePool) {
    const ln = lastName.trim();
    const fn = firstName.trim();
    if (!classId || !ln || !fn) return { ok: false };
    const pool = usernamePool || students.map((s) => s.username).filter(Boolean);
    const username = makeUsername(ln, fn, pool);
    const payload = {
      class_id: classId,
      last_name: ln,
      first_name: fn,
      name: fullStudentName(ln, fn),
      username,
      student_no: studentNo ?? null,
    };
    const { data, error } = await supabase.from("students").insert(payload).select().single();
    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        setSaveError("Сурагчдын хүснэгт байхгүй байна. Supabase SQL Editor-т supabase-students.sql (эсвэл supabase-students-v2.sql)-ийг Run хийнэ үү.");
      } else if (error.code === "23505") {
        return { ok: false, duplicate: true };
      } else if (error.message?.includes("last_name") || error.message?.includes("username")) {
        setSaveError("Сурагчийн багана шинэчлэгдээгүй байна. Supabase SQL Editor-т supabase-students-v2.sql-ийг Run хийнэ үү.");
      } else if (error.code === "42501" || error.message?.includes("policy")) {
        setSaveError("Эрх хүрэлцэхгүй байна. Багшаар нэвтэрсэн эсэхээ шалгана уу.");
      } else {
        setSaveError("Сурагч хадгалахад алдаа гарлаа.");
      }
      return { ok: false };
    }
    setStudents((prev) => sortStudents([...prev, mapStudent(data)]));
    return { ok: true, username };
  }

  async function addStudentManual() {
    if (!activeClassId || !studentLastNameInput.trim() || !studentFirstNameInput.trim()) return;
    const existing = students.filter((s) => s.classId === activeClassId);
    const nextNo = existing.length ? Math.max(...existing.map((s) => s.studentNo || 0)) + 1 : 1;
    const res = await addStudent(activeClassId, studentLastNameInput, studentFirstNameInput, nextNo);
    if (res.ok) {
      setStudentLastNameInput("");
      setStudentFirstNameInput("");
      setStudentImportMsg(res.username ? `Нэвтрэх нэр: ${res.username}` : "");
    } else if (res.duplicate) {
      setStudentImportMsg("Энэ овог, нэртэй сурагч аль хэдийн бүртгэлтэй байна.");
    }
  }

  async function importStudentsFromExcel(file, classId) {
    if (!file || !classId) return;
    setStudentImportLoading(true);
    setStudentImportMsg("");
    setSaveError("");
    try {
      const parsed = await readStudentsFromExcelFile(file);
      if (!parsed.length) {
        setStudentImportMsg("Excel-ээс овог/нэр олдсонгүй. «Овог», «Нэр» багана байгаа эсэхээ шалгана уу.");
        setStudentImportLoading(false);
        return;
      }
      const existingKeys = new Set(
        students
          .filter((s) => s.classId === classId)
          .map((s) => `${(s.lastName || "").toLowerCase()}|${(s.firstName || "").toLowerCase()}`)
      );
      const toInsert = parsed.filter((p) => !existingKeys.has(`${p.lastName.toLowerCase()}|${p.firstName.toLowerCase()}`));
      const skipped = parsed.length - toInsert.length;
      if (!toInsert.length) {
        setStudentImportMsg(`Бүх ${parsed.length} сурагч аль хэдийн бүртгэлтэй байна.`);
        setStudentImportLoading(false);
        return;
      }
      const usernamePool = students.map((s) => s.username).filter(Boolean);
      const rows = toInsert.map((p) => {
        const username = makeUsername(p.lastName, p.firstName, usernamePool);
        usernamePool.push(username);
        return {
          class_id: classId,
          last_name: p.lastName,
          first_name: p.firstName,
          name: fullStudentName(p.lastName, p.firstName),
          username,
          student_no: p.studentNo,
        };
      });
      const { data, error } = await supabase.from("students").insert(rows).select();
      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setSaveError("Сурагчдын хүснэгт байхгүй байна. Supabase SQL Editor-т supabase-students.sql-ийг Run хийнэ үү.");
        } else if (error.message?.includes("last_name") || error.message?.includes("username")) {
          setSaveError("Сурагчийн багана шинэчлэгдээгүй байна. Supabase SQL Editor-т supabase-students-v2.sql-ийг Run хийнэ үү.");
        } else {
          setSaveError("Excel-ээс сурагч оруулахад алдаа гарлаа.");
        }
        setStudentImportLoading(false);
        return;
      }
      const mapped = (data || []).map(mapStudent);
      setStudents((prev) => sortStudents([...prev, ...mapped]));
      setStudentImportMsg(
        skipped > 0
          ? `${mapped.length} сурагч нэмэгдлээ (нэвтрэх нэр автоматаар үүссэн), ${skipped} давхардсаныг алгаслаа.`
          : `${mapped.length} сурагч Excel-ээс амжилттай нэмэгдлээ. Нэвтрэх нэр автоматаар үүссэн.`
      );
    } catch {
      setStudentImportMsg("Excel файл уншихад алдаа гарлаа. .xlsx эсвэл .xls формат ашиглана уу.");
    }
    setStudentImportLoading(false);
  }

  async function deleteStudent(id) {
    const prev = students;
    setStudents(students.filter((s) => s.id !== id));
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) {
      setSaveError("Сурагч устгахад алдаа гарлаа.");
      setStudents(prev);
    }
  }

  const submittingQuizRef = useRef(false);

  async function submitQuiz(opts = {}) {
    if (!activeQuiz || submittingQuizRef.current) return;
    const force = opts.force === true;
    const questions = (activeQuiz.questions || []).map(normalizeQuestion);
    if (!force && !questions.every((_, i) => quizAnswers[i] !== undefined)) return;

    submittingQuizRef.current = true;
    let score = 0;
    questions.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) score += 1;
    });
    const total = questions.length;
    try {
      const { data, error } = await supabase
        .from("attempts")
        .insert({
          student_name: studentSession?.name || studentName,
          quiz_id: activeQuiz.id,
          quiz_title: activeQuiz.title,
          subject: activeQuiz.subject,
          score,
          total,
        })
        .select()
        .single();
      if (error) {
        setSaveError("Үр дүн хадгалахад алдаа гарлаа.");
      } else {
        setAttempts((prev) => [mapAttempt(data), ...prev]);
      }
      try {
        sessionStorage.removeItem(quizDeadlineKey(activeQuiz.id, studentSession?.username));
      } catch {
        // ignore
      }
      setQuizResult({ score, total, timedOut: force });
      setStudentTab("quiz-result");
    } finally {
      submittingQuizRef.current = false;
    }
  }

  async function studentLogin(e) {
    e?.preventDefault();
    const username = nameInput.trim();
    if (!username || !supabase) return;
    setStudentLoginLoading(true);
    setStudentLoginError("");
    try {
      const { data, error } = await supabase.rpc("lookup_student_login", {
        p_username: username,
      });
      if (error) {
        if (error.message?.includes("lookup_student_login") || error.code === "PGRST202") {
          setStudentLoginError("Нэвтрэх функц байхгүй байна. Supabase SQL Editor-т supabase-student-login.sql-ийг Run хийнэ үү.");
        } else {
          setStudentLoginError("Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.");
        }
        setStudentLoginLoading(false);
        return;
      }
      if (!data || !data.username) {
        setStudentLoginError("Ийм нэвтрэх нэр бүртгэлгүй байна. Багшаасаа нэвтрэх нэрээ авна уу.");
        setStudentLoginLoading(false);
        return;
      }
      const session = {
        id: data.id,
        classId: data.class_id,
        lastName: data.last_name || "",
        firstName: data.first_name || "",
        name: data.name || fullStudentName(data.last_name, data.first_name),
        username: data.username,
        studentNo: data.student_no,
        className: data.class_name || "",
      };
      setStudentSession(session);
      setStudentName(session.name);
      setNameInput("");
      setShowNamePrompt(false);
      setRole("student");
    } catch {
      setStudentLoginError("Нэвтрэхэд алдаа гарлаа. Дахин оролдоно уу.");
    }
    setStudentLoginLoading(false);
  }

  async function exitToRoleSelect() {
    if (role === "teacher" && supabase) {
      await supabase.auth.signOut();
      setTeacherUser(null);
    }
    setRole(null);
    setShowTeacherLogin(false);
    setShowNamePrompt(false);
    setTeacherLoginError("");
    setTeacherEmail("");
    setTeacherPassword("");
    setStudentLoginError("");
    setStudentSession(null);
    setStudentName("");
    setNameInput("");
    setTeacherTab("home");
    setStudentTab("home");
    setActiveLesson(null);
    setActiveQuiz(null);
    setQuizAnswers({});
    setQuizResult(null);
    setActiveClassId(null);
    setStudentLastNameInput("");
    setStudentFirstNameInput("");
    setStudentImportMsg("");
  }

  const myAttempts = attempts
    .filter((a) => a.studentName === studentName || (studentSession?.username && a.studentName === studentSession.username))
    .sort((a, b) => b.date - a.date);
  const allAttemptsSorted = [...attempts].sort((a, b) => b.date - a.date);

  return (
    <div className="cn-app min-h-screen w-full" style={{ backgroundColor: "#F3EFE4" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
        .cn-app { font-family: 'Inter', sans-serif; color: #2B2A25; }
        .cn-hand { font-family: 'Caveat', cursive; }
        .cn-paper {
          background-color: #F3EFE4;
          background-image:
            linear-gradient(#DCE1E0 1px, transparent 1px),
            linear-gradient(90deg, #DCE1E0 1px, transparent 1px);
          background-size: 26px 26px;
        }
        .cn-card {
          background: #FBF9F2;
          border: 1px solid #E3DCC8;
          box-shadow: 2px 3px 0 rgba(36,71,143,0.08);
        }
        .cn-btn-primary {
          background: #24478F;
          color: #FBF9F2;
        }
        .cn-btn-primary:hover { background: #1c3670; }
        .cn-btn-secondary {
          background: transparent;
          border: 1.5px solid #24478F;
          color: #24478F;
        }
        .cn-btn-secondary:hover { background: #EAEFF8; }
        .cn-tag {
          font-family: 'Inter', sans-serif;
          font-size: 0.7rem;
          font-weight: 600;
          color: #24478F;
          background: #E5EAF5;
          border-radius: 999px;
          padding: 2px 10px;
        }
        .cn-input, .cn-textarea, .cn-select {
          background: #FFFEFA;
          border: 1.5px solid #D8D0BA;
          border-radius: 6px;
        }
        .cn-input:focus, .cn-textarea:focus, .cn-select:focus {
          outline: none;
          border-color: #24478F;
        }
        .cn-option {
          border: 1.5px solid #D8D0BA;
          background: #FFFEFA;
        }
        .cn-option.selected {
          border-color: #24478F;
          background: #EAEFF8;
        }
        .cn-stamp {
          border: 4px solid currentColor;
          border-radius: 9999px;
          transform: rotate(-7deg);
        }
      `}</style>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-screen gap-3">
          <Loader2 className="animate-spin" size={32} color="#24478F" />
          <p className="text-sm" style={{ color: "#6B6858" }}>Дэвтэр нээгдэж байна...</p>
        </div>
      ) : role === null ? (
        <>
          {saveError && (
            <div className="fixed top-4 left-4 right-4 z-50 max-w-xl mx-auto text-sm px-3 py-2 rounded shadow" style={{ background: "#FBE7E4", color: "#9A3324" }}>
              {saveError}
            </div>
          )}
          <RoleSelect
            showNamePrompt={showNamePrompt}
            setShowNamePrompt={setShowNamePrompt}
            showTeacherLogin={showTeacherLogin}
            setShowTeacherLogin={setShowTeacherLogin}
            nameInput={nameInput}
            setNameInput={setNameInput}
            teacherEmail={teacherEmail}
            setTeacherEmail={setTeacherEmail}
            teacherPassword={teacherPassword}
            setTeacherPassword={setTeacherPassword}
            teacherLoginError={teacherLoginError}
            teacherLoginLoading={teacherLoginLoading}
            studentLoginError={studentLoginError}
            setStudentLoginError={setStudentLoginError}
            studentLoginLoading={studentLoginLoading}
            onTeacher={handleTeacherClick}
            onTeacherLogin={teacherLogin}
            onStudentLogin={studentLogin}
          />
        </>
      ) : (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <TopBar
            role={role}
            studentName={studentName}
            studentUsername={studentSession?.username}
            studentClassName={studentSession?.className}
            teacherEmail={teacherUser?.email}
            onExit={exitToRoleSelect}
          />
          {saveError && (
            <div className="mb-4 text-sm px-3 py-2 rounded flex items-center justify-between" style={{ background: "#FBE7E4", color: "#9A3324" }}>
              <span>{saveError}</span>
              <button onClick={loadAll} className="underline text-xs shrink-0 ml-3">Дахин ачаалах</button>
            </div>
          )}

          {role === "teacher" && (
            <TeacherView
              tab={teacherTab}
              setTab={setTeacherTab}
              lessons={lessons}
              quizzes={quizzes}
              attempts={allAttemptsSorted}
              classes={classes}
              lessonForm={lessonForm}
              setLessonForm={setLessonForm}
              addLesson={addLesson}
              deleteLesson={deleteLesson}
              quizForm={quizForm}
              setQuizForm={setQuizForm}
              updateQuestion={updateQuestion}
              updateOption={updateOption}
              updateOptionImage={updateOptionImage}
              uploadQuizImage={uploadQuizImage}
              addQuestionToForm={addQuestionToForm}
              removeQuestionFromForm={removeQuestionFromForm}
              addQuiz={addQuiz}
              deleteQuiz={deleteQuiz}
              setQuizOpen={setQuizOpen}
              quizFormValid={quizFormValid()}
              quizFormMissingHints={quizFormMissingHints()}
              classForm={classForm}
              setClassForm={setClassForm}
              addClass={addClass}
              deleteClass={deleteClass}
              students={students}
              activeClassId={activeClassId}
              setActiveClassId={setActiveClassId}
              studentLastNameInput={studentLastNameInput}
              setStudentLastNameInput={setStudentLastNameInput}
              studentFirstNameInput={studentFirstNameInput}
              setStudentFirstNameInput={setStudentFirstNameInput}
              addStudentManual={addStudentManual}
              importStudentsFromExcel={importStudentsFromExcel}
              deleteStudent={deleteStudent}
              studentImportMsg={studentImportMsg}
              setStudentImportMsg={setStudentImportMsg}
              studentImportLoading={studentImportLoading}
            />
          )}

          {role === "student" && (
            <StudentView
              tab={studentTab}
              setTab={setStudentTab}
              lessons={lessons}
              quizzes={quizzes}
              myAttempts={myAttempts}
              activeLesson={activeLesson}
              setActiveLesson={setActiveLesson}
              activeQuiz={activeQuiz}
              setActiveQuiz={setActiveQuiz}
              quizAnswers={quizAnswers}
              setQuizAnswers={setQuizAnswers}
              quizResult={quizResult}
              submitQuiz={submitQuiz}
              studentUsername={studentSession?.username || ""}
            />
          )}
        </div>
      )}
    </div>
  );
}

function RoleSelect({
  showNamePrompt,
  setShowNamePrompt,
  showTeacherLogin,
  setShowTeacherLogin,
  nameInput,
  setNameInput,
  teacherEmail,
  setTeacherEmail,
  teacherPassword,
  setTeacherPassword,
  teacherLoginError,
  teacherLoginLoading,
  studentLoginError,
  setStudentLoginError,
  studentLoginLoading,
  onTeacher,
  onTeacherLogin,
  onStudentLogin,
}) {
  return (
    <div className="cn-paper min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <span
        role="img"
        aria-label="Ангийн Дэвтэр"
        className="w-48 h-48 sm:w-56 sm:h-56 mb-4 block"
        style={{
          backgroundColor: "#24478F",
          WebkitMask: "url(/img/logo.png) center / contain no-repeat",
          mask: "url(/img/logo.png) center / contain no-repeat",
        }}
      />
      <h1 className="cn-hand text-6xl mb-2" style={{ color: "#24478F" }}>Ангийн Дэвтэр</h1>
      <p className="text-sm mb-10" style={{ color: "#6B6858" }}>Хичээл заах, шалгалт авах онлайн дэвтэр</p>

      <div className="grid sm:grid-cols-2 gap-5 w-full max-w-2xl">
        <button
          onClick={onTeacher}
          className="cn-card rounded-xl p-6 text-left transition-transform hover:-translate-y-0.5"
        >
          <GraduationCap size={28} color="#24478F" />
          <div className="cn-hand text-3xl mt-3" style={{ color: "#24478F" }}>Багш</div>
          <p className="text-sm mt-1" style={{ color: "#6B6858" }}>
            Имэйл, нууц үгээр нэвтэрч анги үүсгэх, хичээл нэмэх, шалгалт үүсгэх
          </p>
        </button>

        <button
          onClick={() => {
            setShowTeacherLogin(false);
            setStudentLoginError("");
            setShowNamePrompt(true);
          }}
          className="cn-card rounded-xl p-6 text-left transition-transform hover:-translate-y-0.5"
        >
          <Users size={28} color="#24478F" />
          <div className="cn-hand text-3xl mt-3" style={{ color: "#24478F" }}>Сурагч</div>
          <p className="text-sm mt-1" style={{ color: "#6B6858" }}>
            Бүртгэлтэй нэвтрэх нэрээрээ орж хичээл унших, шалгалт өгөх
          </p>
        </button>
      </div>

      {showTeacherLogin && (
        <form onSubmit={onTeacherLogin} className="cn-card rounded-xl p-5 mt-6 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-4">
            <LogIn size={18} color="#24478F" />
            <span className="font-semibold text-sm" style={{ color: "#24478F" }}>Багшийн нэвтрэлт</span>
          </div>
          {teacherLoginError && (
            <p className="text-xs mb-3 px-2 py-1.5 rounded" style={{ background: "#FBE7E4", color: "#9A3324" }}>
              {teacherLoginError}
            </p>
          )}
          <label className="text-sm font-medium block mb-1" style={{ color: "#2B2A25" }}>Имэйл</label>
          <input
            autoFocus
            type="email"
            required
            className="cn-input w-full px-3 py-2 text-sm mb-3"
            placeholder="bagsh@school.mn"
            value={teacherEmail}
            onChange={(e) => setTeacherEmail(e.target.value)}
          />
          <label className="text-sm font-medium block mb-1" style={{ color: "#2B2A25" }}>Нууц үг</label>
          <input
            type="password"
            required
            className="cn-input w-full px-3 py-2 text-sm mb-4"
            placeholder="••••••••"
            value={teacherPassword}
            onChange={(e) => setTeacherPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={teacherLoginLoading || !teacherEmail.trim() || !teacherPassword}
            className="cn-btn-primary w-full rounded-md py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {teacherLoginLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            Нэвтрэх
          </button>
          <button
            type="button"
            onClick={() => setShowTeacherLogin(false)}
            className="w-full text-xs mt-3 underline"
            style={{ color: "#6B6858" }}
          >
            Буцах
          </button>
        </form>
      )}

      {showNamePrompt && (
        <form onSubmit={onStudentLogin} className="cn-card rounded-xl p-5 mt-6 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-4">
            <LogIn size={18} color="#24478F" />
            <span className="font-semibold text-sm" style={{ color: "#24478F" }}>Сурагчийн нэвтрэлт</span>
          </div>
          {studentLoginError && (
            <p className="text-xs mb-3 px-2 py-1.5 rounded" style={{ background: "#FBE7E4", color: "#9A3324" }}>
              {studentLoginError}
            </p>
          )}
          <label className="text-sm font-medium block mb-1" style={{ color: "#2B2A25" }}>
            Нэвтрэх нэр
          </label>
          <input
            autoFocus
            className="cn-input w-full px-3 py-2 text-sm mb-2"
            placeholder="Жишээ: bat.erdene"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs mb-4" style={{ color: "#6B6858" }}>
            Багш бүртгэхэд автоматаар үүссэн нэвтрэх нэрээ оруулна.
          </p>
          <button
            type="submit"
            disabled={studentLoginLoading || !nameInput.trim()}
            className="cn-btn-primary w-full rounded-md py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {studentLoginLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            Нэвтрэх
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNamePrompt(false);
              setStudentLoginError("");
              setNameInput("");
            }}
            className="w-full text-xs mt-3 underline"
            style={{ color: "#6B6858" }}
          >
            Буцах
          </button>
        </form>
      )}
    </div>
  );
}

function TopBar({ role, studentName, studentUsername, studentClassName, teacherEmail, onExit }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <button onClick={onExit} className="flex items-center gap-1.5 text-sm" style={{ color: "#6B6858" }}>
        <ArrowLeft size={16} /> Гарах
      </button>
      <div className="flex items-center gap-2">
        {role === "student" && (
          <span className="text-sm text-right" style={{ color: "#6B6858" }}>
            <strong>{studentName}</strong>
            {studentUsername ? (
              <span className="block text-xs">
                @{studentUsername}
                {studentClassName ? ` · ${studentClassName} анги` : ""}
              </span>
            ) : null}
          </span>
        )}
        {role === "teacher" && teacherEmail && (
          <span className="text-sm" style={{ color: "#6B6858" }}>
            Багш: <strong>{teacherEmail}</strong>
          </span>
        )}
        <span className="cn-tag">{role === "teacher" ? "Багшийн горим" : "Сурагчийн горим"}</span>
      </div>
    </div>
  );
}

function NavCard({ icon, label, sub, onClick }) {
  return (
    <button onClick={onClick} className="cn-card rounded-xl p-5 text-left transition-transform hover:-translate-y-0.5">
      {icon}
      <div className="font-semibold mt-3" style={{ color: "#2B2A25" }}>{label}</div>
      <div className="text-xs mt-1" style={{ color: "#6B6858" }}>{sub}</div>
    </button>
  );
}

/* ---------------- TEACHER ---------------- */

function TeacherView(props) {
  const { tab, setTab, lessons, quizzes, attempts, classes } = props;

  if (tab === "home") {
    return (
      <div>
        <h2 className="cn-hand text-4xl mb-5" style={{ color: "#24478F" }}>Багшийн самбар</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <NavCard icon={<School size={22} color="#24478F" />} label="Анги үүсгэх" sub={`${classes.length} анги`} onClick={() => setTab("class")} />
          <NavCard icon={<PencilLine size={22} color="#24478F" />} label="Хичээл нэмэх" sub={`${lessons.length} хичээл`} onClick={() => setTab("lesson")} />
          <NavCard icon={<ClipboardList size={22} color="#24478F" />} label="Шалгалт үүсгэх" sub={`${quizzes.length} шалгалт`} onClick={() => setTab("quiz")} />
          <NavCard icon={<Trophy size={22} color="#24478F" />} label="Сурагчдын үр дүн" sub={`${attempts.length} оролдлого`} onClick={() => setTab("results")} />
        </div>
      </div>
    );
  }

  if (tab === "class") return <ClassBuilder {...props} />;
  if (tab === "lesson") return <LessonBuilder {...props} />;
  if (tab === "quiz") return <QuizBuilder {...props} />;
  if (tab === "results") return <ResultsTable {...props} />;
  return null;
}

function BackRow({ onBack, title }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <button onClick={onBack} className="cn-btn-secondary rounded-md px-2 py-1.5"><ArrowLeft size={16} /></button>
      <h2 className="cn-hand text-3xl" style={{ color: "#24478F" }}>{title}</h2>
    </div>
  );
}

function ClassBuilder({
  setTab,
  classForm,
  setClassForm,
  addClass,
  classes,
  deleteClass,
  students,
  activeClassId,
  setActiveClassId,
  studentLastNameInput,
  setStudentLastNameInput,
  studentFirstNameInput,
  setStudentFirstNameInput,
  addStudentManual,
  importStudentsFromExcel,
  deleteStudent,
  studentImportMsg,
  setStudentImportMsg,
  studentImportLoading,
}) {
  const [copiedId, setCopiedId] = useState(null);
  const fileRef = useRef(null);
  const activeClass = classes.find((c) => c.id === activeClassId) || null;
  const classStudents = sortStudents(students.filter((s) => s.classId === activeClassId));

  async function copyText(id, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  }

  function openClass(id) {
    setActiveClassId(id);
    setStudentImportMsg("");
    setStudentLastNameInput("");
    setStudentFirstNameInput("");
  }

  if (activeClass) {
    return (
      <div>
        <BackRow
          onBack={() => {
            setActiveClassId(null);
            setStudentImportMsg("");
          }}
          title={`${activeClass.name} ангийн сурагчид`}
        />

        <div className="cn-card rounded-xl p-5 mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-4 text-sm" style={{ color: "#6B6858" }}>
            <span>Нэгдэх код:</span>
            <code className="font-semibold tracking-wider px-2 py-0.5 rounded" style={{ background: "#E5EAF5", color: "#24478F" }}>
              {activeClass.joinCode}
            </code>
            <button type="button" onClick={() => copyText(`code-${activeClass.id}`, activeClass.joinCode)} style={{ color: "#24478F" }}>
              {copiedId === `code-${activeClass.id}` ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>

          <label className="text-sm font-medium block mb-2" style={{ color: "#2B2A25" }}>Ганцаар нэмэх</label>
          <div className="grid sm:grid-cols-2 gap-2 mb-2">
            <input
              className="cn-input w-full px-3 py-2 text-sm"
              placeholder="Овог"
              value={studentLastNameInput}
              onChange={(e) => setStudentLastNameInput(e.target.value)}
            />
            <input
              className="cn-input w-full px-3 py-2 text-sm"
              placeholder="Нэр"
              value={studentFirstNameInput}
              onChange={(e) => setStudentFirstNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStudentManual()}
            />
          </div>
          <p className="text-xs mb-3" style={{ color: "#6B6858" }}>
            Нэвтрэх нэр автоматаар үүснэ (жишээ: <code>bat.erdene</code>).
          </p>
          <button
            onClick={addStudentManual}
            disabled={!studentLastNameInput.trim() || !studentFirstNameInput.trim()}
            className="cn-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1.5 mb-4"
          >
            <Plus size={15} /> Нэмэх
          </button>

          <div className="rounded-lg p-3" style={{ background: "#FFFEFA", border: "1px dashed #D8D0BA" }}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <FileSpreadsheet size={18} color="#24478F" />
              <span className="text-sm font-semibold" style={{ color: "#24478F" }}>Excel-ээс оруулах</span>
            </div>
            <p className="text-xs mb-3" style={{ color: "#6B6858" }}>
              .xlsx / .xls файл. Баганууд: <strong>№</strong>, <strong>Овог</strong>, <strong>Нэр</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadStudentTemplate}
                className="cn-btn-secondary rounded-md px-3 py-2 text-xs font-medium flex items-center gap-1.5"
              >
                <Download size={14} /> Загвар татах
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={studentImportLoading}
                className="cn-btn-primary rounded-md px-3 py-2 text-xs font-medium disabled:opacity-40 flex items-center gap-1.5"
              >
                {studentImportLoading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                Excel сонгох
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) importStudentsFromExcel(file, activeClass.id);
                }}
              />
            </div>
            {studentImportMsg && (
              <p className="text-xs mt-3" style={{ color: studentImportMsg.includes("алдаа") || studentImportMsg.includes("олдсонгүй") ? "#9A3324" : "#2F6F4E" }}>
                {studentImportMsg}
              </p>
            )}
          </div>
        </div>

        <h3 className="text-sm font-semibold mb-3" style={{ color: "#6B6858" }}>
          Бүртгэлтэй сурагчид ({classStudents.length})
        </h3>
        {classStudents.length === 0 ? (
          <EmptyState text="Одоогоор сурагч бүртгээгүй байна. Ганцаар нэмэх эсвэл Excel оруулна уу." />
        ) : (
          <div className="space-y-2">
            {classStudents.map((s) => (
              <div key={s.id} className="cn-card rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{ background: "#E5EAF5", color: "#24478F" }}
                  >
                    {s.studentNo ?? "–"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.lastName} {s.firstName}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs" style={{ color: "#6B6858" }}>Нэвтрэх нэр:</span>
                      <code className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: "#E5EAF5", color: "#24478F" }}>
                        {s.username}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyText(`user-${s.id}`, s.username)}
                        className="p-0.5"
                        title="Нэвтрэх нэр хуулах"
                        style={{ color: "#24478F" }}
                      >
                        {copiedId === `user-${s.id}` ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
                <button onClick={() => deleteStudent(s.id)} style={{ color: "#9A3324" }} className="shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <BackRow onBack={() => setTab("home")} title="Анги үүсгэх" />
      <div className="cn-card rounded-xl p-5 mb-6">
        <p className="text-sm mb-4" style={{ color: "#6B6858" }}>
          Ангийн дугаар болон үсгийг сонгоод хадгална. Дараа нь анги дээр дарж сурагчдаа бүртгэнэ.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: "#2B2A25" }}>Анги</label>
            <select
              className="cn-select w-full px-3 py-2 text-sm"
              value={classForm.grade}
              onChange={(e) => setClassForm((f) => ({ ...f, grade: Number(e.target.value) }))}
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}-р анги</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1" style={{ color: "#2B2A25" }}>Бүлэг</label>
            <select
              className="cn-select w-full px-3 py-2 text-sm"
              value={classForm.section}
              onChange={(e) => setClassForm((f) => ({ ...f, section: e.target.value }))}
            >
              {CLASS_SECTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-4 text-sm" style={{ color: "#6B6858" }}>
          Нэр: <strong style={{ color: "#24478F" }}>{classForm.grade}{classForm.section}</strong>
        </div>
        <button
          onClick={addClass}
          className="cn-btn-primary rounded-md px-4 py-2 text-sm font-medium flex items-center gap-1.5"
        >
          <Plus size={15} /> Анги хадгалах
        </button>
      </div>

      <h3 className="text-sm font-semibold mb-3" style={{ color: "#6B6858" }}>Миний ангиуд ({classes.length})</h3>
      {classes.length === 0 ? (
        <EmptyState text="Одоогоор анги үүсгээгүй байна." />
      ) : (
        <div className="space-y-2">
          {classes.map((c) => {
            const count = students.filter((s) => s.classId === c.id).length;
            return (
              <div key={c.id} className="cn-card rounded-lg p-3 flex items-center justify-between gap-3">
                <button type="button" onClick={() => openClass(c.id)} className="text-left min-w-0 flex-1">
                  <div className="text-sm font-medium" style={{ color: "#24478F" }}>{c.name} анги</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs" style={{ color: "#6B6858" }}>{count} сурагч</span>
                    <span className="text-xs" style={{ color: "#6B6858" }}>·</span>
                    <span className="text-xs" style={{ color: "#6B6858" }}>Код:</span>
                    <code className="text-xs font-semibold tracking-wider px-2 py-0.5 rounded" style={{ background: "#E5EAF5", color: "#24478F" }}>
                      {c.joinCode}
                    </code>
                  </div>
                  <div className="text-xs mt-1 underline" style={{ color: "#24478F" }}>Сурагчид бүртгэх →</div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyText(`code-${c.id}`, c.joinCode)}
                    className="p-1 rounded"
                    title="Код хуулах"
                    style={{ color: "#24478F" }}
                  >
                    {copiedId === `code-${c.id}` ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button onClick={() => deleteClass(c.id)} style={{ color: "#9A3324" }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LessonBuilder({ setTab, lessonForm, setLessonForm, addLesson, lessons, deleteLesson }) {
  return (
    <div>
      <BackRow onBack={() => setTab("home")} title="Хичээлийн материал" />
      <div className="cn-card rounded-xl p-5 mb-6">
        <input
          className="cn-input w-full px-3 py-2 text-sm mb-3"
          placeholder="Хичээлийн гарчиг"
          value={lessonForm.title}
          onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))}
        />
        <select
          className="cn-select w-full px-3 py-2 text-sm mb-3"
          value={lessonForm.subject}
          onChange={(e) => setLessonForm((f) => ({ ...f, subject: e.target.value }))}
        >
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <textarea
          className="cn-textarea w-full px-3 py-2 text-sm mb-3"
          rows={8}
          placeholder="Хичээлийн агуулга, тайлбар..."
          value={lessonForm.content}
          onChange={(e) => setLessonForm((f) => ({ ...f, content: e.target.value }))}
        />
        <button
          onClick={addLesson}
          disabled={!lessonForm.title.trim() || !lessonForm.content.trim()}
          className="cn-btn-primary rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40 flex items-center gap-1.5"
        >
          <Plus size={15} /> Хичээл хадгалах
        </button>
      </div>

      <h3 className="text-sm font-semibold mb-3" style={{ color: "#6B6858" }}>Нэмэгдсэн хичээлүүд ({lessons.length})</h3>
      {lessons.length === 0 ? (
        <EmptyState text="Одоогоор хичээл нэмээгүй байна." />
      ) : (
        <div className="space-y-2">
          {lessons.map((l) => (
            <div key={l.id} className="cn-card rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="cn-tag mr-2">{l.subject}</span>
                <span className="text-sm font-medium">{l.title}</span>
              </div>
              <button onClick={() => deleteLesson(l.id)} style={{ color: "#9A3324" }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuizImageField({ imageUrl, onUploaded, onClear, uploadFn, compact }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className={compact ? "mt-1" : "mb-2"}>
      {imageUrl ? (
        <div className="relative inline-block mb-1 max-w-full">
          <img
            src={imageUrl}
            alt=""
            className={"rounded-md object-contain border " + (compact ? "max-h-24" : "max-h-44")}
            style={{ borderColor: "#E3DCC8", background: "#FFFEFA" }}
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1 right-1 rounded p-1"
            style={{ background: "#FBE7E4", color: "#9A3324" }}
            title="Зураг хасах"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ) : null}
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="cn-btn-secondary rounded-md px-2 py-1 text-xs font-medium disabled:opacity-40 inline-flex items-center gap-1"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
          {imageUrl ? "Зураг солих" : "Зураг нэмэх"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            const url = await uploadFn(file);
            setBusy(false);
            if (url) onUploaded(url);
          }}
        />
      </div>
    </div>
  );
}

function QuizBuilder({
  setTab,
  quizForm,
  setQuizForm,
  updateQuestion,
  updateOption,
  updateOptionImage,
  uploadQuizImage,
  addQuestionToForm,
  removeQuestionFromForm,
  addQuiz,
  quizzes,
  deleteQuiz,
  setQuizOpen,
  quizFormValid,
  quizFormMissingHints = [],
}) {
  const fileRef = useRef(null);
  const [showForm, setShowForm] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleQuizFile(file) {
    if (!file) return;
    setImportLoading(true);
    setImportMsg("");
    try {
      const { parsed } = await readQuizFromFile(file);
      if (!parsed.questions.length) {
        setImportMsg("Асуулт олдсонгүй. Загварын форматыг шалгана уу (1. Асуулт / А) Б) В) Г) / Зөв: Б).");
        setImportLoading(false);
        return;
      }
      const normalized = parsed.questions.map(normalizeQuestion);
      const incomplete = normalized.filter((q) => !questionHasContent(q) || !q.options.every(optionHasContent)).length;
      setQuizForm((f) => ({
        title: parsed.title || f.title,
        subject: parsed.subject || f.subject,
        durationMinutes: f.durationMinutes || 30,
        questions: normalized,
      }));
      setShowForm(true);
      setImportMsg(
        incomplete
          ? `${normalized.length} асуулт орууллаа. ${incomplete} асуултад мэдээлэл дутуу байна — засаад хадгална уу.`
          : `${normalized.length} асуулт амжилттай орууллаа. Шаардлагатай бол засаад «Шалгалт хадгалах» дарна уу.`
      );
    } catch {
      setImportMsg("Файл уншихад алдаа гарлаа. .pdf эсвэл .txt формат ашиглана уу.");
    }
    setImportLoading(false);
  }

  async function handleSaveQuiz() {
    if (!quizFormValid || saving) return;
    setSaving(true);
    const ok = await addQuiz();
    setSaving(false);
    if (ok) {
      setShowForm(false);
      setImportMsg("");
    }
  }

  function closeForm() {
    setShowForm(false);
    setImportMsg("");
  }

  return (
    <div>
      <BackRow onBack={() => setTab("home")} title="Шалгалтууд" />

      {!showForm ? (
        <div className="mb-5">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="cn-btn-primary rounded-md px-4 py-2.5 text-sm font-medium inline-flex items-center gap-1.5"
          >
            <Plus size={16} /> Шалгалт үүсгэх
          </button>
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="cn-hand text-2xl" style={{ color: "#24478F" }}>Шалгалт үүсгэх</h3>
            <button type="button" onClick={closeForm} className="cn-btn-secondary rounded-md px-3 py-1.5 text-xs">
              Болих
            </button>
          </div>

          <div className="cn-card rounded-xl p-5 mb-4" style={{ borderStyle: "dashed" }}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <FileText size={18} color="#24478F" />
              <span className="text-sm font-semibold" style={{ color: "#24478F" }}>PDF / текстээс оруулах</span>
            </div>
            <p className="text-xs mb-3" style={{ color: "#6B6858" }}>
              Тогтмол форматтай .pdf эсвэл .txt файл. Загвар татаж аваад Word/PDF болгож болно.
            </p>
            <pre className="text-xs mb-3 p-2 rounded overflow-x-auto" style={{ background: "#FFFEFA", color: "#6B6858", border: "1px solid #E3DCC8" }}>
{`Гарчиг: Жишээ шалгалт
Хичээл: Математик

1. Асуултын текст?
А) Сонголт 1
Б) Сонголт 2
В) Сонголт 3
Г) Сонголт 4
Зөв: Б`}
            </pre>
            <div className="flex flex-wrap gap-2">
              <a
                href="/quiz-zagvar.txt"
                download
                className="cn-btn-secondary rounded-md px-3 py-2 text-xs font-medium flex items-center gap-1.5"
              >
                <Download size={14} /> Загвар татах
              </a>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={importLoading}
                className="cn-btn-primary rounded-md px-3 py-2 text-xs font-medium disabled:opacity-40 flex items-center gap-1.5"
              >
                {importLoading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Файл сонгох
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,text/plain,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleQuizFile(file);
                }}
              />
            </div>
            {importMsg && (
              <p
                className="text-xs mt-3"
                style={{ color: importMsg.includes("олдсонгүй") || importMsg.includes("алдаа") ? "#9A3324" : "#2F6F4E" }}
              >
                {importMsg}
              </p>
            )}
          </div>

          <div className="cn-card rounded-xl p-5">
            <input
              className="cn-input w-full px-3 py-2 text-sm mb-3"
              placeholder="Шалгалтын гарчиг"
              value={quizForm.title}
              onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))}
            />
            <select
              className="cn-select w-full px-3 py-2 text-sm mb-3"
              value={quizForm.subject}
              onChange={(e) => setQuizForm((f) => ({ ...f, subject: e.target.value }))}
            >
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="mb-4">
              <label className="text-sm font-medium block mb-1" style={{ color: "#2B2A25" }}>
                Шалгалтын хугацаа (минут)
              </label>
              <div className="flex items-center gap-2">
                <Clock size={16} color="#24478F" />
                <input
                  type="number"
                  min={1}
                  max={300}
                  className="cn-input w-32 px-3 py-2 text-sm"
                  value={quizForm.durationMinutes}
                  onChange={(e) => setQuizForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
                />
                <span className="text-xs" style={{ color: "#6B6858" }}>Сурагчийн дэлгэцэн дээр цаг харагдана</span>
              </div>
            </div>

            <div className="space-y-4">
              {quizForm.questions.map((q, qi) => {
                const nq = normalizeQuestion(q);
                return (
                  <div key={qi} className="rounded-lg p-3" style={{ background: "#FFFEFA", border: "1px dashed #D8D0BA" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: "#24478F" }}>Асуулт {qi + 1}</span>
                      <button onClick={() => removeQuestionFromForm(qi)} disabled={quizForm.questions.length <= 1} style={{ color: "#9A3324" }} className="disabled:opacity-30">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input
                      className="cn-input w-full px-3 py-2 text-sm mb-2"
                      placeholder="Асуултын текст (эсвэл зөвхөн зураг)"
                      value={nq.text}
                      onChange={(e) => updateQuestion(qi, "text", e.target.value)}
                    />
                    <QuizImageField
                      imageUrl={nq.imageUrl}
                      uploadFn={uploadQuizImage}
                      onUploaded={(url) => updateQuestion(qi, "imageUrl", url)}
                      onClear={() => updateQuestion(qi, "imageUrl", "")}
                    />
                    <div className="grid sm:grid-cols-2 gap-3 mt-2">
                      {nq.options.map((opt, oi) => (
                        <div key={oi} className="rounded-md p-2" style={{ border: "1px solid #E3DCC8" }}>
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              onClick={() => updateQuestion(qi, "correct", oi)}
                              title="Зөв хариулт болгох"
                              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                              style={{
                                border: "1.5px solid " + (nq.correct === oi ? "#2F6F4E" : "#D8D0BA"),
                                background: nq.correct === oi ? "#E4F0E9" : "#FFFEFA",
                                color: nq.correct === oi ? "#2F6F4E" : "#6B6858",
                              }}
                            >
                              {LETTERS[oi]}
                            </button>
                            <input
                              className="cn-input flex-1 px-3 py-1.5 text-sm"
                              placeholder={`Сонголт ${LETTERS[oi]} (эсвэл зураг)`}
                              value={opt.text}
                              onChange={(e) => updateOption(qi, oi, e.target.value)}
                            />
                          </div>
                          <QuizImageField
                            compact
                            imageUrl={opt.imageUrl}
                            uploadFn={uploadQuizImage}
                            onUploaded={(url) => updateOptionImage(qi, oi, url)}
                            onClear={() => updateOptionImage(qi, oi, "")}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={addQuestionToForm} className="cn-btn-secondary rounded-md px-3 py-1.5 text-sm flex items-center gap-1.5">
                  <Plus size={14} /> Асуулт нэмэх
                </button>
                <button
                  onClick={handleSaveQuiz}
                  disabled={!quizFormValid || saving}
                  className="cn-btn-primary rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-40 flex items-center gap-1.5"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Шалгалт хадгалах
                </button>
                <button type="button" onClick={closeForm} className="text-xs underline" style={{ color: "#6B6858" }}>
                  Болих
                </button>
              </div>
              {!quizFormValid && (
                <div className="mt-3 text-xs rounded-md px-3 py-2" style={{ background: "#FFF6E8", color: "#8A5A00", border: "1px solid #F0D9A8" }}>
                  <div className="font-semibold mb-1">Хадгалах товч идэвхжихэд дараахыг бөглөнө:</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {(quizFormMissingHints.length ? quizFormMissingHints : ["Формын мэдээллийг шалгана уу"]).slice(0, 8).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                    {quizFormMissingHints.length > 8 ? <li>… болон бусад</li> : null}
                  </ul>
                  <p className="mt-2" style={{ color: "#6B6858" }}>
                    Асуулт бүрт А, Б, В, Г <strong>дөрвөн сонголт</strong> бүгд текст эсвэл зурагтай байх ёстой.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <h3 className="text-sm font-semibold mb-3" style={{ color: "#6B6858" }}>Шалгалтын жагсаалт ({quizzes.length})</h3>
      {quizzes.length === 0 ? (
        <EmptyState text="Одоогоор шалгалт үүсгээгүй байна." />
      ) : (
        <div className="flex flex-col gap-3">
          {quizzes.map((q) => (
            <div key={q.id} className="cn-card rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="cn-tag mr-2">{q.subject}</span>
                <span className="text-sm font-medium">{q.title}</span>
                <div className="text-xs mt-1.5 flex flex-wrap gap-x-3 gap-y-1" style={{ color: "#6B6858" }}>
                  <span>{q.questions.length} асуулт</span>
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {q.durationMinutes} мин</span>
                  <span style={{ color: q.isOpen ? "#2F6F4E" : "#9A3324" }}>
                    {q.isOpen ? "Нээлттэй (сурагч өгч болно)" : "Хаалттай"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuizOpen?.(q.id, !q.isOpen)}
                  className={"rounded-md px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 " + (q.isOpen ? "cn-btn-secondary" : "cn-btn-primary")}
                  title={q.isOpen ? "Шалгалт хаах" : "Шалгалт эхлүүлэх"}
                >
                  {q.isOpen ? <Lock size={13} /> : <Unlock size={13} />}
                  {q.isOpen ? "Хаах" : "Эхлүүлэх"}
                </button>
                <button onClick={() => deleteQuiz(q.id)} style={{ color: "#9A3324" }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultsTable({ setTab, attempts }) {
  return (
    <div>
      <BackRow onBack={() => setTab("home")} title="Сурагчдын үр дүн" />
      {attempts.length === 0 ? (
        <EmptyState text="Одоогоор шалгалт өгсөн сурагч алга." />
      ) : (
        <div className="cn-card rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#EAEFF8" }}>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "#24478F" }}>Сурагч</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "#24478F" }}>Шалгалт</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "#24478F" }}>Хичээл</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "#24478F" }}>Оноо</th>
                <th className="text-left px-3 py-2 font-semibold" style={{ color: "#24478F" }}>Огноо</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => {
                const pct = Math.round((a.score / a.total) * 100);
                return (
                  <tr key={a.id} style={{ borderTop: "1px solid #E3DCC8" }}>
                    <td className="px-3 py-2">{a.studentName}</td>
                    <td className="px-3 py-2">{a.quizTitle}</td>
                    <td className="px-3 py-2"><span className="cn-tag">{a.subject}</span></td>
                    <td className="px-3 py-2 font-semibold" style={{ color: pct >= 60 ? "#2F6F4E" : "#9A3324" }}>
                      {a.score}/{a.total} ({pct}%)
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: "#6B6858" }}>{fmtDate(a.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- STUDENT ---------------- */

function StudentView(props) {
  const { tab, setTab, lessons, quizzes, myAttempts } = props;

  if (tab === "home") {
    return (
      <div>
        <h2 className="cn-hand text-4xl mb-5" style={{ color: "#24478F" }}>Сурагчийн самбар</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <NavCard icon={<BookOpen size={22} color="#24478F" />} label="Хичээлүүд" sub={`${lessons.length} хичээл`} onClick={() => setTab("lessons")} />
          <NavCard icon={<ClipboardList size={22} color="#24478F" />} label="Шалгалтууд" sub={`${quizzes.length} шалгалт`} onClick={() => setTab("quizzes")} />
          <NavCard icon={<Trophy size={22} color="#24478F" />} label="Миний онооны түүх" sub={`${myAttempts.length} оролдлого`} onClick={() => setTab("scores")} />
        </div>
      </div>
    );
  }

  if (tab === "lessons") return <LessonList {...props} />;
  if (tab === "lesson") return <LessonDetail {...props} />;
  if (tab === "quizzes") return <QuizList {...props} />;
  if (tab === "quiz") return <QuizTake {...props} />;
  if (tab === "quiz-result") return <QuizResultView {...props} />;
  if (tab === "scores") return <MyScores {...props} />;
  return null;
}

function LessonList({ setTab, lessons, setActiveLesson }) {
  return (
    <div>
      <BackRow onBack={() => setTab("home")} title="Хичээлүүд" />
      {lessons.length === 0 ? (
        <EmptyState text="Одоогоор хичээл нэмэгдээгүй байна." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {lessons.map((l) => (
            <button key={l.id} onClick={() => { setActiveLesson(l); setTab("lesson"); }} className="cn-card rounded-lg p-4 text-left transition-transform hover:-translate-y-0.5">
              <span className="cn-tag">{l.subject}</span>
              <div className="font-semibold mt-2">{l.title}</div>
              <div className="text-xs mt-1 line-clamp-2" style={{ color: "#6B6858" }}>{l.content.slice(0, 90)}...</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonDetail({ setTab, activeLesson }) {
  if (!activeLesson) return null;
  return (
    <div>
      <BackRow onBack={() => setTab("lessons")} title={activeLesson.title} />
      <div className="cn-card rounded-xl p-6">
        <span className="cn-tag">{activeLesson.subject}</span>
        <p className="text-sm mt-4 whitespace-pre-wrap leading-relaxed">{activeLesson.content}</p>
      </div>
    </div>
  );
}

function QuizList({ setTab, quizzes, setActiveQuiz, setQuizAnswers }) {
  return (
    <div>
      <BackRow onBack={() => setTab("home")} title="Шалгалтууд" />
      {quizzes.length === 0 ? (
        <EmptyState text="Одоогоор шалгалт нэмэгдээгүй байна." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {quizzes.map((q) => {
            const open = Boolean(q.isOpen);
            return (
              <button
                key={q.id}
                type="button"
                disabled={!open}
                onClick={() => {
                  if (!open) return;
                  setActiveQuiz(q);
                  setQuizAnswers({});
                  setTab("quiz");
                }}
                className={"cn-card rounded-lg p-4 text-left transition-transform " + (open ? "hover:-translate-y-0.5" : "opacity-70 cursor-not-allowed")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="cn-tag">{q.subject}</span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded"
                    style={{
                      background: open ? "#E4F0E9" : "#FBE7E4",
                      color: open ? "#2F6F4E" : "#9A3324",
                    }}
                  >
                    {open ? "Нээлттэй" : "Хаалттай"}
                  </span>
                </div>
                <div className="font-semibold mt-2">{q.title}</div>
                <div className="text-xs mt-1 flex flex-wrap gap-x-3" style={{ color: "#6B6858" }}>
                  <span>{q.questions.length} асуулт</span>
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {q.durationMinutes || 30} мин</span>
                </div>
                {!open && (
                  <div className="text-xs mt-2 flex items-center gap-1" style={{ color: "#9A3324" }}>
                    <Lock size={12} /> Багш шалгалтыг эхлүүлээгүй байна
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuizTake({ setTab, activeQuiz, quizAnswers, setQuizAnswers, submitQuiz, studentUsername }) {
  if (!activeQuiz) return null;
  const questions = (activeQuiz.questions || []).map(normalizeQuestion);
  const allAnswered = questions.every((_, i) => quizAnswers[i] !== undefined);
  const durationMinutes = Number(activeQuiz.durationMinutes) > 0 ? Number(activeQuiz.durationMinutes) : 30;
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const submittedRef = useRef(false);
  const submitQuizRef = useRef(submitQuiz);
  submitQuizRef.current = submitQuiz;

  useEffect(() => {
    if (!activeQuiz?.isOpen) {
      setTab("quizzes");
      return;
    }
    submittedRef.current = false;
    const key = quizDeadlineKey(activeQuiz.id, studentUsername);
    let deadline = null;
    try {
      deadline = Number(sessionStorage.getItem(key));
    } catch {
      deadline = null;
    }
    if (!deadline || Number.isNaN(deadline) || deadline < Date.now()) {
      deadline = Date.now() + durationMinutes * 60 * 1000;
      try {
        sessionStorage.setItem(key, String(deadline));
      } catch {
        // ignore
      }
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !submittedRef.current) {
        submittedRef.current = true;
        try {
          sessionStorage.removeItem(key);
        } catch {
          // ignore
        }
        submitQuizRef.current({ force: true });
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [activeQuiz?.id, activeQuiz?.isOpen, durationMinutes, studentUsername, setTab]);

  const urgent = secondsLeft <= 60;

  return (
    <div>
      <div
        className="sticky top-0 z-20 mb-4 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
        style={{
          background: urgent ? "#FBE7E4" : "#EAEFF8",
          border: "1px solid " + (urgent ? "#E8B4AB" : "#C9D4EA"),
        }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: urgent ? "#9A3324" : "#24478F" }}>
          <Clock size={18} />
          Үлдсэн хугацаа
        </div>
        <div className="cn-hand text-3xl leading-none tabular-nums" style={{ color: urgent ? "#9A3324" : "#24478F" }}>
          {formatCountdown(secondsLeft)}
        </div>
      </div>

      <BackRow onBack={() => setTab("quizzes")} title={activeQuiz.title} />
      <p className="text-xs mb-4" style={{ color: "#6B6858" }}>
        Нийт хугацаа: {durationMinutes} минут. Цаг дуусмагц автоматаар илгээнэ.
      </p>
      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={qi} className="cn-card rounded-xl p-4">
            <div className="text-sm font-semibold mb-2">
              {qi + 1}. {q.text || (q.imageUrl ? "Зургийг харна уу" : "")}
            </div>
            {q.imageUrl ? (
              <img
                src={q.imageUrl}
                alt=""
                className="mb-3 max-h-56 rounded-md object-contain border"
                style={{ borderColor: "#E3DCC8", background: "#FFFEFA" }}
              />
            ) : null}
            <div className="grid sm:grid-cols-2 gap-2">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => setQuizAnswers((a) => ({ ...a, [qi]: oi }))}
                  className={"cn-option rounded-md px-3 py-2 text-left text-sm flex items-start gap-2" + (quizAnswers[qi] === oi ? " selected" : "")}
                >
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5"
                    style={{
                      border: "1.5px solid " + (quizAnswers[qi] === oi ? "#24478F" : "#D8D0BA"),
                      color: quizAnswers[qi] === oi ? "#24478F" : "#6B6858",
                    }}
                  >
                    {LETTERS[oi]}
                  </span>
                  <span className="min-w-0 flex-1">
                    {opt.text ? <span className="block">{opt.text}</span> : null}
                    {opt.imageUrl ? (
                      <img
                        src={opt.imageUrl}
                        alt=""
                        className="mt-1 max-h-28 rounded object-contain border"
                        style={{ borderColor: "#E3DCC8", background: "#FFFEFA" }}
                      />
                    ) : null}
                    {!opt.text && !opt.imageUrl ? <span style={{ color: "#6B6858" }}>—</span> : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => submitQuiz()} disabled={!allAnswered} className="cn-btn-primary rounded-md px-5 py-2.5 text-sm font-medium mt-5 disabled:opacity-40">
        Шалгалт дуусгах
      </button>
    </div>
  );
}

function QuizResultView({ setTab, quizResult, activeQuiz }) {
  if (!quizResult) return null;
  const pct = Math.round((quizResult.score / quizResult.total) * 100);
  const good = pct >= 60;
  const color = good ? "#2F6F4E" : "#9A3324";
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="cn-stamp w-40 h-40 flex flex-col items-center justify-center" style={{ color }}>
        <span className="cn-hand text-4xl">{pct}%</span>
        <span className="text-xs font-semibold mt-1">{quizResult.score}/{quizResult.total}</span>
      </div>
      <p className="mt-6 text-sm text-center" style={{ color: "#6B6858" }}>
        {quizResult.timedOut ? "Хугацаа дууссан тул шалгалт автоматаар илгээгдлээ. " : ""}
        {good ? "Сайн байна! Үргэлжлүүлээрэй." : "Дахин давтаад үзээрэй."} — {activeQuiz?.title}
      </p>
      <div className="flex gap-3 mt-5">
        <button onClick={() => setTab("quizzes")} className="cn-btn-secondary rounded-md px-4 py-2 text-sm">Шалгалтууд руу буцах</button>
        <button onClick={() => setTab("home")} className="cn-btn-primary rounded-md px-4 py-2 text-sm">Нүүр хуудас</button>
      </div>
    </div>
  );
}

function MyScores({ setTab, myAttempts }) {
  return (
    <div>
      <BackRow onBack={() => setTab("home")} title="Миний онооны түүх" />
      {myAttempts.length === 0 ? (
        <EmptyState text="Та одоогоор шалгалт өгөөгүй байна." />
      ) : (
        <div className="space-y-2">
          {myAttempts.map((a) => {
            const pct = Math.round((a.score / a.total) * 100);
            return (
              <div key={a.id} className="cn-card rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {pct >= 60 ? <CheckCircle2 size={16} color="#2F6F4E" /> : <XCircle size={16} color="#9A3324" />}
                  <span className="cn-tag">{a.subject}</span>
                  <span className="text-sm font-medium">{a.quizTitle}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold" style={{ color: pct >= 60 ? "#2F6F4E" : "#9A3324" }}>{a.score}/{a.total} ({pct}%)</div>
                  <div className="text-xs" style={{ color: "#6B6858" }}>{fmtDate(a.date)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="cn-card rounded-xl p-8 text-center text-sm" style={{ color: "#6B6858", borderStyle: "dashed" }}>
      {text}
    </div>
  );
}
