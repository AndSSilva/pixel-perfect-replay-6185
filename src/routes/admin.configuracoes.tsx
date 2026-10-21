import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Campo, Confirmar, PageHeader, Painel } from "@/components/app/common";
import type { Erros } from "@/components/app/common";
import { executar, restaurarDemo, useDados } from "@/lib/store";
import { salvarConfig } from "@/lib/services/regras";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Gestão de Bebidas" },
      { name: "description", content: "Nome do estabelecimento, texto do cardápio e dados de demonstração." },
      { property: "og:title", content: "Configurações — Gestão de Bebidas" },
      { property: "og:description", content: "Nome do estabelecimento, texto do cardápio e dados de demonstração." },
    ],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  const d = useDados()!;
  const [cfg, setCfg] = useState(d.config);
  const [erros, setErros] = useState<Erros>({});

  const salvar = () => {
    const e: Erros = {};
    if (!cfg.nomeEstabelecimento.trim()) e.nome = "Informe o nome.";
    if (!/^\d{4,8}$/.test(cfg.pinDemo)) e.pin = "Use de 4 a 8 dígitos.";
    setErros(e);
    if (!Object.keys(e).length) executar((x) => salvarConfig(x, cfg), "Configurações salvas.");
  };

  return (
    <>
      <PageHeader titulo="Configurações" />
      <div className="grid max-w-2xl gap-6">
        <Painel titulo="Estabelecimento">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
            <Campo id="nomeEst" rotulo="Nome do estabelecimento *" erro={erros.nome}>
              <Input id="nomeEst" value={cfg.nomeEstabelecimento} maxLength={60} onChange={(e) => setCfg({ ...cfg, nomeEstabelecimento: e.target.value })} />
            </Campo>
            <Campo id="texto" rotulo="Texto auxiliar do cardápio">
              <Textarea id="texto" value={cfg.textoCardapio} maxLength={200} onChange={(e) => setCfg({ ...cfg, textoCardapio: e.target.value })} />
            </Campo>
            <Campo id="pinCfg" rotulo="PIN demonstrativo do painel" erro={erros.pin} dica="Apenas para demonstração; não oferece segurança real.">
              <Input id="pinCfg" inputMode="numeric" value={cfg.pinDemo} maxLength={8} onChange={(e) => setCfg({ ...cfg, pinDemo: e.target.value.replace(/\D/g, "") })} />
            </Campo>
            <Button type="submit">Salvar alterações</Button>
          </form>
        </Painel>
        <Painel titulo="Dados de demonstração">
          <p className="mb-4 text-sm text-muted-foreground">
            Todos os dados deste navegador (produtos, mesas, pedidos, contas e pagamentos) serão substituídos pelo cenário inicial.
          </p>
          <Confirmar
            gatilho={<Button variant="destructive"><RotateCcw className="h-4 w-4" /> Restaurar dados de demonstração</Button>}
            titulo="Restaurar dados de demonstração?"
            descricao="Os dados locais atuais serão apagados e substituídos pelos dados iniciais. Esta ação não pode ser desfeita."
            rotuloAcao="Restaurar"
            perigo
            onConfirmar={() => {
              restaurarDemo();
              toast.success("Dados de demonstração restaurados.");
              location.reload();
            }}
          />
        </Painel>
      </div>
    </>
  );
}
