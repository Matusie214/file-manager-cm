import { NextRequest } from 'next/server';
import { verifyToken, extractTokenFromRequest } from './auth';

export function authenticateRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromRequest(authHeader);
  
  if (!token) {
    throw new Error('No token provided');
  }
  
  try {
    const payload = verifyToken(token);
    return payload;
  } catch {
    throw new Error('Invalid token');
  }
}