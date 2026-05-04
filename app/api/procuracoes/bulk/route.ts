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
      // Large timeout for bulk operations
      signal: AbortSignal.timeout(300_000),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data.detail ?? "Erro ao processar lote no SERPRO." },
        { status: upstream.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[bulk route] upstream error:", err);
    return NextResponse.json(
      { error: "Não foi possível conectar ao serviço backend." },
      { status: 503 }
    );
  }
}
