import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Handle CORS for mobile browsers - some mobile browsers are stricter  
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://comfy-docs.vercel.app',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Mobile-specific CSP for Gemini API access without breaking app functionality
  const userAgent = request.headers.get('user-agent') || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  if (isMobile) {
    // Set a permissive CSP that allows Google API calls on mobile
    // Use Content-Security-Policy-Report-Only to avoid breaking the app
    response.headers.set(
      'Content-Security-Policy-Report-Only',
      "connect-src 'self' https://generativelanguage.googleapis.com https://aiplatform.googleapis.com *"
    );
    
    // Additional mobile compatibility headers
    response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};