import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailShell, escapeHtml, APP_URL, MONO_STACK, TEXT, TEXT_2, MUTED, BG, CARD, BORDER } from "../_shared/gmail-email.ts";
import { initiateMaxelPayRefund, checkMaxelPayRefundStatus } from "../_shared/maxelpay-refund.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function buildSupportEmailHtml(opts: {
  title: string;
  body: string;
  ticketId: string;
  ticketTitle: string;
  isUser: boolean;
  actorName: string;
}): string {
  const content = `
    <tr>
      <td style="padding:34px 40px 0 40px;">
        <span style="font-size:22px;font-weight:600;letter-spacing:-0.02em;color:${TEXT};">${escapeHtml(opts.title)}</span>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 40px 0 40px;">
        <span style="font-family:${MONO_STACK};font-size:13px;color:${MUTED};">Ticket #${escapeHtml(opts.ticketId.slice(0,8))} — ${escapeHtml(opts.ticketTitle)}</span>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:16px 20px;background-color:${BG};border:1px solid ${BORDER};border-radius:12px;">
              <span style="font-size:14px;color:${MUTED};display:block;margin-bottom:6px;">${escapeHtml(opts.actorName)} said:</span>
              <span style="font-size:15px;color:${TEXT};line-height:1.7;white-space:pre-wrap;">${escapeHtml(opts.body)}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 34px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${TEXT}" style="border-radius:999px;">
              <a href="${APP_URL}/support" target="_blank" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:600;color:${BG};text-decoration:none;border-radius:999px;">View conversation</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return emailShell(content, "Support");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Authentication required" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Invalid token" }, 401);

    const body = await req.json();
    const action = body.action;

    // ─── create_ticket ──────────────────────────────────────
    if (action === "create_ticket") {
      const { title, description, category, priority } = body;
      if (!title || !description) return json({ error: "Title and description required" }, 400);

      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .insert({ title, description, category: category || "general", priority: priority || "medium", user_id: user.id })
        .select("id, title, status, created_at")
        .single();

      if (error) return json({ error: error.message }, 500);

      // Log activity
      await supabase.from("support_activity_log").insert({
        ticket_id: ticket.id,
        actor_id: user.id,
        actor_name: user.email || "user",
        action: "ticket_created",
        description: `Ticket created: ${title}`,
      });

      // Notify reviewers (email to support pool)
      try {
        const { data: reviewers } = await supabase
          .from("reviewers")
          .select("email")
          .eq("is_active", true);

        if (reviewers?.length) {
          const reviewerEmails = reviewers.map((r) => r.email).filter(Boolean);
          for (const email of reviewerEmails) {
            await sendEmail(
              email,
              `New support ticket: ${title}`,
              `Ticket #${ticket.id.slice(0,8)}: ${title}\n\n${description}\n\nView: ${APP_URL}/support`,
              buildSupportEmailHtml({
                title: "New support ticket",
                body: description,
                ticketId: ticket.id,
                ticketTitle: title,
                isUser: false,
                actorName: user.email || "user",
              })
            );
          }
        }
      } catch (e) {
        console.error("Failed to notify reviewers:", e);
      }

      return json({ success: true, ticket });
    }

    // ─── reply ──────────────────────────────────────────────
    if (action === "reply") {
      const { ticket_id, message, is_internal } = body;
      if (!ticket_id || !message) return json({ error: "ticket_id and message required" }, 400);

      // Check access: user owns ticket OR is a reviewer
      const { data: ticket } = await supabase
        .from("support_tickets")
        .select("id, user_id, title, assigned_reviewer_id")
        .eq("id", ticket_id)
        .single();

      if (!ticket) return json({ error: "Ticket not found" }, 404);

      const isReviewer = await checkIsReviewer(supabase, user.id);
      const isOwner = ticket.user_id === user.id;

      if (!isOwner && !isReviewer) return json({ error: "Access denied" }, 403);

      const senderType = isReviewer ? "admin" : "user";
      const { data: msg, error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id,
          message,
          sender_id: user.id,
          sender_type: senderType,
          is_internal: is_internal || false,
        })
        .select("id, message, sender_type, created_at")
        .single();

      if (error) return json({ error: error.message }, 500);

      // Log activity
      await supabase.from("support_activity_log").insert({
        ticket_id,
        actor_id: user.id,
        actor_name: isReviewer ? "reviewer" : (user.email || "user"),
        action: "reply",
        description: message.slice(0, 200),
        metadata: { sender_type: senderType, is_internal: is_internal || false },
      });

      // Send email to the other party
      try {
        if (isOwner && ticket.assigned_reviewer_id) {
          // User replied → email reviewer
          const { data: reviewer } = await supabase.auth.admin.getUserById(ticket.assigned_reviewer_id);
          if (reviewer?.user?.email) {
            await sendEmail(
              reviewer.user.email,
              `New reply on ticket: ${ticket.title}`,
              `User replied: ${message.slice(0, 500)}\n\nView: ${APP_URL}/support`,
              buildSupportEmailHtml({
                title: "New reply from user",
                body: message,
                ticketId: ticket_id,
                ticketTitle: ticket.title,
                isUser: false,
                actorName: user.email || "user",
              })
            );
          }
        } else if (isReviewer && isOwner) {
          // Reviewer replied → email user
          const { data: owner } = await supabase.auth.admin.getUserById(ticket.user_id);
          if (owner?.user?.email) {
            await sendEmail(
              owner.user.email,
              `Reply on your ticket: ${ticket.title}`,
              `Support replied: ${message.slice(0, 500)}\n\nView: ${APP_URL}/support`,
              buildSupportEmailHtml({
                title: "Support replied to your ticket",
                body: message,
                ticketId: ticket_id,
                ticketTitle: ticket.title,
                isUser: true,
                actorName: "Support",
              })
            );
          }
        }
      } catch (e) {
        console.error("Failed to send reply email:", e);
      }

      return json({ success: true, message: msg });
    }

    // ─── list_tickets ───────────────────────────────────────
    if (action === "list_tickets") {
      const isReviewer = await checkIsReviewer(supabase, user.id);

      let query = supabase
        .from("support_tickets")
        .select("id, title, category, priority, status, assigned_to, assigned_reviewer_id, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!isReviewer) {
        query = query.eq("user_id", user.id);
      }

      const { data: tickets, error } = await query;
      if (error) return json({ error: error.message }, 500);

      return json({ success: true, tickets });
    }

    // ─── get_ticket ─────────────────────────────────────────
    if (action === "get_ticket") {
      const { ticket_id } = body;
      if (!ticket_id) return json({ error: "ticket_id required" }, 400);

      const isReviewer = await checkIsReviewer(supabase, user.id);

      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", ticket_id)
        .single();

      if (error || !ticket) return json({ error: "Ticket not found" }, 404);

      if (!isReviewer && ticket.user_id !== user.id) {
        return json({ error: "Access denied" }, 403);
      }

      const { data: messages } = await supabase
        .from("support_messages")
        .select("id, message, sender_id, sender_type, is_internal, created_at")
        .eq("ticket_id", ticket_id)
        .order("created_at", { ascending: true });

      const { data: activity } = await supabase
        .from("support_activity_log")
        .select("id, actor_name, action, description, metadata, created_at")
        .eq("ticket_id", ticket_id)
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: refunds } = await supabase
        .from("support_refunds")
        .select("id, amount, currency, destination_address, status, reviewed_by, maxelpay_refund_id, notes, created_at, updated_at")
        .eq("ticket_id", ticket_id)
        .order("created_at", { ascending: false });

      return json({
        success: true,
        ticket,
        messages: messages || [],
        activity: activity || [],
        refunds: refunds || [],
      });
    }

    // ─── assign_ticket (reviewer) ──────────────────────────
    if (action === "assign_ticket") {
      const isReviewer = await checkIsReviewer(supabase, user.id);
      if (!isReviewer) return json({ error: "Reviewer access required" }, 403);

      const { ticket_id, reviewer_id } = body;
      if (!ticket_id) return json({ error: "ticket_id required" }, 400);

      const targetReviewerId = reviewer_id || user.id;

      const { error } = await supabase
        .from("support_tickets")
        .update({ assigned_reviewer_id: targetReviewerId, status: "in_progress" })
        .eq("id", ticket_id);

      if (error) return json({ error: error.message }, 500);

      const { data: ticket } = await supabase
        .from("support_tickets")
        .select("user_id, title")
        .eq("id", ticket_id)
        .single();

      await supabase.from("support_activity_log").insert({
        ticket_id,
        actor_id: user.id,
        actor_name: "reviewer",
        action: "assigned",
        description: `Assigned to reviewer ${targetReviewerId.slice(0,8)}`,
      });

      // Email user
      if (ticket?.user_id) {
        try {
          const { data: owner } = await supabase.auth.admin.getUserById(ticket.user_id);
          if (owner?.user?.email) {
            await sendEmail(
              owner.user.email,
              `Your ticket "${ticket.title}" is being reviewed`,
              `A support reviewer has been assigned to your ticket.\n\nView: ${APP_URL}/support`,
              buildSupportEmailHtml({
                title: "Your ticket is being reviewed",
                body: "A support reviewer has been assigned and will get back to you shortly.",
                ticketId: ticket_id,
                ticketTitle: ticket.title,
                isUser: true,
                actorName: "Support",
              })
            );
          }
        } catch (e) {
          console.error("Failed to email user:", e);
        }
      }

      return json({ success: true });
    }

    // ─── update_status (reviewer) ──────────────────────────
    if (action === "update_status") {
      const isReviewer = await checkIsReviewer(supabase, user.id);
      if (!isReviewer) return json({ error: "Reviewer access required" }, 403);

      const { ticket_id, status } = body;
      if (!ticket_id || !status) return json({ error: "ticket_id and status required" }, 400);

      const validStatuses = ["open", "in_progress", "resolved", "closed"];
      if (!validStatuses.includes(status)) return json({ error: "Invalid status" }, 400);

      const { error } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", ticket_id);

      if (error) return json({ error: error.message }, 500);

      await supabase.from("support_activity_log").insert({
        ticket_id,
        actor_id: user.id,
        actor_name: "reviewer",
        action: "status_change",
        description: `Status changed to ${status}`,
        metadata: { new_status: status },
      });

      return json({ success: true });
    }

    // ─── get_user_context (reviewer) ───────────────────────
    if (action === "get_user_context") {
      const isReviewer = await checkIsReviewer(supabase, user.id);
      if (!isReviewer) return json({ error: "Reviewer access required" }, 403);

      const { user_id } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);

      // Profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, full_name, email, tier, is_premium, subscription_starts_at, subscription_expires_at, created_at")
        .eq("id", user_id)
        .single();

      // Files
      const { data: files } = await supabase
        .from("files")
        .select("id, name, size, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(50);

      const fileCount = files?.length || 0;
      const totalSize = files?.reduce((sum: number, f: any) => sum + (f.size || 0), 0) || 0;

      // Payment history
      const { data: payments } = await supabase
        .from("payment_logs")
        .select("id, plan, plan_type, billing_period, amount_usd, currency, status, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(20);

      // Past tickets
      const { data: pastTickets } = await supabase
        .from("support_tickets")
        .select("id, title, status, category, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(10);

      // Subscription events
      const { data: subEvents } = await supabase
        .from("subscription_events")
        .select("event_type, plan_type, billing_period, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(10);

      return json({
        success: true,
        profile,
        files: { count: fileCount, total_size: totalSize, recent: files?.slice(0, 20) || [] },
        payments: payments || [],
        past_tickets: pastTickets || [],
        subscription_events: subEvents || [],
      });
    }

    // ─── initiate_refund (reviewer) ────────────────────────
    if (action === "initiate_refund") {
      const isReviewer = await checkIsReviewer(supabase, user.id);
      if (!isReviewer) return json({ error: "Reviewer access required" }, 403);

      const { ticket_id, amount, currency, destination_address, payment_txn_id, notes } = body;
      if (!ticket_id || !amount || !destination_address) {
        return json({ error: "ticket_id, amount, and destination_address required" }, 400);
      }

      // Get ticket user
      const { data: ticket } = await supabase
        .from("support_tickets")
        .select("id, user_id, title")
        .eq("id", ticket_id)
        .single();

      if (!ticket) return json({ error: "Ticket not found" }, 404);

      // Create refund record
      const { data: refund, error: refundError } = await supabase
        .from("support_refunds")
        .insert({
          ticket_id,
          user_id: ticket.user_id,
          amount,
          currency: currency || "USD",
          destination_address,
          payment_txn_id: payment_txn_id || null,
          reviewed_by: user.id,
          notes: notes || "",
          status: "approved",
        })
        .select("id")
        .single();

      if (refundError) return json({ error: refundError.message }, 500);

      // Call MaxelPay refund API
      const refundResult = await initiateMaxelPayRefund(supabase, {
        amount,
        currency: currency || "USD",
        destinationAddress: destination_address,
        originalTxnId: payment_txn_id || "",
        userId: ticket.user_id,
        planType: "supporter",
      });

      // Update refund status
      const newStatus = refundResult.success ? "processing" : "failed";
      await supabase
        .from("support_refunds")
        .update({
          status: newStatus,
          maxelpay_refund_id: refundResult.refund_id || null,
          notes: `${notes || ""}\nMaxelPay response: ${refundResult.message || "ok"}`.trim(),
        })
        .eq("id", refund.id);

      // Log activity
      await supabase.from("support_activity_log").insert({
        ticket_id,
        actor_id: user.id,
        actor_name: "reviewer",
        action: refundResult.success ? "refund_initiated" : "refund_failed",
        description: refundResult.success
          ? `Refund of ${amount} ${currency || "USD"} to ${destination_address.slice(0,12)}... initiated`
          : `Refund failed: ${refundResult.message}`,
        metadata: {
          refund_id: refund.id,
          amount,
          currency: currency || "USD",
          destination_address,
          maxelpay_refund_id: refundResult.refund_id,
          maxelpay_status: refundResult.status,
        },
      });

      // Email user
      try {
        const { data: owner } = await supabase.auth.admin.getUserById(ticket.user_id);
        if (owner?.user?.email) {
          await sendEmail(
            owner.user.email,
            refundResult.success
              ? `Refund initiated for your ticket: ${ticket.title}`
              : `Refund processing for your ticket: ${ticket.title}`,
            refundResult.success
              ? `Your refund of ${amount} ${currency || "USD"} to ${destination_address} is being processed.\n\nView: ${APP_URL}/support`
              : `We encountered an issue processing your refund. Our team is looking into it.\n\nView: ${APP_URL}/support`,
            buildSupportEmailHtml({
              title: refundResult.success ? "Refund initiated" : "Refund processing",
              body: refundResult.success
                ? `Your refund of ${amount} ${currency || "USD"} to address ${destination_address} has been initiated and is being processed by our payment provider. You'll receive another email once it's complete.`
                : `We encountered an issue processing your refund. Our support team is investigating and will update you shortly.`,
              ticketId: ticket_id,
              ticketTitle: ticket.title,
              isUser: true,
              actorName: "Support",
            })
          );
        }
      } catch (e) {
        console.error("Failed to email user about refund:", e);
      }

      return json({
        success: refundResult.success,
        refund_id: refund.id,
        maxelpay_refund_id: refundResult.refund_id,
        status: newStatus,
        message: refundResult.message,
      });
    }

    // ─── check_refund_status (reviewer) ────────────────────
    if (action === "check_refund_status") {
      const isReviewer = await checkIsReviewer(supabase, user.id);
      if (!isReviewer) return json({ error: "Reviewer access required" }, 403);

      const { refund_id } = body;
      if (!refund_id) return json({ error: "refund_id required" }, 400);

      const { data: refund } = await supabase
        .from("support_refunds")
        .select("id, maxelpay_refund_id, ticket_id, user_id, amount, currency, status")
        .eq("id", refund_id)
        .single();

      if (!refund) return json({ error: "Refund not found" }, 404);

      if (!refund.maxelpay_refund_id) {
        return json({ success: true, status: refund.status, message: "No MaxelPay refund ID yet" });
      }

      const statusResult = await checkMaxelPayRefundStatus(supabase, refund.maxelpay_refund_id);

      // Update local status if MaxelPay has a definitive answer
      if (statusResult.status === "completed" || statusResult.status === "paid") {
        await supabase
          .from("support_refunds")
          .update({ status: "paid" })
          .eq("id", refund_id);

        // Log + email
        await supabase.from("support_activity_log").insert({
          ticket_id: refund.ticket_id,
          actor_id: user.id,
          actor_name: "system",
          action: "refund_completed",
          description: `Refund of ${refund.amount} ${refund.currency} completed`,
          metadata: { refund_id: refund_id, maxelpay_status: statusResult.status },
        });

        // Email user
        try {
          const { data: owner } = await supabase.auth.admin.getUserById(refund.user_id);
          if (owner?.user?.email) {
            const { data: ticket } = await supabase
              .from("support_tickets")
              .select("title")
              .eq("id", refund.ticket_id)
              .single();

            await sendEmail(
              owner.user.email,
              `Refund complete — ${refund.amount} ${refund.currency}`,
              `Your refund of ${refund.amount} ${refund.currency} has been sent to ${refund.destination_address}.\n\nView: ${APP_URL}/support`,
              buildSupportEmailHtml({
                title: "Refund complete",
                body: `Your refund of ${refund.amount} ${refund.currency} has been sent to destination address ${refund.destination_address}. The transaction is now complete.`,
                ticketId: refund.ticket_id,
                ticketTitle: ticket?.title || "Support",
                isUser: true,
                actorName: "Support",
              })
            );
          }
        } catch (e) {
          console.error("Failed to email refund completion:", e);
        }
      } else if (statusResult.status === "failed") {
        await supabase
          .from("support_refunds")
          .update({ status: "failed" })
          .eq("id", refund_id);

        await supabase.from("support_activity_log").insert({
          ticket_id: refund.ticket_id,
          actor_id: user.id,
          actor_name: "system",
          action: "refund_failed",
          description: `Refund failed at MaxelPay: ${statusResult.status}`,
          metadata: { refund_id: refund_id, maxelpay_status: statusResult.status },
        });
      }

      return json({ success: true, status: statusResult.status, raw: statusResult.raw });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: any) {
    console.error("support-ops error:", err);
    return json({ error: err.message }, 500);
  }
});

async function checkIsReviewer(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("reviewers")
    .select("id")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return !!data;
}
