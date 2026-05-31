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
  created_at: string;
};

export default async function Home() {
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .order("winning_score", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-2xl font-bold">Trend Radar</h1>
        <p className="mt-4 text-red-500">
          Error cargando productos: {error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
            Winning Products Radar
          </p>
          <h1 className="mt-2 text-4xl font-bold">Trend Radar</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Radar experimental para detectar productos, ofertas y ángulos de
            venta que empiezan a repetirse en anuncios digitales.
          </p>
        </div>

        <div className="grid gap-5">
          {(products as Product[] | null)?.map((product) => (
            <article
              key={product.id}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-emerald-400">
                    {product.category ?? "Sin categoría"}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    {product.name}
                  </h2>
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

              {product.description && (
                <p className="mb-5 max-w-3xl text-slate-300">
                  {product.description}
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-950 p-4">
                  <p className="text-xs uppercase text-slate-500">
                    Anuncios detectados
                  </p>
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
    </main>
  );
}