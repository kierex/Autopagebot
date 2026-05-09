const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../storage');
const CONVERSATIONS_FILE = path.join(STORAGE_DIR, 'convo.json');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Initialize empty conversations if file doesn't exist
if (!fs.existsSync(CONVERSATIONS_FILE)) {
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify({}, null, 2));
}

class MemoryManager {
    constructor() {
        this.conversations = new Map();
        this.load();
    }

    // Load conversations from file
    load() {
        try {
            const data = fs.readFileSync(CONVERSATIONS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            this.conversations = new Map(Object.entries(parsed));
            console.log(`📚 Loaded ${this.conversations.size} conversations from storage`);
        } catch (error) {
            console.error('Error loading conversations:', error.message);
            this.conversations = new Map();
        }
    }

    // Save conversations to file
    save() {
        try {
            const data = Object.fromEntries(this.conversations);
            fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(data, null, 2));
            console.log(`💾 Saved ${this.conversations.size} conversations to storage`);
        } catch (error) {
            console.error('Error saving conversations:', error.message);
        }
    }

    // Get conversation for a user
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

    // Add message to conversation
    addMessage(userId, role, content) {
        const conv = this.getConversation(userId);
        conv.messages.push({
            role: role,
            content: content,
            timestamp: Date.now()
        });
        conv.messageCount = conv.messages.length;
        conv.lastActive = Date.now();

        // Keep only last 30 messages for context
        if (conv.messages.length > 30) {
            conv.messages = conv.messages.slice(-30);
        }

        this.conversations.set(userId, conv);
        this.save();
    }

    // Get recent messages for context
    getContext(userId, limit = 10) {
        const conv = this.getConversation(userId);
        const recentMessages = conv.messages.slice(-limit);

        let context = '';
        for (const msg of recentMessages) {
            context += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
        }
        return context;
    }

    // Clear conversation for a user
    clearConversation(userId) {
        this.conversations.delete(userId);
        this.save();
    }

    // Get conversation stats
    getStats(userId) {
        const conv = this.getConversation(userId);
        return {
            messageCount: conv.messageCount,
            lastActive: conv.lastActive,
            createdAt: conv.createdAt,
            isActive: conv.messages.length > 0
        };
    }

    // Delete old conversations (older than 7 days)
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
            console.log(`🧹 Cleaned up ${deleted} old conversations`);
        }
    }
}

module.exports = new MemoryManager();