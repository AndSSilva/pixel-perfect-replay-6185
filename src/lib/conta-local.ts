// Lado do cliente final (mesa): lembra neste navegador qual conta pertence a este aparelho em cada mesa.
// Não é autenticação do administrador — ver src/lib/auth/.
const chaveConta = (mesaId: string) => `bebidas-mvp:conta:${mesaId}`;
export const lerContaLocal = (mesaId: string) => sessionStorage.getItem(chaveConta(mesaId));
export const salvarContaLocal = (mesaId: string, contaId: string) =>
  sessionStorage.setItem(chaveConta(mesaId), contaId);
export const limparContaLocal = (mesaId: string) => sessionStorage.removeItem(chaveConta(mesaId));
