import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// Auth refresh is needed for protected dashboard routes and auth pages.
// Public pages no longer pay for a Supabase user lookup on every request.
export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
