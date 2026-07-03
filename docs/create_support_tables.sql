-- Manual script to create support system tables
-- Run this in your Supabase SQL editor if the tables don't exist

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    user_id UUID NOT NULL,
    assigned_to UUID,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    attachments TEXT[],
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create support_messages table
CREATE TABLE IF NOT EXISTS support_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    sender_id UUID NOT NULL,
    sender_type TEXT CHECK (sender_type IN ('user', 'admin')) NOT NULL,
    attachments TEXT[],
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create support_notifications table
CREATE TABLE IF NOT EXISTS support_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT CHECK (type IN ('new_ticket', 'new_message', 'status_change', 'assignment', 'rating')) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID,
    admin_id UUID,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_support_notifications_user_id ON support_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_support_notifications_admin_id ON support_notifications(admin_id);
CREATE INDEX IF NOT EXISTS idx_support_notifications_ticket_id ON support_notifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_notifications_read ON support_notifications(read);
CREATE INDEX IF NOT EXISTS idx_support_notifications_created_at ON support_notifications(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
DROP POLICY IF EXISTS "Users can view their own tickets" ON support_tickets;
CREATE POLICY "Users can view their own tickets" ON support_tickets
    FOR SELECT USING (
        auth.uid() = user_id OR 
        (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
    );

DROP POLICY IF EXISTS "Users can insert their own tickets" ON support_tickets;
CREATE POLICY "Users can insert their own tickets" ON support_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tickets" ON support_tickets;
CREATE POLICY "Users can update their own tickets" ON support_tickets
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
    );

-- RLS Policies for support_messages
DROP POLICY IF EXISTS "Users can view messages for their tickets" ON support_messages;
CREATE POLICY "Users can view messages for their tickets" ON support_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM support_tickets 
            WHERE support_tickets.id = support_messages.ticket_id 
            AND (support_tickets.user_id = auth.uid() OR 
                 (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true)
        )
    );

DROP POLICY IF EXISTS "Users can insert messages for their tickets" ON support_messages;
CREATE POLICY "Users can insert messages for their tickets" ON support_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM support_tickets 
            WHERE support_tickets.id = support_messages.ticket_id 
            AND (support_tickets.user_id = auth.uid() OR 
                 (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true)
        )
    );

-- RLS Policies for support_notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON support_notifications;
CREATE POLICY "Users can view their own notifications" ON support_notifications
    FOR SELECT USING (
        auth.uid() = user_id OR 
        auth.uid() = admin_id OR 
        (admin_id IS NULL AND (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true)
    );

DROP POLICY IF EXISTS "System can insert notifications" ON support_notifications;
CREATE POLICY "System can insert notifications" ON support_notifications
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own notifications" ON support_notifications;
CREATE POLICY "Users can update their own notifications" ON support_notifications
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        auth.uid() = admin_id OR 
        (admin_id IS NULL AND (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true)
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at 
    BEFORE UPDATE ON support_tickets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing (optional)
-- Uncomment the lines below if you want some test data

-- INSERT INTO support_tickets (title, description, category, priority, user_id) VALUES
-- ('Test Ticket 1', 'This is a test support ticket for demonstration', 'Technical Issue', 'medium', auth.uid()),
-- ('Test Ticket 2', 'Another test ticket to verify the system works', 'Feature Request', 'low', auth.uid());

SELECT 'Support system tables created successfully!' AS message;