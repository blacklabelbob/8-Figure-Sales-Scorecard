import { NextRequest, NextResponse } from "next/server";

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
  segment: string;
  secondarySegment: string;
};

// Score section labels
const SECTIONS = [
  { title: "Sales Process", keys: ["defined-process", "contact-speed", "onspot-estimates", "close-tracking"] },
  { title: "Team Performance", keys: ["self-generated", "neighborhood-marketing", "addons"] },
  { title: "People & Systems", keys: ["hiring-vsl", "onboarding", "screening", "employment-agreement"] },
  { title: "Coaching & Accountability", keys: ["ride-alongs", "role-play", "pipeline-followup", "kpis"] },
  { title: "Exit & Valuation Readiness", keys: ["referral-program", "owner-dependency", "documented-playbook", "revenue-predictability"] },
];

function buildEmailHTML(data: ScorePayload): string {
  const sectionRows = SECTIONS.map((s) => {
    const total = s.keys.reduce((a, k) => a + (data.scores[k] || 0), 0);
    const max = s.keys.length * 5;
    const pct = Math.round((total / max) * 100);
    const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
    return `<tr>
      <td style="padding:6px 0;color:#ccc;font-size:13px;">${s.title}</td>
      <td style="padding:6px 0;color:#00D9FF;font-size:13px;font-weight:700;text-align:right;">${total}/${max} (${pct}%)</td>
    </tr>`;
  }).join("");

  const scoreRows = Object.entries(data.scores)
    .map(([k, v]) => `<tr><td style="color:#888;font-size:12px;padding:3px 0;">${k}</td><td style="color:#fff;font-size:12px;padding:3px 0;text-align:right;">${v}/5</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="background:#0A0A0A;color:#fff;font-family:system-ui,sans-serif;padding:24px;max-width:600px;margin:0 auto;">

<div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:24px;margin-bottom:20px;">
  <div style="color:#00D9FF;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
    🎯 NEW SCORECARD SUBMISSION
  </div>
  <h2 style="font-size:22px;font-weight:900;margin:0 0 4px;">Sales Team Scorecard Lead</h2>
  <p style="color:#666;font-size:13px;margin:0;">${new Date().toLocaleString()}</p>
</div>

<div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:24px;margin-bottom:20px;">
  <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Contact Information</p>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="color:#888;font-size:13px;padding:6px 0;">Name</td><td style="color:#fff;font-size:13px;font-weight:700;text-align:right;">${data.name}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:6px 0;">Email</td><td style="color:#00D9FF;font-size:13px;text-align:right;">${data.email}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:6px 0;">Phone</td><td style="color:#00D9FF;font-size:13px;text-align:right;">${data.phone}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:6px 0;">Role</td><td style="color:#fff;font-size:13px;text-align:right;">${data.role}</td></tr>
    <tr><td style="color:#888;font-size:13px;padding:6px 0;">Company</td><td style="color:#fff;font-size:13px;text-align:right;">${data.company}</td></tr>
  </table>
</div>

<div style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:24px;margin-bottom:20px;">
  <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Score Results</p>
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:48px;font-weight:900;color:#fff;">${data.pct}%</div>
    <div style="color:#00D9FF;font-size:16px;font-weight:700;">${data.segment}</div>
    <div style="color:#888;font-size:13px;">${data.secondarySegment}</div>
    <div style="color:#888;font-size:13px;margin-top:4px;">${data.totalScore} / ${data.maxScore} points</div>
  </div>
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
  Sales Transformation Group · STG Lead Magnet · ${new Date().toLocaleDateString()}
</div>

</body>
</html>`;
}

function buildSMSText(data: ScorePayload): string {
  return `🎯 STG SCORECARD LEAD

${data.name} - ${data.role}
${data.company}
📧 ${data.email}
📞 ${data.phone}

Score: ${data.pct}% (${data.totalScore}/${data.maxScore})
Segment: ${data.segment}
Secondary: ${data.secondarySegment}

Exit Readiness: ${(data.scores["owner-dependency"] || 0)}/5
Revenue Predictability: ${(data.scores["revenue-predictability"] || 0)}/5
Documented Playbook: ${(data.scores["documented-playbook"] || 0)}/5
Process Defined: ${(data.scores["defined-process"] || 0)}/5

${new Date().toLocaleString()}`;
}

export async function POST(req: NextRequest) {
  try {
    const data: ScorePayload = await req.json();

    const htmlBody = buildEmailHTML(data);
    const textBody = buildSMSText(data);
    const errors: string[] = [];

    // ─── EMAIL via Resend (or fallback to EmailJS-style fetch) ───────────────
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const SENDGRID_KEY = process.env.SENDGRID_API_KEY;

    if (RESEND_KEY) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "STG Scorecard <scorecard@salestransformationgroup.com>",
            to: ["robert@salestransformationgroup.com"],
            subject: `🎯 New Scorecard: ${data.name} — ${data.pct}% — ${data.segment}`,
            html: htmlBody,
            text: textBody,
          }),
        });
        if (!emailRes.ok) {
          const err = await emailRes.text();
          errors.push(`Resend error: ${err}`);
        }
      } catch (e) {
        errors.push(`Resend exception: ${e}`);
      }
    } else if (SENDGRID_KEY) {
      try {
        const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SENDGRID_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: "robert@salestransformationgroup.com" }] }],
            from: { email: "scorecard@salestransformationgroup.com", name: "STG Scorecard" },
            subject: `🎯 New Scorecard: ${data.name} — ${data.pct}% — ${data.segment}`,
            content: [
              { type: "text/plain", value: textBody },
              { type: "text/html", value: htmlBody },
            ],
          }),
        });
        if (!sgRes.ok) {
          const err = await sgRes.text();
          errors.push(`SendGrid error: ${err}`);
        }
      } catch (e) {
        errors.push(`SendGrid exception: ${e}`);
      }
    } else {
      // Fallback: log to console in dev
      console.log("=== SCORECARD SUBMISSION ===");
      console.log(textBody);
      console.log("Email HTML generated, length:", htmlBody.length);
    }

    // ─── SMS via Twilio ───────────────────────────────────────────────────────
    const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER;

    if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      try {
        // SMS to Rob
        const robPhone = "+16092173640";
        const smsBody = `🎯 STG Lead: ${data.name} (${data.company})\n${data.pct}% — ${data.segment}\n📞 ${data.phone}\n📧 ${data.email}`;

        const smsRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              From: TWILIO_FROM,
              To: robPhone,
              Body: smsBody,
            }).toString(),
          }
        );
        if (!smsRes.ok) {
          const err = await smsRes.text();
          errors.push(`Twilio SMS error: ${err}`);
        }
      } catch (e) {
        errors.push(`Twilio exception: ${e}`);
      }
    }

    // Always return 200 to the user — don't fail on notification errors
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
