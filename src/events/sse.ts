import type { Request, Response } from "express";

type SseClient = {
  id: string;
  res: Response;
  createdAt: number;
  scope: "public" | "admin";
};

const clients: SseClient[] = [];

function now() {
  return Date.now();
}

function writeEvent(res: Response, payload: unknown) {
  // Minimal SSE frame: `data: ...\n\n`
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function broadcast(payload: unknown, opts?: { scope?: SseClient["scope"] }) {
  const scope = opts?.scope;
  for (const c of [...clients]) {
    if (scope && c.scope !== scope) continue;
    try {
      writeEvent(c.res, payload);
    } catch {
      // ignore, connection will be cleaned up on close
    }
  }
}

export function attachSseClient(req: Request, res: Response, scope: SseClient["scope"]) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // If behind proxies (Railway), this helps flush headers ASAP
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).flushHeaders?.();

  const client: SseClient = {
    id: cryptoRandomId(),
    res,
    createdAt: now(),
    scope,
  };

  clients.push(client);

  // Initial hello + keepalive
  writeEvent(res, { type: "hello", data: { scope } });
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${now()}\n\n`);
    } catch {
      // ignore
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const idx = clients.findIndex((c) => c.id === client.id);
    if (idx >= 0) clients.splice(idx, 1);
  });
}

function cryptoRandomId() {
  // Node 18+ has globalThis.crypto; fallback to Math.random for older environments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${now()}-${Math.random().toString(16).slice(2)}`;
}

