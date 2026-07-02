import { supabaseServer } from "../../../lib/supabaseServer";

type PageProps = {
  params: Promise<{ code: string }> | { code: string };
};

export default async function AppointmentReviewPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params);
  const code = String(resolvedParams?.code || "").trim();

  const { data: approval, error } = await supabaseServer
    .from("appointment_approvals")
    .select("id, action_token, status")
    .eq("short_code", code)
    .maybeSingle();

  const unavailable = error || !approval?.id || !approval?.action_token;
  const status = String(approval?.status || "").toLowerCase();

  const alreadyHandled =
    status &&
    status !== "pending" &&
    status !== "pending_agent" &&
    status !== "agent_pending";

  const acceptUrl =
    approval?.id && approval?.action_token
      ? `/a/${encodeURIComponent(approval.id)}/${encodeURIComponent(
          approval.action_token
        )}`
      : "#";

  const declineUrl =
    approval?.id && approval?.action_token
      ? `/d/${encodeURIComponent(approval.id)}/${encodeURIComponent(
          approval.action_token
        )}`
      : "#";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.25em] text-blue-200">
          easyrealtor.homes
        </p>

        <h1 className="mt-4 text-3xl font-bold">Appointment Review</h1>

        {unavailable ? (
          <div className="mt-6 rounded-2xl bg-red-500/15 p-4 text-red-100">
            This appointment link is invalid or expired.
          </div>
        ) : alreadyHandled ? (
          <div className="mt-6 rounded-2xl bg-amber-500/15 p-4 text-amber-100">
            This appointment request has already been handled.
          </div>
        ) : (
          <>
            <p className="mt-4 text-slate-200">
              Please accept or decline this appointment request.
            </p>

            <div className="mt-8 space-y-6">
              <a
                href={acceptUrl}
                className="block rounded-2xl bg-emerald-500 px-6 py-5 text-center text-xl font-bold text-white shadow-lg"
              >
                Accept Appointment
              </a>

              <a
                href={declineUrl}
                className="block rounded-2xl border border-red-300/40 bg-red-500/20 px-6 py-5 text-center text-xl font-bold text-red-100"
              >
                Decline Appointment
              </a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}