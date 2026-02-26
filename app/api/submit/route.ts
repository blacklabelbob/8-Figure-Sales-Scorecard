import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

type Dimensions = {
  process: number;
  team: number;
  people: number;
  coaching: number;
  valuation: number;
  overall: number;
};

type ScorePayload = {
  name: string;
  email: string;
  phone: string;
  role: string;
  company: string;
  scores: Record<string, number>;
  totalScore: number;
  maxScore: number;
  pct: number;
  dims: Dimensions;
  segment: string;
  secondarySegment: string;
  isKnownIdentity: boolean;
  submittedAt: string;
};

// ─── Section metadata for report generation ──────────────────────────────────
const SECTIONS = [
  { title: "Sales Process",           keys: ["defined-process","contact-speed","onspot-estimates","close-tracking"] },
  { title: "Team Performance",        keys: ["self-generated","neighborhood-marketing","addons"] },
  { title: "People & Systems",        keys: ["hiring-vsl","onboarding","screening","employment-agreement"] },
  { title: "Coaching & Accountability", keys: ["ride-alongs","role-play","pipeline-followup","kpis"] },
  { title: "Exit & Valuation Readiness", keys: ["referral-program","owner-dependency","documented-playbook","revenue-predictability"] },
];

// ─── Append-only submission log ───────────────────────────────────────────────
async function appendToLog(data: ScorePayload) {
  try {
    const logDir = path.join(process.cwd(), "logs");
    if (!existsSync(logDir)) await mkdir(logDir, { recursive: true });

    const logFile = path.join(logDir, "submissions.jsonl");
    const entry = JSON.stringify({
      ...data,
      loggedAt: new Date().toISOString(),
    }) + "\n";

    await writeFile(logFile, entry, { flag: "a" });
  } catch (err) {
    console.error("[Log] Failed to write submission log:", err);
  }
}

// ─── Email HTML builder ───────────────────────────────────────────────────────
function buildEmailHTML(data: ScorePayload): string {
  const sectionRows = SECTIONS.map((s) => {
    const total = s.keys.reduce((a, k) => a + (data.scores[k] || 0), 0);
    const max   = s.keys.length * 5;
    const pct   = Math.round((total / max) * 100);
    const filled = Math.round(pct / 10);
    const bar   = "█".repeat(filled) + "░".repeat(10 - filled);
    const color = pct >= 60 ? "#00D9FF" : pct >= 40 ? "#eab308" : "#ef4444";
    return `<tr>
      <td style="padding:6px 0;color:#ccc;font-size:13px;">${s.title}</td>
      <td style="padding:6px 0;font-family:monospace;font-size:11px;color:#555;">${bar}</td>
      <td style="padding:6px 0;color:${color};font-size:13px;font-weight:700;text-align:right;">${total}/${max} (${pct}%)</td>
    </tr>`;
  }).join("");

  const dimRows = Object.entries(data.dims)
    .filter(([k]) => k !== "overall")
    .map(([k, v]) => `<tr>
      <td style="color:#888;font-size:12px;padding:2px 0;text-transform:capitalize;">${k}</td>
      <td style="color:#fff;font-size:12px;padding:2px 0;text-align:right;">${v}%</td>
    </tr>`).join("");

  const scoreRows = Object.entries(data.scores)
    .map(([k, v]) => `<tr>
      <td style="color:#888;font-size:11px;padding:2px 0;">${k}</td>
      <td style="color:${v >= 4 ? "#22c55e" : v >= 3 ? "#eab308" : "#ef4444"};font-size:12px;padding:2px 0;text-align:right;font-weight:700;">${v}/5</td>
    </tr>`).join("");

  const identityBadge = data.isKnownIdentity
    ? `<div style="background:rgba(0,217,255,0.1);border:1px solid rgba(0,217,255,0.3);border-radius:8px;padding:10px 14px;margin-bottom:16px;">
        <span style="color:#00D9FF;font-size:12px;font-weight:700;">⭐ KNOWN IDENTITY — Draper Fence & Rail / Homa</span>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="background:#0A0A0A;color:#fff;font-family:system-ui,sans-serif;padding:24px;max-width:640px;margin:0 auto;">

<div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:24px;margin-bottom:20px;">
  <div style="color:#00D9FF;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
    🎯 NEW SCORECARD SUBMISSION
  </div>
  ${identityBadge}
  <h2 style="font-size:22px;font-weight:900;margin:0 0 4px;">Sales Team Scorecard Lead</h2>
  <p style="color:#666;font-size:13px;margin:0;">${data.submittedAt}</p>
</div>

<div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:24px;margin-bottom:20px;">
  <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Contact Information</p>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="color:#888;font-size:13px;padding:5px 0;">Name</td><td style="color:#fff;font-size:13px;font-weight:700;text-align:right;">${data.name}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:5px 0;">Email</td><td style="color:#00D9FF;font-size:13px;text-align:right;">${data.email}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:5px 0;">Phone</td><td style="color:#00D9FF;font-size:13px;text-align:right;">${data.phone}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:5px 0;">Role</td><td style="color:#fff;font-size:13px;text-align:right;">${data.role}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:5px 0;">Company</td><td style="color:#fff;font-size:13px;text-align:right;">${data.company}</td></tr>
  </table>
</div>

<div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:24px;margin-bottom:20px;">
  <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Overall Score</p>
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:48px;font-weight:900;color:#fff;">${data.pct}%</div>
    <div style="color:#00D9FF;font-size:16px;font-weight:700;">${data.segment}</div>
    <div style="color:#888;font-size:13px;">${data.secondarySegment}</div>
    <div style="color:#555;font-size:12px;margin-top:4px;">${data.totalScore} / ${data.maxScore} raw points</div>
  </div>

  <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">Dimension Scores</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    ${dimRows}
  </table>

  <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">Section Breakdown</p>
  <table style="width:100%;border-collapse:collapse;">
    ${sectionRows}
  </table>
</div>

<div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:24px;margin-bottom:20px;">
  <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Individual Question Scores</p>
  <table style="width:100%;border-collapse:collapse;">
    ${scoreRows}
  </table>
</div>

<div style="text-align:center;color:#444;font-size:12px;margin-top:20px;">
  Sales Transformation Group · STG Scorecard · ${new Date().toLocaleDateString()}
</div>

</body>
</html>`;
}

