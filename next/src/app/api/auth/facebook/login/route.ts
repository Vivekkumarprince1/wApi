import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Mock implementation for Social Login
    return NextResponse.json({
      success: true,
      message: "Facebook login is not fully implemented on the backend yet.",
      token: "mock-token-123",
      user: {
        id: "mock-id",
        email: "mock@example.com",
        name: "Mock User"
      }
    });
  } catch (err: any) {
    return NextResponse.json({ message: "Server Error", error: err.message }, { status: 500 });
  }
}
