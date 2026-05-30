require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project-id.supabase.co') {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase connection initialized.');
} else {
    console.warn('WARNING: Supabase credentials are missing or default in .env file.');
}

// Local AI settings database fallback
const aiSettingsPath = path.join(__dirname, 'ai_settings.json');

function getLocalAiSettings(guildId) {
    try {
        if (fs.existsSync(aiSettingsPath)) {
            const data = fs.readFileSync(aiSettingsPath, 'utf8');
            const allSettings = JSON.parse(data || '{}');
            return allSettings[guildId] || {
                is_ai_enabled: false,
                ai_prompt: 'Tu es un hôte chaleureux. Accueille le membre {user} sur le serveur {guild} en français de façon amicale et créative.',
                ai_model: 'open-mistral-7b'
            };
        }
    } catch (err) {
        console.error('Error reading local AI settings:', err);
    }
    return {
        is_ai_enabled: false,
        ai_prompt: 'Tu es un hôte chaleureux. Accueille le membre {user} sur le serveur {guild} en français de façon amicale et créative.',
        ai_model: 'open-mistral-7b'
    };
}

function saveLocalAiSettings(guildId, settings) {
    try {
        let allSettings = {};
        if (fs.existsSync(aiSettingsPath)) {
            const data = fs.readFileSync(aiSettingsPath, 'utf8');
            allSettings = JSON.parse(data || '{}');
        }
        allSettings[guildId] = {
            is_ai_enabled: settings.is_ai_enabled === true || settings.is_ai_enabled === 'true',
            ai_prompt: settings.ai_prompt || 'Tu es un hôte chaleureux. Accueille le membre {user} sur le serveur {guild} en français de façon amicale et créative.',
            ai_model: settings.ai_model || 'open-mistral-7b'
        };
        fs.writeFileSync(aiSettingsPath, JSON.stringify(allSettings, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Error saving local AI settings:', err);
        return false;
    }
}

// Mistral AI API Utility
async function callMistralAI(prompt, model = 'open-mistral-7b') {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey || apiKey === 'your_mistral_api_key_here') {
        throw new Error('La clé MISTRAL_API_KEY n\'est pas configurée dans le fichier .env.');
    }

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 200
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erreur API Mistral AI: ${response.status} - ${errText}`);
    }

    const result = await response.json();
    if (result.choices && result.choices.length > 0) {
        return result.choices[0].message.content.trim();
    } else {
        throw new Error('Format de réponse invalide de l\'API Mistral AI.');
    }
}

// Export helper for bot.js
module.exports = { getLocalAiSettings, saveLocalAiSettings, callMistralAI };

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'welcomer_dashboard_secret_998877',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        secure: false // Set to true if running on HTTPS
    }
}));

// Express config
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Multer Storage Configuration for Custom Backgrounds
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, 'bg-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit 5MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed (jpeg, jpg, png, gif, webp).'));
    }
});

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    if (req.session && req.session.isAuthenticated) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized. Please login first.' });
    }
}

// Store a reference to the Discord client
let discordClient = null;

function startServer(client) {
    discordClient = client;
    
    app.listen(PORT, () => {
        console.log(`🚀 Configuration Dashboard running at http://localhost:${PORT}`);
    });
}

