import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middlewares/auth";
import { User, Permission } from "@/lib/models";
import dbConnect from "@/lib/db-connect";

/**
 * GET /api/workspace/team/search
 * Search for a user globally by email to see if they exist and if they are already in the workspace.
 */
export const GET = withAuth(async (req: NextRequest, { workspace }) => {
  await dbConnect();
  
  const email = req.nextUrl.searchParams.get('email');

  if (!email || email.length < 3) {
    return NextResponse.json({ success: true, data: null });
  }

  // 1. Find user globally
  const user = await User.findOne({ 
    email: email.toLowerCase() 
  }).select('name email phone role status').lean();

  if (!user) {
    return NextResponse.json({ 
      success: true, 
      data: { exists: false } 
    });
  }

  // 2. Check if already a member of THIS workspace
  const membership = await Permission.findOne({
    workspace: workspace._id,
    user: user._id
  }).select('role isActive').lean();

  return NextResponse.json({
    success: true,
    data: {
      exists: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      },
      isMember: !!membership && membership.isActive !== false,
      membershipStatus: membership ? (membership.isActive !== false ? 'active' : 'removed') : 'none',
      membershipRole: membership?.role
    }
  });
});
