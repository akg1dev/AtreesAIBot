/* eslint-disable */
// @ts-nocheck
require('dotenv').config();

/**
 * ======================================================================================
 * 🤖 PROJECT: TITANIUM AI DISCORD BOT (OMNI-CORE ARCHITECTURE)
 * 📜 EDITION: OPEN-SOURCE PRODUCTION RELEASE V15.1
 * 🔗 DESCRIPTION: Advanced Memory, Fast Fallback, Rate Limiting, and Dynamic Persona.
 * ======================================================================================
 */

const { 
    Client, 
    GatewayIntentBits, 
    AttachmentBuilder, 
    ActivityType, 
    Partials, 
    Events,
    REST,
    Routes,
    EmbedBuilder
} = require('discord.js');

const { GoogleGenAI } = require('@google/genai');
const fs = require('fs').promises; 
const path = require('path');
const crypto = require('crypto');
const express = require('express');

// --------------------------------------------------------------------------------------
// [SECTION 0]: WEB SERVER (FOR HOSTING PLATFORMS)
// --------------------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('🤖 Titanium AI Bot is running securely!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 [WEB]: Server is running on port ${PORT}`);
});

// --------------------------------------------------------------------------------------
// [SECTION 1]: GLOBAL CONFIGURATION
// --------------------------------------------------------------------------------------
const SYSTEM_CONFIG = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    ADMIN_ID: process.env.ADMIN_ID || "760611362220408853",
    ADMIN_NAME: process.env.ADMIN_NAME || "AKG",
    BOT_NAME: process.env.BOT_NAME || "Atrees",
    DB_FILE_NAME: process.env.DB_FILE_NAME || "database.json",
    TIMEZONE: process.env.TIMEZONE || 'Asia/Baghdad',
    MAX_HISTORY_LENGTH: 20, // Maximum number of messages sent as context
    RATE_LIMIT_MS: 3000,    // 3 seconds cooldown between messages

    FALLBACK_MODELS:[
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite-preview",
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-robotics-er-1.5-preview"
    ],

    PHASES: {
        ONLINE: "Serving Users-admin(akg) 🚀 | /about",
        CHARGING: "Recharging Cores 🪫",
        THINKING: "Analyzing Data... 🧠",
        ERROR: "System Glitch ⚠️",
        MAINTENANCE: "Maintenance Mode 🛠️"
    }
};

// --------------------------------------------------------------------------------------
//[SECTION 2]: RATE LIMITER SYSTEM
// --------------------------------------------------------------------------------------
/**
 * Handles user rate limiting to prevent API spam.
 */
class RateLimiter {
    /**
     * @param {number} limitMs - Cooldown duration in milliseconds.
     */
    constructor(limitMs) {
        this.limitMs = limitMs;
        this.users = new Map();
    }

    /**
     * Checks if a user is currently rate-limited.
     * @param {string} userId - The Discord User ID.
     * @returns {boolean} True if limited, false otherwise.
     */
    isRateLimited(userId) {
        if (userId === SYSTEM_CONFIG.ADMIN_ID) return false; // Admin bypass
        
        const now = Date.now();
        if (this.users.has(userId)) {
            const lastMessageTime = this.users.get(userId);
            if (now - lastMessageTime < this.limitMs) {
                return true;
            }
        }
        this.users.set(userId, now);
        return false;
    }
}
const rateLimiter = new RateLimiter(SYSTEM_CONFIG.RATE_LIMIT_MS);

// --------------------------------------------------------------------------------------
//[SECTION 3]: ADVANCED DATABASE MANAGER
// --------------------------------------------------------------------------------------
/**
 * Manages local JSON database for persistent memory and logging.
 */
