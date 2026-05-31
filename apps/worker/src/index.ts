import "dotenv/config";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const keyword = process.env.SEARCH_KEYWORD ?? "fisioterapia";

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

  if (numericId) {
    return numericId;
  }

  const lineWithId = lines.find((line) =>
    line.includes("Identificador de la biblioteca")
  );

  const idFromText = lineWithId?.match(/\d+/)?.[0];

  if (idFromText) {
    return idFromText;
  }

  return `unknown-${Date.now()}-${index}`;
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

    if (candidates.length > 0) {
      return candidates[0];
    }
  }

  const fallback = lines.find((line) => line.length >= 30);

  return fallback ?? block.slice(0, 500);
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

  console.log("Page text length:", bodyText.length);

  const blocks = bodyText
    .split(/(?=Identificador de la biblioteca:|Library ID:)/g)
    .map((block) => block.trim())
    .filter((block) => {
      const hasLibraryId =
        block.includes("Identificador de la biblioteca:") ||
        block.includes("Library ID:") ||
        /^\d{6,}/.test(block);

      const hasAdSignal =
        block.includes("Publicidad") ||
        block.includes("Ver detalles del anuncio") ||
        block.includes("Activo");

      return hasLibraryId && hasAdSignal && block.length > 100;
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

  console.log(`Finished. Saved: ${savedCount}. Skipped: ${skippedCount}.`);

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});