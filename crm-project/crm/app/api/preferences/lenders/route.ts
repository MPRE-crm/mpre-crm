import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCurrentAgentUserId(request: Request) {
  const raw = request.headers.get("x-user-id");
  if (!raw) return 1; // temp fallback for your user
  const id = Number(raw);
  return Number.isFinite(id) ? id : 1;
}

async function getCurrentOrgId(agentUserId: number) {
  const { data, error } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", agentUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.org_id) throw new Error("No org_id found for agent");

  return data.org_id as string;
}

export async function GET(request: Request) {
  try {
    const agentUserId = await getCurrentAgentUserId(request);
    const orgId = await getCurrentOrgId(agentUserId);

    const { data: lenders, error: lendersError } = await supabase
      .from("users")
      .select("id, name, email, phone")
      .eq("org_id", orgId)
      .eq("role", "lender")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (lendersError) {
      return NextResponse.json(
        { error: lendersError.message },
        { status: 500 }
      );
    }

    const { data: preferences, error: prefsError } = await supabase
      .from("agent_lender_preferences")
      .select("lender_user_id, position, is_active")
      .eq("org_id", orgId)
      .eq("agent_user_id", agentUserId)
      .order("position", { ascending: true });

    if (prefsError) {
      return NextResponse.json(
        { error: prefsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      lenders: lenders || [],
      preferences: preferences || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load lender preferences" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const agentUserId = await getCurrentAgentUserId(request);
    const orgId = await getCurrentOrgId(agentUserId);

    const body = await request.json();
    const lenderIds = Array.isArray(body?.lenderIds) ? body.lenderIds : [];

    const normalizedLenderIds = lenderIds
      .map((id: unknown) => Number(id))
      .filter((id: number) => Number.isFinite(id));

    const { error: deleteError } = await supabase
      .from("agent_lender_preferences")
      .delete()
      .eq("org_id", orgId)
      .eq("agent_user_id", agentUserId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    if (normalizedLenderIds.length > 0) {
      const rows = normalizedLenderIds.map(
        (lenderUserId: number, index: number) => ({
          org_id: orgId,
          agent_user_id: agentUserId,
          lender_user_id: lenderUserId,
          position: index + 1,
          is_active: true,
        })
      );

      const { error: insertError } = await supabase
        .from("agent_lender_preferences")
        .insert(rows);

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }
    }

    const { error: stateError } = await supabase
      .from("agent_lender_rotation_state")
      .upsert({
        org_id: orgId,
        agent_user_id: agentUserId,
        last_lender_user_id: null,
        updated_at: new Date().toISOString(),
      });

    if (stateError) {
      return NextResponse.json(
        { error: stateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save lender preferences" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const agentUserId = await getCurrentAgentUserId(request);
    const orgId = await getCurrentOrgId(agentUserId);

    const body = await request.json();

    const name = String(body?.name || "").trim();
    const email = body?.email ? String(body.email).trim() : null;
    const phone = body?.phone ? String(body.phone).trim() : null;

    if (!name) {
      return NextResponse.json(
        { error: "Lender name is required" },
        { status: 400 }
      );
    }

    const insertPayload: any = {
      name,
      email,
      phone,
      org_id: orgId,
      role: "lender",
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("users")
      .insert(insertPayload)
      .select("id, name, email, phone")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lender: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create lender" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const agentUserId = await getCurrentAgentUserId(request);
    const orgId = await getCurrentOrgId(agentUserId);

    const body = await request.json();
    const lenderUserId = Number(body?.lenderUserId);

    if (!Number.isFinite(lenderUserId)) {
      return NextResponse.json(
        { error: "Valid lenderUserId is required" },
        { status: 400 }
      );
    }

    const { error: deactivateError } = await supabase
      .from("users")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lenderUserId)
      .eq("org_id", orgId)
      .eq("role", "lender");

    if (deactivateError) {
      return NextResponse.json(
        { error: deactivateError.message },
        { status: 500 }
      );
    }

    const { error: prefDeleteError } = await supabase
      .from("agent_lender_preferences")
      .delete()
      .eq("org_id", orgId)
      .eq("lender_user_id", lenderUserId);

    if (prefDeleteError) {
      return NextResponse.json(
        { error: prefDeleteError.message },
        { status: 500 }
      );
    }

    const { error: orgRotationDeleteError } = await supabase
      .from("org_mortgage_rotation")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", lenderUserId);

    if (orgRotationDeleteError) {
      return NextResponse.json(
        { error: orgRotationDeleteError.message },
        { status: 500 }
      );
    }

    const { error: agentRotationResetError } = await supabase
      .from("agent_lender_rotation_state")
      .update({
        last_lender_user_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("last_lender_user_id", lenderUserId);

    if (agentRotationResetError) {
      return NextResponse.json(
        { error: agentRotationResetError.message },
        { status: 500 }
      );
    }

    const { error: orgRotationResetError } = await supabase
      .from("org_mortgage_rotation_state")
      .update({
        last_user_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("last_user_id", lenderUserId);

    if (orgRotationResetError) {
      return NextResponse.json(
        { error: orgRotationResetError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to delete lender" },
      { status: 500 }
    );
  }
}