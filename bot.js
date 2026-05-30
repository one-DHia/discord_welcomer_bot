require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project-id.supabase.co') {
    supabase = createClient(supabaseUrl, supabaseKey);
}

// Create Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ],
    partials: [Partials.GuildMember]
});

// Start bot function
function startBot() {
    const token = process.env.DISCORD_TOKEN;
    if (!token || token === 'your_discord_bot_token_here') {
        console.error('❌ DISCORD_TOKEN is missing or default in .env file. Please configure your bot token.');
        return;
    }
    
    client.login(token);
}

// Ready handler: registers Slash commands
client.once('ready', async () => {
    console.log(`🤖 Bot Discord connecté en tant que ${client.user.tag}`);
    
    const clientId = client.user.id;

    try {
        const commands = [
            new SlashCommandBuilder()
                .setName('welcomer-test')
                .setDescription('Envoie un message de bienvenue de test dans le salon configuré.'),
            new SlashCommandBuilder()
                .setName('welcomer-info')
                .setDescription('Affiche la configuration actuelle du module Welcomer de ce serveur.'),
            new SlashCommandBuilder()
                .setName('ask-ai')
                .setDescription('Posez une question en direct à Mistral AI !')
                .addStringOption(option => 
                    option.setName('question')
                        .setDescription('La question à poser à l\'IA.')
                        .setRequired(true))
        ].map(command => command.toJSON());

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        
        console.log('🔄 Enregistrement des commandes (/) globales...');
        
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        
        console.log('✅ Commandes (/) enregistrées avec succès !');
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement des commandes :', error);
    }
});

// Interaction handler for Slash commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId, guild } = interaction;

    if (!guildId) {
        return interaction.reply({ content: 'Cette commande doit être exécutée sur un serveur.', ephemeral: true });
    }

    if (commandName === 'welcomer-test') {
        await interaction.deferReply({ ephemeral: true });
        
        if (!supabase) {
            return interaction.editReply('Base de données Supabase non connectée. Veuillez configurer le fichier `.env`.');
        }

        try {
            // Load settings
            const { data: settings, error } = await supabase
                .from('welcomer_settings')
                .select('*')
                .eq('guild_id', guildId)
                .single();

            if (error || !settings) {
                return interaction.editReply('Configuration Welcomer introuvable pour ce serveur. Configurez-la via le dashboard d\'abord !');
            }

            if (!settings.channel_id) {
                return interaction.editReply('Le salon de réception n\'est pas configuré.');
            }

            // Trigger test welcome message
            const success = await sendWelcomeMessage(interaction.member, settings.channel_id, true);
            
            if (success) {
                return interaction.editReply(`Message de test envoyé avec succès dans <#${settings.channel_id}> !`);
            } else {
                return interaction.editReply('Impossible d\'envoyer le message de test. Vérifiez les permissions du bot dans le salon.');
            }
        } catch (err) {
            console.error(err);
            return interaction.editReply(`Une erreur est survenue lors du test : ${err.message}`);
        }
    }

    if (commandName === 'welcomer-info') {
        if (!supabase) {
            return interaction.reply({ content: 'Base de données Supabase non configurée.', ephemeral: true });
        }

        try {
            const { data: settings, error } = await supabase
                .from('welcomer_settings')
                .select('*')
                .eq('guild_id', guildId)
                .single();

            const embed = new EmbedBuilder()
                .setTitle(`ℹ️ Configuration Welcomer - ${guild.name}`)
                .setColor('#7289da')
                .setThumbnail(guild.iconURL())
                .setTimestamp();

            if (error || !settings) {
                embed.setDescription('Le module de bienvenue n\'est pas encore configuré sur ce serveur.\nConfigurez-le via votre dashboard web.');
            } else {
                embed.addFields(
                    { name: 'Statut du module', value: settings.is_enabled ? '🟢 Activé' : '🔴 Désactivé', inline: true },
                    { name: 'Salon de réception', value: settings.channel_id ? `<#${settings.channel_id}>` : '❌ Non configuré', inline: true },
                    { name: 'Couleur du texte', value: `\`${settings.text_color || '#ffffff'}\``, inline: true },
                    { name: 'Message texte', value: `\`\`\`${settings.message_template || 'Aucun'}\`\`\`` },
                    { name: 'Image de fond', value: settings.background_url ? `[Lien de l'image](${settings.background_url.startsWith('/') ? 'http://localhost:3000' + settings.background_url : settings.background_url})` : 'Par défaut (Dégradé premium)' }
                );
            }

            return interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: 'Erreur lors de la récupération des infos.', ephemeral: true });
        }
    }

    if (commandName === 'ask-ai') {
        const question = interaction.options.getString('question');
        await interaction.deferReply();
        
        try {
            console.log(`🧠 Command /ask-ai processed. Question: "${question}"`);
            const answer = await callMistralAI(question, 'open-mistral-7b');
            
            const embed = new EmbedBuilder()
                .setTitle('🧠 Réponse de l\'IA')
                .setColor('#9b5de5')
                .addFields(
                    { name: '❓ Question', value: question.length > 1024 ? question.substring(0, 1021) + '...' : question },
                    { name: '💬 Réponse', value: answer.length > 1024 ? answer.substring(0, 1021) + '...' : answer }
                )
                .setFooter({ text: 'Propulsé par Mistral AI' })
                .setTimestamp();
                
            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Error in ask-ai command handler:', err);
            await interaction.editReply({ content: `❌ Impossible d'obtenir une réponse de l'IA : ${err.message}` });
        }
    }
});

