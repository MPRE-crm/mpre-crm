import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthClient, GOOGLE_CALENDAR_SCOPES } from "../../../../../lib/googleCalendar";

export async function GET(req: NextRequest) {
  try {
    const { searchParams, origin } = new URL(req.url);
    const profileId = searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const oauth2Client = getGoogleOAuthClient();

    const state = Buffer.from(JSON.stringify({ profileId, origin })).toString("base64");

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_CALENDAR_SCOPES,
      state,
    });

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to start Google OAuth", details: error.message },
      { status: 500 }
    );
  }
}