import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmin, AdminAuthError } from "@/server/auth";
import { SERVICES } from "@/server/services-config";
import { getConnection, type DbName } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ServiceHealth {
  id: string;
  name: string;
  tier: string;
  status: "up" | "down";
  latencyMs: number | null;
  detail?: unknown;
}

async function probe(baseUrl: string, healthPath: string): Promise<{ ok: boolean; latencyMs: number; detail?: unknown }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${baseUrl}${healthPath}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    const detail = await res.json().catch(() => undefined);
    return { ok: res.ok, latencyMs: Date.now() - start, detail };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

const READY_STATE: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

/**
 * Monitoring snapshot — probes every service health endpoint and reports
 * MongoDB connection states. This is a READ (Rule #4): pure observation.
 */
export async function GET() {
  try {
    await requireAdmin("read");

    const services: ServiceHealth[] = await Promise.all(
      SERVICES.map(async (svc) => {
        const r = await probe(svc.baseUrl, svc.healthPath);
        return {
          id: svc.id,
          name: svc.name,
          tier: svc.tier,
          status: r.ok ? "up" : "down",
          latencyMs: r.latencyMs,
          detail: r.detail,
        } as ServiceHealth;
      })
    );

    // Database connection states (best-effort; connecting on demand).
    const dbNames: DbName[] = ["core", "billing", "campaign", "automation"];
    const databases = await Promise.all(
      dbNames.map(async (name) => {
        try {
          const conn = await getConnection(name);
          return { name, status: READY_STATE[conn.readyState] || "unknown" };
        } catch {
          return { name, status: "unreachable" };
        }
      })
    );

    return NextResponse.json({
      services,
      databases,
      process: {
        uptimeSec: Math.round(process.uptime()),
        memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        nodeVersion: process.version,
        mongooseVersion: mongoose.version,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ message: err.message }, { status: err.status });
    }
    console.error("[admin/read/monitoring]", err);
    return NextResponse.json({ message: "Failed to load monitoring data" }, { status: 500 });
  }
}
