export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  requireAuthenticatedProfile,
  requestErrorStatus,
} from "../../../../lib/server/authenticatedProfile";

function canManageTeamBlocks(role: string) {
  return (
    role === "admin" ||
    role === "org_admin" ||
    role === "platform_admin"
  );
}

export async function GET(req: NextRequest) {
  try {
    const profile =
      await requireAuthenticatedProfile(req);
    const targetProfile = profile;

    const { data, error } = await supabaseAdmin
      .from("agent_availability_blocks")
      .select("*")
      .eq("agent_id", targetProfile.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      profile: {
        id: profile.id,
        org_id: profile.org_id,
        role: profile.role,
        email: profile.email,
      },
      targetProfile: {
        id: targetProfile.id,
        org_id: targetProfile.org_id,
        role: targetProfile.role,
        email: targetProfile.email,
      },
      blocks: data || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load availability blocks" },
      { status: requestErrorStatus(err) }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      block_type,
      block_scope,
      title,
      notes,
      start_at,
      end_at,
      weekday,
      start_time,
      end_time,
      is_active,
    } = body;

    if (!block_type) {
      return NextResponse.json(
        { error: "Missing block_type" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "one_time",
      "recurring_weekly",
      "vacation",
      "same_day_pause",
      "out_of_office",
    ];

    if (!allowedTypes.includes(block_type)) {
      return NextResponse.json({ error: "Invalid block_type" }, { status: 400 });
    }

    const profile =
      await requireAuthenticatedProfile(req);
    const targetProfile = profile;

    const requestedScope = block_scope === "team" ? "team" : "personal";

    if (requestedScope === "team" && !canManageTeamBlocks(profile.role)) {
      return NextResponse.json(
        { error: "Only admins can create team blocks" },
        { status: 403 }
      );
    }

    if (block_type === "recurring_weekly") {
      if (weekday === null || weekday === undefined || !start_time || !end_time) {
        return NextResponse.json(
          {
            error:
              "Recurring weekly blocks require weekday, start_time, and end_time",
          },
          { status: 400 }
        );
      }
    } else {
      if (!start_at || !end_at) {
        return NextResponse.json(
          { error: "This block type requires start_at and end_at" },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("agent_availability_blocks")
      .insert({
        agent_id: targetProfile.id,
        org_id: targetProfile.org_id,
        block_type,
        block_scope: requestedScope,
        created_by_profile_id: profile.id,
        title: title || null,
        notes: notes || null,
        start_at: start_at || null,
        end_at: end_at || null,
        weekday: weekday ?? null,
        start_time: start_time || null,
        end_time: end_time || null,
        is_active: typeof is_active === "boolean" ? is_active : true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      block: data,
      profile,
      targetProfile,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create availability block" },
      { status: requestErrorStatus(err) }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      id,
      title,
      notes,
      start_at,
      end_at,
      weekday,
      start_time,
      end_time,
      is_active,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing id" },
        { status: 400 }
      );
    }

    const profile =
      await requireAuthenticatedProfile(req);
    const targetProfile = profile;

    const { data: existingBlock, error: existingBlockError } = await supabaseAdmin
      .from("agent_availability_blocks")
      .select("id, agent_id, block_scope")
      .eq("id", id)
      .eq("agent_id", targetProfile.id)
      .maybeSingle();

    if (existingBlockError) throw new Error(existingBlockError.message);

    if (!existingBlock) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    if (existingBlock.block_scope === "team" && !canManageTeamBlocks(profile.role)) {
      return NextResponse.json(
        { error: "Only admins can update team blocks" },
        { status: 403 }
      );
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updates.title = title || null;
    if (notes !== undefined) updates.notes = notes || null;
    if (start_at !== undefined) updates.start_at = start_at || null;
    if (end_at !== undefined) updates.end_at = end_at || null;
    if (weekday !== undefined) updates.weekday = weekday ?? null;
    if (start_time !== undefined) updates.start_time = start_time || null;
    if (end_time !== undefined) updates.end_time = end_time || null;
    if (typeof is_active === "boolean") updates.is_active = is_active;

    const { data, error } = await supabaseAdmin
      .from("agent_availability_blocks")
      .update(updates)
      .eq("id", id)
      .eq("agent_id", targetProfile.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      block: data,
      profile,
      targetProfile,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update availability block" },
      { status: requestErrorStatus(err) }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing id" },
        { status: 400 }
      );
    }

    const profile =
      await requireAuthenticatedProfile(req);
    const targetProfile = profile;

    const { data: existingBlock, error: existingBlockError } = await supabaseAdmin
      .from("agent_availability_blocks")
      .select("id, agent_id, block_scope")
      .eq("id", id)
      .eq("agent_id", targetProfile.id)
      .maybeSingle();

    if (existingBlockError) throw new Error(existingBlockError.message);

    if (!existingBlock) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    if (existingBlock.block_scope === "team" && !canManageTeamBlocks(profile.role)) {
      return NextResponse.json(
        { error: "Only admins can delete team blocks" },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from("agent_availability_blocks")
      .delete()
      .eq("id", id)
      .eq("agent_id", targetProfile.id);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      profile,
      targetProfile,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete availability block" },
      { status: requestErrorStatus(err) }
    );
  }
}