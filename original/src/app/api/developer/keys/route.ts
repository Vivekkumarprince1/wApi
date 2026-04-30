import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { Workspace } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import crypto from 'crypto';

/**
 * GET /api/developer/keys
 * List all API keys for the workspace
 */
export const GET = withAuth(async (req, { workspace }) => {
  await dbConnect();
  
  // We already have workspace from withAuth, but we might need to re-fetch to get apiKeys if not populated
  // Actually, withAuth finds the workspace, but we should make sure apiKeys is available.
  const fullWorkspace = await Workspace.findById(workspace._id).select('apiKeys');
  if (!fullWorkspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: fullWorkspace.toObject().apiKeys || []
  });
});

/**
 * POST /api/developer/keys
 * Generate a new API key
 */
export const POST = withAuth(async (req, { workspace }) => {
  await dbConnect();
  
  const { name, templateName } = await req.json();

  const fullWorkspace = await Workspace.findById(workspace._id);
  if (!fullWorkspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Enforce Max Keys Limit (Parity)
  const currentKeys = fullWorkspace.apiKeys || [];
  if (currentKeys.length >= 10) {
    return NextResponse.json({ 
      error: "API Key limit reached. Please revoke existing keys to generate a new one." 
    }, { status: 403 });
  }

  // Generate a secure random API key with 'wk_' prefix
  const apiKey = `wk_${crypto.randomBytes(16).toString('hex')}`;

  const newKey = {
    key: apiKey,
    name: name || 'Default Key',
    templateName: templateName || null,
    isActive: true,
    createdAt: new Date()
  };

  if (!fullWorkspace.apiKeys) fullWorkspace.apiKeys = [];
  fullWorkspace.apiKeys.push(newKey as any);
  await fullWorkspace.save();

  return NextResponse.json({
    success: true,
    data: newKey
  });
});
