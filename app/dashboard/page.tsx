"use client";

import { useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Procuracao {
  sistemaAutorizado?: string;
  dataExpiracao?: string;
  dataInicio?: string;
  outorgante?: string;
  outorgado?: string;
  [key: string]: unknown;
}

interface ConsultaResult {
  tem_procuracao: boolean;
  procuracoes: Procuracao[];
  mensagem: string | null;
  nome_empresa?: string;
}

interface BulkResultItem {
  documento: string;
  status: "ok" | "erro";
  motivo: string | null;
  tem_procuracao: boolean;
  procuracoes: Procuracao[];
  nome_empresa: string;
}

interface BulkResult {
  resultados: BulkResultItem[];
  resumo: { total: number; com_procuracao: number; sem_procuracao: number; erros: number };
}

type Status = "idle" | "loading" | "success" | "error";
type Tab = "individual" | "massa";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskDoc(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function stripDoc(masked: string): string {
  return masked.replace(/\D/g, "");
}

function formatDateBR(dateStr?: string): string {
  if (!dateStr) return "—";
  if (/^\d{8}$/.test(dateStr)) {
    return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pt-BR");
}

function formatDoc(doc?: string): string {
  if (!doc) return "—";
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return doc;
}

const knownKeys = new Set(["sistemaAutorizado","dataExpiracao","dataInicio","outorgante","outorgado","sistema"]);

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("individual");

  // Individual state
  const [docInput, setDocInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ConsultaResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Bulk state
  const [bulkText, setBulkText] = useState("");
  const [bulkStatus, setBulkStatus] = useState<Status>("idle");
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [bulkError, setBulkError] = useState("");
  const [bulkFilter, setBulkFilter] = useState<"todos"|"com"|"sem"|"erros">("todos");

  const digits = stripDoc(docInput);
  const isReady = digits.length === 11 || digits.length === 14;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDocInput(maskDoc(e.target.value));
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
  }, []);

  const handleConsultar = useCallback(async () => {
    if (!isReady) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");
    try {
      const res = await fetch("/api/procuracoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documento: digits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido.");
      setResult(data as ConsultaResult);
      setStatus("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Falha ao consultar.");
      setStatus("error");
    }
  }, [digits, isReady]);

  const handleBulkConsultar = useCallback(async () => {
    const docs = bulkText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (docs.length === 0) {
      setBulkError("Insira ao menos um CNPJ/CPF.");
      setBulkStatus("error");
      return;
    }
    if (docs.length > 500) {
      setBulkError("Máximo de 500 documentos por lote.");
      setBulkStatus("error");
      return;
    }

    setBulkStatus("loading");
    setBulkResult(null);
    setBulkError("");

    try {
      const res = await fetch("/api/procuracoes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentos: docs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no lote.");
      setBulkResult(data as BulkResult);
      setBulkStatus("success");
      setBulkFilter("todos");
    } catch (err: unknown) {
      setBulkError(err instanceof Error ? err.message : "Falha na consulta em lote.");
      setBulkStatus("error");
    }
  }, [bulkText]);

  const filteredResults = bulkResult?.resultados.filter((r) => {
    if (bulkFilter === "com") return r.tem_procuracao;
    if (bulkFilter === "sem") return !r.tem_procuracao && r.status === "ok";
    if (bulkFilter === "erros") return r.status === "erro";
    return true;
  }) ?? [];

  return (
    <div className="min-h-screen bg-brand-graphite font-sans text-brand-snow">
      {/* Background blobs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-brand-bronze/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand-duna/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-white/[0.02] backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-bronze to-brand-duna shadow-lg shadow-brand-bronze/20">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white">
              <path fillRule="evenodd" d="M4.5 3.75a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V6.75a3 3 0 0 0-3-3h-15Zm4.125 3a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Zm-3.873 8.703a4.126 4.126 0 0 1 7.746 0 .75.75 0 0 1-.351.92 7.47 7.47 0 0 1-3.522.877 7.47 7.47 0 0 1-3.522-.877.75.75 0 0 1-.351-.92ZM15 8.25a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H15ZM14.25 12a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H15a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5H18a.75.75 0 0 0 0-1.5h-3Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none text-white">Studio Operacional</h1>
            <p className="mt-1 text-xs text-white/40">Consulta de Procurações Eletrônicas — SERPRO</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 rounded-full border border-brand-bronze/20 bg-brand-bronze/10 px-3 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-duna" />
            <span className="text-xs font-medium text-brand-duna">Integra-Contador API</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 py-12">
        {/* Title */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">Verificar Procuração Eletrônica</h2>
          <p className="mt-2 text-sm text-white/40">Consulte individualmente ou em lote via SERPRO.</p>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex justify-center gap-2">
          {(["individual", "massa"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                tab === t
                  ? "bg-gradient-to-r from-brand-bronze to-brand-duna text-white shadow-lg shadow-brand-bronze/20"
                  : "border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              {t === "individual" ? "Consulta Individual" : "Verificação em Massa"}
            </button>
          ))}
        </div>

        {/* ── Individual Tab ── */}
        {tab === "individual" && (
          <div className="mx-auto max-w-xl">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 shadow-2xl backdrop-blur-sm">
              <div className="space-y-3">
                <label htmlFor="doc-input" className="block text-sm font-medium text-white/60">
                  CPF / CNPJ do cliente
                </label>
                <div className="relative">
                  <input
                    id="doc-input"
                    type="text"
                    value={docInput}
                    onChange={handleChange}
                    onKeyDown={(e) => { if (e.key === "Enter" && isReady) handleConsultar(); }}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    maxLength={18}
                    autoComplete="off"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-white/20 outline-none transition focus:border-brand-bronze/50 focus:ring-2 focus:ring-brand-bronze/20"
                  />
                  {docInput && (
                    <button
                      onClick={() => { setDocInput(""); setStatus("idle"); setResult(null); setErrorMsg(""); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/30 hover:text-white/70"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  id="btn-consultar"
                  onClick={handleConsultar}
                  disabled={!isReady || status === "loading"}
                  className="w-full rounded-xl bg-gradient-to-r from-brand-bronze to-brand-duna px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-bronze/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {status === "loading" ? "Consultando SERPRO..." : "Consultar"}
                </button>
              </div>
            </div>

            {status === "success" && result && <ResultCard result={result} doc={digits} />}
            {status === "error" && <ErrorCard message={errorMsg} />}
          </div>
        )}

        {/* ── Bulk Tab ── */}
        {tab === "massa" && (
          <div className="mx-auto max-w-2xl">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 shadow-2xl backdrop-blur-sm">
              <div className="space-y-3">
                <label htmlFor="bulk-input" className="block text-sm font-medium text-white/60">
                  Lista de CNPJs / CPFs{" "}
                  <span className="text-white/30">(um por linha, vírgula ou ponto-e-vírgula · máx. 500)</span>
                </label>
                <textarea
                  id="bulk-input"
                  value={bulkText}
                  onChange={(e) => { setBulkText(e.target.value); setBulkStatus("idle"); setBulkResult(null); setBulkError(""); }}
                  placeholder={"11.222.333/0001-44\n55.666.777/0001-88\n..."}
                  rows={8}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-white/20 outline-none transition focus:border-brand-bronze/50 focus:ring-2 focus:ring-brand-bronze/20 resize-none font-mono"
                />

                <div className="flex items-center justify-between text-xs text-white/30">
                  <span>
                    {bulkText.split(/[\n,;]+/).filter((s) => s.trim()).length} documentos detectados
                  </span>
                  <button onClick={() => setBulkText("")} className="hover:text-white/60 transition">
                    Limpar
                  </button>
                </div>

                <button
                  id="btn-bulk-consultar"
                  onClick={handleBulkConsultar}
                  disabled={bulkStatus === "loading" || !bulkText.trim()}
                  className="w-full rounded-xl bg-gradient-to-r from-brand-bronze to-brand-duna px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-bronze/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {bulkStatus === "loading" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                      </svg>
                      Consultando lote no SERPRO...
                    </span>
                  ) : "Verificar em Massa"}
                </button>
              </div>
            </div>

            {bulkStatus === "error" && <ErrorCard message={bulkError} />}

            {bulkStatus === "success" && bulkResult && (
              <div className="mt-6 space-y-4">
                {/* Summary pills */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { key: "todos", label: "Total", value: bulkResult.resumo.total, color: "border-white/10 bg-white/5 text-white/70" },
                    { key: "com", label: "Com Procuração", value: bulkResult.resumo.com_procuracao, color: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" },
                    { key: "sem", label: "Sem Procuração", value: bulkResult.resumo.sem_procuracao, color: "border-amber-500/20 bg-amber-500/10 text-amber-400" },
                    { key: "erros", label: "Erros", value: bulkResult.resumo.erros, color: "border-red-500/20 bg-red-500/10 text-red-400" },
                  ].map((pill) => (
                    <button
                      key={pill.key}
                      onClick={() => setBulkFilter(pill.key as typeof bulkFilter)}
                      className={`rounded-xl border p-4 text-left transition ${pill.color} ${bulkFilter === pill.key ? "ring-2 ring-brand-bronze/50" : "hover:opacity-80"}`}
                    >
                      <p className="text-2xl font-bold">{pill.value}</p>
                      <p className="mt-1 text-xs opacity-70">{pill.label}</p>
                    </button>
                  ))}
                </div>

                {/* Results list */}
                <div className="space-y-2">
                  {filteredResults.length === 0 && (
                    <p className="py-8 text-center text-sm text-white/30">Nenhum resultado neste filtro.</p>
                  )}
                  {filteredResults.map((r, i) => (
                    <BulkRow key={i} item={r} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="relative z-10 mt-auto border-t border-white/5 py-6 text-center text-xs text-white/20">
        Studio Operacional LTDA · CNPJ 23.448.109/0001-91 · Uso interno
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BulkRow({ item }: { item: BulkResultItem }) {
  const [open, setOpen] = useState(false);

  const borderColor = item.status === "erro"
    ? "border-red-500/20 bg-red-500/5"
    : item.tem_procuracao
    ? "border-emerald-500/20 bg-emerald-500/5"
    : "border-amber-500/20 bg-amber-500/5";

  const badge = item.status === "erro"
    ? <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-400">Erro</span>
    : item.tem_procuracao
    ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">✓ Ativa</span>
    : <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">Sem procuração</span>;

  return (
    <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          {badge}
          <span className="text-sm font-mono text-white/80">{formatDoc(item.documento)}</span>
          {item.nome_empresa && (
            <span className="text-xs text-white/40">{item.nome_empresa}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-white/30">
          {item.status === "erro" && item.motivo && (
            <span className="text-xs text-red-400/70">{item.motivo}</span>
          )}
          {item.tem_procuracao && (
            <span className="text-xs">{item.procuracoes.length} proc.</span>
          )}
          <span className="transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </button>

      {open && item.tem_procuracao && item.procuracoes.length > 0 && (
        <div className="border-t border-white/5 px-4 py-3 space-y-2">
          {item.procuracoes.map((p, i) => (
            <ProcuracaoCard key={i} procuracao={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({ result, doc }: { result: ConsultaResult; doc: string }) {
  const { tem_procuracao, procuracoes, mensagem, nome_empresa } = result;

  if (tem_procuracao) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">✓ Procuração ativa</span>
          <span className="text-xs text-white/30">{formatDoc(doc)}</span>
          {nome_empresa && <span className="text-xs text-white/40">{nome_empresa}</span>}
        </div>
        <div className="space-y-3">
          {procuracoes.map((p, i) => <ProcuracaoCard key={i} procuracao={p} index={i} />)}
        </div>
        {mensagem && <p className="mt-3 text-xs text-emerald-300/60">{mensagem}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">Sem procuração</span>
        <span className="text-xs text-white/30">{formatDoc(doc)}</span>
        {nome_empresa && <span className="text-xs text-white/40">{nome_empresa}</span>}
      </div>
      <p className="text-sm text-white/60">
        Nenhuma procuração eletrônica encontrada. Oriente o cliente a acessar o{" "}
        <span className="font-medium text-amber-300">portal e-CAC</span> e cadastrar a procuração.
      </p>
      {mensagem && <p className="mt-3 text-xs text-amber-300/60">{mensagem}</p>}
    </div>
  );
}

function ProcuracaoCard({ procuracao, index }: { procuracao: Procuracao; index: number }) {
  const p = procuracao as Record<string, unknown>;
  const sistema = String(procuracao.sistemaAutorizado ?? p["sistema"] ?? `Procuração ${index + 1}`);
  const expiracao = (procuracao.dataExpiracao ?? p["dataFim"] ?? p["validade"] ?? null) as string | null;
  const inicio = (procuracao.dataInicio ?? p["dataInicio"] ?? null) as string | null;

  const labelMap: Record<string, string> = {
    dtexpiracao: "Expiração", dtinicio: "Início", nrsistemas: "Nº Sistemas",
    sistemas: "Sistemas", outorgante: "Outorgante", outorgado: "Outorgado", sistemaAutorizado: "Sistema",
  };

  const extras = Object.entries(procuracao)
    .filter(([k]) => !knownKeys.has(k) && procuracao[k] != null)
    .map(([k, v]) => ({ label: labelMap[k] ?? k, value: String(v), isDate: k.toLowerCase().includes("dt") || k.toLowerCase().includes("data") }));

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <p className="mb-3 text-sm font-semibold text-white/80">{sistema}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {inicio && <DataRow label="Início" value={formatDateBR(String(inicio))} />}
        {expiracao && <DataRow label="Expiração" value={formatDateBR(String(expiracao))} />}
        {procuracao.outorgante && <DataRow label="Outorgante" value={formatDoc(String(procuracao.outorgante))} />}
        {procuracao.outorgado && <DataRow label="Outorgado" value={formatDoc(String(procuracao.outorgado))} />}
        {extras.map(({ label, value, isDate }, i) => (
          <DataRow key={i} label={label} value={isDate ? formatDateBR(value) : value} />
        ))}
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  if (label === "Sistemas" && value.includes(",")) {
    const sistemasList = value.split(",").map((s) => s.trim()).filter(Boolean);
    return (
      <details className="col-span-2 mt-3 group rounded-lg border border-white/5 bg-white/[0.02]">
        <summary className="cursor-pointer list-none flex items-center justify-between p-3 text-white/50 hover:text-white/70 text-xs font-medium transition-colors">
          <span>{label} ({sistemasList.length})</span>
          <span className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="p-3 pt-0 mt-1">
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {sistemasList.map((sys, idx) => (
              <span key={idx} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] leading-tight text-white/70">
                {sys}
              </span>
            ))}
          </div>
        </div>
      </details>
    );
  }

  const isLong = value.length > 50;

  return (
    <div className={`flex flex-col gap-0.5 ${isLong ? 'col-span-2 mt-2' : ''}`}>
      <span className="text-white/30">{label}</span>
      <span className="font-medium text-white/70 leading-relaxed">{value}</span>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">Erro na consulta</span>
      <p className="mt-3 text-sm text-white/60">{message}</p>
    </div>
  );
}