// Event Handler: new user joins the guild
client.on('guildMemberAdd', async (member) => {
    const guildId = member.guild.id;
    let channelId = process.env.WELCOME_CHANNEL_ID;
    
    // Attempt to load from Supabase if connected
    if (supabase) {
        try {
            const { data: settings, error } = await supabase
                .from('welcomer_settings')
                .select('*')
                .eq('guild_id', guildId)
                .single();

            if (!error && settings && settings.is_enabled) {
                if (settings.channel_id) channelId = settings.channel_id;
            }
        } catch (err) {
            console.error('Error fetching settings from Supabase in guildMemberAdd:', err);
        }
    }
    
    // Fallback: search for a welcome/bienvenue/ترحيب/التحقق channel if no channel ID is set
    if (!channelId || channelId === 'your_welcome_channel_id_here' || channelId.trim() === '') {
        const fallbackChannel = member.guild.channels.cache.find(c => 
            (c.type === 0 || c.type === 5) && 
            (c.name.includes('welcome') || 
             c.name.includes('bienvenue') || 
             c.name.includes('ترحيب') || 
             c.name.includes('الترحيب') || 
             c.name.includes('التحقق') || 
             c.name.includes('verification'))
        );
        if (fallbackChannel) {
            channelId = fallbackChannel.id;
        } else {
            // Last fallback: use the system channel or first text channel
            const firstChannel = member.guild.channels.cache.find(c => c.type === 0);
            if (firstChannel) channelId = firstChannel.id;
        }
    }
    
    if (!channelId) {
        console.error('Could not find a welcome channel to send greeting.');
        return;
    }
    
    try {
        await sendWelcomeMessage(member, channelId, false);
    } catch (err) {
        console.error('Error handling guildMemberAdd:', err);
    }
});

/**
 * Renders the welcome card and sends it to the specified channel
 * @param {GuildMember} member The member joining
 * @param {string} channelId The channel target ID
 * @param {boolean} isTest Whether this is a test simulation or a real user join
 */
