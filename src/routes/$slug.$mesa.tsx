import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Minus,
  Plus,
  ReceiptText,
  ShoppingBag,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Carregando, EmptyState } from "@/components/app/common";
import { ComandaDoCliente } from "@/components/cliente/ComandaDoCliente";
import { formatBRL } from "@/lib/format";
import { urlFoto } from "@/lib/catalogo/servico";
import {
  ajustarAoCardapio,
  alterarQuantidade,
  limiteDoProduto,
  linhasDoCarrinho,
  totalDoCarrinho,
  type Carrinho,
} from "@/lib/pedidos/carrinho";
import {
  chaveCardapio,
  chaveMinhaComanda,
  enviarPedido,
  identificarCliente,
  obterCardapio,
  obterMinhaComanda,
} from "@/lib/pedidos/servico-cliente";
import { apagarToken, lerToken, salvarToken } from "@/lib/pedidos/token-local";
import { mensagemDoErroPedido, type ProdutoCardapio } from "@/lib/pedidos/tipos";
import { corSegura } from "@/lib/pedidos/rotulos";
import { numeroDaMesa } from "@/lib/pedidos/mesa-url";

export const Route = createFileRoute("/$slug/$mesa")({
  head: () => ({
    meta: [
      { title: "Cardápio digital" },
      { name: "description", content: "Escolha seus itens e envie o pedido direto da mesa." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PaginaCliente,
});

function PaginaCliente() {
  const { slug, mesa } = Route.useParams();
  const numero = numeroDaMesa(mesa);
  if (numero === null) return <NaoEncontrado />;
  return <Cliente slug={slug.toLowerCase()} numero={numero} />;
}

function NaoEncontrado() {
  return (
    <div className="mx-auto max-w-md p-6">
      <EmptyState
        icone={UtensilsCrossed}
        titulo="Mesa não encontrada"
        texto="Confira o QR Code da mesa ou chame o atendente."
      />
    </div>
  );
}

function Cliente({ slug, numero }: { slug: string; numero: number }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [lido, setLido] = useState(false);
  useEffect(() => {
    setToken(lerToken(slug, numero));
    setLido(true);
  }, [slug, numero]);

  const cardapio = useQuery({
    queryKey: chaveCardapio(slug, numero),
    queryFn: () => obterCardapio(slug, numero),
    refetchInterval: 20_000,
  });
  const comanda = useQuery({
    queryKey: chaveMinhaComanda(token ?? ""),
    queryFn: () => obterMinhaComanda(token!),
    enabled: token !== null,
    refetchInterval: 8_000,
  });

  // Código que o banco não reconhece mais: volta para a identificação.
  useEffect(() => {
    if (token && comanda.isSuccess && comanda.data === null) {
      apagarToken(slug, numero);
      setToken(null);
    }
  }, [token, comanda.isSuccess, comanda.data, slug, numero]);

  if (!lido || cardapio.isPending) return <Carregando />;
  if (cardapio.isError) {
    return (
      <div className="mx-auto max-w-md p-6">
        <EmptyState
          icone={TriangleAlert}
          titulo="Não foi possível carregar"
          texto="Verifique sua conexão e tente novamente."
          acao={<Button onClick={() => void cardapio.refetch()}>Tentar novamente</Button>}
        />
      </div>
    );
  }
  const dados = cardapio.data;
  if (!dados || !dados.mesa.ativa) return <NaoEncontrado />;

  const primaria = corSegura(dados.empresa.cor_primaria, "#2563EB");
  const secundaria = corSegura(dados.empresa.cor_secundaria, "#0F172A");
  const tema = {
    "--cliente-primaria": primaria,
    "--cliente-secundaria": secundaria,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-background text-foreground" style={tema}>
      <header className="px-4 py-4 text-white" style={{ backgroundColor: secundaria }}>
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {dados.empresa.logo_url ? (
            <img
              src={dados.empresa.logo_url}
              alt=""
              className="h-10 w-10 rounded-md bg-white object-contain"
            />
          ) : null}
          <div>
            <h1 className="text-lg font-semibold leading-tight">{dados.empresa.nome}</h1>
            <p className="text-sm opacity-80">Mesa {dados.mesa.numero}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-32 pt-4">
        {token === null ? (
          <Identificar
            slug={slug}
            numero={numero}
            cor={primaria}
            aoIdentificar={(t) => {
              salvarToken(slug, numero, t);
              setToken(t);
            }}
          />
        ) : comanda.isPending ? (
          <Carregando />
        ) : comanda.isError ? (
          <EmptyState
            icone={TriangleAlert}
            titulo="Não foi possível carregar sua comanda"
            acao={<Button onClick={() => void comanda.refetch()}>Tentar novamente</Button>}
          />
        ) : comanda.data ? (
          <Atendimento
            token={token}
            cardapio={dados}
            comanda={comanda.data}
            cor={primaria}
            aoNovaComanda={() => {
              apagarToken(slug, numero);
              setToken(null);
              void qc.invalidateQueries({ queryKey: chaveMinhaComanda(token) });
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

function Identificar({
  slug,
  numero,
  cor,
  aoIdentificar,
}: {
  slug: string;
  numero: number;
  cor: string;
  aoIdentificar: (token: string) => void;
}) {
  const [nome, setNome] = useState("");
  const m = useMutation({
    mutationFn: () => identificarCliente(slug, numero, nome.trim()),
    onSuccess: (r) => aoIdentificar(r.token),
    onError: (e) => toast.error(mensagemDoErroPedido(e)),
  });
  return (
    <form
      className="space-y-4 rounded-lg border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (nome.trim()) m.mutate();
      }}
    >
      <div>
        <h2 className="text-base font-semibold">Qual é o seu nome?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assim o atendente sabe de quem é cada pedido. Cada pessoa da mesa tem a sua conta.
        </p>
      </div>
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        maxLength={40}
        placeholder="Seu nome"
        autoComplete="given-name"
        aria-label="Seu nome"
      />
      <Button
        type="submit"
        className="w-full text-white"
        style={{ backgroundColor: cor }}
        disabled={!nome.trim() || m.isPending}
      >
        {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Ver cardápio
      </Button>
    </form>
  );
}

function Atendimento({
  token,
  cardapio,
  comanda,
  cor,
  aoNovaComanda,
}: {
  token: string;
  cardapio: NonNullable<Awaited<ReturnType<typeof obterCardapio>>>;
  comanda: NonNullable<Awaited<ReturnType<typeof obterMinhaComanda>>>;
  cor: string;
  aoNovaComanda: () => void;
}) {
  const qc = useQueryClient();
  const [aba, setAba] = useState<"cardapio" | "comanda">("cardapio");
  const [carrinho, setCarrinho] = useState<Carrinho>({});
  const [revisando, setRevisando] = useState(false);

  const produtos = useMemo(() => {
    const mapa = new Map<string, ProdutoCardapio>();
    for (const c of cardapio.categorias) for (const p of c.produtos) mapa.set(p.id, p);
    return mapa;
  }, [cardapio]);
  const precos = useMemo(
    () => new Map([...produtos].map(([id, p]) => [id, p.preco_venda_centavos])),
    [produtos],
  );

  // O cardápio muda (reservas de outros clientes): mantém o carrinho dentro do que existe.
  useEffect(() => {
    setCarrinho((c) => {
      const novo = ajustarAoCardapio(c, produtos);
      return JSON.stringify(novo) === JSON.stringify(c) ? c : novo;
    });
  }, [produtos]);

  const aceitaPedido =
    comanda.comanda.status === "aberta" && comanda.comanda.sessao_status === "aberta";
  const total = totalDoCarrinho(carrinho, precos);
  const qtdTotal = Object.values(carrinho).reduce((a, b) => a + b, 0);

  const enviar = useMutation({
    mutationFn: () => enviarPedido(token, linhasDoCarrinho(carrinho)),
    onSuccess: () => {
      toast.success("Pedido enviado! Aguarde a confirmação do atendente.");
      setCarrinho({});
      setRevisando(false);
      setAba("comanda");
      void qc.invalidateQueries({ queryKey: chaveMinhaComanda(token) });
      void qc.invalidateQueries({
        queryKey: chaveCardapio(cardapio.empresa.slug, cardapio.mesa.numero),
      });
    },
    onError: (e) => {
      toast.error(mensagemDoErroPedido(e));
      void qc.invalidateQueries({
        queryKey: chaveCardapio(cardapio.empresa.slug, cardapio.mesa.numero),
      });
    },
  });

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        Olá, <strong className="text-foreground">{comanda.comanda.cliente_nome}</strong>!
      </p>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
        {(["cardapio", "comanda"] as const).map((a) => (
          <button
            key={a}
            role="tab"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${aba === a ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            {a === "cardapio" ? "Cardápio" : "Minha comanda"}
          </button>
        ))}
      </div>

      {aba === "comanda" ? (
        <ComandaDoCliente token={token} comanda={comanda} aoNovaComanda={aoNovaComanda} />
      ) : (
        <>
          {!aceitaPedido ? (
            <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {comanda.comanda.status !== "aberta"
                ? "Sua comanda foi encerrada."
                : "A mesa está sendo fechada. Chame o atendente para novos pedidos."}
            </div>
          ) : null}
          {cardapio.categorias.length === 0 ? (
            <EmptyState icone={UtensilsCrossed} titulo="Cardápio indisponível no momento" />
          ) : (
            cardapio.categorias.map((c) => (
              <section key={c.id} className="mb-6">
                <h2 className="text-base font-semibold">{c.nome}</h2>
                {c.descricao ? (
                  <p className="text-sm text-muted-foreground">{c.descricao}</p>
                ) : null}
                <ul className="mt-2 space-y-2">
                  {c.produtos.map((p) => {
                    const lim = limiteDoProduto(p);
                    const qtd = carrinho[p.id] ?? 0;
                    const foto = urlFoto(p.foto_path);
                    return (
                      <li key={p.id} className="flex gap-3 rounded-lg border bg-card p-3">
                        {foto ? (
                          <img
                            src={foto}
                            alt=""
                            loading="lazy"
                            className="h-16 w-16 shrink-0 rounded-md object-cover"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-tight">{p.nome}</p>
                          {p.descricao ? (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {p.descricao}
                            </p>
                          ) : null}
                          <p className="mt-1 text-sm font-semibold">
                            {formatBRL(p.preco_venda_centavos)}
                          </p>
                          {p.esgotado ? <p className="text-xs text-destructive">Esgotado</p> : null}
                        </div>
                        {aceitaPedido && lim > 0 ? (
                          <div className="flex items-center gap-1 self-center">
                            {qtd > 0 ? (
                              <>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8"
                                  aria-label={`Remover ${p.nome}`}
                                  onClick={() =>
                                    setCarrinho((c0) => alterarQuantidade(c0, p.id, -1, lim))
                                  }
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-6 text-center text-sm tabular-nums">{qtd}</span>
                              </>
                            ) : null}
                            <Button
                              size="icon"
                              className="h-8 w-8 text-white"
                              style={{ backgroundColor: cor }}
                              aria-label={`Adicionar ${p.nome}`}
                              disabled={qtd >= lim}
                              onClick={() =>
                                setCarrinho((c0) => alterarQuantidade(c0, p.id, 1, lim))
                              }
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </>
      )}

      {aba === "cardapio" && qtdTotal > 0 ? (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3">
          <div className="mx-auto max-w-xl">
            <Button
              className="w-full justify-between text-white"
              style={{ backgroundColor: cor }}
              onClick={() => setRevisando(true)}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" /> Revisar pedido ({qtdTotal})
              </span>
              <span>{formatBRL(total)}</span>
            </Button>
          </div>
        </div>
      ) : null}

      {revisando ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Revisar pedido"
        >
          <div className="max-h-[85vh] w-full overflow-auto rounded-t-xl bg-background p-4 sm:max-w-md sm:rounded-xl">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ReceiptText className="h-5 w-5" /> Seu pedido
            </h2>
            <ul className="mt-3 divide-y">
              {Object.entries(carrinho).map(([id, q]) => {
                const p = produtos.get(id);
                if (!p) return null;
                return (
                  <li key={id} className="flex justify-between py-2 text-sm">
                    <span>
                      {q}× {p.nome}
                    </span>
                    <span className="tabular-nums">{formatBRL(p.preco_venda_centavos * q)}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatBRL(total)}</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              O pedido só vale depois que o atendente confirmar. Se não for confirmado em 45
              minutos, ele expira.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setRevisando(false)}
                disabled={enviar.isPending}
              >
                Voltar
              </Button>
              <Button
                className="text-white"
                style={{ backgroundColor: cor }}
                onClick={() => enviar.mutate()}
                disabled={enviar.isPending}
              >
                {enviar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar pedido
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
