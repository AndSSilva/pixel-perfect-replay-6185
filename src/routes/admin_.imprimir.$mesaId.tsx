import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carregando } from "@/components/app/common";
import { useDados } from "@/lib/store";
import { estaLogadoDemo } from "@/lib/auth-demo";

export const Route = createFileRoute("/admin_/imprimir/$mesaId")({
  head: () => ({
    meta: [
      { title: "Imprimir QR Code — Gestão de Bebidas" },
      { name: "description", content: "QR Code da mesa pronto para impressão." },
      { property: "og:title", content: "Imprimir QR Code — Gestão de Bebidas" },
      { property: "og:description", content: "QR Code da mesa pronto para impressão." },
    ],
  }),
  component: Imprimir,
});

function Imprimir() {
  const { mesaId } = Route.useParams();
  const d = useDados();
  const nav = useNavigate();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (estaLogadoDemo()) setOk(true);
    else nav({ to: "/admin/login", replace: true });
  }, [nav]);
  if (!d || !ok) return <Carregando />;
  const mesa = d.mesas.find((m) => m.id === mesaId);
  if (!mesa) return <p className="p-8 text-center">Mesa não encontrada.</p>;
  const link = `${window.location.origin}/cardapio/${mesa.id}`;

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className="no-print mb-6 flex justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/mesas/$mesaId" params={{ mesaId }}><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir</Button>
      </div>
      <div className="rounded-2xl border bg-foreground p-8 text-center text-background">
        <p className="text-sm font-medium uppercase tracking-widest">{d.config.nomeEstabelecimento}</p>
        <h1 className="mt-2 text-4xl font-bold">{mesa.nome}</h1>
        <div className="my-6 flex justify-center">
          <QRCodeSVG value={link} size={240} marginSize={2} />
        </div>
        <p className="text-lg font-semibold">Aponte a câmera e faça seu pedido</p>
        <p className="mt-2 break-all text-xs">{link}</p>
      </div>
    </main>
  );
}
