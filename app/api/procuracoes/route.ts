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

    const data = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data.detail ?? "Erro ao consultar o SERPRO." },
        { status: upstream.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[procuracoes route] upstream error:", err);
    return NextResponse.json(
      { error: "Não foi possível conectar ao serviço backend." },
      { status: 503 }
    );
  }
}