async function sendWelcomeMessage(member, channelId, isTest = false) {
    try {
        const guild = member.guild;
        const channel = guild.channels.cache.get(channelId);
        
        if (!channel) {
            console.error(`Channel ${channelId} not found in guild ${guild.id}`);
            return false;
        }

        // Default Arabic settings as requested (ignoring database if needed, fallback-first)
        let settings = {
            message_template: 'مرحباً بك {user} في السيرفر! يرجى الانتظار حتى يتم التحقق من حسابك. 🛡️',
            text_color: '#dbc3ff',
            background_url: '/uploads/welcome-bg.png' // Using the copied starry cloud welcome background!
        };
        const localAi = getLocalAiSettings(guild.id);
        let aiSettings = {
            is_ai_enabled: localAi.is_ai_enabled,
            ai_prompt: localAi.ai_prompt,
            ai_model: localAi.ai_model
        };

        if (supabase) {
            try {
                const { data } = await supabase
                    .from('welcomer_settings')
                    .select('*')
                    .eq('guild_id', guild.id)
                    .single();
                if (data) {
                    // Override default settings with Supabase if present
                    if (data.message_template) settings.message_template = data.message_template;
                    if (data.text_color) settings.text_color = data.text_color;
                    if (data.background_url) settings.background_url = data.background_url;
                    
                    // Supabase columns for AI (if they exist)
                    if (data.is_ai_enabled !== undefined) aiSettings.is_ai_enabled = data.is_ai_enabled;
                    if (data.ai_prompt !== undefined) aiSettings.ai_prompt = data.ai_prompt;
                    if (data.ai_model !== undefined) aiSettings.ai_model = data.ai_model;
                }
            } catch (dbErr) {
                console.warn('Could not read Supabase settings, using default configurations.', dbErr);
            }
        }

        // 1. Build and Format the welcome message text
        let formattedMsg = '';
        if (aiSettings.is_ai_enabled) {
            console.log(`🧠 Génération du message d'accueil IA (Mistral - ${aiSettings.ai_model}) pour le membre ${member.user ? member.user.username : member.displayName}...`);
            formattedMsg = await generateAIWelcomeMessage(member, aiSettings.ai_prompt, aiSettings.ai_model);
            
            if (!formattedMsg) {
                console.warn('La génération par IA a retourné un résultat vide. Fallback sur le message statique.');
                formattedMsg = formatStaticTemplate(settings.message_template, member, guild, isTest);
            }
        } else {
            formattedMsg = formatStaticTemplate(settings.message_template, member, guild, isTest);
        }

        // 2. Generate the Canvas Card Buffer
        const canvasBuffer = await generateWelcomeCard(member, settings, isTest);
        const attachment = new AttachmentBuilder(canvasBuffer, { name: 'welcome-card.png' });

        // 3. Send message with attachment
        await channel.send({
            content: formattedMsg,
            files: [attachment]
        });

        return true;
    } catch (err) {
        console.error('Error generating or sending welcome card:', err);
        return false;
    }
}

/**
 * Draws avatar and styling on canvas and returns a PNG buffer
 */
