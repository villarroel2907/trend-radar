import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SearchPageProps = {
  searchParams: Promise<{
    keyword?: string;
  }>;
};

type Ad = {
  id: string;
  platform: string;
  keyword: string;
  title: string | null;
  ad_text: string;
  ad_url: string | null;
  advertiser_name: string | null;
  country: string | null;
  language: string | null;
  created_at: string;
};

function extractDomain(adText: string): string | null {
  const match = adText.match(/Domain:\s*(.+)/);
  return match?.[1]?.trim() ?? null;
}

function extractLibraryId(adText: string): string | null {
  const match = adText.match(/Library ID:\s*(.+)/);
  return match?.[1]?.trim() ?? null;
}

function extractCleanCopy(adText: string): string {
  const parts = adText.split("\n").filter(Boolean);
  return parts[parts.length - 1] ?? adText;
}

function countBy<T extends string>(items: T[]) {
  const map = new Map<T, number>();

  for (const item of items) {
    map.set(item, (map.get(item) ?? 0) + 1);
  }

  return [...map.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const keyword = params.keyword?.trim().toLowerCase() || "";

  const { data: ads, error } = await supabase
    .from("ads")
    .select("*")
    .eq("keyword", keyword)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <h1 className="text-3xl font-bold">Keyword Explorer</h1>
        <p className="mt-4 text-red-400">Error: {error.message}</p>
      </main>
    );
  }

  const keywordAds = (ads ?? []) as Ad[];

  const advertisers = countBy(
    keywordAds
      .map((ad) => ad.advertiser_name?.trim())
      .filter((x): x is string => Boolean(x))
  );

  const domains = countBy(
    keywordAds
      .map((ad) => extractDomain(ad.ad_text))
      .filter((x): x is string => Boolean(x))
  );

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            ← Volver al dashboard
          </Link>

          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-emerald-400">
            Keyword Explorer
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            {keyword || "Buscar keyword"}
          </h1>

          <p className="mt-3 max-w-3xl text-slate-300">
            Analiza una keyword específica: anunciantes, dominios y últimos
            anuncios capturados.
          </p>

          <form action="/search" className="mt-6 flex max-w-xl gap-3">
            <input
              name="keyword"
              defaultValue={keyword}
              placeholder="Ej: fisioterapia, psicologos, abogados..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400"
            />

            <button
              type="submit"
              className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Buscar
            </button>
          </form>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Anuncios detectados</p>
            <p className="mt-2 text-3xl font-bold">{keywordAds.length}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Anunciantes únicos</p>
            <p className="mt-2 text-3xl font-bold">{advertisers.length}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Dominios únicos</p>
            <p className="mt-2 text-3xl font-bold">{domains.length}</p>
          </div>
        </section>

        <section className="mb-10 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-2xl font-semibold">Top Advertisers</h2>

            <div className="grid gap-4">
              {advertisers.map((advertiser, index) => (
                <article
                  key={advertiser.name}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-400">#{index + 1}</p>
                      <h3 className="mt-1 text-lg font-semibold">
                        {advertiser.name}
                      </h3>
                    </div>

                    <div className="rounded-xl bg-emerald-500/10 px-4 py-3">
                      <p className="text-center text-xs uppercase text-emerald-300">
                        Ads
                      </p>
                      <p className="text-center text-2xl font-bold text-emerald-400">
                        {advertiser.total}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold">Top Domains</h2>

            <div className="grid gap-4">
              {domains.map((domain, index) => (
                <article
                  key={domain.name}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-400">#{index + 1}</p>
                      <h3 className="mt-1 break-all text-lg font-semibold">
                        {domain.name}
                      </h3>
                    </div>

                    <div className="rounded-xl bg-blue-500/10 px-4 py-3">
                      <p className="text-center text-xs uppercase text-blue-300">
                        Ads
                      </p>
                      <p className="text-center text-2xl font-bold text-blue-400">
                        {domain.total}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">Últimos anuncios</h2>

          <div className="grid gap-4">
            {keywordAds.map((ad) => {
              const domain = extractDomain(ad.ad_text);
              const libraryId = extractLibraryId(ad.ad_text);
              const cleanCopy = extractCleanCopy(ad.ad_text);

              return (
                <article
                  key={ad.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300">
                      {ad.platform}
                    </span>

                    {libraryId && (
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-400">
                        ID {libraryId}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold">
                    {ad.advertiser_name ?? "Anunciante desconocido"}
                  </h3>

                  <p className="mt-3 text-slate-300">{cleanCopy}</p>

                  {domain && (
                    <p className="mt-3 text-sm text-slate-500">
                      Dominio: {domain}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}