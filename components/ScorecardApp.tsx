'use client';

import { useState, useEffect, useRef } from 'react';
import { PHASES, ALL_QUESTIONS, calculateScore, DRAPER_TEASER, MAX_SCORE } from '@/lib/scorecard-data';
import { CheckCircle, ChevronRight, ChevronLeft, Lock, Star, AlertTriangle, TrendingUp, Users } from 'lucide-react';

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface ContactForm {
  name: string;
  businessEmail: string;
  role: string;
  phone: string;
}

type AppState = 'intro' | 'quiz' | 'teaser' | 'gate' | 'results';

// ─── PHONE FORMATTER ─────────────────────────────────────────────────────────
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 && !['1111111111', '0000000000', '1234567890'].includes(digits);
}

function isValidBusinessEmail(email: string): boolean {
  const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'live.com', 'msn.com'];
  const emailLower = email.toLowerCase();
  const parts = emailLower.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  if (!domain || !domain.includes('.')) return false;
  // Allow free emails but validate format
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

// ─── SCORE RING COMPONENT ─────────────────────────────────────────────────────
function ScoreRing({ score, max, size = 120 }: { score: number; max: number; size?: number }) {
  const pct = score / max;
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = pct >= 0.7 ? '#00D9FF' : pct >= 0.45 ? '#FF6B35' : '#ef4444';

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a1a2e" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text
        x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={size * 0.22} fontWeight="bold"
        style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}
      >
        {score}/{max}
      </text>
    </svg>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function ScorecardApp() {
  const [appState, setAppState] = useState<AppState>('intro');
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [contact, setContact] = useState<ContactForm>({ name: '', businessEmail: '', role: '', phone: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<ReturnType<typeof calculateScore> | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward');
  const topRef = useRef<HTMLDivElement>(null);

  const currentPhase = PHASES[currentPhaseIdx];
  const currentQ = currentPhase?.questions[currentQIdx];

  // Total progress
  const answeredCount = Object.keys(answers).length;
  const totalProgress = Math.round((answeredCount / ALL_QUESTIONS.length) * 100);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [appState, currentPhaseIdx, currentQIdx]);

  useEffect(() => {
    if (currentQ) {
      setSelectedRating(answers[currentQ.id] ?? null);
    }
  }, [currentPhaseIdx, currentQIdx]);

  function handleRatingSelect(rating: number) {
    setSelectedRating(rating);
  }

  function handleNext() {
    if (!selectedRating) return;

    const newAnswers = { ...answers, [currentQ.id]: selectedRating };
    setAnswers(newAnswers);
    setAnimDir('forward');

    // Move to next question
    const nextQIdx = currentQIdx + 1;
    if (nextQIdx < currentPhase.questions.length) {
      setCurrentQIdx(nextQIdx);
    } else {
      const nextPhaseIdx = currentPhaseIdx + 1;
      if (nextPhaseIdx < PHASES.length) {
        setCurrentPhaseIdx(nextPhaseIdx);
        setCurrentQIdx(0);
      } else {
        // All done → teaser
        const calcResults = calculateScore(newAnswers);
        setResults(calcResults);
        setAppState('teaser');
      }
    }
    setSelectedRating(null);
  }

  function handleBack() {
    setAnimDir('back');
    if (currentQIdx > 0) {
      setCurrentQIdx(currentQIdx - 1);
    } else if (currentPhaseIdx > 0) {
      const prevPhase = PHASES[currentPhaseIdx - 1];
      setCurrentPhaseIdx(currentPhaseIdx - 1);
      setCurrentQIdx(prevPhase.questions.length - 1);
    } else {
      setAppState('intro');
    }
  }

  function handleContactChange(field: keyof ContactForm, value: string) {
    if (field === 'phone') {
      value = formatPhone(value);
    }
    setContact(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: '' }));
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!contact.name.trim() || contact.name.trim().split(' ').length < 2) {
      errors.name = 'Please enter your full name';
    }
    if (!isValidBusinessEmail(contact.businessEmail)) {
      errors.businessEmail = 'Please enter a valid email address';
    }
    if (!contact.role.trim()) {
      errors.role = 'Please enter your role';
    }
    if (!isValidPhone(contact.phone)) {
      errors.phone = 'Please enter a valid 10-digit US phone number';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmitGate() {
    if (!validateForm()) return;
    setSubmitting(true);

    try {
      const payload = {
        contact,
        results: {
          total: results?.total,
          percentage: results?.percentage,
          categoryId: results?.categoryId,
          categoryName: results?.category?.name,
          phaseScores: results?.phaseScores,
        },
        company: 'Draper Fence & Rail',
        timestamp: new Date().toISOString(),
      };

      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setAppState('results');
      } else {
        // Show results anyway — don't block the user
        setAppState('results');
      }
    } catch {
      setAppState('results');
    } finally {
      setSubmitting(false);
    }
  }

  const phaseColors = ['#00D9FF', '#FF6B35', '#9B59B6'];

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (appState === 'intro') {
    return (
      <div ref={topRef} className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
        {/* Header */}
        <div className="px-5 pt-8 pb-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00D9FF, #0066FF)' }}>
              <span className="text-xs font-black">STG</span>
            </div>
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Sales Transformation Group</span>
          </div>

          <div className="inline-flex items-center gap-2 bg-[#00D9FF]/10 border border-[#00D9FF]/30 rounded-full px-3 py-1 mb-4">
            <Star className="w-3 h-3 text-[#00D9FF]" />
            <span className="text-[#00D9FF] text-xs font-semibold">Personalized for Draper Fence & Rail</span>
          </div>

          <h1 className="text-3xl font-black leading-tight mb-3">
            The 8-Figure<br />
            <span style={{ background: 'linear-gradient(90deg, #00D9FF, #FF6B35)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Sales Team Scorecard
            </span>
          </h1>

          <p className="text-gray-400 text-base leading-relaxed mb-6">
            15 questions. 5 minutes. Discover exactly where your sales operation stands — and what it's costing you right now.
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Questions', value: '15', color: '#00D9FF' },
              { label: 'Minutes', value: '~5', color: '#FF6B35' },
              { label: 'Insights', value: '3+', color: '#9B59B6' },
            ].map(stat => (
              <div key={stat.label} className="bg-[#111] rounded-xl p-3 text-center border border-white/5">
                <div className="text-2xl font-black mb-0.5" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-gray-500 text-xs">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* What you'll find */}
          <div className="bg-[#111] rounded-2xl p-4 mb-6 border border-white/5">
            <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#00D9FF]" />
              What you'll discover:
            </h3>
            {[
              'Where your sales process has invisible gaps',
              'Why reps may be underperforming (and it\'s not their fault)',
              'Your exact growth stage & biggest leverage point',
              'The 3 moves that match your current situation',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-[#00D9FF] mt-0.5 shrink-0" />
                <span className="text-gray-300 text-sm">{item}</span>
              </div>
            ))}
          </div>

          {/* Homa callout */}
          <div className="bg-gradient-to-r from-[#00D9FF]/10 to-[#FF6B35]/10 rounded-2xl p-4 mb-8 border border-[#00D9FF]/20">
            <p className="text-gray-300 text-sm leading-relaxed">
              <span className="text-white font-semibold">Homa</span> — this scorecard was built specifically for where Draper Fence & Rail is right now. Answer honestly. The more accurate your answers, the more useful your results will be.
            </p>
          </div>

          <button
            onClick={() => setAppState('quiz')}
            className="w-full py-4 rounded-2xl font-black text-lg text-black transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #00D9FF, #0088FF)' }}
          >
            Start My Scorecard →
          </button>

          <p className="text-center text-gray-600 text-xs mt-3">
            Takes about 5 minutes · No prior research needed · 100% confidential
          </p>
        </div>
      </div>
    );
  }

  // ─── QUIZ ─────────────────────────────────────────────────────────────────
  if (appState === 'quiz' && currentQ) {
    const phaseColor = phaseColors[currentPhaseIdx];
    const globalQNum = PHASES.slice(0, currentPhaseIdx).reduce((a, p) => a + p.questions.length, 0) + currentQIdx + 1;

    return (
      <div ref={topRef} className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
        {/* Progress bar */}
        <div className="w-full h-1 bg-[#1a1a1a]">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${totalProgress}%`, background: `linear-gradient(90deg, #00D9FF, #FF6B35)` }}
          />
        </div>

        {/* Phase indicator */}
        <div className="px-5 pt-5 pb-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{currentPhase.icon}</span>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: phaseColor }}>
                Phase {currentPhase.number}: {currentPhase.name}
              </span>
            </div>
            <span className="text-gray-500 text-xs font-mono">{globalQNum} / {ALL_QUESTIONS.length}</span>
          </div>

          {/* Phase dots */}
          <div className="flex gap-1.5 mb-6">
            {PHASES.map((p, pi) => (
              <div
                key={p.number}
                className="h-1.5 flex-1 rounded-full transition-all"
                style={{
                  background: pi < currentPhaseIdx
                    ? phaseColors[pi]
                    : pi === currentPhaseIdx
                    ? phaseColor
                    : '#1a1a1a',
                }}
              />
            ))}
          </div>

          {/* Question */}
          <div className="mb-8">
            <h2 className="text-xl font-black leading-snug mb-2 text-white">
              {currentQ.text}
            </h2>
            {currentQ.subtext && (
              <p className="text-gray-400 text-sm leading-relaxed">{currentQ.subtext}</p>
            )}
          </div>

          {/* Rating buttons */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-500 mb-3 px-1">
              <span>1 – {currentQ.lowLabel}</span>
              <span>5 – {currentQ.highLabel}</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  onClick={() => handleRatingSelect(rating)}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center transition-all active:scale-95 border"
                  style={{
                    background: selectedRating === rating
                      ? phaseColor
                      : selectedRating !== null && selectedRating > rating
                      ? `${phaseColor}22`
                      : '#111',
                    borderColor: selectedRating === rating ? phaseColor : '#222',
                    transform: selectedRating === rating ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  <span className="text-xl font-black" style={{ color: selectedRating === rating ? '#000' : '#fff' }}>
                    {rating}
                  </span>
                </button>
              ))}
            </div>

            {/* Rating label */}
            <div className="mt-3 text-center h-5">
              {selectedRating !== null && (
                <span className="text-sm font-medium" style={{ color: phaseColor }}>
                  {selectedRating === 1 ? '⚠️ Needs significant work'
                    : selectedRating === 2 ? '📉 Below average — room to grow'
                    : selectedRating === 3 ? '↔️ Doing it sometimes'
                    : selectedRating === 4 ? '✅ Mostly in place'
                    : '🔥 Fully systemized'}
                </span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="flex-shrink-0 px-4 py-4 rounded-2xl bg-[#111] border border-white/10 font-bold text-gray-400 active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              disabled={!selectedRating}
              className="flex-1 py-4 rounded-2xl font-black text-base transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{
                background: selectedRating ? `linear-gradient(135deg, ${phaseColor}, #0066FF)` : '#1a1a1a',
                color: selectedRating ? '#000' : '#444',
              }}
            >
              {currentPhaseIdx === PHASES.length - 1 && currentQIdx === currentPhase.questions.length - 1
                ? 'See My Results →'
                : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── TEASER ───────────────────────────────────────────────────────────────
  if (appState === 'teaser' && results) {
    const pct = results.percentage;
    const barColor = pct >= 70 ? '#00D9FF' : pct >= 45 ? '#FF6B35' : '#ef4444';

    return (
      <div ref={topRef} className="min-h-screen bg-[#0A0A0A] text-white flex flex-col px-5 pt-8 pb-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00D9FF, #0066FF)' }}>
            <span className="text-xs font-black">STG</span>
          </div>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Your Scorecard Results</span>
        </div>

        <h2 className="text-2xl font-black mb-1">Scorecard Complete ✓</h2>
        <p className="text-gray-400 text-sm mb-6">Here's what we found about Draper Fence & Rail...</p>

        {/* Score overview */}
        <div className="bg-[#111] rounded-2xl p-5 mb-5 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-4xl font-black mb-0.5" style={{ color: barColor }}>
                {results.total}<span className="text-xl text-gray-500">/{MAX_SCORE}</span>
              </div>
              <div className="text-gray-400 text-sm">Overall Score</div>
            </div>
            <ScoreRing score={results.total} max={MAX_SCORE} size={90} />
          </div>

          {/* Phase breakdown */}
          <div className="space-y-3">
            {PHASES.map((phase, i) => {
              const ps = results.phaseScores[phase.number];
              const pm = results.phaseMaxes[phase.number];
              const pp = Math.round((ps / pm) * 100);
              return (
                <div key={phase.number}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300 font-medium">{phase.icon} {phase.name}</span>
                    <span className="font-mono" style={{ color: phaseColors[i] }}>{ps}/{pm}</span>
                  </div>
                  <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${pp}%`, background: phaseColors[i] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Teaser insight */}
        <div className="bg-[#111] rounded-2xl p-5 mb-6 border border-[#00D9FF]/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-[#FF6B35]" />
            <span className="text-xs font-bold text-[#FF6B35] uppercase tracking-wider">Pattern Detected</span>
          </div>
          {DRAPER_TEASER.lines.map((line, i) => (
            <p key={i} className={`text-sm leading-relaxed mb-3 ${i === 0 ? 'text-white font-semibold' : 'text-gray-300'}`}>
              {line}
            </p>
          ))}
        </div>

        {/* Lock icon + CTA */}
        <div className="bg-gradient-to-b from-[#00D9FF]/10 to-[#FF6B35]/5 rounded-2xl p-5 mb-6 border border-[#00D9FF]/20 text-center">
          <Lock className="w-8 h-8 mx-auto mb-3 text-[#00D9FF]" />
          <h3 className="text-white font-black text-lg mb-2">Your Full Growth Report is Ready</h3>
          <p className="text-gray-400 text-sm mb-1">Unlock:</p>
          {['Your exact growth stage classification', 'The 3 highest-leverage moves for right now', "What your score means for this spring's revenue"].map((item, i) => (
            <div key={i} className="flex items-center gap-2 justify-center mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00D9FF]" />
              <span className="text-gray-300 text-sm">{item}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setAppState('gate')}
          className="w-full py-4 rounded-2xl font-black text-lg text-black transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #00D9FF, #0088FF)' }}
        >
          Unlock My Full Results →
        </button>

        <p className="text-center text-gray-600 text-xs mt-3">
          🔒 We will never share your information.
        </p>
      </div>
    );
  }

  // ─── GATE ─────────────────────────────────────────────────────────────────
  if (appState === 'gate') {
    return (
      <div ref={topRef} className="min-h-screen bg-[#0A0A0A] text-white flex flex-col px-5 pt-8 pb-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00D9FF, #0066FF)' }}>
            <span className="text-xs font-black">STG</span>
          </div>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Almost There</span>
        </div>

        <h2 className="text-2xl font-black mb-2">Get Your Full Results</h2>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          We'll send your growth stage report and personalized insights directly to you.
        </p>

        <div className="space-y-4 mb-6">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={contact.name}
              onChange={e => handleContactChange('name', e.target.value)}
              placeholder="Homa Wahab-Draper"
              className="w-full bg-[#111] border rounded-xl px-4 py-3.5 text-white placeholder-gray-600 text-base focus:outline-none transition-colors"
              style={{ borderColor: formErrors.name ? '#ef4444' : '#222' }}
            />
            {formErrors.name && <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Your Role <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={contact.role}
              onChange={e => handleContactChange('role', e.target.value)}
              placeholder="Owner, Sales Manager, etc."
              className="w-full bg-[#111] border rounded-xl px-4 py-3.5 text-white placeholder-gray-600 text-base focus:outline-none transition-colors"
              style={{ borderColor: formErrors.role ? '#ef4444' : '#222' }}
            />
            {formErrors.role && <p className="text-red-400 text-xs mt-1">{formErrors.role}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Business Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={contact.businessEmail}
              onChange={e => handleContactChange('businessEmail', e.target.value)}
              placeholder="homa@draperfencing.com"
              className="w-full bg-[#111] border rounded-xl px-4 py-3.5 text-white placeholder-gray-600 text-base focus:outline-none transition-colors"
              style={{ borderColor: formErrors.businessEmail ? '#ef4444' : '#222' }}
            />
            {formErrors.businessEmail && <p className="text-red-400 text-xs mt-1">{formErrors.businessEmail}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              Contact Number <span className="text-red-400">*</span>
              <span className="text-gray-600 font-normal ml-1 normal-case">— so we can text your results</span>
            </label>
            <input
              type="tel"
              value={contact.phone}
              onChange={e => handleContactChange('phone', e.target.value)}
              placeholder="(317) 000-0000"
              maxLength={14}
              className="w-full bg-[#111] border rounded-xl px-4 py-3.5 text-white placeholder-gray-600 text-base focus:outline-none transition-colors font-mono"
              style={{ borderColor: formErrors.phone ? '#ef4444' : '#222' }}
            />
            {formErrors.phone && <p className="text-red-400 text-xs mt-1">{formErrors.phone}</p>}
          </div>
        </div>

        {/* Appointment callout */}
        <div className="bg-[#0A2A1A] border border-[#00D9FF]/30 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#00D9FF]/20 flex items-center justify-center shrink-0">
              <span className="text-sm">📅</span>
            </div>
            <div>
              <p className="text-white text-sm font-semibold mb-1">Appointment Confirmed</p>
              <p className="text-gray-300 text-xs leading-relaxed">
                It looks like you have an appointment set with our Senior Growth Consultant Rob at 11 AM to discuss next steps about the proposal that was sent over.
              </p>
              <p className="text-[#00D9FF] text-xs font-semibold mt-2">
                We'd love to have you in the February cohort. →
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmitGate}
          disabled={submitting}
          className="w-full py-4 rounded-2xl font-black text-lg text-black transition-all active:scale-95 mb-3"
          style={{ background: submitting ? '#333' : 'linear-gradient(135deg, #00D9FF, #0088FF)', color: submitting ? '#666' : '#000' }}
        >
          {submitting ? 'Sending...' : 'See My Full Growth Report →'}
        </button>

        <p className="text-center text-gray-600 text-xs">
          🔒 We will never share your information.
        </p>
      </div>
    );
  }

  // ─── RESULTS ──────────────────────────────────────────────────────────────
  if (appState === 'results' && results) {
    const cat = results.category;
    const pct = results.percentage;
    const barColor = pct >= 70 ? '#00D9FF' : pct >= 45 ? '#FF6B35' : '#ef4444';

    return (
      <div ref={topRef} className="min-h-screen bg-[#0A0A0A] text-white flex flex-col pb-16">
        {/* Hero score */}
        <div className="px-5 pt-8 pb-6" style={{ background: 'linear-gradient(180deg, #0d1a2d 0%, #0A0A0A 100%)' }}>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00D9FF, #0066FF)' }}>
              <span className="text-xs font-black">STG</span>
            </div>
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Your Growth Report</span>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-5xl font-black mb-1" style={{ color: barColor }}>
                {results.total}
                <span className="text-2xl text-gray-500">/{MAX_SCORE}</span>
              </div>
              <div className="text-gray-400 text-sm">8-Figure Sales Score™</div>
              <div className="text-lg font-bold mt-1" style={{ color: barColor }}>{pct}%</div>
            </div>
            <ScoreRing score={results.total} max={MAX_SCORE} size={110} />
          </div>

          {/* Category badge */}
          <div className="inline-flex items-center gap-2 rounded-2xl px-4 py-2" style={{ background: `${barColor}22`, border: `1px solid ${barColor}40` }}>
            <span className="text-xl">{cat.emoji}</span>
            <span className="font-black text-sm" style={{ color: barColor }}>{cat.name}</span>
          </div>
        </div>

        <div className="px-5 space-y-5">
          {/* Headline */}
          <div className="bg-[#111] rounded-2xl p-5 border border-white/5">
            <h2 className="text-xl font-black text-white mb-2 leading-tight">{cat.headline}</h2>
            <p className="text-gray-300 text-sm leading-relaxed">{cat.description}</p>
          </div>

          {/* Key Insight */}
          <div className="rounded-2xl p-5 border" style={{ background: `${barColor}0d`, borderColor: `${barColor}30` }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: barColor }}>💡</div>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: barColor }}>Key Insight</span>
            </div>
            <p className="text-white text-sm leading-relaxed font-medium">{cat.keyInsight}</p>
          </div>

          {/* Wins */}
          <div className="bg-[#111] rounded-2xl p-5 border border-white/5">
            <h3 className="font-black text-sm mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">What's Working ✓</span>
            </h3>
            {cat.wins.map((win, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                <p className="text-gray-300 text-sm leading-relaxed">{win}</p>
              </div>
            ))}
          </div>

          {/* Challenges */}
          <div className="bg-[#111] rounded-2xl p-5 border border-white/5">
            <h3 className="font-black text-sm mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FF6B35]" />
              <span className="text-[#FF6B35]">Where to Focus</span>
            </h3>
            {cat.challenges.map((ch, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] mt-2 shrink-0" />
                <p className="text-gray-300 text-sm leading-relaxed">{ch}</p>
              </div>
            ))}
          </div>

          {/* Opportunities */}
          <div className="bg-[#111] rounded-2xl p-5 border border-white/5">
            <h3 className="font-black text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#00D9FF]" />
              <span className="text-[#00D9FF]">Your Top Opportunities</span>
            </h3>
            {cat.opportunities.map((opp, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-[#00D9FF]/20 text-[#00D9FF] text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">{opp}</p>
              </div>
            ))}
          </div>

          {/* Phase scores */}
          <div className="bg-[#111] rounded-2xl p-5 border border-white/5">
            <h3 className="font-black text-sm mb-4 text-white">Score by Category</h3>
            {PHASES.map((phase, i) => {
              const ps = results.phaseScores[phase.number];
              const pm = results.phaseMaxes[phase.number];
              const pp = Math.round((ps / pm) * 100);
              const c = phaseColors[i];
              return (
                <div key={phase.number} className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-bold text-white">{phase.icon} {phase.name}</span>
                    <span className="font-mono font-bold" style={{ color: c }}>{ps}/{pm} · {pp}%</span>
                  </div>
                  <div className="h-3 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${pp}%`, background: `linear-gradient(90deg, ${c}, ${c}88)` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Urgency */}
          <div className="bg-[#1a0a00] rounded-2xl p-5 border border-[#FF6B35]/30">
            <p className="text-[#FF6B35] text-sm font-semibold leading-relaxed">{cat.urgencyNote}</p>
          </div>

          {/* Final CTA */}
          <div className="bg-[#0A2A3A] rounded-2xl p-5 border border-[#00D9FF]/30 text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Users className="w-5 h-5 text-[#00D9FF]" />
              <span className="font-black text-sm text-[#00D9FF]">February Cohort — Limited Spots</span>
            </div>
            <p className="text-gray-300 text-sm mb-4 leading-relaxed">
              Your Senior Growth Consultant Rob is ready to walk through these results with you at your 11 AM appointment. Spots for the February cohort close end of month.
            </p>
            <a
              href="tel:8557848143"
              className="block w-full py-4 rounded-2xl font-black text-lg text-black mb-3 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #00D9FF, #0088FF)' }}
            >
              {cat.ctaText}
            </a>
            <p className="text-gray-500 text-xs">Call: (855) 784-8143 · SellOnSTG.com</p>
          </div>

          <p className="text-center text-gray-600 text-xs pb-4">
            🔒 We will never share your information. · Sales Transformation Group © 2026
          </p>
        </div>
      </div>
    );
  }

  return null;
}