async function generateWelcomeCard(member, settings, isTest = false) {
    const canvas = createCanvas(900, 400);
    const ctx = canvas.getContext('2d');
    
    // A. Draw background
    let bgImg = null;
    const bgUrl = settings.background_url || '/uploads/welcome-bg.png';
    
    try {
        if (bgUrl.startsWith('/uploads/')) {
            // Local background path - resolve correctly
            const localPath = path.join(__dirname, bgUrl);
            if (fs.existsSync(localPath)) {
                bgImg = await loadImage(localPath);
            }
        } else if (bgUrl.startsWith('http')) {
            // Remote image URL
            bgImg = await loadImage(bgUrl);
        }
    } catch (err) {
        console.error('Error loading welcome background image in canvas:', err);
    }
    
    if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, 900, 400);
    } else {
        // Fallback elegant dark gradient
        const grad = ctx.createLinearGradient(0, 0, 900, 400);
        grad.addColorStop(0, '#11121d');
        grad.addColorStop(0.5, '#1e1f2f');
        grad.addColorStop(1, '#0a0b10');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 900, 400);
    }
    
    // Check if we are using our special starry moon welcome-bg.png image
    const isSpecialBg = bgUrl.includes('welcome-bg.png');
    
    if (isSpecialBg) {
        // --- CUSTOM PREMIUM SIDE-BY-SIDE LAYOUT FOR WELCOME-BG.PNG ---
        // This avoids overlapping the gorgeous pixelated 'WELCOME' text in the center!
        
        // 1. Draw a subtle dark card backdrop on the left side to highlight the user details
        ctx.fillStyle = 'rgba(10, 11, 16, 0.45)';
        ctx.beginPath();
        ctx.roundRect(40, 40, 320, 320, 20);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(155, 93, 229, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(40, 40, 320, 320, 20);
        ctx.stroke();
        
        // 2. Setup Avatar details
        const avatarUrl = isTest 
            ? 'https://cdn.discordapp.com/embed/avatars/0.png' 
            : member.user.displayAvatarURL({ extension: 'png', size: 256 });
            
        const avatarX = 200;
        const avatarY = 145;
        const radius = 55;
        
        // Avatar border outer glow
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = '#9b5de5'; // Purple glow to match neon theme
        ctx.fill();
        ctx.restore();
        
        // Clip avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
        ctx.clip();
        
        try {
            const avatarImg = await loadImage(avatarUrl);
            ctx.drawImage(avatarImg, avatarX - radius, avatarY - radius, radius * 2, radius * 2);
        } catch (err) {
            console.error('Error loading user avatar in canvas:', err);
            ctx.fillStyle = '#2b2d31';
            ctx.fillRect(avatarX - radius, avatarY - radius, radius * 2, radius * 2);
        }
        ctx.restore();
        
        // 3. User name & Tag below avatar on the left
        const username = isTest ? member.displayName : member.user.username;
        const discriminator = isTest ? '' : (member.user.discriminator !== '0' && member.user.discriminator !== '0000' ? `#${member.user.discriminator}` : '');
        const userTag = `${username}${discriminator}`;
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Format customizable title (Default is the username tag)
        const rawCardTitle = settings.card_title || '{tag}';
        const formattedCardTitle = rawCardTitle
            .replace(/{user}/g, username)
            .replace(/{tag}/g, userTag)
            .replace(/{guild}/g, member.guild.name)
            .replace(/{count}/g, isTest ? '42' : member.guild.memberCount.toString());

        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = settings.text_color || '#dbc3ff';
        ctx.fillText(formattedCardTitle, 200, 240);
        
        // Format customizable subtitle (Default is Member count)
        const rawCardSubtitle = settings.card_subtitle || 'Membre n°{count}';
        const formattedCardSubtitle = rawCardSubtitle
            .replace(/{user}/g, username)
            .replace(/{tag}/g, userTag)
            .replace(/{guild}/g, member.guild.name)
            .replace(/{count}/g, isTest ? '42' : member.guild.memberCount.toString());

        ctx.font = '500 16px Arial';
        ctx.fillStyle = '#b7b9d2';
        ctx.fillText(formattedCardSubtitle, 200, 280);
        
        // Draw Verification prompt
        ctx.font = 'bold 15px Arial';
        ctx.fillStyle = '#e9d5ff';
        ctx.fillText('يرجى انتظار التحقق 🛡️', 200, 315);
        
        // D. Elegant glowing outer card borders
        const borderGrad = ctx.createLinearGradient(0, 0, 900, 400);
        borderGrad.addColorStop(0, '#7289da');
        borderGrad.addColorStop(1, '#9b5de5');
        ctx.strokeStyle = borderGrad;
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, 900, 400);
        
    } else {
        // --- STANDARD CENTERED LAYOUT ---
        // B. Darken the image with an overlay for supreme readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 900, 400);
        
        // C. Elegant glowing outer card borders
        const borderGrad = ctx.createLinearGradient(0, 0, 900, 400);
        borderGrad.addColorStop(0, '#7289da');
        borderGrad.addColorStop(1, '#9b5de5');
        ctx.strokeStyle = borderGrad;
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, 900, 400);
        
        // D. Member avatar setup
        const avatarUrl = isTest 
            ? 'https://cdn.discordapp.com/embed/avatars/0.png' 
            : member.user.displayAvatarURL({ extension: 'png', size: 256 });
            
        const avatarX = 450;
        const avatarY = 135;
        const radius = 60;
        
        // Avatar border outline glow
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = '#7289da';
        ctx.fill();
        ctx.restore();
        
        // Clip avatar circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
        ctx.clip();
        
        try {
            const avatarImg = await loadImage(avatarUrl);
            ctx.drawImage(avatarImg, avatarX - radius, avatarY - radius, radius * 2, radius * 2);
        } catch (err) {
            console.error('Error loading user avatar in canvas:', err);
            ctx.fillStyle = '#2b2d31';
            ctx.fillRect(avatarX - radius, avatarY - radius, radius * 2, radius * 2);
        }
        ctx.restore();
        
        // E. Draw Text elements
        const username = isTest ? member.displayName : member.user.username;
        const discriminator = isTest ? '' : (member.user.discriminator !== '0' && member.user.discriminator !== '0000' ? `#${member.user.discriminator}` : '');
        const userTag = `${username}${discriminator}`;

        // Header BIENVENUE / Custom
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const rawCardTitle = settings.card_title || 'BIENVENUE';
        const formattedCardTitle = rawCardTitle
            .replace(/{user}/g, username)
            .replace(/{tag}/g, userTag)
            .replace(/{guild}/g, member.guild.name)
            .replace(/{count}/g, isTest ? '42' : member.guild.memberCount.toString());

        ctx.font = '800 32px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(formattedCardTitle, 450, 245);
        
        // Member user username (in middle)
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = settings.text_color || '#ffffff';
        ctx.fillText(userTag, 450, 290);
        
        // Subtitle (Default: Membre n°{count})
        const rawCardSubtitle = settings.card_subtitle || 'Membre n°{count}';
        const formattedCardSubtitle = rawCardSubtitle
            .replace(/{user}/g, username)
            .replace(/{tag}/g, userTag)
            .replace(/{guild}/g, member.guild.name)
            .replace(/{count}/g, isTest ? '42' : member.guild.memberCount.toString());

        ctx.font = '500 18px Arial';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(formattedCardSubtitle, 450, 335);
    }
    
    return canvas.toBuffer('image/png');
}

