import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Plus, Send, ArrowLeft, Loader2, Circle, CheckCircle, Clock, AlertCircle } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageFrame } from '@/components/layout/PageFrame';

const SP_CSS = `
.sp-root{max-width:1080px;margin:0 auto;text-align:left}
.sp-head{display:flex;justify-content:center;margin-bottom:24px}
.sp-root :is(h1,h2,h3){color:var(--sa-text,#e8e7e1)}
.sp-root :is(p,span,td){line-height:1.6}
.sp-root [class*="rounded-lg"]{border-radius:12px}
.sp-root [class*="text-blue-"],
.sp-root [class*="text-amber-"],
.sp-root [class*="text-green-"],
.sp-root [class*="text-emerald-"],
.sp-root [class*="text-red-"]{color:var(--sa-mute,#8d8f89)!important}
.sp-root [class*="bg-blue-"],
.sp-root [class*="bg-amber-"],
.sp-root [class*="bg-green-"],
.sp-root [class*="bg-emerald-"],
.sp-root [class*="bg-red-"]{background-color:var(--sa-bg-4,#1b201d)!important;color:var(--sa-mute,#8d8f89)!important}
.sp-root [class*="border-blue-"],
.sp-root [class*="border-amber-"],
.sp-root [class*="border-green-"],
.sp-root [class*="border-emerald-"],
.sp-root [class*="border-red-"]{border-color:var(--sa-line,#1f2221)!important}
.sp-root [class*="bg-primary"]{background-color:var(--sa-bg-4,#1b201d)!important;color:var(--sa-text,#e8e7e1)!important}
`;

interface Ticket {
  id: string;
  title: string;
  category: string;
  priority: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Message {
  id: string;
  message: string;
  sender_id: string;
  sender_type: string;
  is_internal: boolean | null;
  created_at: string | null;
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  resolved: 'bg-green-500/10 text-green-500 border-green-500/20',
  closed: 'bg-muted text-muted-foreground border-border',
};

const statusIcons: Record<string, React.ReactNode> = {
  open: <Circle className="h-3 w-3" />,
  in_progress: <Clock className="h-3 w-3" />,
  resolved: <CheckCircle className="h-3 w-3" />,
  closed: <CheckCircle className="h-3 w-3" />,
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function SupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', category: 'general', priority: 'medium' });
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadTickets();
  }, [user]);

  useEffect(() => {
    if (selectedTicket) loadMessages(selectedTicket.id);
  }, [selectedTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!selectedTicket) return;
    const channel = supabase
      .channel('support-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${selectedTicket.id}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => [...prev, msg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket]);

  async function loadTickets() {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) { setLoading(false); return; }

    const res = await supabase.functions.invoke('support-ops', {
      body: { action: 'list_tickets' },
      headers: { Authorization: `Bearer ${session.session.access_token}` },
    });
    setTickets(res.data?.tickets || []);
    setLoading(false);
  }

  async function loadMessages(ticketId: string) {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) return;

    const res = await supabase.functions.invoke('support-ops', {
      body: { action: 'get_ticket', ticket_id: ticketId },
      headers: { Authorization: `Bearer ${session.session.access_token}` },
    });
    setMessages(res.data?.messages || []);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedTicket) return;
    setSending(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) { setSending(false); return; }

    await supabase.functions.invoke('support-ops', {
      body: { action: 'reply', ticket_id: selectedTicket.id, message: newMessage.trim() },
      headers: { Authorization: `Bearer ${session.session.access_token}` },
    });
    setNewMessage('');
    setSending(false);
  }

  async function createTicket() {
    if (!newTicket.title.trim() || !newTicket.description.trim()) return;
    setCreating(true);
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) { setCreating(false); return; }

    const res = await supabase.functions.invoke('support-ops', {
      body: { action: 'create_ticket', ...newTicket },
      headers: { Authorization: `Bearer ${session.session.access_token}` },
    });

    if (res.data?.ticket) {
      setTickets((prev) => [res.data.ticket, ...prev]);
      setSelectedTicket(res.data.ticket);
      setShowNewTicket(false);
      setNewTicket({ title: '', description: '', category: 'general', priority: 'medium' });
    }
    setCreating(false);
  }

  if (!user) {
    return (
      <div className="sp-root flex min-h-screen items-center justify-center">
        <style>{SP_CSS}</style>
        <Card className="max-w-md p-8 text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in to get support</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">You need to be signed in to create and manage support tickets.</p>
            <Link to="/auth"><Button>Sign In</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageFrame title="Support" subtitle="We're here to help. Open a ticket and a human will get back to you." wide>
      <style>{SP_CSS}</style>
      <div className="sp-root">
        <div className="sp-head">
          <Button onClick={() => setShowNewTicket(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Ticket
          </Button>
        </div>

        {showNewTicket && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">New Support Ticket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="What's going on?" value={newTicket.title} onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })} />
              <Textarea placeholder="Tell us more about the issue..." rows={4} value={newTicket.description} onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })} />
              <div className="flex gap-3">
                <Select value={newTicket.category} onValueChange={(v) => setNewTicket({ ...newTicket, category: v })}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newTicket.priority} onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={createTicket} disabled={creating || !newTicket.title.trim()}>
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create Ticket
                </Button>
                <Button variant="ghost" onClick={() => setShowNewTicket(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr]">
          {/* Ticket list */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading tickets...
              </div>
            ) : tickets.length === 0 ? (
              <Card className="p-8 text-center">
                <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No tickets yet. Create one to get started.</p>
              </Card>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                    selectedTicket?.id === ticket.id ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ticket.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{ticket.category} · {timeAgo(ticket.created_at)}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${statusColors[ticket.status || 'open']}`}>
                      <span className="mr-1">{statusIcons[ticket.status || 'open']}</span>
                      {ticket.status || 'open'}
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Conversation */}
          <div>
            {selectedTicket ? (
              <Card className="flex h-[calc(100vh-200px)] flex-col">
                <CardHeader className="flex-row items-center gap-3 border-b py-3">
                  <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setSelectedTicket(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1">
                    <CardTitle className="text-base">{selectedTicket.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">Ticket #{selectedTicket.id.slice(0, 8)} · {selectedTicket.category}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs ${statusColors[selectedTicket.status || 'open']}`}>
                    {statusIcons[selectedTicket.status || 'open']}
                    <span className="ml-1">{selectedTicket.status || 'open'}</span>
                  </Badge>
                </CardHeader>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg) => {
                    const isUser = msg.sender_type === 'user';
                    return (
                      <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}>
                          <p className="text-xs font-medium opacity-70 mb-1">
                            {isUser ? 'You' : 'Support'} · {timeAgo(msg.created_at)}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t p-3">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      rows={1}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      className="min-h-[44px] resize-none"
                    />
                    <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="icon" className="shrink-0">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="flex h-[calc(100vh-200px)] items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Select a ticket to view the conversation</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