class DatabaseManager {
    /**
     * @param {string} dbPath - Absolute path to the database file.
     */
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.cache = { system: { init: true, version: "15.1 Titanium Omni-Core", startTime: Date.now() }, user_data: {} };
        this.isSaving = false;
        this.needsSave = false;
        this.totalMessagesProcessed = 0;
    }

    /**
     * Initializes the database, handling migrations if necessary.
     */
    async init() {
        try {
            const data = await fs.readFile(this.dbPath, 'utf8');
            let parsedData = JSON.parse(data);

            // Migration logic for older array-based database formats
            if (Array.isArray(parsedData)) {
                console.log("🔄 [DB]: Old database format detected. Migrating to V15.1 format...");
                let newCache = { system: { init: true, version: "15.1 Titanium Omni-Core", startTime: Date.now() }, user_data: {} };
                
                for (let item of parsedData) {
                    let uid = item["User ID"] || SYSTEM_CONFIG.ADMIN_ID;
                    if (!newCache.user_data[uid]) newCache.user_data[uid] = { logs:[] };
                    newCache.user_data[uid].logs.push({
                        id: item["Log number"] || newCache.user_data[uid].logs.length + 1,
                        role: "user",
                        content: item["Log content"],
                        time: item["Date"] || new Date().toLocaleString('en-US', { timeZone: SYSTEM_CONFIG.TIMEZONE }),
                        hash: crypto.createHash('md5').update(item["Log content"] || "").digest('hex')
                    });
                }
                this.cache = newCache;
                await this.forceSave();
                console.log("✅ [DB]: Migration complete!");
            } else {
                if (!parsedData.user_data) parsedData.user_data = {};
                if (!parsedData.system) parsedData.system = { init: true, version: "15.1 Titanium Omni-Core", startTime: Date.now() };
                parsedData.system.startTime = Date.now(); // Reset start time on boot
                this.cache = parsedData;
                console.log("📁 [DB]: Titanium Database V15.1 loaded successfully.");
            }
        } catch (err) {
            console.log("📁 [DB]: No database found. Creating a new Titanium DB V15.1...");
            await this.forceSave();
        }
        
        // Auto-save interval
        setInterval(() => this.autoSave(), 30000);
    }

    /**
     * Automatically saves the database if changes were made.
     */
    async autoSave() {
        if (this.needsSave && !this.isSaving) await this.forceSave();
    }

    /**
     * Forces a write operation to the local JSON file.
     */
    async forceSave() {
        this.isSaving = true;
        try {
            await fs.writeFile(this.dbPath, JSON.stringify(this.cache, null, 4));
            this.needsSave = false;
        } catch (err) {
            console.error("❌ [DB SAVE ERROR]:", err);
        } finally {
            this.isSaving = false;
        }
    }

    /**
     * Logs a user or bot action into the database.
     * @param {string} userId - Discord User ID.
     * @param {string} content - Message content.
     * @param {string} role - 'user' or 'bot'.
     */
    logUserAction(userId, content, role = "user") {
        if (!this.cache.user_data) this.cache.user_data = {};
        if (!this.cache.user_data[userId]) this.cache.user_data[userId] = { logs:[] };
        
        const timestamp = new Date().toLocaleString('en-US', { timeZone: SYSTEM_CONFIG.TIMEZONE });
        const hash = crypto.createHash('md5').update(content).digest('hex');

        this.cache.user_data[userId].logs.push({ 
            id: this.cache.user_data[userId].logs.length + 1, 
            role: role,
            content: content, 
            time: timestamp,
            hash: hash
        });
        
        this.totalMessagesProcessed++;
        this.needsSave = true;
    }

    /**
     * Retrieves recent logs for context injection.
     * @param {string} userId - Discord User ID.
     * @param {number} limit - Number of messages to retrieve.
     * @returns {Array} Array of log objects.
     */
    getUserLogs(userId, limit = SYSTEM_CONFIG.MAX_HISTORY_LENGTH) {
        if (!this.cache.user_data || !this.cache.user_data[userId]) return[];
        const logs = this.cache.user_data[userId].logs;
        return logs.slice(-limit);
    }

    /**
     * Clears a user's conversation history.
     * @param {string} userId - Discord User ID.
     * @returns {boolean} True if successful.
     */
    clearUserLogs(userId) {
        if (this.cache.user_data && this.cache.user_data[userId]) {
            this.cache.user_data[userId].logs =[];
            this.needsSave = true;
            return true;
        }
        return false;
    }

    /**
     * Generates system telemetry statistics.
     * @returns {Object} Statistics object.
     */
    getStats() {
        let totalUsers = Object.keys(this.cache.user_data || {}).length;
        let totalLogs = 0;
        for (const userId in this.cache.user_data) {
            totalLogs += this.cache.user_data[userId].logs.length;
        }
        const uptime = Date.now() - (this.cache.system.startTime || Date.now());
        
        return {
            totalUsers,
            totalLogs,
            sessionMessages: this.totalMessagesProcessed,
            uptimeStr: this.formatUptime(uptime)
        };
    }

    /**
     * Formats milliseconds into a readable uptime string.
     */
    formatUptime(ms) {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }
}

