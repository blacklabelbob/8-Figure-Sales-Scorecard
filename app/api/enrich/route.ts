import { NextRequest, NextResponse } from "next/server";

export type CompanyProfile = {
  name: string;
  domain: string | null;
  description: string | null;
  industry: string | null;
  employeeRange: string | null;
  location: string | null;
  logoUrl: string | null;
  linkedinUrl: string | null;
  twitterHandle: string | null;
  source: "clearbit" | "brandfetch" | "fallback";
};

// ─── Extract domain from email ────────────────────────────────────────────────
function extractDomain(email: string): string | null {
  const match = email.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!match) return null;
  const domain = match[1];
  // Skip personal/free email providers
  const skip = [
    "gmail.com","yahoo.com","hotmail.com","outlook.com","icloud.com",
    "aol.com","live.com","msn.com","me.com","protonmail.com","mail.com",
  ];
  return skip.includes(domain) ? null : domain;
}

// ─── Clearbit Autocomplete API (free, no key) ─────────────────────────────────
async function tryClearbit(domain: string): Promise<CompanyProfile | null> {
  try {
    const res = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(domain)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data: Array<{
      name: string; domain: string; logo: string;
    }> = await res.json();

    const match = data.find((c) => c.domain === domain) ?? data[0];
    if (!match) return null;

    // Try Clearbit company API for richer data
    let description: string | null = null;
    let industry: string | null = null;
    let employeeRange: string | null = null;
    let location: string | null = null;

    try {
      const companyRes = await fetch(
        `https://company.clearbit.com/v2/companies/find?domain=${domain}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (companyRes.ok) {
        const cd = await companyRes.json();
        description  = cd.description ?? null;
        industry     = cd.category?.industry ?? null;
        employeeRange = cd.metrics?.employeesRange ?? null;
        location     = cd.geo?.city && cd.geo?.state
          ? `${cd.geo.city}, ${cd.geo.state}`
          : (cd.geo?.country ?? null);
      }
    } catch {
      // Rich data unavailable — that's fine, we still have name + logo
    }

    return {
      name: match.name,
      domain: match.domain,
      description,
      industry,
      employeeRange,
      location,
      logoUrl: match.logo ?? `https://logo.clearbit.com/${domain}`,
      linkedinUrl: null,
      twitterHandle: null,
      source: "clearbit",
    };
  } catch {
    return null;
  }
}

// ─── Brandfetch free logo API (fallback) ─────────────────────────────────────
async function tryBrandfetch(domain: string): Promise<CompanyProfile | null> {
  try {
    // Brandfetch public logo endpoint — no key needed
    const logoUrl = `https://cdn.brandfetch.io/${domain}/w/400/h/400?c=1idG1aIPIVUMBL5`;
    // Quick HEAD check to see if logo exists
    const probe = await fetch(logoUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(4000),
    });
    if (!probe.ok) return null;

    // Derive a display name from the domain (e.g. acmeroofing.com → Acme Roofing)
    const namePart = domain.split(".")[0];
    const displayName = namePart
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      name: displayName,
      domain,
      description: null,
      industry: null,
      employeeRange: null,
      location: null,
      logoUrl,
      linkedinUrl: null,
      twitterHandle: null,
      source: "brandfetch",
    };
  } catch {
    return null;
  }
}

// ─── Graceful fallback — just the domain ─────────────────────────────────────
function buildFallback(domain: string, companyName: string): CompanyProfile {
  const namePart = domain.split(".")[0];
  const displayName = companyName || namePart
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    name: displayName,
    domain,
    description: null,
    industry: null,
    employeeRange: null,
    location: null,
    logoUrl: `https://logo.clearbit.com/${domain}`,
    linkedinUrl: null,
    twitterHandle: null,
    source: "fallback",
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { email, company } = await req.json() as { email: string; company: string };

    const domain = extractDomain(email);

    if (!domain) {
      // Personal email — return minimal profile from what they typed
      return NextResponse.json({
        success: true,
        profile: {
          name: company || "Your Company",
          domain: null,
          description: null,
          industry: null,
          employeeRange: null,
          location: null,
          logoUrl: null,
          linkedinUrl: null,
          twitterHandle: null,
          source: "fallback",
        } satisfies CompanyProfile,
      });
    }

    // Try enrichment chain: Clearbit → Brandfetch → fallback
    const profile =
      (await tryClearbit(domain)) ??
      (await tryBrandfetch(domain)) ??
      buildFallback(domain, company);

    // Always prefer whatever company name they typed if enrichment returns
    // something suspiciously generic
    if (company && company.length > profile.name.length) {
      profile.name = company;
    }

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    console.error("[enrich] error:", err);
    return NextResponse.json(
      { success: false, profile: null },
      { status: 500 }
    );
  }
}
