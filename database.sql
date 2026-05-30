-- Database Setup for Discord Welcomer Bot
-- Execute these SQL queries in your Supabase SQL Editor (found in Dashboard > SQL Editor > New query).

-- 1. Create the welcomer_settings table with customizable card text options
CREATE TABLE IF NOT EXISTS welcomer_settings (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT,
    message_template TEXT DEFAULT 'مرحباً بك {user} في السيرفر! يرجى الانتظار حتى يتم التحقق من حسابك. 🛡️',
    background_url TEXT DEFAULT '/uploads/welcome-bg.png',
    text_color TEXT DEFAULT '#dbc3ff',
    card_title TEXT DEFAULT 'BIENVENUE',
    card_subtitle TEXT DEFAULT 'Membre n°{count}',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE welcomer_settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all actions
CREATE POLICY "Allow all access to settings" ON welcomer_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. Trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_welcomer_settings_modtime
    BEFORE UPDATE ON welcomer_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