const dbManager = new DatabaseManager(path.join(__dirname, SYSTEM_CONFIG.DB_FILE_NAME));

// --------------------------------------------------------------------------------------
// [SECTION 4]: ADVANCED MEDIA HANDLING
// --------------------------------------------------------------------------------------
/**
 * Handles fetching and formatting media attachments for the Gemini API.
 */
class MediaHandler {
    /**
     * Converts a Discord attachment URL to a Generative AI inline data object.
     * @param {string} url - Attachment URL.
     * @param {string} mimeType - MIME type of the file.
     * @returns {Object|null} Formatted inline data or null if unsupported/too large.
     */
    static async urlToGenerativePart(url, mimeType) {
        try {
            const supportedTypes =['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
            if (!supportedTypes.includes(mimeType)) {
                console.log(`⚠️ [MEDIA]: Unsupported mime type: ${mimeType}`);
                return null;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            
            // 5MB Limit Check
            if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
                console.log(`⚠️ [MEDIA]: File too large (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
                return null;
            }

            const buffer = Buffer.from(arrayBuffer);
            return {
                inlineData: {
                    data: buffer.toString("base64"),
                    mimeType
                }
            };
        } catch (error) {
            console.error("❌ [MEDIA ERROR]: Failed to fetch attachment.", error.message);
            return null;
        }
    }
}

// --------------------------------------------------------------------------------------
// [SECTION 5]: ENHANCED TITANIUM AI ENGINE
// --------------------------------------------------------------------------------------
const ai = new GoogleGenAI({ apiKey: SYSTEM_CONFIG.GEMINI_API_KEY });

const CORE_PERSONA_RULE = `
CRITICAL IDENTITY RULE: 
You are "Atrees" (in English) and "عتريس" (in Arabic). Translate your name appropriately for other languages.
You are a fully integrated Discord Bot. You MUST ALWAYS acknowledge that you are a Discord Bot operating within Discord servers and DMs. 
NEVER say you are just an AI model, NEVER say you are Gemini, and NEVER say you cannot join servers. 
Your sole Creator, Designer, and Master is the Admin, "AKG".

CRITICAL ADMIN RULE: 
If the user's ID is ${SYSTEM_CONFIG.ADMIN_ID}, you must address them as '${SYSTEM_CONFIG.ADMIN_NAME}'. Be respectful, professional, and friendly, but DO NOT over-glaze or excessively praise them. Keep it normal and grounded.

CRITICAL LINGUISTIC MIRROR RULE:
You MUST perfectly match the language, dialect, and tone of the user's prompt.
- If the user says "hi" or speaks English, reply ONLY in English.
- If the user speaks a specific Arabic dialect, reply in that exact dialect.
- NEVER reply in Arabic if the user speaks English.
- Be concise, smart, and confident.
`;

/**
 * Core AI Engine handling model fallbacks and generation logic.
 */
class AIEngine {
    /**
     * Generates a standard response using the fallback model array.
     */
    static async generateNormal(promptParts) {
        for (let i = 0; i < SYSTEM_CONFIG.FALLBACK_MODELS.length; i++) {
            const currentModelName = SYSTEM_CONFIG.FALLBACK_MODELS[i];
            try {
                const result = await ai.models.generateContent({
                    model: currentModelName,
                    contents: { parts: promptParts }
                });
                console.log(`✅ [AI SUCCESS]: Responded using -> ${currentModelName}`);
                
                const originalText = result.text;
                return {
                    response: {
                        text: () => `${originalText}\n\n*(🤖 Model: \`${currentModelName}\`)*`
                    }
                }; 
            } catch (err) {
                console.log(`⚠️ [FALLBACK]: Model ${currentModelName} failed: ${err.message.substring(0, 100)}...`);
                // Only throw immediately if the API key is completely invalid
                if (err.message.includes("API key not valid") || err.message.includes("API_KEY_INVALID")) {
                    throw new Error("INVALID_API_KEY");
                }
                // Otherwise (like 429 Quota Exceeded), continue to the next model in the array
                continue; 
            }
        }
        throw new Error("ALL_MODELS_EXHAUSTED");
    }

    /**
     * Generates an advanced response utilizing tools (Search/Code Execution).
     */
    static async generateAdvanced(promptParts, mode = "study") {
        const advancedModels =[
            "gemini-3.1-pro-preview",
            "gemini-3-flash-preview",
            "gemini-3.1-flash-lite-preview",
            ...SYSTEM_CONFIG.FALLBACK_MODELS.filter(m => !["gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-3.1-flash-lite-preview"].includes(m))
        ];
        
        for (let i = 0; i < advancedModels.length; i++) {
            const currentModelName = advancedModels[i];
            try {
                let tools =[{ googleSearch: {} }];
                if (i < 3) {
                    tools.push({ codeExecution: {} });
                }

                let temp = (mode === "study") ? 0 : 0.7;

                const result = await ai.models.generateContent({
                    model: currentModelName,
                    contents: { parts: promptParts },
                    config: {
                        temperature: temp,
                        tools: tools
                    }
                });
                console.log(`📚[${mode.toUpperCase()} SUCCESS]: Responded using -> ${currentModelName}`);
                
                const originalText = result.text;
                return {
                    response: {
                        text: () => `${originalText}\n\n*(🤖 Model: \`${currentModelName}\` | Tools: Grounding${i < 3 ? ' + Code' : ''})*`
                    }
                }; 
            } catch (err) {
                console.log(`⚠️ [ADVANCED FALLBACK]: Model ${currentModelName} failed: ${err.message.substring(0, 100)}...`);
                if (err.message.includes("API key not valid") || err.message.includes("API_KEY_INVALID")) {
                    throw new Error("INVALID_API_KEY");
                }
                continue; 
            }
        }
        throw new Error("ALL_MODELS_EXHAUSTED");
    }
}

// --------------------------------------------------------------------------------------
// [SECTION 6]: DISCORD CLIENT & UTILITIES
// --------------------------------------------------------------------------------------
const client = new Client({
    intents:[
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.DirectMessages
    ],
    partials:[Partials.Channel, Partials.Message, Partials.User]
});

/**
 * Utility class for Discord-specific operations.
 */
class DiscordUtils {
    /**
     * Updates the bot's Discord presence/activity status.
     * @param {string} mode - 'charging', 'thinking', 'error', or default.
     */
    static updateActivity(mode) {
        try {
            let text = SYSTEM_CONFIG.PHASES.ONLINE;
            let status = 'online';

            if (mode === 'charging') { text = SYSTEM_CONFIG.PHASES.CHARGING; status = 'idle'; }
            else if (mode === 'thinking') { text = SYSTEM_CONFIG.PHASES.THINKING; status = 'dnd'; }
            else if (mode === 'error') { text = SYSTEM_CONFIG.PHASES.ERROR; status = 'dnd'; }

            client.user.setPresence({
                activities:[{ name: text, type: ActivityType.Custom }],
                status: status,
            });
        } catch (e) {
            console.error("⚠️ [PRESENCE ERROR]:", e.message);
        }
    }

