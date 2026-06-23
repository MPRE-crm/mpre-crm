import { supabaseAdmin } from "../supabaseAdmin";
import { getGoogleOAuthClient } from "../googleCalendar";

type GoogleCalendarConnection = {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
};

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export async function getAuthorizedGoogleOAuthClient(connection: GoogleCalendarConnection) {
  const oauth2Client = getGoogleOAuthClient();

  oauth2Client.setCredentials({
    access_token: connection.access_token || undefined,
    refresh_token: connection.refresh_token || undefined,
    expiry_date: connection.token_expires_at
      ? new Date(connection.token_expires_at).getTime()
      : undefined,
  });

  const expiresAtMs = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;

  const shouldRefresh =
    !connection.access_token ||
    !expiresAtMs ||
    expiresAtMs <= Date.now() + TOKEN_REFRESH_BUFFER_MS;

  if (shouldRefresh) {
    if (!connection.refresh_token) {
      throw new Error("Google calendar connection is missing a refresh token. Please reconnect Google Calendar.");
    }

    await oauth2Client.getAccessToken();
  }

  const credentials = oauth2Client.credentials;

  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (credentials.access_token && credentials.access_token !== connection.access_token) {
    patch.access_token = credentials.access_token;
  }

  if (credentials.refresh_token && credentials.refresh_token !== connection.refresh_token) {
    patch.refresh_token = credentials.refresh_token;
  }

  if (credentials.expiry_date) {
    patch.token_expires_at = new Date(credentials.expiry_date).toISOString();
  }

  if (Object.keys(patch).length > 1) {
    const { error } = await supabaseAdmin
      .from("calendar_connections")
      .update(patch)
      .eq("id", connection.id);

    if (error) {
      throw new Error(`Failed to save refreshed Google calendar token: ${error.message}`);
    }
  }

  return oauth2Client;
}
