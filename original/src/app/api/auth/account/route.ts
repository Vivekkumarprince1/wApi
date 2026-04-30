import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, clearAuthCookie } from '@/lib/auth-utils';
import { AccountDeletionService } from '@/lib/services/auth/account-deletion-service';
import dbConnect from '@/lib/db-connect';

export async function DELETE(req: NextRequest) {
  try {
    await dbConnect();
    
    // 1. Authentication Check
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return NextResponse.json({ message: 'Invalid or expired session' }, { status: 401 });
    }

    const userId = decoded.id;

    // 2. Perform Comprehensive Deletion
    console.log(`[API] Received account deletion request for user ${userId}`);
    await AccountDeletionService.deleteAccount(userId);

    // 3. Clear Session and Return Success
    const response = NextResponse.json({ 
      success: true, 
      message: 'Your account and all associated data have been permanently deleted.' 
    });
    
    return clearAuthCookie(response);
  } catch (error: any) {
    console.error('[API] Account deletion error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'An error occurred during account deletion' 
    }, { status: 500 });
  }
}
