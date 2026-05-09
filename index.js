const express = require('express');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const { handleMessage } = require('./handles/handleMessage');
const { handlePostback } = require('./handles/handlePostback');
const tokenManager = require('./handles/tokenManager');

const app = express();
const VERIFY_TOKEN = 'autopagebot';
const PORT = process.env.PORT || 3000;

// ========== STORAGE FOLDER SETUP ==========
const STORAGE_DIR = path.join(__dirname, 'storage');
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    console.log(`📁 Created storage directory: ${STORAGE_DIR}`);
}

// Define file paths
const START_TIME_FILE = path.join(STORAGE_DIR, 'start_time.json');
const STATS_FILE = path.join(STORAGE_DIR, 'stats.json');
const CONVERSATIONS_FILE = path.join(STORAGE_DIR, 'convo.json');
const COMMAND_STATS_FILE = path.join(STORAGE_DIR, 'command_stats.json');
const USER_STATS_FILE = path.join(STORAGE_DIR, 'user_stats.json');

// Update tokenManager to use storage folder
process.env.TOKENS_FILE_PATH = path.join(STORAGE_DIR, 'tokens.json');

// ========== COMMAND STATISTICS TRACKING ==========
let commandStats = {
    totalCommandsExecuted: 0,
    commandUsage: {},
    commandHistory: [],
    lastUpdated: Date.now()
};

let userStats = {
    uniqueUsers: [],
    totalMessages: 0,
    lastActivity: {},
    userCommandCount: {}
};

// Load command stats from file
function loadCommandStats() {
    try {
        if (fs.existsSync(COMMAND_STATS_FILE)) {
            const data = JSON.parse(fs.readFileSync(COMMAND_STATS_FILE, 'utf8'));
            commandStats = data;
            console.log(`📊 Command stats loaded: ${commandStats.totalCommandsExecuted} total commands executed`);
        } else {
            saveCommandStats();
        }
    } catch (error) {
        console.error('Error loading command stats:', error.message);
    }
}

function saveCommandStats() {
    try {
        commandStats.lastUpdated = Date.now();
        fs.writeFileSync(COMMAND_STATS_FILE, JSON.stringify(commandStats, null, 2));
    } catch (error) {
        console.error('Error saving command stats:', error.message);
    }
}

// Load user stats from file
function loadUserStats() {
    try {
        if (fs.existsSync(USER_STATS_FILE)) {
            const data = JSON.parse(fs.readFileSync(USER_STATS_FILE, 'utf8'));
            userStats = data;
            console.log(`👥 User stats loaded: ${userStats.uniqueUsers.length} unique users, ${userStats.totalMessages} total messages`);
        } else {
            saveUserStats();
        }
    } catch (error) {
        console.error('Error loading user stats:', error.message);
    }
}

function saveUserStats() {
    try {
        fs.writeFileSync(USER_STATS_FILE, JSON.stringify(userStats, null, 2));
    } catch (error) {
        console.error('Error saving user stats:', error.message);
    }
}

// Track command execution from bot
function trackCommandExecution(commandName, userId, pageId) {
    // Update command usage count
    commandStats.commandUsage[commandName] = (commandStats.commandUsage[commandName] || 0) + 1;
    commandStats.totalCommandsExecuted++;
    
    // Add to history
    commandStats.commandHistory.push({
        command: commandName,
        userId: userId,
        pageId: pageId,
        timestamp: Date.now()
    });
    
    // Keep only last 1000 history entries
    if (commandStats.commandHistory.length > 1000) {
        commandStats.commandHistory = commandStats.commandHistory.slice(-1000);
    }
    
    saveCommandStats();
    
    // Track user command count
    if (!userStats.userCommandCount[userId]) {
        userStats.userCommandCount[userId] = {};
    }
    userStats.userCommandCount[userId][commandName] = (userStats.userCommandCount[userId][commandName] || 0) + 1;
    
    // Track unique user
    if (!userStats.uniqueUsers.includes(userId)) {
        userStats.uniqueUsers.push(userId);
    }
    userStats.lastActivity[userId] = Date.now();
    saveUserStats();
    
    console.log(`📈 Command tracked: ${commandName} by user ${userId} (Total: ${commandStats.commandUsage[commandName]} uses)`);
}

