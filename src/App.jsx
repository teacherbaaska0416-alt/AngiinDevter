import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

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

function emptyQuestion() {
  return { text: "", options: ["", "", "", ""], correct: 0 };
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

  const [teacherTab, setTeacherTab] = useState("home");
  const [studentTab, setStudentTab] = useState("home");

  const [activeLesson, setActiveLesson] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);

  const [lessonForm, setLessonForm] = useState({ title: "", subject: SUBJECTS[0], content: "" });
  const [quizForm, setQuizForm] = useState({ title: "", subject: SUBJECTS[0], questions: [emptyQuestion()] });

  const mapLesson = (l) => ({ id: l.id, title: l.title, subject: l.subject, content: l.content, createdAt: new Date(l.created_at).getTime() });
  const mapQuiz = (q) => ({ id: q.id, title: q.title, subject: q.subject, questions: q.questions, createdAt: new Date(q.created_at).getTime() });
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
      const [lessonsRes, quizzesRes, attemptsRes] = await Promise.all([
        supabase.from("lessons").select("*").order("created_at", { ascending: false }),
        supabase.from("quizzes").select("*").order("created_at", { ascending: false }),
        supabase.from("attempts").select("*").order("date", { ascending: false }),
      ]);
      if (lessonsRes.error || quizzesRes.error || attemptsRes.error) {
        throw lessonsRes.error || quizzesRes.error || attemptsRes.error;
      }
      setLessons((lessonsRes.data || []).map(mapLesson));
      setQuizzes((quizzesRes.data || []).map(mapQuiz));
      setAttempts((attemptsRes.data || []).map(mapAttempt));
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
      if (session?.user?.email) setTeacherUser({ email: session.user.email });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) setTeacherUser({ email: session.user.email });
      else setTeacherUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleTeacherClick() {
    setShowNamePrompt(false);
    setTeacherLoginError("");
    if (teacherUser) {
      setRole("teacher");
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
    setTeacherUser({ email: data.user.email });
    setTeacherPassword("");
    setShowTeacherLogin(false);
    setRole("teacher");
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
      const questions = f.questions.map((q, i) => (i === idx ? { ...q, [field]: value } : q));
      return { ...f, questions };
    });
  }

  function updateOption(qIdx, optIdx, value) {
    setQuizForm((f) => {
      const questions = f.questions.map((q, i) => {
        if (i !== qIdx) return q;
        const options = q.options.map((o, oi) => (oi === optIdx ? value : o));
        return { ...q, options };
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
    return quizForm.questions.every((q) => q.text.trim() && q.options.every((o) => o.trim()));
  }

  async function addQuiz() {
    if (!quizFormValid()) return;
    const { data, error } = await supabase
      .from("quizzes")
      .insert({ title: quizForm.title, subject: quizForm.subject, questions: quizForm.questions })
      .select()
      .single();
    if (error) {
      setSaveError("Шалгалт хадгалахад алдаа гарлаа.");
      return;
    }
    setQuizzes((prev) => [mapQuiz(data), ...prev]);
    setQuizForm({ title: "", subject: SUBJECTS[0], questions: [emptyQuestion()] });
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

  async function submitQuiz() {
    if (!activeQuiz) return;
    let score = 0;
    activeQuiz.questions.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) score += 1;
    });
    const total = activeQuiz.questions.length;
    const { data, error } = await supabase
      .from("attempts")
      .insert({
        student_name: studentName,
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
    setQuizResult({ score, total });
    setStudentTab("quiz-result");
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
    setTeacherTab("home");
    setStudentTab("home");
    setActiveLesson(null);
    setActiveQuiz(null);
    setQuizAnswers({});
    setQuizResult(null);
  }

  const myAttempts = attempts.filter((a) => a.studentName === studentName).sort((a, b) => b.date - a.date);
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
            onTeacher={handleTeacherClick}
            onTeacherLogin={teacherLogin}
            onStudentConfirm={() => {
              if (!nameInput.trim()) return;
              setStudentName(nameInput.trim());
              setRole("student");
            }}
          />
        </>
      ) : (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <TopBar role={role} studentName={studentName} teacherEmail={teacherUser?.email} onExit={exitToRoleSelect} />
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
              lessonForm={lessonForm}
              setLessonForm={setLessonForm}
              addLesson={addLesson}
              deleteLesson={deleteLesson}
              quizForm={quizForm}
              setQuizForm={setQuizForm}
              updateQuestion={updateQuestion}
              updateOption={updateOption}
              addQuestionToForm={addQuestionToForm}
              removeQuestionFromForm={removeQuestionFromForm}
              addQuiz={addQuiz}
              deleteQuiz={deleteQuiz}
              quizFormValid={quizFormValid()}
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
  onTeacher,
  onTeacherLogin,
  onStudentConfirm,
}) {
  return (
    <div className="cn-paper min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <img
        src="/img/logo.jpg"
        alt="Ангийн Дэвтэр"
        className="w-28 h-28 sm:w-32 sm:h-32 object-contain mb-4"
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
            Имэйл, нууц үгээр нэвтэрч хичээл нэмэх, шалгалт үүсгэх
          </p>
        </button>

        <button
          onClick={() => { setShowTeacherLogin(false); setShowNamePrompt(true); }}
          className="cn-card rounded-xl p-6 text-left transition-transform hover:-translate-y-0.5"
        >
          <Users size={28} color="#24478F" />
          <div className="cn-hand text-3xl mt-3" style={{ color: "#24478F" }}>Сурагч</div>
          <p className="text-sm mt-1" style={{ color: "#6B6858" }}>
            Хичээл унших, шалгалт өгөх, өөрийн онооны түүхээ харах
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
        <div className="cn-card rounded-xl p-5 mt-6 w-full max-w-sm">
          <label className="text-sm font-medium block mb-2" style={{ color: "#2B2A25" }}>
            Нэрээ оруулна уу
          </label>
          <input
            autoFocus
            className="cn-input w-full px-3 py-2 text-sm mb-3"
            placeholder="Жишээ: Батаа"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onStudentConfirm()}
          />
          <button onClick={onStudentConfirm} disabled={!nameInput.trim()} className="cn-btn-primary w-full rounded-md py-2 text-sm font-medium disabled:opacity-40">
            Эхлэх
          </button>
        </div>
      )}
    </div>
  );
}

