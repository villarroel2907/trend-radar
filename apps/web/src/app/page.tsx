import { supabase } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  winning_score: number;
  total_ads: number;
  total_advertisers: number;
  total_countries: number;
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
  return match?.[1] ?? null;
}

function extractLibraryId(adText: string): string | null {
  const match = adText.match(/Library ID:\s*(.+)/);
  return match?.[1] ?? null;
}

function extractCleanCopy(adText: string): string {
  const parts = adText.split("\n").filter(Boolean);
  const copy = parts[parts.length - 1];
  return copy ?? adText;
}

export default async function Home() {
  const [{ data: products, error: productsError }, { data: ads, error: adsError }] =
    await Promise.all([
      supabase
        .from("products")
        .select("*")
        .order("winning_score", { ascending: false })
        .limit(5),

      supabase
        .from("ads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (productsError || adsError) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <h1 className="text-2xl font-bold">Trend Radar</h1>
        <p className="mt-4 text-red-400">
          Error cargando datos: {productsError?.message ?? adsError?.message}
        </p>
      </main>
    );
  }

  const totalAds = ads?.length ?? 0;
  const totalAdvertisers = new Set(
    ads?.map((ad) => ad.advertiser_name).filter(Boolean)
  ).size;
  const totalKeywords = new Set(ads?.map((ad) => ad.keyword).filter(Boolean)).size;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
            Meta Ads Intelligence
          </p>
          <h1 className="mt-2 text-4xl font-bold">Trend Radar</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Dashboard experimental para detectar anuncios, anunciantes, dominios
            y posibles productos ganadores a partir de Meta Ads Library.
          </p>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Últimos anuncios cargados</p>
            <p className="mt-2 text-3xl font-bold">{totalAds}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Anunciantes detectados</p>
            <p className="mt-2 text-3xl font-bold">{totalAdvertisers}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Keywords rastreadas</p>
            <p className="mt-2 text-3xl font-bold">{totalKeywords}</p>
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Productos ganadores</h2>
              <p className="mt-1 text-sm text-slate-400">
                Por ahora estos datos son manuales; luego serán calculados desde
                los anuncios detectados.
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {(products as Product[] | null)?.map((product) => (
              <article
                key={product.id}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-emerald-400">
                      {product.category ?? "Sin categoría"}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="mt-2 max-w-3xl text-sm text-slate-300">
                        {product.description}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl bg-emerald-500/10 px-5 py-3 text-center">
                    <p className="text-xs uppercase tracking-widest text-emerald-300">
                      Score
                    </p>
                    <p className="text-3xl font-bold text-emerald-400">
                      {product.winning_score}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs uppercase text-slate-500">Anuncios</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {product.total_ads}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs uppercase text-slate-500">
                      Anunciantes
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {product.total_advertisers}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4">
                    <p className="text-xs uppercase text-slate-500">Países</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {product.total_countries}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-2xl font-semibold">Últimos anuncios detectados</h2>
            <p className="mt-1 text-sm text-slate-400">
              Datos capturados por el worker desde Meta Ads Library.
            </p>
          </div>

          <div className="grid gap-4">
            {(ads as Ad[] | null)?.map((ad) => {
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
                    <span className="rounded-full bg-blue-500/10 px-3 py-1 text-blue-300">
                      {ad.keyword}
                    </span>
                    {ad.country && (
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                        {ad.country}
                      </span>
                    )}
                    {libraryId && (
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-400">
                        ID {libraryId}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {ad.advertiser_name ?? "Anunciante desconocido"}
                      </h3>

                      <p className="mt-3 text-slate-300">{cleanCopy}</p>

                      {domain && (
                        <p className="mt-3 text-sm text-slate-500">
                          Dominio: {domain}
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl bg-slate-950 p-4 text-sm text-slate-400">
                      <p>
                        <span className="text-slate-500">Creado:</span>{" "}
                        {new Date(ad.created_at).toLocaleString("es-BO")}
                      </p>

                      {ad.ad_url && (
                        <a
                          href={ad.ad_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block text-emerald-400 hover:text-emerald-300"
                        >
                          Ver fuente →
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}