// ==================== AUTHENTICATION API ====================

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === 'admin' && password === '2006') {
        req.session.isAuthenticated = true;
        req.session.username = 'admin';
        return res.json({ success: true, message: 'Logged in successfully' });
    } else {
        return res.status(401).json({ error: 'Invalid username or password' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

app.get('/api/auth/check', (req, res) => {
    if (req.session && req.session.isAuthenticated) {
        res.json({ isAuthenticated: true, username: req.session.username });
    } else {
        res.json({ isAuthenticated: false });
    }
});

// ==================== CONFIGURATION API ====================

// Get config for a specific guild
app.get('/api/config/:guildId', requireAuth, async (req, res) => {
    const { guildId } = req.params;
    
    if (!supabase) {
        return res.status(503).json({ error: 'Database connection not initialized. Check your Supabase .env config.' });
    }
    
    try {
        const { data, error } = await supabase
            .from('welcomer_settings')
            .select('*')
            .eq('guild_id', guildId)
            .single();

        const localAi = getLocalAiSettings(guildId);
            
        if (error && error.code === 'PGRST116') {
            // No record found, return default settings structure
            return res.json({
                guild_id: guildId,
                channel_id: '',
                message_template: 'مرحباً بك {user} في السيرفر! يرجى الانتظار حتى يتم التحقق من حسابك. 🛡️',
                background_url: '/uploads/welcome-bg.png',
                text_color: '#dbc3ff',
                card_title: 'BIENVENUE',
                card_subtitle: 'Membre n°{count}',
                is_enabled: true,
                isNew: true,
                ...localAi
            });
        } else if (error) {
            throw error;
        }
        
        const responseData = {
            ...data,
            is_ai_enabled: data.is_ai_enabled !== undefined ? data.is_ai_enabled : localAi.is_ai_enabled,
            ai_prompt: data.ai_prompt !== undefined ? data.ai_prompt : localAi.ai_prompt,
            ai_model: data.ai_model !== undefined ? data.ai_model : localAi.ai_model
        };
        res.json(responseData);
    } catch (err) {
        console.error('Error fetching config:', err);
        res.status(500).json({ error: 'Failed to retrieve settings from database.' });
    }
});

// Update or create config
app.post('/api/config', requireAuth, async (req, res) => {
    const { guild_id, channel_id, message_template, background_url, text_color, card_title, card_subtitle, is_enabled, is_ai_enabled, ai_prompt, ai_model } = req.body;
    
    if (!guild_id) {
        return res.status(400).json({ error: 'Guild ID is required.' });
    }
    
    if (!supabase) {
        return res.status(503).json({ error: 'Database connection not initialized. Check your Supabase .env config.' });
    }
    
    try {
        let supabaseSuccess = false;
        let resultData = null;
        
        try {
            const { data, error } = await supabase
                .from('welcomer_settings')
                .upsert({
                    guild_id,
                    channel_id,
                    message_template,
                    background_url,
                    text_color,
                    card_title,
                    card_subtitle,
                    is_enabled,
                    is_ai_enabled: is_ai_enabled === true || is_ai_enabled === 'true',
                    ai_prompt,
                    ai_model
                })
                .select()
                .single();
                
            if (!error && data) {
                supabaseSuccess = true;
                resultData = data;
            }
        } catch (dbErr) {
            console.log('Notice: Could not write AI columns directly to Supabase. Using local JSON fallback storage.');
        }

        if (!supabaseSuccess) {
            // Save standard settings to Supabase
            const { data, error } = await supabase
                .from('welcomer_settings')
                .upsert({
                    guild_id,
                    channel_id,
                    message_template,
                    background_url,
                    text_color,
                    card_title,
                    card_subtitle,
                    is_enabled
                })
                .select()
                .single();
                
            if (error) throw error;
            
            // Save AI settings to local JSON fallback database
            saveLocalAiSettings(guild_id, { is_ai_enabled, ai_prompt, ai_model });
            
            resultData = {
                ...data,
                is_ai_enabled,
                ai_prompt,
                ai_model
            };
        } else {
            // Synchronize locally too so bot.js can access it quickly
            saveLocalAiSettings(guild_id, { is_ai_enabled, ai_prompt, ai_model });
        }

        res.json({ success: true, data: resultData });
    } catch (err) {
        console.error('Error updating config:', err);
        res.status(500).json({ error: 'Failed to save settings.' });
    }
});

// Upload image background
app.post('/api/config/upload', requireAuth, upload.single('background'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided.' });
    }
    
    // Return relative URL path
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
});

// POST /api/ai/generate-template
app.post('/api/ai/generate-template', requireAuth, async (req, res) => {
    const { prompt, model } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Une consigne (prompt) est requise pour générer le message.' });
    }
    
    try {
        const template = await callMistralAI(prompt, model || 'open-mistral-7b');
        res.json({ success: true, template });
    } catch (err) {
        console.error('Error generating template:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== DISCORD BOT INTEGRATION API ====================

// Get list of servers (guilds) and their channels the bot is in
app.get('/api/bot/guilds', requireAuth, (req, res) => {
    if (!discordClient || !discordClient.isReady()) {
        return res.status(503).json({ error: 'Discord bot client is not connected yet.' });
    }
    
    try {
        const guildsData = discordClient.guilds.cache.map(guild => {
            // Find text channels
            const channels = guild.channels.cache
                .filter(channel => channel.type === 0 || channel.type === 5) // Text or announcement channel
                .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                
            return {
                id: guild.id,
                name: guild.name,
                icon: guild.iconURL() || null,
                channels: channels
            };
        });
        
        res.json({ guilds: guildsData });
    } catch (err) {
        console.error('Error fetching Discord data:', err);
        res.status(500).json({ error: 'Failed to fetch Discord server list.' });
    }
});

// Trigger a test welcome card
app.post('/api/bot/test', requireAuth, async (req, res) => {
    const { guild_id, channel_id } = req.body;
    
    if (!discordClient || !discordClient.isReady()) {
        return res.status(503).json({ error: 'Discord bot client is not connected yet.' });
    }
    
    if (!guild_id || !channel_id) {
        return res.status(400).json({ error: 'Guild ID and Channel ID are required to send a test.' });
    }
    
    try {
        const guild = discordClient.guilds.cache.get(guild_id);
        if (!guild) {
            return res.status(404).json({ error: 'Bot is not in the specified guild.' });
        }
        
        const channel = guild.channels.cache.get(channel_id);
        if (!channel) {
            return res.status(404).json({ error: 'Specified channel does not exist in the guild.' });
        }
        
        // Import our welcoming card generator (we'll implement this in bot.js)
        const { sendWelcomeMessage } = require('./bot.js');
        
        // Simulating a dummy member using the client's own user (bot itself)
        const dummyMember = {
            guild: guild,
            user: discordClient.user,
            displayName: discordClient.user.username,
            toString: () => `<@${discordClient.user.id}>`
        };
        
        await sendWelcomeMessage(dummyMember, channel_id, true); // true for test mode
        res.json({ success: true, message: 'Test welcome message sent successfully!' });
    } catch (err) {
        console.error('Error sending test message:', err);
        res.status(500).json({ error: `Failed to send test: ${err.message}` });
    }
});

module.exports = { startServer };