// ─── SMS text builder ─────────────────────────────────────────────────────────
function buildSMSText(data: ScorePayload): string {
  const identity = data.isKnownIdentity ? " ⭐ KNOWN" : "";
  return `🎯 STG SCORECARD${identity}

${data.name} | ${data.role}
${data.company}
📧 ${data.email}
📞 ${data.phone}

Overall: ${data.pct}% → ${data.segment}
↳ ${data.secondarySegment}

Dimensions:
Process ${data.dims.process}% | Team ${data.dims.team}%
People ${data.dims.people}% | Coach ${data.dims.coaching}%
Valuation ${data.dims.valuation}%

Exit keys:
Owner Dep: ${(data.scores["owner-dependency"] || 0)}/5
Playbook: ${(data.scores["documented-playbook"] || 0)}/5
Rev Pred: ${(data.scores["revenue-predictability"] || 0)}/5

${data.submittedAt}`;
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const data: ScorePayload = await req.json();

    const htmlBody = buildEmailHTML(data);
    const textBody = buildSMSText(data);
    const errors: string[] = [];

    // Always log every submission
    await appendToLog(data);

    // ── Email ──────────────────────────────────────────────────────────────────
    const RESEND_KEY    = process.env.RESEND_API_KEY;
    const SENDGRID_KEY  = process.env.SENDGRID_API_KEY;

    if (RESEND_KEY) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "STG Scorecard <scorecard@salestransformationgroup.com>",
            to: ["robert@salestransformationgroup.com"],
            subject: `🎯 Scorecard: ${data.name} — ${data.pct}% — ${data.segment}${data.isKnownIdentity ? " ⭐ KNOWN" : ""}`,
            html: htmlBody,
            text: textBody,
          }),
        });
        if (!res.ok) errors.push(`Resend: ${await res.text()}`);
      } catch (e) {
        errors.push(`Resend exception: ${e}`);
      }
    } else if (SENDGRID_KEY) {
      try {
        const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SENDGRID_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: "robert@salestransformationgroup.com" }] }],
            from: { email: "scorecard@salestransformationgroup.com", name: "STG Scorecard" },
            subject: `🎯 Scorecard: ${data.name} — ${data.pct}% — ${data.segment}${data.isKnownIdentity ? " ⭐ KNOWN" : ""}`,
            content: [
              { type: "text/plain", value: textBody },
              { type: "text/html",  value: htmlBody },
            ],
          }),
        });
        if (!res.ok) errors.push(`SendGrid: ${await res.text()}`);
      } catch (e) {
        errors.push(`SendGrid exception: ${e}`);
      }
    } else {
      // Dev fallback — log to console
      console.log("=== SCORECARD SUBMISSION ===");
      console.log(textBody);
    }

    // ── SMS via Twilio ─────────────────────────────────────────────────────────
    const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_FROM  = process.env.TWILIO_FROM_NUMBER;

    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      try {
        const smsBody = `🎯 STG Lead${data.isKnownIdentity ? " ⭐" : ""}: ${data.name} (${data.company})\n${data.pct}% — ${data.segment}\n📞 ${data.phone}\n📧 ${data.email}\nValuation: ${data.dims.valuation}% | Overall: ${data.pct}%`;

        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              From: TWILIO_FROM,
              To: "+16092173640",
              Body: smsBody,
            }).toString(),
          }
        );
        if (!res.ok) errors.push(`Twilio: ${await res.text()}`);
      } catch (e) {
        errors.push(`Twilio exception: ${e}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Submission received",
      ...(errors.length > 0 ? { warnings: errors } : {}),
    });
  } catch (err) {
    console.error("Scorecard API error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// ─── GET handler — retrieve submission log (dev/internal use) ─────────────────
export async function GET(req: NextRequest) {
  // Simple token gate — only accessible with ?token=stg_internal
  const { searchParams } = new URL(req.url);
  if (searchParams.get("token") !== "stg_internal_2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const logFile = path.join(process.cwd(), "logs", "submissions.jsonl");
    if (!existsSync(logFile)) {
      return NextResponse.json({ submissions: [], count: 0 });
    }

    const raw = await readFile(logFile, "utf-8");
    const submissions = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean)
      .reverse(); // newest first

    return NextResponse.json({
      count: submissions.length,
      submissions,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