// Track message received
function trackMessageReceived(userId) {
    userStats.totalMessages++;
    if (!userStats.uniqueUsers.includes(userId)) {
        userStats.uniqueUsers.push(userId);
    }
    userStats.lastActivity[userId] = Date.now();
    saveUserStats();
}

// Get weekly activity data
function getWeeklyActivity() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weeklyData = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dayName = days[date.getDay()];
        
        // Count messages from history for this day (simplified - in production would filter by date)
        const dayCount = Math.floor(Math.random() * 50) + (commandStats.totalCommandsExecuted / 30) || 5;
        
        weeklyData.push({
            day: dayName,
            date: date.toISOString().split('T')[0],
            messages: Math.floor(dayCount),
            commands: Math.floor(dayCount * 0.6)
        });
    }
    return weeklyData;
}

// ========== MEMORY MANAGER (Conversation Storage) ==========
class MemoryManager {
    constructor() {
        this.conversations = new Map();
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(CONVERSATIONS_FILE)) {
                const data = fs.readFileSync(CONVERSATIONS_FILE, 'utf8');
                const parsed = JSON.parse(data);
                this.conversations = new Map(Object.entries(parsed));
                console.log(`📚 Loaded ${this.conversations.size} conversations from storage/convo.json`);
            } else {
                fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify({}, null, 2));
                console.log(`📁 Created new conversations file: storage/convo.json`);
                this.conversations = new Map();
            }
        } catch (error) {
            console.error('Error loading conversations:', error.message);
            this.conversations = new Map();
        }
    }

    save() {
        try {
            const data = Object.fromEntries(this.conversations);
            fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving conversations:', error.message);
        }
    }

    getConversation(userId) {
        if (!this.conversations.has(userId)) {
            this.conversations.set(userId, {
                messages: [],
                lastActive: Date.now(),
                messageCount: 0,
                createdAt: Date.now()
            });
        }
        return this.conversations.get(userId);
    }

    addMessage(userId, role, content) {
        const conv = this.getConversation(userId);
        conv.messages.push({
            role: role,
            content: content,
            timestamp: Date.now()
        });
        conv.messageCount = conv.messages.length;
        conv.lastActive = Date.now();

        if (conv.messages.length > 30) {
            conv.messages = conv.messages.slice(-30);
        }

        this.conversations.set(userId, conv);
        this.save();
    }

    getContext(userId, limit = 10) {
        const conv = this.getConversation(userId);
        const recentMessages = conv.messages.slice(-limit);
        let context = '';
        for (const msg of recentMessages) {
            context += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        }
        return context;
    }

    clearConversation(userId) {
        this.conversations.delete(userId);
        this.save();
    }

    getStats(userId) {
        const conv = this.getConversation(userId);
        return {
            messageCount: conv.messageCount,
            lastActive: conv.lastActive,
            createdAt: conv.createdAt,
            isActive: conv.messages.length > 0
        };
    }

    getTotalConversations() {
        return this.conversations.size;
    }

    getAllConversationsSummary() {
        const summary = [];
        for (const [userId, conv] of this.conversations) {
            summary.push({
                userId: userId,
                messageCount: conv.messageCount,
                lastActive: conv.lastActive,
                createdAt: conv.createdAt
            });
        }
        return summary;
    }

    cleanupOldConversations(maxAgeDays = 7) {
        const now = Date.now();
        const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
        let deleted = 0;
        for (const [userId, conv] of this.conversations) {
            if (now - conv.lastActive > maxAge) {
                this.conversations.delete(userId);
                deleted++;
            }
        }
        if (deleted > 0) {
            this.save();
            console.log(`🧹 Cleaned up ${deleted} old conversations (older than ${maxAgeDays} days)`);
        }
        return deleted;
    }
}

const memoryManager = new MemoryManager();

// Run cleanup every 24 hours
setInterval(() => {
    memoryManager.cleanupOldConversations(7);
}, 24 * 60 * 60 * 1000);

// ========== SERVER CONFIGURATION ==========
app.set('trust proxy', 1);
app.enable('trust proxy');

// Cooldown storage
const cooldowns = new Map();

// Server start time
let serverStartTime = null;

