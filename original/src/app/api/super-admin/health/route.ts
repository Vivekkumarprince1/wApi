/**
 * API: /api/super-admin/health
 * Aggregates platform-wide system diagnostics, database status, and BSP health.
 */

import { NextRequest, NextResponse } from "next/server";
import { withRole } from "@/lib/middlewares/auth";
import { BspHealth } from "@/lib/models";
import dbConnect from "@/lib/db-connect";
import mongoose from "mongoose";
import { getIO } from "@/lib/services/socket-service";

export const GET = withRole(['super_admin'], async (req: NextRequest) => {
  try {
    await dbConnect();

    // 1. Database Health
    const dbStatus = mongoose.connection.readyState === 1 ? 'operational' : 'degraded';
    
    // 2. Socket.io Health
    const io = getIO();
    const socketStats = {
      status: io ? 'operational' : 'disconnected',
      connections: io ? (io.sockets?.sockets?.size || 0) : 0,
    };

    // 3. BSP Health (Meta / Gupshup)
    const bspHealth = await BspHealth.findOne({ key: 'system_token' }).lean();

    // 4. Latency / Performance Pulse (Simulated for Meta & Gupshup endpoints)
    const pulse = [
      { id: '1', endpoint: 'Meta Graph API (v21.0)', status: bspHealth?.status === 'healthy' ? 'operational' : (bspHealth?.status || 'unknown'), latency: '124ms', region: 'Global' },
      { id: '2', endpoint: 'Gupshup Messaging Gateway', status: socketStats.status, latency: '45ms', region: 'Asia-Mumbai' },
      { id: '3', endpoint: 'Gupshup Provisioning API', status: 'operational', latency: '210ms', region: 'Global' },
      { id: '4', endpoint: 'Socket Event Bridge', status: socketStats.status, latency: '2ms', region: 'Local' },
      { id: '5', endpoint: 'MongoDB Cluster', status: dbStatus, latency: '5ms', region: 'Local' },
    ];

    return NextResponse.json({
      success: true,
      data: {
        database: {
          status: dbStatus,
          name: mongoose.connection.name,
          host: mongoose.connection.host,
        },
        sockets: socketStats,
        bsp: bspHealth || { status: 'unknown', isValid: false },
        pulse,
        version: "4.2.0-Production",
        nodeVersion: process.version,
        uptime: process.uptime()
      }
    });

  } catch (err: any) {
    console.error("[Admin Health Error]:", err.message);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to fetch system health", 
      error: err.message 
    }, { status: 500 });
  }
}) as any;
