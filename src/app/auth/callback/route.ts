import { NextResponse, type NextRequest } from "next/server";
import { recordTermsAcceptance } from "@/lib/terms";
import { supabaseUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const next = searchParams.get("next") ?? "/app";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  // Enlace con token_hash (confirmación, recuperación o el que genera scripts/dev-login-link.mjs):
  // no depende de que se abra en el mismo navegador donde se pidió.
  const type = searchParams.get("type");
  const OTP_TYPES = ["magiclink", "signup", "recovery", "email"] as const;
  if (tokenHash && OTP_TYPES.includes(type as (typeof OTP_TYPES)[number])) {
    const supabase = await supabaseUser();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as (typeof OTP_TYPES)[number] });
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }

  if (code) {
    const supabase = await supabaseUser();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (searchParams.get("terms") === "1" && data.user) await recordTermsAcceptance(data.user.id);
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=1`);
}