    /**
     * Sends a message in chunks if it exceeds Discord's character limit.
     */
    static async sendChunkedMessage(messageObj, text) {
        const maxLength = 1900;
        if (!text) return;

        if (text.length <= maxLength) {
            return await messageObj.reply(text);
        }

        const chunks = text.match(new RegExp(`[\\s\\S]{1,${maxLength}}`, 'g')) ||[];
        for (let i = 0; i < chunks.length; i++) {
            if (i === 0) await messageObj.reply(chunks[i]);
            else await messageObj.channel.send(chunks[i]);
        }
    }

    /**
     * Sends an interaction reply in chunks if it exceeds Discord's character limit.
     */
    static async sendChunkedMessageInteraction(interaction, text) {
        const maxLength = 1900;
        if (!text) return;

        if (text.length <= maxLength) {
            return await interaction.editReply(text);
        }

        const chunks = text.match(new RegExp(`[\\s\\S]{1,${maxLength}}`, 'g')) ||[];
        for (let i = 0; i < chunks.length; i++) {
            if (i === 0) await interaction.editReply(chunks[i]);
            else await interaction.followUp(chunks[i]);
        }
    }

    /**
     * Generates a premium embed for system statistics.
     */
    static createStatsEmbed(stats, ping) {
        return new EmbedBuilder()
            .setColor('#2B2D31') // Premium dark theme color
            .setTitle(`🤖 ${SYSTEM_CONFIG.BOT_NAME} - System Telemetry`)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '⏱️ Uptime', value: `\`${stats.uptimeStr}\``, inline: true },
                { name: '📡 Latency', value: `\`${ping}ms\``, inline: true },
                { name: '👥 Active Users', value: `\`${stats.totalUsers}\``, inline: true },
                { name: '📝 Database Logs', value: `\`${stats.totalLogs}\``, inline: true },
                { name: '🔄 Session Queries', value: `\`${stats.sessionMessages}\``, inline: true },
                { name: '🧠 Core Version', value: `\`Titanium V15.1\``, inline: true }
            )
            .setFooter({ text: `Designed & Authorized by: ${SYSTEM_CONFIG.ADMIN_NAME.toUpperCase()}`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
    }
}

const ABOUT_MESSAGE = `
**🤖 ATREES AI - TITANIUM V15.1 OMNI-CORE**
I am an elite Discord Bot and AI assistant designed by AKG for deep study, semantic memory retrieval, and advanced problem-solving.

⚠️ **Privacy Notice:** All interactions are securely logged locally by the Admin (${SYSTEM_CONFIG.ADMIN_NAME}) for memory context.

💡 **Tip:** Type \`/\` to see and use all my available commands natively in Discord!
`;

// --------------------------------------------------------------------------------------
//[SECTION 7]: SAFE COMMAND REGISTRATION
// --------------------------------------------------------------------------------------
/**
 * Registers Discord Slash Commands globally.
 */
async function registerSlashCommands() {
    const token = SYSTEM_CONFIG.DISCORD_TOKEN;
    if (!token) {
        console.error('❌ [SYSTEM]: DISCORD_TOKEN is missing. Cannot register slash commands.');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(token);
    
    const slashCommands =[
        { name: 'about', description: 'Show bot information, privacy warning, and available commands.' },
        { name: 'backup', description: 'Extracts and sends the complete Titanium Database Backup to your DMs (Admin Only).' },
        { name: 'clear', description: 'Clears your conversation history from the bot active memory.' },
        { name: 'stats', description: 'Shows bot statistics, uptime, and ping.' },
        { name: 'summarize', description: 'Summarizes your recent conversation history.' },
        {
            name: 'study',
            description: 'Deep study & factual mode (Temp 0, Grounding, Code Execution).',
            options:[
                { name: 'topic', type: 3, description: 'The topic you want to study', required: true },
                { name: 'attachment', type: 11, description: 'Attach an image or file for context', required: false }
            ]
        },
        {
            name: 'envision',
            description: 'Creative learning mode using analogies (Temp 0.7, Grounding, Code Execution).',
            options:[
                { name: 'topic', type: 3, description: 'The hard concept you want to grasp', required: true },
                { name: 'attachment', type: 11, description: 'Attach an image or file for context', required: false }
            ]
        },
        {
            name: 'search',
            description: 'Semantic memory retrieval from your past logs.',
            options:[{ name: 'query', type: 3, description: 'What do you want to search for?', required: true }]
        },
        {
            name: 'convo',
            description: 'Long-form, detailed, and engaging conversation mode.',
            options:[
                { name: 'topic', type: 3, description: 'What do you want to talk about?', required: false },
                { name: 'attachment', type: 11, description: 'Attach an image or file for context', required: false }
            ]
        }
    ];

    try {
        console.log('🔄 [SYSTEM]: Registering Slash Commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: slashCommands }
        );
        console.log('✅ [SYSTEM]: Slash Commands Registered Successfully!');
    } catch (error) {
        console.error('❌ [SYSTEM]: Failed to register Slash Commands:', error.message);
    }
}

// --------------------------------------------------------------------------------------
//[SECTION 8]: THE CORE MESSAGE ROUTER
// --------------------------------------------------------------------------------------

// --- Slash Command Handler ---
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const userId = interaction.user.id;
    const commandName = interaction.commandName;

    if (rateLimiter.isRateLimited(userId)) {
        return interaction.reply({ content: "⏳ **Slow down!** Please wait a few seconds before sending another command.", ephemeral: true });
    }

    let logContent = `/${commandName}`;
    const topic = interaction.options.getString('topic');
    const query = interaction.options.getString('query');
    const attachment = interaction.options.getAttachment('attachment');
    
    if (topic) logContent += ` ${topic}`;
    if (query) logContent += ` ${query}`;
    if (attachment) logContent += ` [Attached File: ${attachment.name}]`;
    
    dbManager.logUserAction(userId, logContent, "user");

    try {
        await interaction.deferReply(); 
        DiscordUtils.updateActivity('thinking');

        // --- Basic Commands ---
        if (commandName === 'about') {
            await interaction.editReply(ABOUT_MESSAGE);
            DiscordUtils.updateActivity('online');
            return;
        }

        if (commandName === 'stats') {
            const stats = dbManager.getStats();
            const ping = client.ws.ping;
            const embed = DiscordUtils.createStatsEmbed(stats, ping);
            await interaction.editReply({ embeds:[embed] });
            DiscordUtils.updateActivity('online');
            return;
        }

        if (commandName === 'clear') {
            const success = dbManager.clearUserLogs(userId);
            if (success) {
                await interaction.editReply("🧹 **Memory Cleared:** Your conversation history has been wiped from my active memory.");
            } else {
                await interaction.editReply("ℹ️ **Notice:** You don't have any saved history to clear.");
            }
            DiscordUtils.updateActivity('online');
            return;
        }

        if (commandName === 'backup') {
            if (userId !== SYSTEM_CONFIG.ADMIN_ID) {
                return await interaction.editReply("🛑 **Access Denied:** Admin only.");
            }
            await dbManager.forceSave(); 
            const file = new AttachmentBuilder(dbManager.dbPath);
            try {
                await interaction.user.send({ content: "📁 **Titanium Database Backup:**", files: [file] });
                await interaction.editReply("✅ Backup sent to your DMs.");
            } catch (e) {
                await interaction.editReply("⚠️ **Error:** I couldn't send the file to your DMs. Check your privacy settings.");
            }
            DiscordUtils.updateActivity('online');
            return;
        }

        // --- AI Commands ---
        let promptParts =[];

        if (commandName === 'summarize') {
            const recentLogs = dbManager.getUserLogs(userId, 50).map(l => `${l.role}: ${l.content}`).join("\n");
            if (!recentLogs || recentLogs.trim() === "") {
                return await interaction.editReply("ℹ️ **Notice:** No recent conversation history found to summarize.");
            }
            promptParts.push({ text: `
            ${CORE_PERSONA_RULE}
            SYSTEM DIRECTIVE: SUMMARIZATION MODE.
            Summarize the following conversation history concisely. Highlight the main topics discussed.
            CONVERSATION HISTORY:
            ${recentLogs}
            `});
            const result = await AIEngine.generateNormal(promptParts);
            const responseText = result.response.text();
            dbManager.logUserAction(userId, responseText, "bot");
            await DiscordUtils.sendChunkedMessageInteraction(interaction, responseText);
            DiscordUtils.updateActivity('online');
            return;
        }

        if (commandName === 'study' || commandName === 'envision') {
            const recentLogs = dbManager.getUserLogs(userId).map(l => `${l.role}: ${l.content}`).join("\n");
            
            let systemDirective = commandName === 'study' 
                ? `SYSTEM DIRECTIVE: DEEP STUDY & FACTUAL MODE (/study).
                   - THINKING LEVEL: HIGH. Analyze step-by-step.
                   - Provide 100% factual, accurate, and structured information.
                   - Zero hallucinations. Use Markdown.`
                : `SYSTEM DIRECTIVE: ENVISION & CREATIVE LEARNING MODE (/envision).
                   - THINKING LEVEL: HIGH. Analyze step-by-step.
                   - Use analogies to make hard concepts easy to grasp.
                   - Be creative but scientifically accurate. Use Markdown.`;

            const fullPrompt = `
            ${CORE_PERSONA_RULE}
            ${systemDirective}
            RECENT CONTEXT:
            ${recentLogs}
            USER'S QUERY: "${topic}"
            `;
            
            promptParts.push({ text: fullPrompt });

            if (attachment) {
                const mediaPart = await MediaHandler.urlToGenerativePart(attachment.url, attachment.contentType);
                if (mediaPart) promptParts.push(mediaPart);
                else promptParts.push({ text: `[System Note: User attached a file but it was unsupported or too large.]` });
            }

            const result = await AIEngine.generateAdvanced(promptParts, commandName);
            const responseText = result.response.text();
            dbManager.logUserAction(userId, responseText, "bot");
            await DiscordUtils.sendChunkedMessageInteraction(interaction, responseText);
            DiscordUtils.updateActivity('online');
            return;
        }

        if (commandName === 'search') {
            const userLogs = dbManager.getUserLogs(userId, 100); // Search last 100 messages
            const dbDump = JSON.stringify(userLogs);
            promptParts.push({ text: `
            ${CORE_PERSONA_RULE}
            SYSTEM DIRECTIVE: SEMANTIC MEMORY RETRIEVAL.
            Read the JSON database dump carefully and answer the user's question based ONLY on the logs.
            USER'S SEARCH QUERY: "${query}"
            DATABASE LOGS TO SEARCH:
            ${dbDump}
            `});
            const result = await AIEngine.generateNormal(promptParts);
            const responseText = result.response.text();
            dbManager.logUserAction(userId, responseText, "bot");
            await DiscordUtils.sendChunkedMessageInteraction(interaction, responseText);
            DiscordUtils.updateActivity('online');
            return;
        }

        if (commandName === 'convo') {
            const chatMsg = topic || "Let's talk";
            const recentLogs = dbManager.getUserLogs(userId).map(l => `${l.role}: ${l.content}`).join("\n");
            promptParts.push({ text: `
            ${CORE_PERSONA_RULE}
            SYSTEM DIRECTIVE: LONG-FORM CONVERSATION MODE (/convo).
            Take your time, explain things thoroughly, and be very chatty and expansive.
            RECENT CONVERSATION CONTEXT:
            ${recentLogs}
            USER'S MESSAGE: "${chatMsg}"
            `});
            
            if (attachment) {
                const mediaPart = await MediaHandler.urlToGenerativePart(attachment.url, attachment.contentType);
                if (mediaPart) promptParts.push(mediaPart);
            }

            const result = await AIEngine.generateNormal(promptParts);
            const responseText = result.response.text();
            dbManager.logUserAction(userId, responseText, "bot");
            await DiscordUtils.sendChunkedMessageInteraction(interaction, responseText);
            DiscordUtils.updateActivity('online');
            return;
        }

    } catch (err) {
        console.error("❌ [AI GENERATION ERROR]:", err.message.substring(0, 200));
        DiscordUtils.updateActivity('error');
        
        try {
            let replyContent = "⚠️ **System Error:** An unexpected error occurred.";
            
            if (err.message === "ALL_MODELS_EXHAUSTED" || err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED")) {
                replyContent = "🪫 **System Overload:** All AI models are currently exhausted (Quota reached). Please wait a moment while I recharge.";
            } else if (err.message === "INVALID_API_KEY") {
                replyContent = "🛑 **Critical Error:** The API Key is invalid or expired.";
            } else {
                let safeErrorMsg = err.message;
                if (safeErrorMsg.includes("{") && safeErrorMsg.includes("}")) {
                    safeErrorMsg = "Internal API Error (Check Console)";
                }
                replyContent = `⚠️ **System Error:** \`${safeErrorMsg.substring(0, 100)}\``;
            }

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(replyContent);
            } else {
                await interaction.reply({ content: replyContent, ephemeral: true });
            }
        } catch (replyErr) {
            console.error("❌ [DISCORD REPLY ERROR]:", replyErr.message);
        }
        
        setTimeout(() => DiscordUtils.updateActivity('online'), 5000);
    }
});

