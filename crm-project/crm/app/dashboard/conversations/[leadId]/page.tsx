"use client";

import { use, useEffect, useState } from "react";

type MessageRow = {
  id: string;
  lead_id: string | null;
  lead_phone: string | null;
  direction: string | null;
  body: string | null;
  status: string | null;
  created_at: string;
  twilio_sid: string | null;
};

type LeadInfo = {
  id: string;
  name: string;
  phone: string | null;
} | null;

export default function ConversationPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = use(params);

  const [lead, setLead] = useState<LeadInfo>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function loadConversation() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/conversations/${leadId}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load conversation");
      }

      setLead(data.lead ?? null);
      setMessages(data.messages ?? []);
    } catch (err: any) {
      setError(err?.message || "Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }

  async function sendReply() {
    try {
      const clean = reply.trim();
      if (!clean) return;

      setSending(true);
      setError("");

      const res = await fetch(`/api/conversations/${leadId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: clean }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to send reply");
      }

      setReply("");
      await loadConversation();
    } catch (err: any) {
      setError(err?.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    loadConversation();
  }, [leadId]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Conversation</h1>
          <p className="text-sm text-gray-500">
            {lead ? `${lead.name}${lead.phone ? ` • ${lead.phone}` : ""}` : "Loading lead..."}
          </p>
        </div>

        <button
          onClick={loadConversation}
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="text-sm font-medium">Reply</div>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type a reply..."
          className="min-h-28 w-full rounded-md border p-3 text-sm"
        />
        <div className="flex justify-end">
          <button
            onClick={sendReply}
            disabled={sending || !reply.trim()}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send Reply"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-md border p-4">Loading...</div>
      ) : messages.length === 0 ? (
        <div className="rounded-md border bg-white p-6 text-gray-500">
          No messages found for this lead.
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => {
            const outbound = (msg.direction || "").toLowerCase().includes("out");

            return (
              <div
                key={msg.id}
                className={`max-w-3xl rounded-2xl border px-4 py-3 ${
                  outbound
                    ? "ml-auto bg-gray-900 text-white"
                    : "mr-auto bg-white text-gray-900"
                }`}
              >
                <div className="mb-1 text-xs opacity-70">
                  {msg.direction || "unknown"} •{" "}
                  {msg.created_at ? new Date(msg.created_at).toLocaleString() : "-"}
                </div>
                <div className="whitespace-pre-wrap text-sm">
                  {msg.body || "(no message body)"}
                </div>
                <div className="mt-2 text-xs opacity-70">
                  Status: {msg.status || "-"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}