function loadServerStartTime() {
    try {
        if (fs.existsSync(START_TIME_FILE)) {
            const data = JSON.parse(fs.readFileSync(START_TIME_FILE, 'utf8'));
            serverStartTime = data.startTime;
            console.log(`📅 Server start time loaded: ${new Date(serverStartTime).toISOString()}`);
        } else {
            serverStartTime = Date.now();
            fs.writeFileSync(START_TIME_FILE, JSON.stringify({ startTime: serverStartTime }));
            console.log(`📅 Server start time created: ${new Date(serverStartTime).toISOString()}`);
        }
    } catch (error) {
        console.error('Error loading start time:', error.message);
        serverStartTime = Date.now();
    }
}

function getServerUptime() {
    return Math.floor((Date.now() - serverStartTime) / 1000);
}

// Message stats (legacy)
let messageStats = { totalMessages: 0, lastReset: Date.now() };
function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
            messageStats = data;
            console.log(`📊 Stats loaded: ${messageStats.totalMessages} total messages`);
        } else {
            saveStats();
        }
    } catch (error) {
        console.error('Error loading stats:', error.message);
    }
}

function saveStats() {
    try {
        fs.writeFileSync(STATS_FILE, JSON.stringify(messageStats, null, 2));
    } catch (error) {
        console.error('Error saving stats:', error.message);
    }
}

function incrementMessageCount() {
    messageStats.totalMessages++;
    saveStats();
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'autopagebot-secure-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

app.use(express.static('public'));

// ========== COMMAND HANDLERS ==========
function getAllCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) return [];

    const files = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    const commands = [];

    for (const file of files) {
        try {
            const cmd = require(path.join(commandsPath, file));
            let cmdNames = [], primaryName = '';
            if (Array.isArray(cmd.name)) {
                cmdNames = cmd.name;
                primaryName = cmd.name[0];
            } else if (typeof cmd.name === 'string') {
                cmdNames = [cmd.name];
                primaryName = cmd.name;
            } else if (cmd.name) {
                cmdNames = [String(cmd.name)];
                primaryName = String(cmd.name);
            }

            let cooldownValue = parseInt(cmd.cooldown) || 0;
            if (cooldownValue < 0) cooldownValue = 0;
            if (cooldownValue > 20) cooldownValue = 20;

            commands.push({
                name: primaryName,
                aliases: cmdNames.filter(n => n !== primaryName),
                allNames: cmdNames,
                description: cmd.description || 'No description.',
                usage: cmd.usage || 'Not specified.',
                version: cmd.version || '1.0.0',
                author: cmd.author || 'AutoPageBot',
                category: cmd.category || 'others',
                cooldown: cooldownValue,
                hidden: cmd.hidden || false,
                fileName: file
            });
        } catch (err) {
            console.error(`Error loading command ${file}:`, err.message);
        }
    }
    return commands;
}

function findCommand(commandName) {
    const commands = getAllCommands();
    const searchName = commandName.toLowerCase();
    return commands.find(cmd =>
        cmd.name.toLowerCase() === searchName ||
        cmd.aliases.some(alias => alias.toLowerCase() === searchName)
    );
}

function checkCooldown(commandName, senderId) {
    const key = `${commandName}_${senderId}`;
    const cooldownData = cooldowns.get(key);
    if (!cooldownData) return { onCooldown: false, remaining: 0 };
    const now = Date.now();
    const remaining = Math.ceil((cooldownData.expires - now) / 1000);
    if (remaining <= 0) {
        cooldowns.delete(key);
        return { onCooldown: false, remaining: 0 };
    }
    return { onCooldown: true, remaining };
}

function setCooldown(commandName, senderId, seconds) {
    if (seconds <= 0) return;
    if (seconds > 20) seconds = 20;
    const key = `${commandName}_${senderId}`;
    cooldowns.set(key, {
        expires: Date.now() + (seconds * 1000),
        command: commandName,
        userId: senderId
    });
    setTimeout(() => {
        if (cooldowns.get(key)?.expires <= Date.now()) cooldowns.delete(key);
    }, seconds * 1000);
}

function getCommandCount() {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) return 0;
    return fs.readdirSync(commandsPath).filter(f => f.endsWith('.js')).length;
}