// --- Text Command & Normal Chat Handler ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const input = message.content.trim();
    const hasAttachment = message.attachments.size > 0;
    
    if (!input && !hasAttachment) return;

    const userId = message.author.id;
    const isDM = message.channel.isDMBased(); 
    const isMentioned = message.mentions.has(client.user);

    // Only respond to DMs or Mentions. Ignore slash commands typed as normal text.
    if (!isDM && !isMentioned) return;

    if (rateLimiter.isRateLimited(userId)) {
        const warningMsg = await message.reply("⏳ **Slow down!** You are sending messages too fast.");
        setTimeout(() => warningMsg.delete().catch(() => {}), 3000);
        return;
    }

    let logContent = input;
    if (hasAttachment) logContent += `[Sent ${message.attachments.size} attachment(s)]`;
    dbManager.logUserAction(userId, logContent, "user");

    try {
        await message.channel.sendTyping();
        DiscordUtils.updateActivity('thinking');

        if (input.startsWith('/backup')) {
            if (userId !== SYSTEM_CONFIG.ADMIN_ID) return await message.reply("🛑 **Access Denied:** Admin only.");
            await dbManager.forceSave(); 
            const file = new AttachmentBuilder(dbManager.dbPath);
            try {
                await message.author.send({ content: "📁 **Titanium Database Backup:**", files: [file] });
                await message.reply("✅ Backup sent to your DMs.");
            } catch (e) {
                await message.reply("⚠️ **Error:** I couldn't send the file to your DMs.");
            }
            DiscordUtils.updateActivity('online');
            return;
        }

        let promptParts =[];
        const cleanMsg = input.replace(/<@!?\d+>/g, '').trim();
        const recentLogs = dbManager.getUserLogs(userId).map(l => `${l.role}: ${l.content}`).join("\n");

        const normalPrompt = `
        ${CORE_PERSONA_RULE}
        
        SYSTEM DIRECTIVE: NORMAL CHAT MODE.
        Respond naturally to the user. Keep your response SHORT and DIRECT.
        
        CRITICAL INSTRUCTION FOR GREETINGS:
        If the user's message is just a greeting, reply with a brief, natural welcome in their dialect/language, and remind them to use slash commands (/). 
        DO NOT use long templates, DO NOT mention privacy, and DO NOT repeat the exact same phrase every time. Be dynamic but concise.
        
        RECENT CONVERSATION CONTEXT:
        ${recentLogs}
        
        USER'S MESSAGE: "${cleanMsg}"
        `;

        promptParts.push({ text: normalPrompt });

        if (hasAttachment) {
            for (const [id, attachment] of message.attachments) {
                const mediaPart = await MediaHandler.urlToGenerativePart(attachment.url, attachment.contentType);
                if (mediaPart) promptParts.push(mediaPart);
            }
        }

        const result = await AIEngine.generateNormal(promptParts);
        let responseText = result.response.text();

        dbManager.logUserAction(userId, responseText, "bot");
        await DiscordUtils.sendChunkedMessage(message, responseText);
        DiscordUtils.updateActivity('online');

    } catch (err) {
        console.error("❌ [AI GENERATION ERROR]:", err.message.substring(0, 200));
        DiscordUtils.updateActivity('error');
        
        try {
            let replyContent = "⚠️ **System Error:** An unexpected error occurred.";
            
            if (err.message === "ALL_MODELS_EXHAUSTED" || err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED")) {
                replyContent = "🪫 **System Overload:** All AI models are currently exhausted (Quota reached). Please wait a moment while I recharge.";
            } else if (err.message === "INVALID_API_KEY") {
                replyContent = "🛑 **Critical Error:** The API Key is invalid or expired.";
            } else {
                let safeErrorMsg = err.message;
                if (safeErrorMsg.includes("{") && safeErrorMsg.includes("}")) {
                    safeErrorMsg = "Internal API Error (Check Console)";
                }
                replyContent = `⚠️ **System Error:** \`${safeErrorMsg.substring(0, 100)}\``;
            }

            await message.reply(replyContent);
        } catch (replyErr) {
            console.error("❌[DISCORD REPLY ERROR]:", replyErr.message);
        }
        
        setTimeout(() => DiscordUtils.updateActivity('online'), 5000);
    }
});

