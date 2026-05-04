import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = `${process.env.BACKEND_URL || "http://localhost:8000"}/api/procuracoes`;

export async function POST(req: NextRequest) {
  let body: { documento?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const raw = (body.documento ?? "").replace(/\D/g, "");

  if (raw.length !== 11 && raw.length !== 14) {
    return NextResponse.json(
      { error: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)." },
      { status: 422 }
    );
  }

  try {
    const upstream = await fetch(FASTAPI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documento: raw }),
    });

    if (!upstream.ok) {
      let errorMsg = `Erro no backend (Status ${upstream.status})`;
      try {
        const text = await upstream.text();
        try {
          const json = JSON.parse(text);
          if (json.detail) {
            errorMsg = typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
          } else {
            errorMsg = text;
          }
        } catch {
          errorMsg = text;
        }
      } catch (e) {
        // ignore
      }
      return NextResponse.json({ error: errorMsg }, { status: upstream.status });
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[procuracoes route] upstream error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Não foi possível conectar ao serviço backend: ${message}` },
      { status: 503 }
    );
  }
}
