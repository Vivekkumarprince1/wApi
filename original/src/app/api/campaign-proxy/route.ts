import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import axios from "axios";

/**
 * CONSOLIDATED CAMPAIGN PROXY
 * Forwards all /api/campaign-proxy/* requests to the campaign-service.
 */

const CAMPAIGN_SERVICE_URL = process.env.CAMPAIGN_SERVICE_URL || "http://localhost:3002";
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || "";

export const GET = withAuth(proxyHandler);
export const POST = withAuth(proxyHandler);
export const PUT = withAuth(proxyHandler);
export const PATCH = withAuth(proxyHandler);
export const DELETE = withAuth(proxyHandler);

async function proxyHandler(req: NextRequest, { user, workspace, role }: any) {
  const urlObj = new URL(req.url);
  const pathname = urlObj.pathname;
  let pathString = pathname.replace(/^\/api\/campaign-proxy\/?/, "");
  if (pathString === pathname) {
    pathString = pathname.replace(/^\/api\/?/, "");
  }
  
  console.log(`[CampaignProxy] Request: ${req.method} ${pathname} -> target: ${pathString}`);
  
  const url = `${CAMPAIGN_SERVICE_URL}/api/campaign-proxy/${pathString}`;
  
  const correlationId = req.headers.get("x-correlation-id") || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const headers: any = {
    "Content-Type": "application/json",
    "x-internal-service-secret": INTERNAL_SERVICE_SECRET,
    "x-correlation-id": correlationId,
  };

  if (workspace?._id) headers["x-workspace-id"] = workspace._id.toString();
  if (user?._id) headers["x-user-id"] = user._id.toString();
  if (role) headers["x-user-role"] = role;

  try {
    let body: any;
    if (req.method !== "GET" && req.method !== "DELETE") {
      try { body = await req.json(); } catch (e) { body = undefined; }
    }

    const response = await axios({
      method: req.method,
      url,
      data: body,
      headers,
      params: Object.fromEntries(req.nextUrl.searchParams),
      validateStatus: () => true,
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error(`[CampaignProxy] Error targeting ${url}:`, error.message);
    return NextResponse.json({ 
      success: false, 
      error: "Campaign service unreachable", 
      details: error.message 
    }, { status: 502 });
  }
}
