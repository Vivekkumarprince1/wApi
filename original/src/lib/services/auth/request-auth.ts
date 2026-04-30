import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth-utils';
import { User } from '@/lib/models';

export async function getOptionalRequestUser(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.id) return null;
  return User.findById(decoded.id).select('-passwordHash');
}
