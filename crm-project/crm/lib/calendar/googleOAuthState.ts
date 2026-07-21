import { createHmac, randomBytes, timingSafeEqual } from "crypto";

type GoogleOAuthState = {
  profileId: string;
  issuedAt: number;
  nonce: string;
};

const MAX_STATE_AGE_MS = 10 * 60 * 1000;

function stateSecret() {
  const secret =
    process.env.GOOGLE_OAUTH_STATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      "Missing GOOGLE_OAUTH_STATE_SECRET or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return secret;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signature(payload: string) {
  return createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");
}

export function createGoogleOAuthState(
  profileId: string
) {
  const payload = encode(
    JSON.stringify({
      profileId,
      issuedAt: Date.now(),
      nonce: randomBytes(16).toString("hex"),
    } satisfies GoogleOAuthState)
  );

  return `${payload}.${signature(payload)}`;
}

export function readGoogleOAuthState(
  state: string
): GoogleOAuthState {
  const [payload, suppliedSignature, extra] =
    state.split(".");

  if (!payload || !suppliedSignature || extra) {
    throw new Error("Invalid Google OAuth state.");
  }

  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);

  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    throw new Error("Invalid Google OAuth state signature.");
  }

  let parsed: GoogleOAuthState;

  try {
    parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
  } catch {
    throw new Error("Invalid Google OAuth state payload.");
  }

  if (
    !parsed?.profileId ||
    !Number.isFinite(parsed.issuedAt) ||
    Date.now() - parsed.issuedAt > MAX_STATE_AGE_MS ||
    parsed.issuedAt > Date.now() + 60_000
  ) {
    throw new Error("Google OAuth state expired or is invalid.");
  }

  return parsed;
}
