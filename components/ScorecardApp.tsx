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

  function handlePrev() {
    if (currentSection > 0) setCurrentSection((p) => p - 1);
    else setStep("intro");
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: "linear-gradient(135deg,#00D9FF,#2791e8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 13, color: "#000", flexShrink: 0,
              }}>STG</div>
              <span style={{ color: "#555", fontSize: 13 }}>Sales Transformation Group</span>
            </div>

            {/* Badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(0,217,255,0.08)", border: "1px solid rgba(0,217,255,0.2)",
              borderRadius: 100, padding: "5px 14px", marginBottom: 14,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D9FF", display: "inline-block", animation: "pulse-dot 1.5s ease-in-out infinite" }} />
              <span style={{ color: "#00D9FF", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Free · 3 Minutes · Instant Results
              </span>
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.18, letterSpacing: "-0.5px", marginBottom: 14 }}>
              Is Your Sales Team{" "}
              <span className="gradient-text">Ready to Scale</span>
              {" "}—{" "}
              <span className="gradient-text-coral">or Ready to Sell?</span>
            </h1>
            <p style={{ color: "#888", fontSize: 15, lineHeight: 1.65, marginBottom: 24 }}>
              Answer {TOTAL_QUESTIONS} questions about your sales operation. Get your exact score,
              your segment, and a personalized analysis — including what it means for your business trajectory.
            </p>

            {/* Stats */}
            <div className="section-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, textAlign: "center", marginBottom: 20 }}>
              {[
                { v: "3 min",           l: "To complete" },
                { v: String(TOTAL_QUESTIONS), l: "Questions" },
                { v: "Free",            l: "Assessment" },
              ].map((s) => (
                <div key={s.l}>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "#00D9FF" }}>{s.v}</div>
                  <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* What you'll discover */}
            <div className="section-card" style={{ marginBottom: 20 }}>
              <p style={{ color: "#666", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
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
            <p style={{ color: "#333", fontSize: 12, textAlign: "center", marginTop: 12 }}>
              We will never share your information.
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
                <span style={{ color: "#555", fontSize: 12 }}>
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
                      <p style={{ color: "#555", fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
                        {q.context}
                      </p>
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
                              border: `1.5px solid ${on ? colors[val - 1] : "#222"}`,
                              background: on ? bgs[val - 1] : "#111",
                              borderRadius: 10, padding: "14px 4px",
                              display: "flex", flexDirection: "column",
                              alignItems: "center", cursor: "pointer",
                              transition: "all 0.15s ease",
                              boxShadow: on ? `0 0 14px ${colors[val - 1]}40` : "none",
                              transform: on ? "scale(1.06)" : "scale(1)",
                            }}
                          >
                            <span style={{ fontSize: 20, fontWeight: 900, color: on ? colors[val - 1] : "#444" }}>
                              {val}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#444", fontSize: 10 }}>{q.labels[0]}</span>
                      <span style={{ color: "#444", fontSize: 10 }}>{q.labels[1]}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Navigation */}
            <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
              <button
                onClick={handlePrev}
                style={{
                  flexShrink: 0, background: "#141414", border: "1px solid #222",
                  color: "#666", borderRadius: 12, padding: "14px 18px", cursor: "pointer",
                  fontSize: 14, fontWeight: 600,
                }}
              >←</button>
              <button
                className="cta-btn"
                style={{ flex: 1 }}
                disabled={!sectionAnswered}
                onClick={handleNext}
              >
                {currentSection < SECTIONS.length - 1
                  ? `Next: ${SECTIONS[currentSection + 1].title} →`
                  : "See My Results →"}
              </button>
            </div>
            {!sectionAnswered && (
              <p style={{ color: "#444", fontSize: 12, textAlign: "center", marginTop: 10 }}>
                Answer all {section.questions.length} questions to continue
              </p>
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

            <button className="cta-btn" onClick={() => setStep("gate")}>
              Unlock My Full Results →
            </button>
            <p style={{ color: "#333", fontSize: 12, textAlign: "center", marginTop: 10 }}>
              Free · 30 seconds · We will never share your information.
            </p>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════
            GATE
        ═══════════════════════════════════════════ */}
        {step === "gate" && (
          <motion.div key="gate" {...fadeUp} style={{ padding: "32px 20px" }}>
            <h2 style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.2, marginBottom: 10 }}>
              Where should we send your <span className="gradient-text">full results?</span>
            </h2>
            <p style={{ color: "#777", fontSize: 14, lineHeight: 1.55, marginBottom: 28 }}>
              Your detailed scorecard, segment analysis, and personalized recommendations — delivered instantly.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Name */}
              <div>
                <label style={{ display: "block", color: "#666", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>
                  Full Name
                </label>
                <input
                  className={`stg-input${gateErrors.name ? " error" : ""}`}
                  type="text" placeholder="Your name"
                  value={gateData.name}
                  onChange={(e) => setGateData((p) => ({ ...p, name: e.target.value }))}
                  onFocus={() => setGateErrors((p) => ({ ...p, name: "" }))}
                />
                {gateErrors.name && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{gateErrors.name}</p>}
              </div>

              {/* Role */}
              <div>
                <label style={{ display: "block", color: "#666", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>
                  Your Role
                </label>
                <input
                  className={`stg-input${gateErrors.role ? " error" : ""}`}
                  type="text" placeholder="Owner / CEO / Sales Manager"
                  value={gateData.role}
                  onChange={(e) => setGateData((p) => ({ ...p, role: e.target.value }))}
                  onFocus={() => setGateErrors((p) => ({ ...p, role: "" }))}
                />
                {gateErrors.role && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{gateErrors.role}</p>}
              </div>

              {/* Company */}
              <div>
                <label style={{ display: "block", color: "#666", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>
                  Company Name
                </label>
                <input
                  className={`stg-input${gateErrors.company ? " error" : ""}`}
                  type="text" placeholder="Your company"
                  value={gateData.company}
                  onChange={(e) => setGateData((p) => ({ ...p, company: e.target.value }))}
                  onFocus={() => setGateErrors((p) => ({ ...p, company: "" }))}
                />
                {gateErrors.company && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{gateErrors.company}</p>}
              </div>

              {/* Email */}
              <div>
                <label style={{ display: "block", color: "#666", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 8 }}>
                  Business Email
                </label>
                <input
                  className={`stg-input${gateErrors.email ? " error" : ""}`}
                  type="email" placeholder="you@yourcompany.com"
                  inputMode="email" autoComplete="email"
                  value={gateData.email}
                  onChange={(e) => setGateData((p) => ({ ...p, email: e.target.value }))}
                  onFocus={() => setGateErrors((p) => ({ ...p, email: "" }))}
                />
                {gateErrors.email && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{gateErrors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <label style={{ display: "block", color: "#666", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 4 }}>
                  Mobile Number
                </label>
                <p style={{ color: "#444", fontSize: 11, marginBottom: 8 }}>so we can text you your results</p>
                <input
                  className={`stg-input phone-input${gateErrors.phone ? " error" : ""}`}
                  type="tel" placeholder="(555) 555-5555"
                  inputMode="tel" autoComplete="tel"
                  value={gateData.phone}
                  onChange={(e) => setGateData((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
                  onFocus={() => setGateErrors((p) => ({ ...p, phone: "" }))}
                />
                {gateErrors.phone && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{gateErrors.phone}</p>}
              </div>
            </div>

            {/* Identity-gated appointment note — only shows if Draper email/company detected */}
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
                {submitting ? "Sending Your Results..." : "Get My Full Results →"}
              </button>
              <p style={{ color: "#333", fontSize: 12, textAlign: "center", marginTop: 12 }}>
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
            {/* Header */}
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

            {/* Score ring */}
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

            {/* Description — dynamically generated */}
            <div className="section-card" style={{ marginBottom: 16 }}>
              <p style={{ color: "#ccc", fontSize: 14, lineHeight: 1.72 }}>{segment.description}</p>
            </div>

            {/* ── Identity-gated exit context from Rob's notes ──────────────── */}
            {identity.isKnown && identity.exitContext && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="section-card"
                style={{ borderColor: "rgba(0,217,255,0.2)", background: "rgba(0,217,255,0.04)", marginBottom: 16 }}
              >
                <p style={{ color: "#00D9FF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                  📋 Based on Our Prior Conversation
                </p>
                <p style={{ fontSize: 13, color: "#bbb", lineHeight: 1.65 }}>
                  {identity.exitContext}
                </p>
              </motion.div>
            )}

            {/* Score breakdown */}
            <div className="section-card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 18 }}>
                Score Breakdown
              </p>
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

            {/* Strengths — dynamically built from scores */}
            <div className="section-card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 11, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>
                ✅ What Your Scores Reveal as Strengths
              </p>
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

            {/* Opportunities — derived from lowest dimension */}
            <div className="section-card" style={{ marginBottom: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 11, color: "#FF6B35", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 14 }}>
                🎯 Highest-ROI Opportunities Right Now
              </p>
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

            {/* Insight */}
            <div className="section-card" style={{ borderColor: "rgba(0,217,255,0.2)", background: "rgba(0,217,255,0.04)", marginBottom: 16 }}>
              <p style={{ color: "#00D9FF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>
                💡 The Insight That Changes the Math
              </p>
              <p style={{ color: "#ccc", fontSize: 14, lineHeight: 1.72 }}>{segment.insight}</p>
            </div>

            {/* Urgency */}
            <div className="section-card" style={{ borderColor: "rgba(255,107,53,0.2)", background: "rgba(255,107,53,0.04)", marginBottom: 20 }}>
              <p style={{ color: "#FF6B35", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>
                ⏱ Why the Timing Matters
              </p>
              <p style={{ color: "#ccc", fontSize: 14, lineHeight: 1.72 }}>{segment.urgency}</p>
            </div>

            {/* ── Identity-gated appointment note — results page ─────────────── */}
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

            {/* CTAs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <a
                href="https://salestransformationgroup.com"
                target="_blank" rel="noopener noreferrer"
                style={{ display: "block", textAlign: "center", textDecoration: "none" }}
                className="cta-btn"
              >
                Book My Strategy Call →
              </a>
              <a
                href="tel:8557848143"
                style={{ display: "block", textAlign: "center", textDecoration: "none" }}
                className="cta-btn cta-btn-coral"
              >
                Call Us: (855) 784-8143
              </a>
            </div>

            <p style={{ color: "#2a2a2a", fontSize: 12, textAlign: "center", marginTop: 16 }}>
              🔒 We will never share your information.
            </p>

            <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #151515", textAlign: "center" }}>
              <p style={{ color: "#444", fontSize: 12 }}>Sales Transformation Group · salestransformationgroup.com</p>
              <p style={{ color: "#333", fontSize: 11, marginTop: 4 }}>Serving specialty contractors since 2018</p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