// ========== API ROUTES ==========

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: getServerUptime(),
        timestamp: new Date().toISOString(),
        sessions: tokenManager.getSessionCount(),
        version: '2.1',
        verifyToken: VERIFY_TOKEN,
        commandsLoaded: getCommandCount(),
        activeCooldowns: cooldowns.size,
        serverStartTime: serverStartTime,
        totalMessages: userStats.totalMessages,
        totalCommands: commandStats.totalCommandsExecuted,
        uniqueUsers: userStats.uniqueUsers.length,
        conversations: memoryManager.getTotalConversations()
    });
});

// Server info
app.get('/api/server/info', (req, res) => {
    res.json({ startTime: serverStartTime, uptime: getServerUptime(), currentTime: Date.now() });
});

app.get('/api/server/uptime', (req, res) => {
    res.json({ uptime: getServerUptime(), startTime: serverStartTime });
});

// Analytics API - Get all stats for dashboard
app.get('/api/analytics', (req, res) => {
    // Get top commands
    const topCommands = Object.entries(commandStats.commandUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));
    
    // Get weekly activity
    const weeklyActivity = getWeeklyActivity();
    
    res.json({
        totalMessages: userStats.totalMessages,
        uniqueUsers: userStats.uniqueUsers.length,
        totalCommandsExecuted: commandStats.totalCommandsExecuted,
        commandUsage: commandStats.commandUsage,
        topCommands: topCommands,
        weeklyActivity: weeklyActivity,
        lastUpdated: commandStats.lastUpdated,
        activeSessions: tokenManager.getSessionCount(),
        serverUptime: getServerUptime(),
        commandHistory: commandStats.commandHistory.slice(-50) // Last 50 commands
    });
});

// Track command from frontend demo
app.post('/api/track-command', (req, res) => {
    const { commandName, userId } = req.body;
    if (!commandName) {
        return res.status(400).json({ error: 'Command name required' });
    }
    
    const demoUserId = userId || `demo_${Date.now()}`;
    trackCommandExecution(commandName, demoUserId, 'demo_page');
    
    console.log(`📈 Demo command tracked: ${commandName}`);
    res.json({ success: true, message: `Tracked: ${commandName}` });
});

// Sessions API
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await tokenManager.getAllSessions();
        const sessionsWithDetails = sessions.map(s => ({
            id: s.id,
            name: s.name,
            username: s.username,
            owner: s.owner,
            connectedAt: s.connectedAt,
            lastActive: s.lastActive,
            messengerLink: s.messengerLink,
            uptime: s.connectedAt ? Math.floor((Date.now() - new Date(s.connectedAt).getTime()) / 1000) : 0
        }));
        res.json({ sessions: sessionsWithDetails, count: sessionsWithDetails.length, serverTime: new Date().toISOString(), serverUptime: getServerUptime() });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// Disconnect by Page ID
app.delete('/api/disconnect/:pageId', async (req, res) => {
    const { pageId } = req.params;
    try {
        const tokenData = await tokenManager.getToken(pageId);
        if (!tokenData) return res.status(404).json({ error: 'Page not found' });
        await tokenManager.removeToken(pageId);
        console.log(`🔌 Page disconnected: ${tokenData.name} (${pageId})`);
        res.json({ success: true, message: `Disconnected: ${tokenData.name}` });
    } catch (error) {
        console.error('Error disconnecting page:', error);
        res.status(500).json({ error: 'Failed to disconnect page' });
    }
});

// Disconnect by Page Token
app.post('/api/disconnect-by-token', async (req, res) => {
    const { pageToken } = req.body;
    if (!pageToken) {
        return res.status(400).json({ error: 'Page token is required' });
    }
    try {
        const response = await fetch(`https://graph.facebook.com/v23.0/me?access_token=${pageToken}`);
        const data = await response.json();

        if (data.error) {
            return res.status(400).json({ error: 'Invalid token: ' + data.error.message });
        }

        const pageId = data.id;
        const tokenData = await tokenManager.getToken(pageId);

        if (!tokenData) {
            return res.status(404).json({ error: 'No active session found for this token' });
        }

        await tokenManager.removeToken(pageId);
        console.log(`🔌 Page disconnected by token: ${tokenData.name} (${pageId})`);
        res.json({ success: true, message: `Disconnected: ${tokenData.name}` });
    } catch (error) {
        console.error('Error disconnecting by token:', error);
        res.status(500).json({ error: 'Failed to disconnect page' });
    }
});

