const { readFile, writeFile } = require('fs/promises');
const fs = require('fs');
const path = require('path');

// Use storage folder for tokens
const STORAGE_DIR = path.join(__dirname, '../storage');
const TOKENS_FILE = path.join(STORAGE_DIR, 'tokens.json');
const STATS_FILE = path.join(STORAGE_DIR, 'stats.json');

let pageTokens = new Map();
let totalMessages = 0;

const loadTokens = async () => {
    try {
        // Ensure storage directory exists
        if (!fs.existsSync(STORAGE_DIR)) {
            fs.mkdirSync(STORAGE_DIR, { recursive: true });
        }

        const data = await readFile(TOKENS_FILE, 'utf8').catch(() => '{}');
        const tokens = JSON.parse(data);

        for (const [pageId, tokenData] of Object.entries(tokens)) {
            pageTokens.set(pageId, tokenData);
        }

        console.log(`✅ Loaded ${pageTokens.size} page tokens from ${TOKENS_FILE}`);
        return pageTokens;
    } catch (error) {
        console.error('Error loading tokens:', error.message);
        return new Map();
    }
};

const saveTokens = async () => {
    try {
        const tokens = Object.fromEntries(pageTokens);
        await writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2));
        console.log(`💾 Saved ${pageTokens.size} tokens to disk`);
    } catch (error) {
        console.error('Error saving tokens:', error.message);
    }
};

const loadStats = async () => {
    try {
        const data = await readFile(STATS_FILE, 'utf8').catch(() => '{}');
        const stats = JSON.parse(data);
        totalMessages = stats.totalMessages || 0;
        console.log(`📊 Loaded stats: ${totalMessages} total messages`);
    } catch (error) {
        console.error('Error loading stats:', error.message);
    }
};

const saveStats = async () => {
    try {
        await writeFile(STATS_FILE, JSON.stringify({ totalMessages }, null, 2));
    } catch (error) {
        console.error('Error saving stats:', error.message);
    }
};

const addToken = async (pageId, tokenData) => {
    // Ensure connectedAt is set
    if (!tokenData.connectedAt) {
        tokenData.connectedAt = new Date().toISOString();
    }
    if (!tokenData.lastActive) {
        tokenData.lastActive = new Date().toISOString();
    }
    
    pageTokens.set(pageId, tokenData);
    await saveTokens();
    console.log(`✅ Added token for: ${tokenData.name} (${pageId})`);
};

const getToken = async (pageId) => {
    const token = pageTokens.get(pageId);
    if (token) {
        // Update lastActive when token is accessed
        token.lastActive = new Date().toISOString();
        pageTokens.set(pageId, token);
        await saveTokens();
    }
    return token;
};

const getAllSessions = async () => {
    const sessions = [];
    for (const [pageId, data] of pageTokens.entries()) {
        sessions.push({
            id: pageId,
            name: data.name,
            username: data.username,
            owner: data.owner,
            lastActive: data.lastActive,
            connectedAt: data.connectedAt,
            messengerLink: `https://m.me/${pageId}`,
            ip: data.ip,
            userAgent: data.userAgent,
            token: data.token,
            status: getSessionStatus(data.lastActive)
        });
    }
    // Sort by connectedAt (newest first)
    sessions.sort((a, b) => new Date(b.connectedAt) - new Date(a.connectedAt));
    return sessions;
};

// Helper function to get session status
const getSessionStatus = (lastActive) => {
    if (!lastActive) return 'unknown';
    const lastActiveTime = new Date(lastActive).getTime();
    const now = Date.now();
    const diffMinutes = (now - lastActiveTime) / 1000 / 60;
    
    if (diffMinutes < 1) return 'online';
    if (diffMinutes < 5) return 'active';
    if (diffMinutes < 30) return 'idle';
    return 'inactive';
};

// Get uptime for a specific bot in seconds
const getBotUptime = async (pageId) => {
    const token = pageTokens.get(pageId);
    if (!token || !token.connectedAt) return 0;
    
    const connectedTime = new Date(token.connectedAt).getTime();
    const now = Date.now();
    return Math.floor((now - connectedTime) / 1000);
};

// Get all bots with their uptime
const getAllBotsWithUptime = async () => {
    const bots = [];
    for (const [pageId, data] of pageTokens.entries()) {
        const uptime = await getBotUptime(pageId);
        bots.push({
            id: pageId,
            name: data.name,
            username: data.username,
            owner: data.owner,
            connectedAt: data.connectedAt,
            lastActive: data.lastActive,
            uptime: uptime,
            uptimeFormatted: formatUptime(uptime),
            status: getSessionStatus(data.lastActive),
            messengerLink: `https://m.me/${pageId}`
        });
    }
    return bots;
};

// Format uptime helper
const formatUptime = (seconds) => {
    if (seconds < 0) seconds = 0;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
};

const updateLastActive = async (pageId) => {
    const token = pageTokens.get(pageId);
    if (token) {
        token.lastActive = new Date().toISOString();
        pageTokens.set(pageId, token);
        await saveTokens();
    }
};

const incrementMessages = async () => {
    totalMessages++;
    await saveStats();
};

const getTotalMessages = async () => {
    return totalMessages;
};

const getSessionCount = () => {
    return pageTokens.size;
};

const removeToken = async (pageId) => {
    const deleted = pageTokens.delete(pageId);
    if (deleted) {
        await saveTokens();
        console.log(`🗑️ Removed token for page ${pageId}`);
    }
    return deleted;
};

// Get bot info by token (useful for API calls)
const getBotByToken = async (token) => {
    for (const [pageId, data] of pageTokens.entries()) {
        if (data.token === token) {
            return { pageId, ...data };
        }
    }
    return null;
};

// Get all active sessions with last active time
const getActiveSessions = async () => {
    const activeSessions = [];
    const now = Date.now();
    const ACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    
    for (const [pageId, data] of pageTokens.entries()) {
        const lastActive = data.lastActive ? new Date(data.lastActive).getTime() : 0;
        const isActive = (now - lastActive) < ACTIVE_THRESHOLD;
        
        if (isActive) {
            activeSessions.push({
                id: pageId,
                name: data.name,
                username: data.username,
                owner: data.owner,
                lastActive: data.lastActive,
                connectedAt: data.connectedAt
            });
        }
    }
    
    return activeSessions;
};

// Clean up old/inactive sessions (optional)
const cleanupInactiveSessions = async (maxInactiveDays = 30) => {
    const now = Date.now();
    const maxInactiveMs = maxInactiveDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    
    for (const [pageId, data] of pageTokens.entries()) {
        const lastActive = data.lastActive ? new Date(data.lastActive).getTime() : 0;
        if (now - lastActive > maxInactiveMs) {
            pageTokens.delete(pageId);
            removed++;
        }
    }
    
    if (removed > 0) {
        await saveTokens();
        console.log(`🧹 Cleaned up ${removed} inactive sessions (inactive for ${maxInactiveDays} days)`);
    }
    
    return removed;
};

// Load stats on startup
loadStats();

module.exports = {
    loadTokens,
    addToken,
    getToken,
    getAllSessions,
    updateLastActive,
    getSessionCount,
    removeToken,
    incrementMessages,
    getTotalMessages,
    getBotUptime,
    getAllBotsWithUptime,
    getBotByToken,
    getActiveSessions,
    cleanupInactiveSessions,
    formatUptime
};