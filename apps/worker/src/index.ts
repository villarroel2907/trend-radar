import "dotenv/config";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const rawKeyword =
  process.argv.slice(2).join(" ").trim() ||
  process.env.SEARCH_KEYWORD ||
  "fisioterapia";

const keyword = rawKeyword
  .replace(/^--\s*/, "")
  .trim()
  .toLowerCase();

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function cleanLines(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== "​");
}

function extractLibraryId(lines: string[], index: number): string {
  const numericId = lines.find((line) => /^\d{6,}$/.test(line));

  if (numericId) return numericId;

  const lineWithId = lines.find((line) =>
    line.includes("Identificador de la biblioteca")
  );

  const idFromText = lineWithId?.match(/\d+/)?.[0];

  return idFromText ?? `unknown-${Date.now()}-${index}`;
}

function extractAdvertiserName(lines: string[]): string {
  const detailsIndex = lines.findIndex((line) =>
    line.includes("Ver detalles del anuncio")
  );

  if (detailsIndex >= 0 && lines[detailsIndex + 1]) {
    return lines[detailsIndex + 1];
  }

  return "Unknown advertiser";
}

function extractDomain(lines: string[]): string | null {
  return (
    lines.find((line) => /^[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(line)) ?? null
  );
}

function extractStatus(lines: string[]): string | null {
  return lines.find((line) => line === "Activo" || line === "Active") ?? null;
}

function extractAdCopy(lines: string[], block: string): string {
  const publicityIndex = lines.findIndex((line) => line === "Publicidad");

  const blockedWords = new Set([
    "Publicidad",
    "Ver detalles del anuncio",
    "Abrir menú desplegable",
    "Plataformas",
    "Transparencia de la UE",
    "Más información",
    "Enviar mensaje",
    "Comprar",
    "Registrarte",
    "Activo",
  ]);

  if (publicityIndex >= 0) {
    const candidates = lines
      .slice(publicityIndex + 1)
      .filter((line) => !blockedWords.has(line))
      .filter((line) => !/^\d+$/.test(line))
      .filter((line) => !/^\d+:\d+ \/ \d+:\d+$/.test(line))
      .filter((line) => !/^[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(line))
      .filter((line) => line.length >= 15);

    if (candidates.length > 0) return candidates[0];
  }

  return lines.find((line) => line.length >= 30) ?? block.slice(0, 500);
}

function extractDomainFromAdText(adText: string): string | null {
  const match = adText.match(/Domain:\s*(.+)/);
  return match?.[1]?.trim().toUpperCase() ?? null;
}

async function refreshAdvertisers() {
  const { data: ads, error } = await supabase
    .from("ads")
    .select("advertiser_name, created_at")
    .not("advertiser_name", "is", null);

  if (error) {
    console.error("Error loading ads for advertisers refresh:", error);
    return;
  }

  const map = new Map<
    string,
    { name: string; total_ads: number; first_seen_at: string; last_seen_at: string }
  >();

  for (const ad of ads ?? []) {
    if (!ad.advertiser_name) continue;

    const current = map.get(ad.advertiser_name);

    if (!current) {
      map.set(ad.advertiser_name, {
        name: ad.advertiser_name,
        total_ads: 1,
        first_seen_at: ad.created_at,
        last_seen_at: ad.created_at,
      });
      continue;
    }

    current.total_ads += 1;

    if (ad.created_at < current.first_seen_at) {
      current.first_seen_at = ad.created_at;
    }

    if (ad.created_at > current.last_seen_at) {
      current.last_seen_at = ad.created_at;
    }
  }

  for (const advertiser of map.values()) {
    await supabase.from("advertisers").upsert(
      {
        ...advertiser,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name" }
    );
  }

  console.log(`Advertisers refreshed: ${map.size}`);
}

async function refreshDomains() {
  const { data: ads, error } = await supabase
    .from("ads")
    .select("ad_text, advertiser_name, created_at")
    .like("ad_text", "%Domain:%");

  if (error) {
    console.error("Error loading ads for domains refresh:", error);
    return;
  }

  const map = new Map<
    string,
    {
      name: string;
      total_ads: number;
      advertisers: Set<string>;
      first_seen_at: string;
      last_seen_at: string;
    }
  >();

  for (const ad of ads ?? []) {
    const domain = extractDomainFromAdText(ad.ad_text);
    if (!domain) continue;

    const current = map.get(domain);

    if (!current) {
      map.set(domain, {
        name: domain,
        total_ads: 1,
        advertisers: new Set(ad.advertiser_name ? [ad.advertiser_name] : []),
        first_seen_at: ad.created_at,
        last_seen_at: ad.created_at,
      });
      continue;
    }

    current.total_ads += 1;

    if (ad.advertiser_name) {
      current.advertisers.add(ad.advertiser_name);
    }

    if (ad.created_at < current.first_seen_at) {
      current.first_seen_at = ad.created_at;
    }

    if (ad.created_at > current.last_seen_at) {
      current.last_seen_at = ad.created_at;
    }
  }

  for (const domain of map.values()) {
    await supabase.from("domains").upsert(
      {
        name: domain.name,
        total_ads: domain.total_ads,
        total_advertisers: domain.advertisers.size,
        first_seen_at: domain.first_seen_at,
        last_seen_at: domain.last_seen_at,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name" }
    );
  }

  console.log(`Domains refreshed: ${map.size}`);
}

async function main() {
  console.log(`Searching Meta Ads Library for keyword: ${keyword}`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
  });

  const page = await browser.newPage({
    viewport: {
      width: 1366,
      height: 900,
    },
  });

  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BO&is_targeted_country=false&media_type=all&search_type=keyword_unordered&q=${encodeURIComponent(
    keyword
  )}`;

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  console.log("Waiting for initial load...");
  await page.waitForTimeout(8000);

  console.log("Scrolling to load ad cards...");

  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(2500);
  }

  const bodyText = await page.locator("body").innerText();

  const blocks = bodyText
    .split(/(?=Identificador de la biblioteca:|Library ID:)/g)
    .map((block) => block.trim())
    .filter((block) => {
      const hasAdSignal =
        block.includes("Publicidad") ||
        block.includes("Ver detalles del anuncio") ||
        block.includes("Activo");

      return hasAdSignal && block.length > 100;
    });

  console.log(`Possible ad blocks found: ${blocks.length}`);

  let savedCount = 0;
  let skippedCount = 0;

  for (const [index, block] of blocks.slice(0, 10).entries()) {
    const lines = cleanLines(block);

    const libraryId = extractLibraryId(lines, index);
    const advertiserName = extractAdvertiserName(lines);
    const domain = extractDomain(lines);
    const status = extractStatus(lines);
    const adCopy = extractAdCopy(lines, block);

    const uniqueAdUrl = `${url}#${libraryId}`;

    const { data: existingAd, error: existingError } = await supabase
      .from("ads")
      .select("id")
      .eq("platform", "facebook")
      .eq("ad_url", uniqueAdUrl)
      .maybeSingle();

    if (existingError) {
      console.error(`Error checking duplicate ${libraryId}:`, existingError);
      continue;
    }

    if (existingAd) {
      console.log(`Skipped duplicate: ${libraryId}`);
      skippedCount++;
      continue;
    }

    const cleanText = [
      `Library ID: ${libraryId}`,
      `Status: ${status ?? "Unknown"}`,
      `Advertiser: ${advertiserName}`,
      domain ? `Domain: ${domain}` : null,
      "",
      adCopy,
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase.from("ads").insert({
      platform: "facebook",
      keyword,
      title: adCopy.slice(0, 120),
      ad_text: cleanText,
      ad_url: uniqueAdUrl,
      advertiser_name: advertiserName,
      country: "BO",
      language: "es",
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    });

    if (error) {
      console.error(`Insert error on block ${index + 1}:`, error);
    } else {
      console.log(`Saved parsed ad ${index + 1}: ${advertiserName}`);
      savedCount++;
    }
  }

  await browser.close();

  console.log("Refreshing summary tables...");
  await refreshAdvertisers();
  await refreshDomains();

  console.log(`Finished. Saved: ${savedCount}. Skipped: ${skippedCount}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});