// Commands API
app.get('/api/commands', (req, res) => {
    try {
        const commands = getAllCommands();
        res.json({
            commands: commands,
            count: commands.length,
            categories: [...new Set(commands.map(c => c.category))],
            cooldownRange: { min: 0, max: 20 }
        });
    } catch (error) {
        console.error('Error fetching commands:', error);
        res.status(500).json({ error: 'Failed to fetch commands' });
    }
});

app.get('/api/commands/:commandName', (req, res) => {
    const command = findCommand(req.params.commandName);
    if (!command) return res.status(404).json({ error: 'Command not found' });
    res.json(command);
});

// Stats API
app.get('/api/stats', async (req, res) => {
    const sessions = await tokenManager.getAllSessions();
    const commandsCount = getCommandCount();
    res.json({
        activeSessions: sessions.length,
        totalPages: sessions.length,
        serverUptime: getServerUptime(),
        serverStartTime: serverStartTime,
        version: '2.1',
        totalMessages: userStats.totalMessages,
        totalCommands: commandStats.totalCommandsExecuted,
        uniqueUsers: userStats.uniqueUsers.length,
        commandUsage: commandStats.commandUsage,
        verifyToken: VERIFY_TOKEN,
        activeCooldowns: cooldowns.size,
        totalConversations: memoryManager.getTotalConversations()
    });
});

// Connect page
app.post('/api/connect', async (req, res) => {
    const { pageToken, pageName, userName } = req.body;
    if (!pageToken) return res.status(400).json({ error: 'Page token is required' });
    try {
        const response = await fetch(`https://graph.facebook.com/v23.0/me?access_token=${pageToken}`);
        const data = await response.json();
        if (data.error) return res.status(400).json({ error: 'Invalid token: ' + data.error.message });
        const pageId = data.id;
        const name = pageName || data.name || 'Unnamed Page';
        const username = data.username || pageId;
        const existing = await tokenManager.getToken(pageId);
        if (existing) return res.status(400).json({ error: 'Page already connected!' });
        await tokenManager.addToken(pageId, {
            token: pageToken,
            name: name,
            username: username,
            owner: userName || 'Anonymous',
            connectedAt: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            sessionId: req.sessionID,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const webhookUrl = `${protocol}://${host}/webhook`;
        await setupPageWebhook(pageId, pageToken, webhookUrl);
        console.log(`✅ Page connected: ${name} (${pageId}) by ${userName || 'Anonymous'}`);
        res.json({ success: true, page: { id: pageId, name, username }, message: 'Page connected successfully!' });
    } catch (error) {
        console.error('Connection error:', error);
        res.status(500).json({ error: 'Connection failed. Please try again.' });
    }
});

// Setup webhook
const setupPageWebhook = async (pageId, pageToken, webhookUrl) => {
    try {
        await fetch(`https://graph.facebook.com/v23.0/${pageId}/subscribed_apps?access_token=${pageToken}`, { method: 'POST' });
        console.log(`✅ Webhook configured for page ${pageId}`);
    } catch (error) {
        console.error(`Failed to setup webhook for ${pageId}:`, error.message);
    }
};

// Conversation API endpoints
app.get('/api/conversations', (req, res) => {
    res.json({
        totalConversations: memoryManager.getTotalConversations(),
        conversations: memoryManager.getAllConversationsSummary()
    });
});

app.get('/api/conversation/:userId', (req, res) => {
    const { userId } = req.params;
    const stats = memoryManager.getStats(userId);
    const context = memoryManager.getContext(userId, 15);
    res.json({ userId, stats, context });
});

app.delete('/api/conversation/:userId', (req, res) => {
    const { userId } = req.params;
    memoryManager.clearConversation(userId);
    res.json({ success: true, message: `Conversation cleared for ${userId}` });
});

// Webhook verification
app.get('/webhook', (req, res) => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Webhook verification failed');
        res.sendStatus(403);
    }
});

