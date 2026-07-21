import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabaseAdmin";

export type AuthenticatedProfile = {
  id: string;
  org_id: string;
  role: string;
  email: string | null;
};

export class RequestAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RequestAuthError";
    this.status = status;
  }
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";

  return header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
}

function serverSettings() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "Supabase server environment variables are incomplete."
    );
  }

  return { supabaseUrl, anonKey };
}

export async function requireAuthenticatedProfile(
  request: Request
): Promise<AuthenticatedProfile> {
  const token = bearerToken(request);

  if (!token) {
    throw new RequestAuthError(
      "Missing authentication token.",
      401
    );
  }

  const { supabaseUrl, anonKey } = serverSettings();

  const authClient = createClient(
    supabaseUrl,
    anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const {
    data: userResult,
    error: userError,
  } = await authClient.auth.getUser(token);

  if (userError || !userResult.user) {
    throw new RequestAuthError(
      userError?.message || "Not authenticated.",
      401
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabaseAdmin
    .from("profiles")
    .select("id, org_id, role, email")
    .eq("id", userResult.user.id)
    .single();

  if (profileError || !profile) {
    throw new RequestAuthError(
      profileError?.message || "Profile not found.",
      404
    );
  }

  return profile as AuthenticatedProfile;
}

export function requestErrorStatus(
  error: unknown
) {
  return error instanceof RequestAuthError
    ? error.status
    : 500;
}
