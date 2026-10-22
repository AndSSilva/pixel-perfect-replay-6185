import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock, Minus, Plus, ReceiptText, Search, ShoppingBag, Trash2, TriangleAlert, User, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo, Carregando, iconeCategoria } from "@/components/app/common";
import { executar, useDados } from "@/lib/store";
import { contasAbertasComNome, enviarPedido, identificarCliente, saldoConta, totalConfirmadoConta, totalPagoConta } from "@/lib/services/regras";
import { lerContaLocal, limparContaLocal, salvarContaLocal } from "@/lib/auth-demo";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cardapio/$mesaId")({
  head: () => ({
    meta: [
      { title: "Cardápio digital — Faça seu pedido" },
      { name: "description", content: "Escolha suas bebidas e envie o pedido direto da mesa." },
      { property: "og:title", content: "Cardápio digital — Faça seu pedido" },
      { property: "og:description", content: "Escolha suas bebidas e envie o pedido direto da mesa." },
    ],
  }),
  component: Cardapio,
});

type Etapa = "identificar" | "menu" | "revisao" | "enviado" | "comanda";

function Cardapio() {
  const { mesaId } = Route.useParams();
  const d = useDados();
  const [contaId, setContaId] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("identificar");
  const [nome, setNome] = useState("");
  const [erroNome, setErroNome] = useState<string>();
  const [homonimos, setHomonimos] = useState<{ id: string; abertaEm: string }[] | null>(null);
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("todas");
  const [carrinho, setCarrinho] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState(false);

  // Restore this browser's bill for the table, if still open.
  useEffect(() => {
    if (!d) return;
    const salvo = lerContaLocal(mesaId);
    const mesa = d.mesas.find((m) => m.id === mesaId);
    const c = salvo && d.contas.find((x) => x.id === salvo);
    if (c && c.status === "aberta" && mesa?.sessaoAtualId === c.sessaoId) {
      setContaId(c.id);
      setEtapa((e) => (e === "identificar" ? "menu" : e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!d, mesaId]);

  const categoriasAtivas = useMemo(() => (d ? d.categorias.filter((c) => c.ativa) : []), [d]);
  if (!d) return <Carregando />;

  const mesa = d.mesas.find((m) => m.id === mesaId);
  if (!mesa || !mesa.ativa) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <TriangleAlert className="h-10 w-10 text-warning" />
        <h1 className="mt-4 text-2xl font-semibold">Mesa indisponível</h1>
        <p className="mt-2 max-w-xs text-muted-foreground">
          {mesa ? "Esta mesa está desativada no momento." : "Não encontramos esta mesa."} Chame um atendente para ajudar.
        </p>
      </main>
    );
  }

  const conta = contaId ? d.contas.find((c) => c.id === contaId) : undefined;
  const produtos = d.produtos.filter(
    (p) =>
      p.disponivel &&
      categoriasAtivas.some((c) => c.id === p.categoriaId) &&
      (cat === "todas" || p.categoriaId === cat) &&
      p.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  const linhas = Object.entries(carrinho)
    .map(([id, q]) => ({ p: d.produtos.find((x) => x.id === id), q }))
    .filter((l): l is { p: NonNullable<typeof l.p>; q: number } => !!l.p && l.q > 0);
  const totalCarrinho = linhas.reduce((s, l) => s + l.p.precoCentavos * l.q, 0);
  const qtdCarrinho = linhas.reduce((s, l) => s + l.q, 0);
  const alterar = (id: string, delta: number) =>
    setCarrinho((c) => {
      const n = Math.max(0, (c[id] ?? 0) + delta);
      const novo = { ...c, [id]: n };
      if (n === 0) delete novo[id];
      return novo;
    });

  const vincular = (existente?: string) => {
    const r = executar((x) => identificarCliente(x, mesa.id, nome, existente));
    if (r.ok) {
      salvarContaLocal(mesa.id, r.valor);
      setContaId(r.valor);
      setHomonimos(null);
      setEtapa("menu");
    }
  };
  const prosseguir = () => {
    const n = nome.trim();
    if (!n) return setErroNome("Informe seu nome ou apelido.");
    if (n.length > 40) return setErroNome("Use até 40 caracteres.");
    const iguais = contasAbertasComNome(d, mesa.id, n);
    if (iguais.length) setHomonimos(iguais.map((c) => ({ id: c.id, abertaEm: c.abertaEm })));
    else vincular();
  };
  const enviar = () => {
    if (!contaId) return;
    setEnviando(true);
    const r = executar((x) => enviarPedido(x, contaId, linhas.map((l) => ({ produtoId: l.p.id, quantidade: l.q }))));
    setEnviando(false);
    if (r.ok) {
      setCarrinho({});
      setEtapa("enviado");
    }
  };

  const cabecalho = (
    <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display font-semibold">{d.config.nomeEstabelecimento}</p>
          <p className="text-xs text-primary">{mesa.nome}</p>
        </div>
        {conta && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs",
                etapa === "comanda" ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
              onClick={() => setEtapa((e) => (e === "comanda" ? "menu" : "comanda"))}
              aria-label="Ver minha comanda"
            >
              <ReceiptText className="h-3.5 w-3.5" /> Comanda
            </button>
            <button
              className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs"
              onClick={() => {
                limparContaLocal(mesa.id);
                setContaId(null);
                setNome("");
                setEtapa("identificar");
              }}
              aria-label="Trocar de cliente"
            >
              <User className="h-3.5 w-3.5" /> {conta.clienteNome} · trocar
            </button>
          </div>
        )}
      </div>
    </header>
  );

  if (etapa === "identificar" || !conta) {
    return (
      <div className="min-h-screen">
        {cabecalho}
        <main className="mx-auto max-w-lg px-5 py-10">
          <h1 className="text-3xl font-semibold">Bem-vindo à {mesa.nome}</h1>
          <p className="mt-2 text-muted-foreground">{d.config.textoCardapio || "Informe como podemos te chamar para abrir sua conta."}</p>
          {homonimos ? (
            <div className="mt-8 space-y-3">
              <p className="font-medium">Já existe uma conta com o nome “{nome.trim()}” nesta mesa. É você?</p>
              {homonimos.map((h, i) => (
                <Button key={h.id} variant="secondary" className="h-12 w-full justify-start" onClick={() => vincular(h.id)}>
                  Sim, usar a conta {homonimos.length > 1 ? `nº ${i + 1}` : "existente"} (aberta às {new Date(h.abertaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})
                </Button>
              ))}
              <Button className="h-12 w-full" onClick={() => vincular()}>Não, criar uma nova conta</Button>
              <Button variant="ghost" className="w-full" onClick={() => setHomonimos(null)}>Voltar</Button>
            </div>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); prosseguir(); }}>
              <Campo id="nome-cliente" rotulo="Seu nome ou apelido" erro={erroNome} dica="Não pedimos telefone nem e-mail.">
                <Input id="nome-cliente" className="h-12 text-base" autoFocus value={nome} maxLength={40} onChange={(e) => { setNome(e.target.value); setErroNome(undefined); }} />
              </Campo>
              <Button type="submit" className="h-12 w-full text-base">Ver cardápio</Button>
            </form>
          )}
        </main>
      </div>
    );
  }

  if (etapa === "comanda") {
    const pedidosConta = d.pedidos
      .filter((p) => p.contaId === conta.id)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    const entregues = pedidosConta.filter((p) => p.status === "confirmado");
    const pendentes = pedidosConta.filter((p) => p.status === "pendente");
    const rejeitados = pedidosConta.filter((p) => p.status === "rejeitado");
    const totalConfirmado = totalConfirmadoConta(d, conta.id);
    const totalPago = totalPagoConta(d, conta.id);
    const saldo = saldoConta(d, conta.id);

    const secao = (
      titulo: string,
      lista: typeof pedidosConta,
      icone: React.ReactNode,
      classeIcone: string,
      vazio?: string,
    ) =>
      lista.length > 0 || vazio ? (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <span className={classeIcone}>{icone}</span> {titulo}
          </h2>
          {lista.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{vazio}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {lista.map((p) => (
                <li key={p.id} className="rounded-xl border bg-card p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Pedido às {new Date(p.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="font-semibold tabular text-foreground">{formatBRL(p.totalCentavos)}</span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {p.itens.map((i) => (
                      <li key={i.produtoId} className="flex justify-between text-sm">
                        <span>
                          {i.quantidade}× {i.nomeProduto}
                        </span>
                        <span className="tabular text-muted-foreground">{formatBRL(i.subtotalCentavos)}</span>
                      </li>
                    ))}
                  </ul>
                  {p.status === "rejeitado" && p.motivoRejeicao && (
                    <p className="mt-2 text-xs text-destructive">Motivo: {p.motivoRejeicao}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null;

    return (
      <div className="min-h-screen pb-10">
        {cabecalho}
        <main className="mx-auto max-w-lg px-4 py-6">
          <button onClick={() => setEtapa("menu")} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar ao cardápio
          </button>
          <h1 className="text-2xl font-semibold">Minha comanda</h1>
          <p className="mt-1 text-sm text-muted-foreground">{conta.clienteNome} · {mesa.nome}</p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-xs text-muted-foreground">Consumido</p>
              <p className="mt-1 font-semibold tabular">{formatBRL(totalConfirmado)}</p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-xs text-muted-foreground">Pago</p>
              <p className="mt-1 font-semibold tabular">{formatBRL(totalPago)}</p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-xs text-muted-foreground">A pagar</p>
              <p className={cn("mt-1 font-semibold tabular", saldo > 0 && "text-primary")}>{formatBRL(saldo)}</p>
            </div>
          </div>

          {pedidosConta.length === 0 && (
            <p className="mt-8 text-center text-muted-foreground">Você ainda não fez nenhum pedido.</p>
          )}
          {secao("Aguardando entrega", pendentes, <Clock className="h-4 w-4" />, "text-warning")}
          {secao("Entregues", entregues, <CheckCircle2 className="h-4 w-4" />, "text-primary")}
          {secao("Não atendidos", rejeitados, <XCircle className="h-4 w-4" />, "text-destructive")}

          <Button className="mt-8 h-12 w-full" onClick={() => setEtapa("menu")}>Fazer um pedido</Button>
        </main>
      </div>
    );
  }

  if (etapa === "enviado") {
    return (
      <div className="min-h-screen">
        {cabecalho}
        <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
          <CheckCircle2 className="h-14 w-14 text-primary" />
          <h1 className="mt-4 text-2xl font-semibold">Pedido enviado!</h1>
          <p className="mt-2 text-muted-foreground">Seu pedido está aguardando a confirmação do atendente. O valor só entra na sua conta depois de confirmado.</p>
          <Button className="mt-8 h-12 w-full" onClick={() => setEtapa("comanda")}>Acompanhar na minha comanda</Button>
          <Button variant="secondary" className="mt-3 h-12 w-full" onClick={() => setEtapa("menu")}>Fazer outro pedido</Button>
        </main>
      </div>
    );
  }

  if (etapa === "revisao") {
    return (
      <div className="min-h-screen pb-32">
        {cabecalho}
        <main className="mx-auto max-w-lg px-4 py-6">
          <button onClick={() => setEtapa("menu")} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Continuar escolhendo</button>
          <h1 className="text-2xl font-semibold">Revise seu pedido</h1>
          {linhas.length === 0 ? (
            <p className="mt-6 text-muted-foreground">Seu carrinho está vazio.</p>
          ) : (
            <ul className="mt-4 divide-y rounded-xl border bg-card">
              {linhas.map(({ p, q }) => (
                <li key={p.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{formatBRL(p.precoCentavos)} · subtotal <span className="tabular text-foreground">{formatBRL(p.precoCentavos * q)}</span></p>
                  </div>
                  <Qtd q={q} menos={() => alterar(p.id, -1)} mais={() => alterar(p.id, 1)} />
                  <Button size="icon" variant="ghost" aria-label={`Remover ${p.nome}`} onClick={() => alterar(p.id, -q)}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </main>
        <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-lg">
            <div className="mb-3 flex justify-between text-lg font-semibold"><span>Total</span><span className="tabular">{formatBRL(totalCarrinho)}</span></div>
            <Button className="h-12 w-full text-base" disabled={linhas.length === 0 || enviando} onClick={enviar}>
              {enviando ? "Enviando…" : "Confirmar e enviar pedido"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      {cabecalho}
      <main className="mx-auto max-w-lg px-4 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar bebida" placeholder="Buscar bebida" className="h-11 pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Categorias">
          {[{ id: "todas", nome: "Todas" }, ...categoriasAtivas].map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={cat === c.id}
              onClick={() => setCat(c.id)}
              className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors", cat === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
            >
              {c.nome}
            </button>
          ))}
        </div>
        {produtos.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">Nenhuma bebida encontrada.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {produtos.map((p) => {
              const q = carrinho[p.id] ?? 0;
              const Icone = iconeCategoria(d.categorias.find((c) => c.id === p.categoriaId)?.nome);
              return (
                <li key={p.id} className={cn("flex items-center gap-3 rounded-xl border bg-card p-3", q > 0 && "border-primary/50")}>
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted"><Icone className="h-6 w-6 text-primary" aria-hidden /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{p.nome}</p>
                    {p.descricao && <p className="truncate text-xs text-muted-foreground">{p.descricao}</p>}
                    <p className="mt-1 font-semibold tabular">{formatBRL(p.precoCentavos)}</p>
                  </div>
                  {q === 0 ? (
                    <Button size="icon" className="h-11 w-11 rounded-full" aria-label={`Adicionar ${p.nome}`} onClick={() => alterar(p.id, 1)}><Plus className="h-5 w-5" /></Button>
                  ) : (
                    <Qtd q={q} menos={() => alterar(p.id, -1)} mais={() => alterar(p.id, 1)} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">{d.config.nomeEstabelecimento}</Link> · versão demonstrativa
        </p>
      </main>
      {qtdCarrinho > 0 && (
        <div className="fixed inset-x-0 bottom-0 p-4">
          <Button className="mx-auto flex h-14 w-full max-w-lg justify-between rounded-xl px-5 text-base shadow-lg" onClick={() => setEtapa("revisao")}>
            <span className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> {qtdCarrinho} {qtdCarrinho === 1 ? "item" : "itens"}</span>
            <span>Revisar · {formatBRL(totalCarrinho)}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

function Qtd({ q, menos, mais }: { q: number; menos: () => void; mais: () => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border bg-muted p-1">
      <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" aria-label="Diminuir" onClick={menos}><Minus className="h-4 w-4" /></Button>
      <span className="w-6 text-center font-semibold tabular" aria-live="polite">{q}</span>
      <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" aria-label="Aumentar" onClick={mais}><Plus className="h-4 w-4" /></Button>
    </div>
  );
}