function TopBar({ role, studentName, teacherEmail, onExit }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <button onClick={onExit} className="flex items-center gap-1.5 text-sm" style={{ color: "#6B6858" }}>
        <ArrowLeft size={16} /> Гарах
      </button>
      <div className="flex items-center gap-2">
        {role === "student" && (
          <span className="text-sm" style={{ color: "#6B6858" }}>
            Сурагч: <strong>{studentName}</strong>
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
  const { tab, setTab, lessons, quizzes, attempts } = props;

  if (tab === "home") {
    return (
      <div>
        <h2 className="cn-hand text-4xl mb-5" style={{ color: "#24478F" }}>Багшийн самбар</h2>
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <NavCard icon={<PencilLine size={22} color="#24478F" />} label="Хичээл нэмэх" sub={`${lessons.length} хичээл`} onClick={() => setTab("lesson")} />
          <NavCard icon={<ClipboardList size={22} color="#24478F" />} label="Шалгалт үүсгэх" sub={`${quizzes.length} шалгалт`} onClick={() => setTab("quiz")} />
          <NavCard icon={<Trophy size={22} color="#24478F" />} label="Сурагчдын үр дүн" sub={`${attempts.length} оролдлого`} onClick={() => setTab("results")} />
        </div>
      </div>
    );
  }

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

function QuizBuilder({ setTab, quizForm, setQuizForm, updateQuestion, updateOption, addQuestionToForm, removeQuestionFromForm, addQuiz, quizzes, deleteQuiz, quizFormValid }) {
  return (
    <div>
      <BackRow onBack={() => setTab("home")} title="Шалгалт үүсгэх" />
      <div className="cn-card rounded-xl p-5 mb-6">
        <input
          className="cn-input w-full px-3 py-2 text-sm mb-3"
          placeholder="Шалгалтын гарчиг"
          value={quizForm.title}
          onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))}
        />
        <select
          className="cn-select w-full px-3 py-2 text-sm mb-4"
          value={quizForm.subject}
          onChange={(e) => setQuizForm((f) => ({ ...f, subject: e.target.value }))}
        >
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="space-y-4">
          {quizForm.questions.map((q, qi) => (
            <div key={qi} className="rounded-lg p-3" style={{ background: "#FFFEFA", border: "1px dashed #D8D0BA" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: "#24478F" }}>Асуулт {qi + 1}</span>
                <button onClick={() => removeQuestionFromForm(qi)} disabled={quizForm.questions.length <= 1} style={{ color: "#9A3324" }} className="disabled:opacity-30">
                  <Trash2 size={14} />
                </button>
              </div>
              <input
                className="cn-input w-full px-3 py-2 text-sm mb-2"
                placeholder="Асуултын текст"
                value={q.text}
                onChange={(e) => updateQuestion(qi, "text", e.target.value)}
              />
              <div className="grid sm:grid-cols-2 gap-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuestion(qi, "correct", oi)}
                      title="Зөв хариулт болгох"
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{
                        border: "1.5px solid " + (q.correct === oi ? "#2F6F4E" : "#D8D0BA"),
                        background: q.correct === oi ? "#E4F0E9" : "#FFFEFA",
                        color: q.correct === oi ? "#2F6F4E" : "#6B6858",
                      }}
                    >
                      {LETTERS[oi]}
                    </button>
                    <input
                      className="cn-input flex-1 px-3 py-1.5 text-sm"
                      placeholder={`Сонголт ${LETTERS[oi]}`}
                      value={opt}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button onClick={addQuestionToForm} className="cn-btn-secondary rounded-md px-3 py-1.5 text-sm flex items-center gap-1.5">
            <Plus size={14} /> Асуулт нэмэх
          </button>
          <button onClick={addQuiz} disabled={!quizFormValid} className="cn-btn-primary rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-40">
            Шалгалт хадгалах
          </button>
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-3" style={{ color: "#6B6858" }}>Нэмэгдсэн шалгалтууд ({quizzes.length})</h3>
      {quizzes.length === 0 ? (
        <EmptyState text="Одоогоор шалгалт үүсгээгүй байна." />
      ) : (
        <div className="space-y-2">
          {quizzes.map((q) => (
            <div key={q.id} className="cn-card rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="cn-tag mr-2">{q.subject}</span>
                <span className="text-sm font-medium">{q.title}</span>
                <span className="text-xs ml-2" style={{ color: "#6B6858" }}>{q.questions.length} асуулт</span>
              </div>
              <button onClick={() => deleteQuiz(q.id)} style={{ color: "#9A3324" }}><Trash2 size={16} /></button>
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
          {quizzes.map((q) => (
            <button key={q.id} onClick={() => { setActiveQuiz(q); setQuizAnswers({}); setTab("quiz"); }} className="cn-card rounded-lg p-4 text-left transition-transform hover:-translate-y-0.5">
              <span className="cn-tag">{q.subject}</span>
              <div className="font-semibold mt-2">{q.title}</div>
              <div className="text-xs mt-1" style={{ color: "#6B6858" }}>{q.questions.length} асуулт</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuizTake({ setTab, activeQuiz, quizAnswers, setQuizAnswers, submitQuiz }) {
  if (!activeQuiz) return null;
  const allAnswered = activeQuiz.questions.every((_, i) => quizAnswers[i] !== undefined);
  return (
    <div>
      <BackRow onBack={() => setTab("quizzes")} title={activeQuiz.title} />
      <div className="space-y-4">
        {activeQuiz.questions.map((q, qi) => (
          <div key={qi} className="cn-card rounded-xl p-4">
            <div className="text-sm font-semibold mb-3">{qi + 1}. {q.text}</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => setQuizAnswers((a) => ({ ...a, [qi]: oi }))}
                  className={"cn-option rounded-md px-3 py-2 text-left text-sm flex items-center gap-2" + (quizAnswers[qi] === oi ? " selected" : "")}
                >
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                    style={{
                      border: "1.5px solid " + (quizAnswers[qi] === oi ? "#24478F" : "#D8D0BA"),
                      color: quizAnswers[qi] === oi ? "#24478F" : "#6B6858",
                    }}
                  >
                    {LETTERS[oi]}
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={submitQuiz} disabled={!allAnswered} className="cn-btn-primary rounded-md px-5 py-2.5 text-sm font-medium mt-5 disabled:opacity-40">
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
      <p className="mt-6 text-sm" style={{ color: "#6B6858" }}>
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
