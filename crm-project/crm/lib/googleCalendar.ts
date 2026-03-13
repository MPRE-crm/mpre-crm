import { google } from "googleapis";

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId) throw new Error("Missing GOOGLE_CLIENT_ID");
  if (!clientSecret) throw new Error("Missing GOOGLE_CLIENT_SECRET");
  if (!redirectUri) throw new Error("Missing GOOGLE_REDIRECT_URI");

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export async function fetchGoogleAccountEmail(oauth2Client: any) {
  const oauth2 = google.oauth2({
    auth: oauth2Client,
    version: "v2",
  });

  const { data } = await oauth2.userinfo.get();
  return data.email || null;
}

export async function fetchGoogleCalendars(oauth2Client: any) {
  const calendar = google.calendar({
    version: "v3",
    auth: oauth2Client,
  });

  const { data } = await calendar.calendarList.list();

  return (data.items || []).map((item) => ({
    provider_calendar_id: item.id || "",
    name: item.summary || "Unnamed Calendar",
    timezone: item.timeZone || null,
    is_primary: !!item.primary,
  }));
}