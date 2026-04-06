const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const fs = require('fs');
const path = require('path');

// API Keys (Primary + Backups)
const API_KEYS = [
  'AIzaSyD5U9SFqJ4FiSQv00pXb06Kv3ZH9H76JjI', // Primary
  'AIzaSyDQ4TD9hnEnAt3JGcVjIm9yWbmuc9cGt1M', // Backup 1
  'AIzaSyC5KE1o0o5sA4G5mYXS7GSemdHf2wQ8y3g', // Backup 2
  'AIzaSyDuOaOrtTvx9W5Jw6eQOIJb613uEP-vgWQ', // Backup 3
  'AIzaSyB_UMcCeW7_cnkigbePnh7GVWWEIrziaFQ'  // Backup 4
];

// Conversation storage file
const CONVERSATIONS_FILE = path.join(__dirname, '../conversations.json');
let conversations = new Map();

// Load conversations from file
function loadConversations() {
    try {
        if (fs.existsSync(CONVERSATIONS_FILE)) {
            const data = JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, 'utf8'));
            conversations = new Map(Object.entries(data));
            console.log(`📚 Loaded ${conversations.size} conversations`);
        }
    } catch (error) {
        console.error('Error loading conversations:', error.message);
    }
}

// Save conversations to file
function saveConversations() {
    try {
        const data = Object.fromEntries(conversations);
        fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving conversations:', error.message);
    }
}

// Get conversation history for user
function getConversation(userId) {
    if (!conversations.has(userId)) {
        conversations.set(userId, {
            messages: [],
            lastActive: Date.now()
        });
    }
    return conversations.get(userId);
}

// Add message to conversation
function addToConversation(userId, role, content) {
    const conv = getConversation(userId);
    conv.messages.push({
        role: role,
        content: content,
        timestamp: Date.now()
    });
    
    // Keep only last 20 messages for context
    if (conv.messages.length > 20) {
        conv.messages = conv.messages.slice(-20);
    }
    
    conv.lastActive = Date.now();
    conversations.set(userId, conv);
    saveConversations();
}

// Clear conversation for user
function clearConversation(userId) {
    conversations.delete(userId);
    saveConversations();
}

// Build conversation context
function buildContext(userId, currentMessage) {
    const conv = getConversation(userId);
    const recentMessages = conv.messages.slice(-10); // Last 10 messages
    
    let context = '';
    for (const msg of recentMessages) {
        context += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    }
    
    return context;
}

function makeBold(text) {
  return text.replace(/\*\*(.+?)\*\*/g, (match, word) => {
    let boldText = '';
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (char >= 'a' && char <= 'z') {
        boldText += String.fromCharCode(char.charCodeAt(0) + 0x1D41A - 97);
      } else if (char >= 'A' && char <= 'Z') {
        boldText += String.fromCharCode(char.charCodeAt(0) + 0x1D400 - 65);
      } else if (char >= '0' && char <= '9') {
        boldText += String.fromCharCode(char.charCodeAt(0) + 0x1D7CE - 48);
      } else {
        boldText += char;
      }
    }
    return boldText;
  });
}

function splitMessage(text) {
  const maxLength = 1900;
  const chunks = [];

  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }

  return chunks;
}

module.exports = {
    name: ['ai', 'chat', 'gpt', 'ask', 'gemini'],
    usage: 'ai [question] or ai reset or ai clear',
    version: '1.0.0',
    author: 'AutoPagebot',
    category: 'ai',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        // Load conversations on first run
        if (conversations.size === 0) {
            loadConversations();
        }
        
        const message = args.join(' ');

        if (!args.length) {
            const conv = getConversation(senderId);
            const messageCount = conv.messages.length;
            
            return sendMessage(senderId, { 
                text: `🤖 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻𝗮𝗹 𝗔𝗜

📝 Usage: ai [your question]

✨ Examples:
• ai Hello! My name is John
• ai What's my name? (remembers context)
• ai Tell me a joke
• ai Explain quantum physics

🔄 Commands:
• ai reset - Clear conversation history
• ai stats - Show conversation stats

📊 Current session: ${messageCount} messages

💡 The AI remembers your conversation!`
            }, pageAccessToken);
        }

        // Handle reset command
        if (message.toLowerCase() === 'reset' || message.toLowerCase() === 'clear') {
            clearConversation(senderId);
            return sendMessage(senderId, {
                text: '🧹 Conversation history has been cleared!\n\n💬 You can now start a fresh conversation.'
            }, pageAccessToken);
        }

        // Handle stats command
        if (message.toLowerCase() === 'stats') {
            const conv = getConversation(senderId);
            return sendMessage(senderId, {
                text: `📊 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻 𝗦𝘁𝗮𝘁𝘀

• Total messages: ${conv.messages.length}
• Last active: ${new Date(conv.lastActive).toLocaleString()}
• Session active: Yes

💡 Use "ai reset" to clear history`
            }, pageAccessToken);
        }

        const header = '💬 | 𝗔𝗜 𝗔𝘀𝘀𝗶𝘀𝘁𝗮𝗻𝘁\n・────────────・\n';
        const footer = '\n・────────────・';

        // Send typing indicator
        await sendMessage(senderId, { text: '🤔 Thinking...' }, pageAccessToken);

        // Build context from conversation history
        const context = buildContext(senderId, message);
        let prompt = message;
        
        if (context) {
            prompt = `Previous conversation:\n${context}\nUser: ${message}\nAssistant:`;
        }

        let aiResponse = null;
        let lastError = null;

        // Try each API key until one works
        for (let i = 0; i < API_KEYS.length; i++) {
            try {
                const response = await axios.get('https://kryptonite-api-library.onrender.com/api/gemini-vision', {
                    params: { 
                        prompt: prompt,
                        uid: senderId,
                        imgUrl: '',
                        apikey: API_KEYS[i]
                    },
                    timeout: 30000
                });

                if (response.data && response.data.status === true && response.data.response) {
                    aiResponse = response.data.response;
                    console.log(`✅ API key ${i + 1} worked successfully`);
                    break;
                } else {
                    throw new Error('Invalid API response');
                }
            } catch (error) {
                lastError = error;
                console.log(`❌ API key ${i + 1} failed:`, error.message);
            }
        }

        if (!aiResponse) {
            console.error('AI Error:', lastError?.message);
            await sendMessage(senderId, {
                text: header + '❌ All API keys failed. Please try again later.\n\n💡 Tip: The server might be busy!' + footer
            }, pageAccessToken);
            return;
        }

        // Save to conversation history
        addToConversation(senderId, 'user', message);
        addToConversation(senderId, 'assistant', aiResponse);

        aiResponse = aiResponse.trim();
        aiResponse = makeBold(aiResponse);

        const chunks = splitMessage(aiResponse);

        for (let i = 0; i < chunks.length; i++) {
            const isFirst = i === 0;
            const isLast = i === chunks.length - 1;

            let fullMessage = chunks[i];
            if (isFirst) fullMessage = header + fullMessage;
            if (isLast) fullMessage = fullMessage + footer;

            await sendMessage(senderId, { text: fullMessage }, pageAccessToken);
        }
    }
};