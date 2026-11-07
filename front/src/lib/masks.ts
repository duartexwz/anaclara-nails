/** Máscaras de CPF e telefone (BR) — exibem formatado, enviam só dígitos. */

export function apenasDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

export function mascararCpf(v: string): string {
  const d = apenasDigitos(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function mascararTelefone(v: string): string {
  const d = apenasDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length === 0 ? "" : `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Máscara de valor monetário/decimal — dígitos e até 2 decimais ("140" · "140,50"). */
export function mascararMoeda(v: string): string {
  const s = v.replace(/\./g, ",").replace(/[^\d,]/g, "");
  if (!s) return "";
  const [inteiro = "", ...demais] = s.split(",");
  const digitos = inteiro.replace(/^0+(?=\d)/, "") || "0";
  if (demais.length === 0) return digitos;
  return `${digitos},${demais.join("").slice(0, 2)}`;
}

/** Máscara de duração ("1h30" · "45min" · "90") — mantém só o que o formato aceita. */
export function mascararDuracao(v: string): string {
  return v.toLowerCase().replace(/[^0-9hmin.,\s]/g, "");
}

export function desmascararTelefone(v: string): string {
  return apenasDigitos(v);
}

export function desmascararCpf(v: string): string {
  return apenasDigitos(v);
}

/** Formata um telefone já salvo (dígitos ou já mascarado) para exibição. */
export function formatarTelefoneExibicao(v: string | null | undefined): string {
  if (!v) return "—";
  const d = apenasDigitos(v);
  if (d.length === 0) return "—";
  return mascararTelefone(d);
}

export function formatarCpfExibicao(v: string | null | undefined): string {
  if (!v) return "—";
  const d = apenasDigitos(v);
  if (d.length === 0) return "—";
  return mascararCpf(d);
}
