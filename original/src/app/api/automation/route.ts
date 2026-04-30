import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import axios from "axios";

/**
 * CONSOLIDATED AUTOMATION PROXY
 * This single file handles ALL /api/automation/* requests via Next.js rewrites.
 * No subfolders required.
 */

const AUTOMATION_SERVICE_URL = process.env.AUTOMATION_SERVICE_URL || "http://localhost:3001";
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET || "";

export const GET = withAuth(proxyHandler);
export const POST = withAuth(proxyHandler);
export const PUT = withAuth(proxyHandler);
export const PATCH = withAuth(proxyHandler);
export const DELETE = withAuth(proxyHandler);

async function proxyHandler(req: NextRequest, { user, workspace, role }: any) {
  // Extract the relative path from the actual URL to avoid rewrite issues
  const urlObj = new URL(req.url);
  const pathname = urlObj.pathname;
  const pathString = pathname.replace(/^\/api\/automation\/?/, "");
  
  console.log(`[Proxy] Request: ${req.method} ${pathname} -> target: ${pathString}`);
  
  // Reconstruct the URL for the microservice
  const url = `${AUTOMATION_SERVICE_URL}/api/automation/${pathString}`;
  
  // Extract headers and add security
  const headers: any = {
    "Content-Type": "application/json",
    "x-internal-service-secret": INTERNAL_SERVICE_SECRET,
  };

  // Pass along auth info from withAuth context
  if (workspace?._id) headers["x-workspace-id"] = workspace._id.toString();
  if (user?._id) headers["x-user-id"] = user._id.toString();
  if (role) headers["x-user-role"] = role;

  try {
    let body: any;
    if (req.method !== "GET" && req.method !== "DELETE") {
        try {
            body = await req.json();
        } catch (e) {
            body = undefined;
        }
    }

    const response = await axios({
      method: req.method,
      url,
      data: body,
      headers,
      params: Object.fromEntries(req.nextUrl.searchParams),
      validateStatus: () => true, // Don't throw on 404/500, pass it back
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    console.error(`[AutomationProxy] Error targeting ${url}:`, error.message);
    return NextResponse.json({ 
        success: false, 
        error: "Microservice unreachable", 
        details: error.message 
    }, { status: 502 });
  }
}