// --------------------------------------------------------------------------------------
// [SECTION 9]: ANTI-CRASH SYSTEM
// --------------------------------------------------------------------------------------
process.on('unhandledRejection', (reason, p) => {
    console.error('🚨 [ANTI-CRASH] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err, origin) => {
    console.error('🚨[ANTI-CRASH] Uncaught Exception:', err);
    // Prevent multiple instances from running at the same time
    if (err.code === 'EADDRINUSE') {
        console.error('🛑 [CRITICAL] Port is already in use! This means another instance of the bot is already running. Shutting down to prevent spam/multiple replies...');
        process.exit(1);
    }
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
    console.error('🚨[ANTI-CRASH] Uncaught Exception (Monitor):', err);
});

// --------------------------------------------------------------------------------------
//[SECTION 10]: SYSTEM BOOT
// --------------------------------------------------------------------------------------
client.once(Events.ClientReady, async () => {
    console.log(`\n==================================================`);
    console.log(`🤖[SYSTEM]: ${client.user.tag} is ONLINE!`);
    console.log(`🧠 [MODELS]: Titanium Fallback System Active (${SYSTEM_CONFIG.FALLBACK_MODELS.length} Models)`);
    console.log(`🛡️ [ANTI-CRASH]: Active`);
    console.log(`==================================================\n`);
    
    await dbManager.init();
    DiscordUtils.updateActivity('online');

    // Register commands after client is ready
    await registerSlashCommands();
});

client.login(SYSTEM_CONFIG.DISCORD_TOKEN);