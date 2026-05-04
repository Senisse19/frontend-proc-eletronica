import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BULK_URL = `${process.env.BACKEND_URL || "http://localhost:8000"}/api/procuracoes/bulk`;

export async function POST(req: NextRequest) {
  let body: { documentos?: string[] };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  if (!Array.isArray(body.documentos) || body.documentos.length === 0) {
    return NextResponse.json(
      { error: "Envie um array 'documentos' não-vazio." },
      { status: 422 }
    );
  }

  if (body.documentos.length > 500) {
    return NextResponse.json(
      { error: "Máximo de 500 documentos por lote." },
      { status: 422 }
    );
  }

  try {
    const upstream = await fetch(FASTAPI_BULK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentos: body.documentos }),
      signal: AbortSignal.timeout(300_000),
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
      } catch {
        // ignore
      }
      return NextResponse.json({ error: errorMsg }, { status: upstream.status });
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[bulk route] upstream error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Não foi possível conectar ao serviço backend: ${message}` },
      { status: 503 }
    );
  }
}
