import { NextRequest, NextResponse } from "next/server";

export type CompanyProfile = {
  name: string;
  domain: string | null;
  description: string | null;
  industry: string | null;
  location: string | null;
  logoUrl: string | null;
  source: "scraped" | "fallback";
};

// ─── Skip personal email domains ─────────────────────────────────────────────
const PERSONAL_DOMAINS = new Set([
  "gmail.com","yahoo.com","hotmail.com","outlook.com","icloud.com",
  "aol.com","live.com","msn.com","me.com","protonmail.com","mail.com",
  "ymail.com","comcast.net","verizon.net","att.net","sbcglobal.net",
]);

function extractDomain(email: string): string | null {
  const match = email.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!match) return null;
  return PERSONAL_DOMAINS.has(match[1]) ? null : match[1];
}

// ─── Scrape the company's own website ────────────────────────────────────────
async function scrapeWebsite(domain: string): Promise<{
  rawText: string;
  logoUrl: string | null;
  siteReachable: boolean;
}> {
  const attempts = [`https://${domain}`, `https://www.${domain}`];

  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(7000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; STGBot/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();
      const base = new URL(url);

      // ── Pull the juicy meta signals ───────────────────────────────────────
      const extract = (pattern: RegExp) => html.match(pattern)?.[1]?.trim() ?? null;
      const title       = extract(/<title[^>]*>([^<]{1,120})<\/title>/i);
      const metaDesc    = extract(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']{0,300})["']/i)
                       ?? extract(/<meta[^>]*content=["']([^"']{0,300})["'][^>]*name=["']description["']/i);
      const ogDesc      = extract(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']{0,300})["']/i)
                       ?? extract(/<meta[^>]*content=["']([^"']{0,300})["'][^>]*property=["']og:description["']/i);
      const ogSiteName  = extract(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']{0,80})["']/i)
                       ?? extract(/<meta[^>]*content=["']([^"']{0,80})["'][^>]*property=["']og:site_name["']/i);
      const twitterDesc = extract(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']{0,300})["']/i)
                       ?? extract(/<meta[^>]*content=["']([^"']{0,300})["'][^>]*name=["']twitter:description["']/i);

      const rawText = [title, ogSiteName, metaDesc, ogDesc, twitterDesc]
        .filter(Boolean).join(" | ").slice(0, 800);

      // ── Find logo ─────────────────────────────────────────────────────────
      const logoUrl = await findBestLogo(html, base, domain);

      return { rawText, logoUrl, siteReachable: true };
    } catch {
      // try next URL
    }
  }
  return { rawText: "", logoUrl: null, siteReachable: false };
}

async function findBestLogo(html: string, base: URL, domain: string): Promise<string | null> {
  const toAbs = (href: string) => {
    if (!href || href.startsWith("data:")) return null;
    if (href.startsWith("http")) return href;
    if (href.startsWith("//")) return `${base.protocol}${href}`;
    if (href.startsWith("/")) return `${base.protocol}//${base.host}${href}`;
    return `${base.protocol}//${base.host}/${href}`;
  };

  const candidates: string[] = [];

  // Priority order: apple-touch → og:image → rel icon → favicon.ico
  const appleIcon = html.match(/<link[^>]*rel=["']apple-touch-icon(?:-precomposed)?["'][^>]*href=["']([^"']+)["']/i)?.[1];
  if (appleIcon) { const u = toAbs(appleIcon); if (u) candidates.push(u); }

  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];
  if (ogImage) { const u = toAbs(ogImage); if (u) candidates.push(u); }

  const relIcon = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"'?#]+)["']/i)?.[1];
  if (relIcon) { const u = toAbs(relIcon); if (u) candidates.push(u); }

  candidates.push(`${base.protocol}//${domain}/favicon.ico`);
  candidates.push(`${base.protocol}//www.${domain}/favicon.ico`);

  for (const url of candidates) {
    try {
      const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
      const ct = r.headers.get("content-type") ?? "";
      if (r.ok && (ct.includes("image") || /\.(ico|png|jpg|svg|webp)(\?|$)/i.test(url))) {
        return url;
      }
    } catch { /* skip */ }
  }
  return null;
}

// ─── GPT analysis via native fetch (no SDK dependency) ───────────────────────
async function analyzeWithGPT(
  rawText: string,
  domain: string,
  companyNameHint: string,
): Promise<{ name: string; description: string; industry: string; location: string } | null> {
  const apiKey  = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  if (!apiKey) return null;

  const content = `You are analyzing a company for a sales scorecard tool.

Domain: ${domain}
User-provided company name: ${companyNameHint || "unknown"}
Website metadata scraped: ${rawText || "(no website content — infer from domain only)"}

Return a JSON object with these EXACT keys:
- "name": Proper display name of the company
- "description": ONE sentence max 110 chars, plain English, what they actually do. No fluff.
- "industry": 1-3 word industry label. E.g. "Roofing", "Fence & Rail", "HVAC", "Landscaping", "General Contractor", "Solar", "Plumbing", "Painting"
- "location": "City, ST" format if inferable, else ""

ONLY output valid JSON. No markdown, no backticks, no explanation.`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content }],
        max_tokens: 200,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn("[enrich/gpt] non-ok response:", res.status);
      return null;
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    const clean = text.replace(/^```json?\s*/i, "").replace(/```$/i, "").trim();
    if (!clean.startsWith("{")) return null;
    return JSON.parse(clean);
  } catch (e) {
    console.warn("[enrich/gpt] error:", e);
    return null;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { email, company } = await req.json() as { email: string; company: string };
    const domain = extractDomain(email);

    // Personal / no domain — return just the typed name, no card
    if (!domain) {
      return NextResponse.json({
        success: true,
        profile: {
          name: company || "Your Company",
          domain: null,
          description: null,
          industry: null,
          location: null,
          logoUrl: null,
          source: "fallback",
        } satisfies CompanyProfile,
      });
    }

    // Step 1: scrape website (get logo + raw text)
    const scraped = await scrapeWebsite(domain);

    // Step 2: GPT analysis with scraped text
    const gpt = await analyzeWithGPT(scraped.rawText, domain, company);

    const profile: CompanyProfile = {
      // Always trust what the user typed over GPT's guess for the name
      name: (company?.trim()) || gpt?.name || domain.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      domain,
      description: gpt?.description ?? null,
      industry: gpt?.industry ?? null,
      location: gpt?.location || null,
      logoUrl: scraped.logoUrl,
      source: scraped.siteReachable ? "scraped" : "fallback",
    };

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    console.error("[enrich] error:", err);
    return NextResponse.json({ success: false, profile: null }, { status: 500 });
  }
}