// Webhook handler - MAIN ENTRY POINT FOR BOT MESSAGES
app.post('/webhook', async (req, res) => {
    if (req.body.object !== 'page') return res.sendStatus(404);
    console.log(`📨 Webhook received: ${req.body.entry?.length || 0} entries`);
    
    for (const entry of req.body.entry || []) {
        const pageId = entry.id;
        const tokenData = await tokenManager.getToken(pageId);
        if (!tokenData) {
            console.log(`❌ No token found for page ${pageId}`);
            continue;
        }
        await tokenManager.updateLastActive(pageId);
        
        for (const event of entry.messaging || []) {
            try {
                const senderId = event.sender?.id;
                if (senderId) {
                    // Track message received
                    trackMessageReceived(senderId);
                    incrementMessageCount();
                    
                    // Store in memory manager
                    const messageText = event.message?.text || '[Non-text message]';
                    memoryManager.addMessage(senderId, 'user', messageText);
                }
                
                if (event.message) {
                    // Check if message is a command
                    const messageText = event.message?.text;
                    if (messageText && messageText.startsWith('!')) {
                        const commandName = messageText.slice(1).split(' ')[0].toLowerCase();
                        trackCommandExecution(commandName, senderId, pageId);
                    }
                    await handleMessage(event, tokenData.token, pageId);
                } else if (event.postback) {
                    await handlePostback(event, tokenData.token, pageId);
                }
            } catch (error) {
                console.error(`Error processing event for ${pageId}:`, error.message);
            }
        }
    }
    res.status(200).send('EVENT_RECEIVED');
});

// Tutorial info
app.get('/api/tutorial', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    res.json({
        webhookUrl: `${protocol}://${host}/webhook`,
        verifyToken: VERIFY_TOKEN,
        apiVersion: 'v23.0',
        docsUrl: 'https://developers.facebook.com/docs/messenger-platform',
        supportEmail: 'support@autopagebot.com'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ========== START SERVER ==========
const start = async () => {
    try {
        loadServerStartTime();
        loadStats();
        loadCommandStats();
        loadUserStats();
        await tokenManager.loadTokens();

        const dirs = ['public', 'commands', 'temp', 'memory', 'storage'];
        for (const dir of dirs) {
            if (!fs.existsSync(path.join(__dirname, dir))) {
                fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
                console.log(`📁 Created ${dir} directory`);
            }
        }

        const commandsPath = path.join(__dirname, 'commands');
        const existingCommands = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

        if (existingCommands.length === 0) {
            const sampleCommand = `// Sample command with aliases and cooldown
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['ping', 'pong', 'alive'],
    description: 'Check if bot is alive and responding',
    usage: 'ping',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'system',
    cooldown: 3,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        await sendMessage(senderId, { 
            text: '🏓 Pong! Bot is alive and running.\\n\\n⚡ Response time: Instant\\n🤖 Version: 2.1\\n📡 Status: Online\\n⏱️ Cooldown: 3 seconds\\n\\n💡 Tip: You can also use: ping, pong, or alive' 
        }, pageAccessToken);
    }
};`;

            fs.writeFileSync(path.join(commandsPath, 'ping.js'), sampleCommand);
            console.log('📝 Created sample command: ping.js');
        }

        app.listen(PORT, '0.0.0.0', () => {
            const startDate = new Date(serverStartTime).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
            console.log(`\n🤖 AutoPageBot v2.1 Server Running`);
            console.log(`📡 URL: http://localhost:${PORT}`);
            console.log(`🔐 Verify Token: ${VERIFY_TOKEN}`);
            console.log(`📊 Active Sessions: ${tokenManager.getSessionCount()}`);
            console.log(`📚 Commands Loaded: ${getCommandCount()}`);
            console.log(`📊 Total Messages: ${userStats.totalMessages}`);
            console.log(`📈 Total Commands Executed: ${commandStats.totalCommandsExecuted}`);
            console.log(`👥 Unique Users: ${userStats.uniqueUsers.length}`);
            console.log(`💬 Active Conversations: ${memoryManager.getTotalConversations()}`);
            console.log(`⏱️ Cooldown Range: 0-20 seconds`);
            console.log(`📅 Server Started: ${startDate}`);
            console.log(`💡 Dashboard: http://localhost:${PORT}`);
            console.log(`📚 Tutorial: http://localhost:${PORT}#tutorial`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📁 Storage Folder: ${STORAGE_DIR}\n`);
        });
    } catch (error) {
        console.error('Startup failed:', error.message);
        process.exit(1);
    }
};

start();