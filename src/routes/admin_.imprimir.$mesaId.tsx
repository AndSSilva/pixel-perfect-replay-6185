import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/app/common";
import { estadoDaConsulta } from "@/components/app/Consulta";
import { supabase } from "@/integrations/supabase/client";
import { useGuardaAdmin } from "@/lib/auth/use-sessao";
import { rotuloMesa, urlMesa } from "@/lib/catalogo/mesas";

export const Route = createFileRoute("/admin_/imprimir/$mesaId")({
  head: () => ({
    meta: [
      { title: "Imprimir QR Code — Mesa Digital" },
      { name: "description", content: "QR Code da mesa pronto para impressão." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Imprimir,
});

async function buscarMesa(mesaId: string) {
  const { data, error } = await supabase
    .from("mesas")
    .select("id, numero, estabelecimentos(nome, slug)")
    .eq("id", mesaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function Imprimir() {
  const { liberado } = useGuardaAdmin();
  if (!liberado) return <Carregando />;
  return <Cartaz />;
}

function Cartaz() {
  const { mesaId } = Route.useParams();
  const consulta = useQuery({
    queryKey: ["mesa-cartaz", mesaId],
    queryFn: () => buscarMesa(mesaId),
    retry: false,
  });
  const pronto = estadoDaConsulta(consulta);
  if (pronto) return <div className="mx-auto max-w-md px-4 py-8">{pronto}</div>;

  const mesa = consulta.data;
  const empresa = mesa?.estabelecimentos;
  if (!mesa || !empresa) {
    return (
      <div className="mx-auto max-w-md px-4 py-8 text-center">
        <p>Mesa não encontrada.</p>
        <Button asChild variant="ghost" className="mt-4">
          <Link to="/admin/mesas">
            <ArrowLeft className="h-4 w-4" /> Voltar às mesas
          </Link>
        </Button>
      </div>
    );
  }
  const link = urlMesa(window.location.origin, empresa.slug, mesa.numero);

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className="no-print mb-6 flex justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/mesas">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
      </div>
      <div className="rounded-2xl border bg-white p-8 text-center text-slate-900">
        <p className="text-sm font-medium uppercase tracking-widest">{empresa.nome}</p>
        <h1 className="mt-2 text-4xl font-bold">{rotuloMesa(mesa.numero)}</h1>
        <div className="my-6 flex justify-center">
          <QRCodeSVG value={link} size={240} marginSize={2} />
        </div>
        <p className="text-lg font-semibold">Aponte a câmera e faça seu pedido</p>
        <p className="mt-2 break-all text-xs text-slate-600">{link}</p>
      </div>
    </main>
  );
}
