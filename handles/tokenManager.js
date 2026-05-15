const { readFile, writeFile } = require('fs/promises');
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
        const fs = require('fs');
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
    pageTokens.set(pageId, tokenData);
    await saveTokens();
    console.log(`✅ Added token for: ${tokenData.name} (${pageId})`);
};

const getToken = async (pageId) => {
    return pageTokens.get(pageId);
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
            token: data.token // Include token for profile picture API
        });
    }
    // Sort by connectedAt (newest first)
    sessions.sort((a, b) => new Date(b.connectedAt) - new Date(a.connectedAt));
    return sessions;
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
    getTotalMessages
};