// Local AI settings database fallback for bot
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
        console.error('Error reading local AI settings in bot:', err);
    }
    return {
        is_ai_enabled: false,
        ai_prompt: 'Tu es un hôte chaleureux. Accueille le membre {user} sur le serveur {guild} en français de façon amicale et créative.',
        ai_model: 'open-mistral-7b'
    };
}

// Mistral AI API Utility for bot
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

// Format static message template helper
function formatStaticTemplate(template, member, guild, isTest) {
    return template
        .replace(/{user}/g, member.toString())
        .replace(/{tag}/g, isTest ? 'NouveauMembre' : `${member.user.username}`)
        .replace(/{guild}/g, guild.name)
        .replace(/{count}/g, isTest ? '42' : guild.memberCount.toString());
}

// Generate dynamic AI Welcome Message
async function generateAIWelcomeMessage(member, promptText, model) {
    try {
        const username = member.user ? member.user.username : member.displayName;
        const guildName = member.guild.name;
        const count = member.guild.memberCount;
        const userTag = member.user ? `${member.user.username}` : member.displayName;
        
        const formattedPrompt = promptText
            .replace(/{user}/g, `@${username}`)
            .replace(/{tag}/g, userTag)
            .replace(/{guild}/g, guildName)
            .replace(/{count}/g, count.toString());
            
        const systemPrompt = `${formattedPrompt}\n\nCONSIGNE STRICTE : Rédige uniquement le message d'accueil à envoyer au membre. Reste court (maximum 2 phrases). Utilise des emojis. Ne mets aucun titre, aucune formalité superflue et adresse-toi directement à lui par sa mention ou son nom.`;
        
        return await callMistralAI(systemPrompt, model);
    } catch (err) {
        console.error('Error generating AI welcome message:', err);
        return null;
    }
}

module.exports = { startBot, client, sendWelcomeMessage };
