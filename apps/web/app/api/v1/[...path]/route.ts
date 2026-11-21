import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Runtime proxy for /api/v1/* → the configured API origin (API_INTERNAL_URL).
// unlike `rewrites()` in next.config.js (baked at build time), this resolves
// the API origin on every request, so it works on any host without rebuilds.
const TARGET = () =>
  (process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000").replace(/\/+$/, "");

const HOP_BY_HOP = new Set([
  "connection",
  "content-length",
  "host",
  "transfer-encoding",
  "via",
  "keep-alive",
  "upgrade",
]);

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  // /api/v1/health maps to the API's real /health (used by the background
  // keep-warm ping); everything else keeps the /api/v1 prefix.
  const url = path[0] === "health"
    ? `${TARGET()}/health${req.nextUrl.search}`
    : `${TARGET()}/api/v1/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  // Preserve the original origin for CORS / Set-Cookie forwarding.
  headers.set("x-forwarded-host", req.headers.get("host") || "");
  headers.set("x-forwarded-proto", req.nextUrl.protocol.replace(":", ""));

  // Forward as a string body. Verified against a raw-bytes fetch of the
  // upstream from inside the container — this path proxies login/me/orgs/
  // meetings etc. with correct Content-Length.
  let body: string | undefined;
  if (!["GET", "HEAD"].includes(req.method)) {
    body = await req.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: `API unreachable: ${err?.message || "unknown error"}`, code: "UPSTREAM_UNREACHABLE" },
      { status: 502 },
    );
  }

  const upText = await upstream.text();
  const passthrough = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) passthrough.set(key, value);
  });

  return new NextResponse(upText, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: passthrough,
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
export async function OPTIONS(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx);
}
