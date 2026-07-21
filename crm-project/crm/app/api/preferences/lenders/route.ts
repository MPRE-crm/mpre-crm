import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../lib/server/authenticatedProfile";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function currentPreferenceOwner(
  request: Request
) {
  const profile =
    await requireAuthenticatedProfile(request);

  const {
    data: userById,
    error: userByIdError,
  } = await supabase
    .from("users")
    .select("id, org_id")
    .eq("org_id", profile.org_id)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (userByIdError) {
    throw new Error(userByIdError.message);
  }

  let user = userById;

  if (!user && profile.email) {
    const {
      data: userByEmail,
      error: userByEmailError,
    } = await supabase
      .from("users")
      .select("id, org_id")
      .eq("org_id", profile.org_id)
      .ilike("email", profile.email)
      .limit(1)
      .maybeSingle();

    if (userByEmailError) {
      throw new Error(userByEmailError.message);
    }

    user = userByEmail;
  }

  if (!user?.id || !user.org_id) {
    throw new Error(
      "No CRM user record is linked to the authenticated profile."
    );
  }

  return {
    agentUserId: Number(user.id),
    orgId: String(user.org_id),
  };
}

export async function GET(request: Request) {
  try {
    const {
      agentUserId,
      orgId,
    } = await currentPreferenceOwner(request);

    const {
      data: preferences,
      error: prefsError,
    } = await supabase
      .from("agent_lender_preferences")
      .select("lender_user_id, position, is_active")
      .eq("org_id", orgId)
      .eq("agent_user_id", agentUserId)
      .eq("is_active", true)
      .order("position", { ascending: true });

    if (prefsError) {
      throw new Error(prefsError.message);
    }

    const lenderIds = (preferences || []).map(
      (row) => Number(row.lender_user_id)
    );

    if (lenderIds.length === 0) {
      return NextResponse.json({
        lenders: [],
        preferences: [],
      });
    }

    const {
      data: lenderRows,
      error: lendersError,
    } = await supabase
      .from("users")
      .select("id, name, email, phone")
      .eq("org_id", orgId)
      .eq("role", "lender")
      .eq("is_active", true)
      .in("id", lenderIds);

    if (lendersError) {
      throw new Error(lendersError.message);
    }

    const lenderById = new Map(
      (lenderRows || []).map(
        (lender) => [Number(lender.id), lender]
      )
    );

    const lenders = lenderIds
      .map((id) => lenderById.get(id))
      .filter(Boolean);

    return NextResponse.json({
      lenders,
      preferences: preferences || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to load lender preferences",
      },
      { status: requestErrorStatus(err) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const {
      agentUserId,
      orgId,
    } = await currentPreferenceOwner(request);

    const body = await request.json();

    const lenderIds = Array.isArray(body?.lenderIds)
      ? body.lenderIds
      : [];

    const normalizedLenderIds: number[] = Array.from(
      new Set<number>(
        lenderIds
          .map((id: unknown) => Number(id))
          .filter(
            (id: number) =>
              Number.isFinite(id)
          )
      )
    );

    const {
      data: currentPreferences,
      error: currentPreferencesError,
    } = await supabase
      .from("agent_lender_preferences")
      .select("lender_user_id")
      .eq("org_id", orgId)
      .eq("agent_user_id", agentUserId);

    if (currentPreferencesError) {
      throw new Error(
        currentPreferencesError.message
      );
    }

    const currentLenderIds = new Set(
      (currentPreferences || []).map(
        (row) => Number(row.lender_user_id)
      )
    );

    const containsForeignLender =
      normalizedLenderIds.some(
        (id) => !currentLenderIds.has(id)
      );

    if (containsForeignLender) {
      return NextResponse.json(
        {
          error:
            "You can reorder only lenders already attached to your personal list.",
        },
        { status: 403 }
      );
    }

    const { error: deleteError } =
      await supabase
        .from("agent_lender_preferences")
        .delete()
        .eq("org_id", orgId)
        .eq(
          "agent_user_id",
          agentUserId
        );

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (normalizedLenderIds.length > 0) {
      const rows =
        normalizedLenderIds.map(
          (
            lenderUserId: number,
            index: number
          ) => ({
            org_id: orgId,
            agent_user_id:
              agentUserId,
            lender_user_id:
              lenderUserId,
            position: index + 1,
            is_active: true,
          })
        );

      const { error: insertError } =
        await supabase
          .from(
            "agent_lender_preferences"
          )
          .insert(rows);

      if (insertError) {
        throw new Error(
          insertError.message
        );
      }
    }

    const { error: stateError } =
      await supabase
        .from(
          "agent_lender_rotation_state"
        )
        .upsert({
          org_id: orgId,
          agent_user_id: agentUserId,
          last_lender_user_id: null,
          updated_at:
            new Date().toISOString(),
        });

    if (stateError) {
      throw new Error(stateError.message);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to save lender preferences",
      },
      { status: requestErrorStatus(err) }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const {
      agentUserId,
      orgId,
    } = await currentPreferenceOwner(request);

    const body = await request.json();

    const name =
      String(body?.name || "").trim();

    const email = body?.email
      ? String(body.email)
          .trim()
          .toLowerCase()
      : null;

    const phone = body?.phone
      ? String(body.phone).trim()
      : null;

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Lender name is required",
        },
        { status: 400 }
      );
    }

    let lender:
      | {
          id: number;
          name: string;
          email: string | null;
          phone: string | null;
        }
      | null = null;

    if (email) {
      const {
        data: existingLender,
        error: existingLenderError,
      } = await supabase
        .from("users")
        .select(
          "id, name, email, phone"
        )
        .eq("org_id", orgId)
        .eq("role", "lender")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

      if (existingLenderError) {
        throw new Error(
          existingLenderError.message
        );
      }

      lender = existingLender;
    }

    if (!lender) {
      const {
        data: createdLender,
        error: createError,
      } = await supabase
        .from("users")
        .insert({
          name,
          email,
          phone,
          org_id: orgId,
          role: "lender",
          is_active: true,
          updated_at:
            new Date().toISOString(),
        })
        .select(
          "id, name, email, phone"
        )
        .single();

      if (createError) {
        throw new Error(
          createError.message
        );
      }

      lender = createdLender;
    }

    const {
      data: existingPreference,
      error: existingPreferenceError,
    } = await supabase
      .from("agent_lender_preferences")
      .select("id")
      .eq("org_id", orgId)
      .eq(
        "agent_user_id",
        agentUserId
      )
      .eq(
        "lender_user_id",
        lender.id
      )
      .maybeSingle();

    if (existingPreferenceError) {
      throw new Error(
        existingPreferenceError.message
      );
    }

    if (!existingPreference) {
      const {
        data: finalPreference,
        error: finalPreferenceError,
      } = await supabase
        .from(
          "agent_lender_preferences"
        )
        .select("position")
        .eq("org_id", orgId)
        .eq(
          "agent_user_id",
          agentUserId
        )
        .order("position", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (finalPreferenceError) {
        throw new Error(
          finalPreferenceError.message
        );
      }

      const nextPosition =
        Number(
          finalPreference?.position ||
            0
        ) + 1;

      const {
        error: preferenceInsertError,
      } = await supabase
        .from(
          "agent_lender_preferences"
        )
        .insert({
          org_id: orgId,
          agent_user_id:
            agentUserId,
          lender_user_id:
            lender.id,
          position: nextPosition,
          is_active: true,
        });

      if (preferenceInsertError) {
        throw new Error(
          preferenceInsertError.message
        );
      }
    }

    const {
      error: rotationStateError,
    } = await supabase
      .from(
        "agent_lender_rotation_state"
      )
      .upsert({
        org_id: orgId,
        agent_user_id: agentUserId,
        last_lender_user_id: null,
        updated_at:
          new Date().toISOString(),
      });

    if (rotationStateError) {
      throw new Error(
        rotationStateError.message
      );
    }

    return NextResponse.json({
      success: true,
      lender,
      added_to_personal_rotation: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to add lender",
      },
      { status: requestErrorStatus(err) }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const {
      agentUserId,
      orgId,
    } = await currentPreferenceOwner(request);

    const body = await request.json();

    const lenderUserId =
      Number(body?.lenderUserId);

    if (!Number.isFinite(lenderUserId)) {
      return NextResponse.json(
        {
          error:
            "Valid lenderUserId is required",
        },
        { status: 400 }
      );
    }

    const {
      data: personalPreference,
      error: preferenceLookupError,
    } = await supabase
      .from("agent_lender_preferences")
      .select("id")
      .eq("org_id", orgId)
      .eq(
        "agent_user_id",
        agentUserId
      )
      .eq(
        "lender_user_id",
        lenderUserId
      )
      .maybeSingle();

    if (preferenceLookupError) {
      throw new Error(
        preferenceLookupError.message
      );
    }

    if (!personalPreference) {
      return NextResponse.json(
        {
          error:
            "Lender is not attached to your personal list.",
        },
        { status: 404 }
      );
    }

    const {
      error: preferenceDeleteError,
    } = await supabase
      .from("agent_lender_preferences")
      .delete()
      .eq("id", personalPreference.id);

    if (preferenceDeleteError) {
      throw new Error(
        preferenceDeleteError.message
      );
    }

    const {
      error: rotationResetError,
    } = await supabase
      .from(
        "agent_lender_rotation_state"
      )
      .update({
        last_lender_user_id: null,
        updated_at:
          new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq(
        "agent_user_id",
        agentUserId
      );

    if (rotationResetError) {
      throw new Error(
        rotationResetError.message
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to remove lender",
      },
      { status: requestErrorStatus(err) }
    );
  }
}