import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher([
  '/multiplayer(.*)',
]);

import { NextResponse } from 'next/server'; // Ensure NextResponse is imported

export default clerkMiddleware(async (auth, req) => { // Make the handler async
  if (isProtectedRoute(req)) {
    // auth.protect() can:
    // 1. Throw an error (e.g., for unauthenticated access, leading to a redirect by clerkMiddleware).
    // 2. Return a NextResponse (e.g., an explicit redirect response).
    // 3. Return an AuthObject (e.g., SignedInAuthObject) for authenticated and authorized users.
    // We must ensure our handler returns NextMiddlewareResult (NextResponse | void).

    // Let clerkMiddleware handle errors thrown by auth.protect().
    // We only need to handle the cases where auth.protect() returns a value.
    const decision = await auth.protect();

    if (decision instanceof NextResponse) {
      // If auth.protect() itself returns a NextResponse (e.g., a redirect), honor it.
      return decision;
    }
    
    // If decision is not a NextResponse (it's likely an AuthObject like SignedInAuthObject),
    // it means the user is authenticated and authorized for the protected route.
    // Returning undefined (void) allows the request to proceed to the route handler.
    return undefined;
  }
  
  // If not a protected route, allow the request to proceed.
  return undefined;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Add multiplayer routes to be processed by middleware
    '/multiplayer(.*)'
  ],
}