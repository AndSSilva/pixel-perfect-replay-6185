// DEMONSTRATION ONLY. This "login" compares a PIN stored in the browser and keeps a flag in
// sessionStorage. It provides NO real security and must be replaced by real auth with a backend.
const CHAVE = "bebidas-mvp:admin-demo";

export const estaLogadoDemo = () => typeof window !== "undefined" && sessionStorage.getItem(CHAVE) === "1";
export const entrarDemo = () => sessionStorage.setItem(CHAVE, "1");
export const sairDemo = () => sessionStorage.removeItem(CHAVE);

// Remembers which bill this browser uses at a given table (customer side).
const chaveConta = (mesaId: string) => `bebidas-mvp:conta:${mesaId}`;
export const lerContaLocal = (mesaId: string) => sessionStorage.getItem(chaveConta(mesaId));
export const salvarContaLocal = (mesaId: string, contaId: string) => sessionStorage.setItem(chaveConta(mesaId), contaId);
export const limparContaLocal = (mesaId: string) => sessionStorage.removeItem(chaveConta(mesaId));
