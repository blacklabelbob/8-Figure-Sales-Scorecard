"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SECTIONS, TOTAL_QUESTIONS, MAX_SCORE,
  classifySegment, computeDimensions, scoreColor, scoreLabel,
  formatPhone, isValidPhone, isValidEmail, getTeaserText,
  identifyRespondent,
  type Scores,
} from "@/lib/scorecard-data";

type GateData = {
  name: string;
  email: string;
  phone: string;
  role: string;
  company: string;
};

export default function ScorecardApp() {
  const [step, setStep] = useState<"intro" | "quiz" | "teaser" | "gate" | "results">("intro");
  const [currentSection, setCurrentSection] = useState(0);
  const [scores, setScores] = useState<Scores>({});
  const [gateData, setGateData] = useState<GateData>({
    name: "", email: "", phone: "", role: "", company: "",
  });
  const [gateErrors, setGateErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [scoreVisible, setScoreVisible] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, currentSection]);

  useEffect(() => {
    if (step === "results") {
      const t = setTimeout(() => setScoreVisible(true), 400);
      return () => clearTimeout(t);
    }
  }, [step]);

  // ── Auto-advance: when all questions in current section are answered ────────
  useEffect(() => {
    if (step !== "quiz") return;
    const section = SECTIONS[currentSection];
    if (!section) return;
    const allAnswered = section.questions.every((q) => scores[q.id] !== undefined);
    if (allAnswered) {
      const t = setTimeout(() => {
        if (currentSection < SECTIONS.length - 1) {
          setCurrentSection((p) => p + 1);
        } else {
          setStep("teaser");
        }
      }, 520); // brief pause so the last tap registers visually
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, currentSection, step]);

  // ── Computed values ──────────────────────────────────────────────────────────
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const dims = computeDimensions(scores);
  const pct = dims.overall;
  const segment = classifySegment(scores);
  const teaser = getTeaserText(scores);

  // Identity detection — runs on gate data in real-time
  const identity = identifyRespondent(gateData.email, gateData.company);

  const section = SECTIONS[currentSection];
  const sectionAnswered = section?.questions.every((q) => scores[q.id] !== undefined);

  const completedQs =
    SECTIONS.slice(0, currentSection).reduce((a, s) => a + s.questions.length, 0) +
    (section?.questions.filter((q) => scores[q.id] !== undefined).length ?? 0);
  const progressPct = Math.round((completedQs / TOTAL_QUESTIONS) * 100);

  const circumference = 345.4;
  const ringOffset = scoreVisible ? circumference - (circumference * pct) / 100 : circumference;
  const ringColor = scoreColor(pct);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleScore(qId: string, val: number) {
    setScores((p) => ({ ...p, [qId]: val }));
  }

  function handleNext() {
    if (currentSection < SECTIONS.length - 1) setCurrentSection((p) => p + 1);
    else setStep("teaser");
  }

  function getSectionScore(s: typeof SECTIONS[0]) {
    const t = s.questions.reduce((a, q) => a + (scores[q.id] || 0), 0);
    const m = s.questions.length * 5;
    return { total: t, max: m, pct: Math.round((t / m) * 100) };
  }

  function validateGate() {
    const e: Record<string, string> = {};
    if (!gateData.name.trim() || gateData.name.trim().length < 2)
      e.name = "Please enter your full name.";
    if (!isValidEmail(gateData.email))
      e.email = "Please enter a valid business email address.";
    if (!gateData.role.trim())
      e.role = "Please enter your role.";
    if (!isValidPhone(gateData.phone))
      e.phone = "Please enter a valid 10-digit US phone number.";
    if (!gateData.company.trim())
      e.company = "Please enter your company name.";
    setGateErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validateGate()) return;
    setSubmitting(true);

    try {
      await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...gateData,
          scores,
          totalScore,
          maxScore: MAX_SCORE,
          pct,
          dims,
          segment: segment.primary,
          secondarySegment: segment.secondary,
          isKnownIdentity: identity.isKnown,
          submittedAt: new Date().toISOString(),
        }),
      });
    } catch (_) {
      /* always proceed — don't gate on notification failures */
    }

    setSubmitting(false);
    setStep("results");
  }

  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.32 },
  };
  const slideIn = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
    transition: { duration: 0.26 },
  };

  return (
    <div ref={topRef} style={{ background: "#0A0A0A", minHeight: "100vh" }}>
      <AnimatePresence mode="wait">

        {/* ═══════════════════════════════════════════
            INTRO
        ═══════════════════════════════════════════ */}
        {step === "intro" && (
          <motion.div key="intro" {...fadeUp} style={{ padding: "32px 20px" }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 32 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: "linear-gradient(135deg,#00D9FF,#2791e8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 13, color: "#000", flexShrink: 0,
              }}>STG</div>
              <span style={{ color: "#fff", fontSize: 26, fontWeight: 900, letterSpacing: "-0.3px" }}>Sales Transformation Group</span>
            </div>

            {/* Badge */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(0,217,255,0.08)", border: "1px solid rgba(0,217,255,0.2)",
                borderRadius: 100, padding: "5px 14px",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D9FF", display: "inline-block", animation: "pulse-dot 1.5s ease-in-out infinite" }} />
                <span style={{ color: "#00D9FF", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  Free · 3 Minutes · Instant Results
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.18, letterSpacing: "-0.5px", marginBottom: 14, textAlign: "center" }}>
              Is Your Sales Team{" "}
              <span className="gradient-text">Ready to Scale</span>
              {" "}—{" "}
              <span className="gradient-text-coral">or Ready to Sell?</span>
            </h1>
            <p style={{ color: "#888", fontSize: 15, lineHeight: 1.65, marginBottom: 24 }}>
              Answer {TOTAL_QUESTIONS} questions about your sales operation. Get your exact score,
              your segment, and a personalized analysis — including what it means for your business trajectory.
            </p>

            {/* Social Proof — centered single line */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <div className="social-proof" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>🏆</span>
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>Trusted by over 1,000+ contractors</span>
              </div>
            </div>


            {/* What you'll discover */}
            <div className="section-card" style={{ marginBottom: 24 }}>
              <p style={{ color: "#00D9FF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
                What you&apos;ll discover
              </p>
              {[
                "Your exact sales maturity score across 5 dimensions",
                "Which pain-qualified segment your business falls into — and what that means",
                "The specific gaps most impacting your revenue and valuation right now",
                "Your #1 highest-ROI opportunity to act on immediately",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 3 ? 10 : 0, alignItems: "flex-start" }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                    background: "rgba(0,217,255,0.1)", border: "1px solid rgba(0,217,255,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#00D9FF", fontSize: 10, fontWeight: 700,
                  }}>✓</div>
                  <span style={{ color: "#ccc", fontSize: 14, lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>

            <button className="cta-btn" onClick={() => setStep("quiz")}>
              Start My Free Assessment →
            </button>
            <p style={{ color: "#444", fontSize: 12, textAlign: "center", marginTop: 12 }}>
              🔒 We will never share your information.
            </p>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════
            QUIZ
        ═══════════════════════════════════════════ */}
        {step === "quiz" && (
          <motion.div key={`quiz-${currentSection}`} {...slideIn} style={{ padding: "24px 20px" }}>
            {/* Progress bar */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#FF6B35", fontSize: 12, fontWeight: 700 }}>
                  Section {currentSection + 1} of {SECTIONS.length}
                </span>
                <span style={{ color: "#00D9FF", fontSize: 12, fontWeight: 600 }}>
                  {progressPct}% complete
                </span>
              </div>
              <div style={{ height: 4, background: "#1E1E1E", borderRadius: 2, overflow: "hidden" }}>
                <div className="progress-fill" style={{ height: "100%", width: `${progressPct}%` }} />
              </div>
            </div>

            {/* Section header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(0,217,255,0.06)", border: "1px solid rgba(0,217,255,0.15)",
                borderRadius: 20, padding: "4px 12px", marginBottom: 8,
              }}>
                <span style={{ color: "#00D9FF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Phase {section.phase} · {section.title}
                </span>
              </div>
              <p style={{ color: "#777", fontSize: 14, lineHeight: 1.5 }}>{section.subtitle}</p>
            </div>

            {/* Questions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {section.questions.map((q, qi) => {
                const selected = scores[q.id];
                const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#00D9FF"];
                const bgs = [
                  "rgba(239,68,68,0.1)", "rgba(249,115,22,0.1)",
                  "rgba(234,179,8,0.1)", "rgba(34,197,94,0.1)",
                  "rgba(0,217,255,0.1)",
                ];
                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: qi * 0.07 }}
                  >
                    <p style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.4, color: "#fff", marginBottom: 4 }}>
                      {q.text}
                    </p>
                    {q.context && (
                      <div style={{
                        background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.15)",
                        borderRadius: 8, padding: "8px 12px", marginBottom: 12,
                      }}>
                        <span style={{ color: "#FF6B35", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.6px" }}>Data  </span>
                        <span style={{ color: "#aaa", fontSize: 12, lineHeight: 1.5 }}>{q.context}</span>
                      </div>
                    )}

                    {/* 1–5 rating buttons */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 6 }}>
                      {[1, 2, 3, 4, 5].map((val) => {
                        const on = selected === val;
                        return (
                          <button
                            key={val}
                            onClick={() => handleScore(q.id, val)}
                            style={{
                              border: `1.5px solid ${on ? colors[val - 1] : "#333"}`,
                              background: on ? bgs[val - 1] : "#1a1a1a",
                              borderRadius: 10, padding: "14px 4px",
                              display: "flex", flexDirection: "column",
                              alignItems: "center", cursor: "pointer",
                              transition: "all 0.15s ease",
                              boxShadow: on ? `0 0 14px ${colors[val - 1]}40` : "none",
                              transform: on ? "scale(1.06)" : "scale(1)",
                            }}
                          >
                            <span style={{ fontSize: 20, fontWeight: 900, color: on ? colors[val - 1] : "#888" }}>
                              {val}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#666", fontSize: 10 }}>{q.labels[0]}</span>
                      <span style={{ color: "#666", fontSize: 10 }}>{q.labels[1]}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Auto-advance hint */}
            {!sectionAnswered && (
              <p style={{ color: "#333", fontSize: 12, textAlign: "center", marginTop: 28 }}>
                Answer all {section.questions.length} questions — we&apos;ll advance automatically
              </p>
            )}
            {sectionAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: "center", marginTop: 20 }}
              >
                <div style={{ color: "#00D9FF", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                  ✓ Section complete — advancing…
                </div>
                {/* Manual advance button as fallback */}
                <button className="nav-btn" onClick={handleNext}>
                  {currentSection < SECTIONS.length - 1
                    ? `Next: ${SECTIONS[currentSection + 1].title} →`
                    : "See My Results →"}
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════
            TEASER
        ═══════════════════════════════════════════ */}
        {step === "teaser" && (
          <motion.div key="teaser" {...fadeUp} style={{ padding: "32px 20px" }}>
            <div className="section-card" style={{ textAlign: "center", padding: 28, marginBottom: 20 }}>
              <p style={{ color: "#555", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 20 }}>
                Assessment Complete
              </p>

              {/* Blurred score ring */}
              <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
                <svg width={120} height={120} viewBox="0 0 120 120">
                  <circle cx={60} cy={60} r={40} fill="none" stroke="#1E1E1E" strokeWidth={10} />
                  <circle
                    cx={60} cy={60} r={40} fill="none" stroke={ringColor} strokeWidth={10}
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * pct) / 100}
                    strokeLinecap="round"
                    style={{ transform: "rotate(-90deg)", transformOrigin: "center", filter: "blur(4px)" }}
                  />
                </svg>
                <div style={{
                  position: "absolute", inset: 0, display: "flex",
                  flexDirection: "column", alignItems: "center", justifyContent: "center",
                  filter: "blur(6px)",
                }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: "#fff" }}>{pct}%</span>
                  <span style={{ fontSize: 10, color: "#888" }}>{scoreLabel(pct)}</span>
                </div>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{
                    background: "rgba(0,0,0,0.75)", borderRadius: "50%",
                    width: 42, height: 42, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 20, backdropFilter: "blur(4px)",
                  }}>🔒</div>
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: 15, color: "#fff", marginBottom: 4 }}>
                Segment: <span className="gradient-text">{segment.emoji} {segment.primary}</span>
              </div>
              <p style={{ color: "#666", fontSize: 13 }}>{segment.secondary}</p>

              {/* Teaser insight — 100% answer-driven */}
              <div style={{
                background: "rgba(0,217,255,0.05)", border: "1px solid rgba(0,217,255,0.15)",
                borderRadius: 12, padding: "14px 16px", textAlign: "left", marginTop: 16,
              }}>
                <p style={{ color: "#00D9FF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                  ⚡ Initial Signal
                </p>
                <p style={{ color: "#bbb", fontSize: 13, lineHeight: 1.65 }}>{teaser}</p>
              </div>
            </div>

            {/* Section preview (blurred) */}
            <div className="section-card" style={{ marginBottom: 24 }}>
              <p style={{ color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>
                Inside your full report
              </p>
              {SECTIONS.map((s) => {
                const ss = getSectionScore(s);
                return (
                  <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ color: "#bbb", fontSize: 13 }}>{s.title}</span>
                    <div style={{ display: "flex", gap: 4, filter: "blur(3px)" }}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: (ss.pct / 20) >= i ? scoreColor(ss.pct) : "#222",
                        }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <button className="nav-btn" onClick={() => setStep("gate")}>
              Unlock My Full Results →
            </button>
            <p style={{ color: "#444", fontSize: 12, textAlign: "center", marginTop: 10 }}>
              🔒 Free · 30 seconds · We will never share your information.
            </p>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════
            GATE
        ═══════════════════════════════════════════ */}
        {step === "gate" && (
          <motion.div key="gate" {...fadeUp} style={{ padding: "32px 20px" }}>
            {/* Blue accent header bar */}
            <div style={{
              background: "linear-gradient(135deg, rgba(0,40,80,0.6), rgba(39,145,232,0.12))",
              border: "1px solid rgba(39,145,232,0.2)",
              borderRadius: 16,
              padding: "20px 20px 16px",
              marginBottom: 28,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "linear-gradient(135deg,#00D9FF,#2791e8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 12, color: "#000", flexShrink: 0,
                }}>STG</div>
                <span style={{ color: "#2791e8", fontSize: 12, fontWeight: 600 }}>Sales Transformation Group</span>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.2, marginBottom: 8 }}>
                Where should we send your{" "}
                <span className="gradient-text">full results?</span>
              </h2>
              <p style={{ color: "#6b9fd4", fontSize: 13, lineHeight: 1.55 }}>
                Your detailed scorecard, segment analysis, and personalized recommendations — delivered instantly.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Name */}
              <div>
                <label className="gate-label">Full Name</label>
                <div style={{ position: "relative" }}>
                  <span className="input-icon">👤</span>
                  <input
                    className={`stg-input stg-input-icon${gateErrors.name ? " error" : ""}`}
                    type="text" placeholder="Your name"
                    value={gateData.name}
                    onChange={(e) => setGateData((p) => ({ ...p, name: e.target.value }))}
                    onFocus={() => setGateErrors((p) => ({ ...p, name: "" }))}
                  />
                </div>
                {gateErrors.name && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{gateErrors.name}</p>}
              </div>

              {/* Role */}
              <div>
                <label className="gate-label">Your Role</label>
                <div style={{ position: "relative" }}>
                  <span className="input-icon">💼</span>
                  <input
                    className={`stg-input stg-input-icon${gateErrors.role ? " error" : ""}`}
                    type="text" placeholder="Owner / CEO / Sales Manager"
                    value={gateData.role}
                    onChange={(e) => setGateData((p) => ({ ...p, role: e.target.value }))}
                    onFocus={() => setGateErrors((p) => ({ ...p, role: "" }))}
                  />
                </div>
                {gateErrors.role && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{gateErrors.role}</p>}
              </div>

              {/* Company */}
              <div>
                <label className="gate-label">Company Name</label>
                <div style={{ position: "relative" }}>
                  <span className="input-icon">🏢</span>
                  <input
                    className={`stg-input stg-input-icon${gateErrors.company ? " error" : ""}`}
                    type="text" placeholder="Your company"
                    value={gateData.company}
                    onChange={(e) => setGateData((p) => ({ ...p, company: e.target.value }))}
                    onFocus={() => setGateErrors((p) => ({ ...p, company: "" }))}
                  />
                </div>
                {gateErrors.company && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{gateErrors.company}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="gate-label">Business Email</label>
                <div style={{ position: "relative" }}>
                  <span className="input-icon">✉️</span>
                  <input
                    className={`stg-input stg-input-icon${gateErrors.email ? " error" : ""}`}
                    type="email" placeholder="you@yourcompany.com"
                    inputMode="email" autoComplete="email"
                    value={gateData.email}
                    onChange={(e) => setGateData((p) => ({ ...p, email: e.target.value }))}
                    onFocus={() => setGateErrors((p) => ({ ...p, email: "" }))}
                  />
                </div>
                {gateErrors.email && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{gateErrors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="gate-label">Mobile Number</label>
                <p style={{ color: "#444", fontSize: 11, marginBottom: 8 }}>so we can text you your results</p>
                <div style={{ position: "relative" }}>
                  <span className="input-icon">📱</span>
                  <input
                    className={`stg-input stg-input-icon${gateErrors.phone ? " error" : ""}`}
                    type="tel" placeholder="(555) 555-5555"
                    inputMode="tel" autoComplete="tel"
                    value={gateData.phone}
                    onChange={(e) => setGateData((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
                    onFocus={() => setGateErrors((p) => ({ ...p, phone: "" }))}
                  />
                </div>
                {gateErrors.phone && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{gateErrors.phone}</p>}
              </div>
            </div>

            {/* Identity-gated appointment note */}
            {identity.isKnown && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="section-card"
                style={{ borderColor: "rgba(0,217,255,0.2)", background: "rgba(0,217,255,0.04)", marginTop: 20 }}
              >
                <p style={{ fontSize: 13, color: "#999", lineHeight: 1.65 }}>
                  {identity.appointmentNote}
                </p>
              </motion.div>
            )}

            <div style={{ marginTop: 28 }}>
              <button className="cta-btn" disabled={submitting} onClick={handleSubmit}>
                {submitting ? "Sending Your Results..." : "🔓 Get My Full Results →"}
              </button>
              <p style={{ color: "#444", fontSize: 12, textAlign: "center", marginTop: 12 }}>
                🔒 We will never share your information. No spam, ever.
              </p>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════
            RESULTS
        ═══════════════════════════════════════════ */}
        {step === "results" && (
          <motion.div key="results" {...fadeUp} style={{ padding: "32px 20px" }}>

            {/* ── SECTION 1: Header ─────────────────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
                borderRadius: 100, padding: "5px 14px", marginBottom: 12,
              }}>
                <span style={{ fontSize: 12 }}>✅</span>
                <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px" }}>
                  Results for {gateData.name || "You"}
                </span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.2, marginBottom: 4 }}>
                Your Sales Team Scorecard
              </h2>
              <p style={{ color: "#555", fontSize: 13 }}>
                {gateData.company} · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>

            {/* ── SECTION 2: Score Ring ────────────────────────────────── */}
            <div className="results-section-header">📊 Your Overall Score</div>
            <div className="section-divider" />
            <div className="section-card" style={{ textAlign: "center", padding: 28, marginBottom: 20 }}>
              <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
                <svg width={140} height={140} viewBox="0 0 140 140">
                  <circle cx={70} cy={70} r={55} fill="none" stroke="#1A1A1A" strokeWidth={12} />
                  <circle
                    cx={70} cy={70} r={55} fill="none" stroke={ringColor} strokeWidth={12}
                    strokeDasharray={circumference}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    style={{
                      transform: "rotate(-90deg)", transformOrigin: "center",
                      transition: "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)",
                    }}
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: "#fff" }}>{pct}%</span>
                  <span style={{ fontSize: 12, color: ringColor, fontWeight: 700 }}>{scoreLabel(pct)}</span>
                </div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>{segment.emoji}</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: segment.color, marginLeft: 8 }}>
                  {segment.primary}
                </span>
              </div>
              <p style={{ color: "#666", fontSize: 13, fontStyle: "italic" }}>{segment.tagline}</p>
            </div>

            {/* ── SECTION 3: Segment Description ──────────────────────── */}
            <div className="results-section-header">🧠 What This Means For You</div>
            <div className="section-divider" />
            <div className="section-card" style={{ marginBottom: 20 }}>
              <p style={{ color: "#ccc", fontSize: 14, lineHeight: 1.72 }}>{segment.description}</p>
            </div>

            {/* Identity-gated exit context from Rob's notes */}
            {identity.isKnown && identity.exitContext && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="section-card"
                style={{ borderColor: "rgba(0,217,255,0.2)", background: "rgba(0,217,255,0.04)", marginBottom: 20 }}
              >
                <p style={{ color: "#00D9FF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                  📋 Based on Our Prior Conversation
                </p>
                <p style={{ fontSize: 13, color: "#bbb", lineHeight: 1.65 }}>
                  {identity.exitContext}
                </p>
              </motion.div>
            )}

            {/* ── SECTION 4: Score Breakdown ───────────────────────────── */}
            <div className="results-section-header">📈 Score Breakdown</div>
            <div className="section-divider" />
            <div className="section-card" style={{ marginBottom: 20 }}>
              {SECTIONS.map((s) => {
                const ss = getSectionScore(s);
                const c = scoreColor(ss.pct);
                return (
                  <div key={s.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: "#ccc", fontSize: 13, fontWeight: 500 }}>{s.title}</span>
                      <span style={{ color: c, fontSize: 12, fontWeight: 700 }}>
                        {ss.total}/{ss.max} ({scoreLabel(ss.pct)})
                      </span>
                    </div>
                    <div style={{ height: 6, background: "#1A1A1A", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", background: c, borderRadius: 3,
                        width: `${ss.pct}%`,
                        transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)",
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── SECTION 5: Strengths ────────────────────────────────── */}
            <div className="results-section-header">✅ What You&apos;re Doing Right</div>
            <div className="section-divider" />
            <div className="section-card" style={{ marginBottom: 20 }}>
              {segment.strengths.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < segment.strengths.length - 1 ? 12 : 0, alignItems: "flex-start" }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                    background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#22c55e", fontSize: 10, fontWeight: 700,
                  }}>✓</div>
                  <span style={{ color: "#ccc", fontSize: 14, lineHeight: 1.55 }}>{s}</span>
                </div>
              ))}
            </div>

            {/* ── SECTION 6: Opportunities ─────────────────────────────── */}
            <div className="results-section-header">🎯 Highest-ROI Opportunities</div>
            <div className="section-divider" />
            <div className="section-card" style={{ marginBottom: 20 }}>
              {segment.opportunities.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < segment.opportunities.length - 1 ? 12 : 0, alignItems: "flex-start" }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                    background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#FF6B35", fontSize: 10, fontWeight: 800,
                  }}>{i + 1}</div>
                  <span style={{ color: "#ccc", fontSize: 14, lineHeight: 1.55 }}>{o}</span>
                </div>
              ))}
            </div>

            {/* ── SECTION 7: Key Insight ───────────────────────────────── */}
            <div className="results-section-header">💡 The Insight That Changes the Math</div>
            <div className="section-divider" />
            <div className="section-card" style={{ borderColor: "rgba(0,217,255,0.2)", background: "rgba(0,217,255,0.04)", marginBottom: 20 }}>
              <p style={{ color: "#ccc", fontSize: 14, lineHeight: 1.72 }}>{segment.insight}</p>
            </div>

            {/* ── SECTION 8: Urgency ───────────────────────────────────── */}
            <div className="results-section-header">⏱ Why the Timing Matters</div>
            <div className="section-divider" />
            <div className="section-card" style={{ borderColor: "rgba(255,107,53,0.2)", background: "rgba(255,107,53,0.04)", marginBottom: 20 }}>
              <p style={{ color: "#ccc", fontSize: 14, lineHeight: 1.72 }}>{segment.urgency}</p>
            </div>

            {/* Identity-gated appointment note — results page */}
            {identity.isKnown && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="section-card"
                style={{ borderColor: "rgba(0,217,255,0.15)", background: "rgba(0,217,255,0.04)", marginBottom: 24 }}
              >
                <p style={{ fontSize: 13, color: "#999", lineHeight: 1.7 }}>
                  📅 <strong style={{ color: "#fff" }}>You have an appointment set</strong> with our Senior Growth
                  Consultant <strong style={{ color: "#00D9FF" }}>Rob</strong> at 11 AM to discuss these results and
                  next steps on the proposal. We&apos;d love to have you in the{" "}
                  <strong style={{ color: "#00D9FF" }}>February Cohort</strong>.
                </p>
              </motion.div>
            )}

            {/* ── Social Proof compact strip ────────────────────────── */}
            <div className="social-proof" style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>🏆</div>
              <div style={{ color: "#666", fontSize: 12, lineHeight: 1.5 }}>
                <strong style={{ color: "#fff" }}>1,000+ contractors</strong> &nbsp;·&nbsp; <strong style={{ color: "#00D9FF" }}>$2B+ revenue added</strong> &nbsp;·&nbsp; <strong style={{ color: "#22c55e" }}>92% hit KPIs in 6 months</strong>
              </div>
            </div>

            {/* ── SECTION 10: Dual CTA ─────────────────────────────────── */}
            <div className="results-section-header">🚀 Your Next Step</div>
            <div className="section-divider" />

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>

              {/* Option 1 — Book a Call (calendar-themed) */}
              <a
                href="https://calendly.com/robert-salestransformationgroup/stg-discovery-call"
                target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: "none" }}
              >
                <div className="cta-card-calendar">
                  <div className="cta-card-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <div className="cta-card-text">
                    <div className="cta-card-title">Book a Time with a Sr. Consultant</div>
                    <div className="cta-card-sub">Pick a slot that works for you — free 20-min call</div>
                  </div>
                  <div className="cta-card-arrow">→</div>
                </div>
              </a>

              {/* Option 2 — Call Now (phone-themed) */}
              <a
                href="tel:2393645062"
                style={{ textDecoration: "none" }}
              >
                <div className="cta-card-phone">
                  <div className="cta-card-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.28h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 6.06 6.06l.95-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </div>
                  <div className="cta-card-text">
                    <div className="cta-card-title">Let&apos;s Talk Right Now</div>
                    <div className="cta-card-sub">Connect with a Growth Consultant instantly</div>
                  </div>
                  <div className="cta-card-arrow">→</div>
                </div>
              </a>

              <p style={{ color: "#333", fontSize: 12, textAlign: "center", marginTop: 2 }}>
                🔒 We will never share your information.
              </p>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #151515", textAlign: "center" }}>
              <p style={{ color: "#444", fontSize: 12 }}>Sales Transformation Group · salestransformationgroup.com</p>
              <p style={{ color: "#333", fontSize: 11, marginTop: 4 }}>Serving specialty contractors since 2018</p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
