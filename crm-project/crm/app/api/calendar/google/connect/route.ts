export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleOAuthClient,
  GOOGLE_CALENDAR_SCOPES,
} from "../../../../../lib/googleCalendar";
import {
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../../lib/server/authenticatedProfile";
import {
  createGoogleOAuthState,
} from "../../../../../lib/calendar/googleOAuthState";

export async function POST(req: NextRequest) {
  try {
    const profile =
      await requireAuthenticatedProfile(req);

    const oauth2Client = getGoogleOAuthClient();
    const state =
      createGoogleOAuthState(profile.id);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_CALENDAR_SCOPES,
      state,
    });

    return NextResponse.json({
      ok: true,
      url: authUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to start Google OAuth",
        details: error.message,
      },
      { status: requestErrorStatus(error) }
    );
  }
}