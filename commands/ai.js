const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { sendMessage } = require('../handles/sendMessage');

// JSON file path for conversations
const CONVERSATIONS_FILE = path.join(__dirname, '../conversations.json');

// In-memory cache for faster access
let conversationsCache = new Map();
let isLoaded = false;

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

// Load conversations from JSON file
async function loadConversations() {
  try {
    const data = await fs.readFile(CONVERSATIONS_FILE, 'utf8').catch(() => '{}');
    const conversations = JSON.parse(data);
    
    conversationsCache.clear();
    for (const [userId, conv] of Object.entries(conversations)) {
      conversationsCache.set(userId, conv);
    }
    
    isLoaded = true;
    console.log(`✅ Loaded ${conversationsCache.size} conversations from JSON`);
  } catch (error) {
    console.error('Error loading conversations:', error.message);
    conversationsCache.clear();
  }
}

// Save conversations to JSON file
async function saveConversations() {
  try {
    const conversations = Object.fromEntries(conversationsCache);
    await fs.writeFile(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2));
    console.log(`💾 Saved ${conversationsCache.size} conversations to JSON`);
  } catch (error) {
    console.error('Error saving conversations:', error.message);
  }
}

// Get conversation for a user
function getConversation(senderId) {
  if (!conversationsCache.has(senderId)) {
    conversationsCache.set(senderId, {
      messages: [],
      context: '',
      created: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      messageCount: 0
    });
  }
  
  const conv = conversationsCache.get(senderId);
  conv.lastActive = new Date().toISOString();
  return conv;
}

// Update conversation
async function updateConversation(senderId, userMessage, aiResponse) {
  const conv = getConversation(senderId);
  
  conv.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  });
  
  conv.messages.push({
    role: 'assistant',
    content: aiResponse,
    timestamp: new Date().toISOString()
  });
  
  conv.messageCount += 2;
  
  // Keep only last 30 messages
  if (conv.messages.length > 30) {
    conv.messages = conv.messages.slice(-30);
  }
  
  // Update context string
  conv.context = conv.messages.map(m => `${m.role}: ${m.content}`).join('\n');
  
  conversationsCache.set(senderId, conv);
  await saveConversations();
}

// Clear conversation
async function clearConversation(senderId) {
  conversationsCache.delete(senderId);
  await saveConversations();
}

// Get conversation stats
function getConversationStats(senderId) {
  const conv = conversationsCache.get(senderId);
  if (!conv) {
    return {
      exists: false,
      messageCount: 0,
      created: null,
      lastActive: null
    };
  }
  
  return {
    exists: true,
    messageCount: conv.messageCount,
    created: conv.created,
    lastActive: conv.lastActive,
    messageHistory: conv.messages.length
  };
}

module.exports = {
    name: ['ai'],
    usage: 'ai [question]',
    version: '1.0.0',
    author: 'Develooer',
    category: 'ai',
    cooldown: 3,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        // Load conversations on first run
        if (!isLoaded) {
            await loadConversations();
        }
        
        const message = args.join(' ');

        if (!args.length) {
            const stats = getConversationStats(senderId);
            const historyStatus = stats.exists ? `📊 You have ${stats.messageCount} messages in history` : '✨ No conversation history yet';
            
            return sendMessage(senderId, { 
                text: `🤖 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻𝗮𝗹 𝗔𝗜 (JSON Storage)

📝 Usage: ai [your message]

✨ Examples:
• ai Hello! How are you?
• ai Tell me a joke
• ai What is love?

💡 Features:
• Remembers conversation context
• Persistent storage (conversations.json)
• Natural conversations

🔄 Commands:
• ai reset - Clear your conversation
• ai stats - Show conversation stats

${historyStatus}`
            }, pageAccessToken);
        }

        // Handle reset command
        if (message.toLowerCase() === 'reset') {
            await clearConversation(senderId);
            return sendMessage(senderId, {
                text: '🧹 Your conversation history has been cleared from conversations.json!\n\n💬 You can now start a fresh conversation.'
            }, pageAccessToken);
        }

        // Handle stats command
        if (message.toLowerCase() === 'stats') {
            const stats = getConversationStats(senderId);
            
            if (!stats.exists) {
                return sendMessage(senderId, {
                    text: '📊 No conversation history found.\n\n💡 Start chatting with "ai hello" to create your conversation file!'
                }, pageAccessToken);
            }
            
            const created = new Date(stats.created).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
            const lastActive = new Date(stats.lastActive).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
            
            return sendMessage(senderId, {
                text: `📊 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻 𝗦𝘁𝗮𝘁𝘀 (JSON)

• Total messages: ${stats.messageCount}
• Messages in memory: ${stats.messageHistory}
• Created: ${created}
• Last active: ${lastActive}
• Storage: conversations.json

💡 Use "ai reset" to clear history`
            }, pageAccessToken);
        }

        // Get conversation for user
        const conv = getConversation(senderId);
        
        // Build context from previous messages (last 8 exchanges for better performance)
        let context = '';
        const recentMessages = conv.messages.slice(-16); // Last 8 exchanges
        for (const msg of recentMessages) {
            context += `${msg.role}: ${msg.content}\n`;
        }

        const header = '💬 | 𝗖𝗵𝗮𝘁𝗚𝗣𝗧 𝗙𝗿𝗲𝗲\n・────────────・\n';
        const footer = '\n・──── >ᴗ< ─────・';

        // Send typing indicator
        await sendMessage(senderId, { text: '🤔 Thinking...' }, pageAccessToken);

        try {
            // Include conversation context in the prompt
            const fullPrompt = context ? `Previous conversation:\n${context}\nUser: ${message}\nAI:` : message;
            
            const response = await axios.get('https://yin-api.vercel.app/ai/chatgptfree', {
                params: { 
                    prompt: fullPrompt,
                    model: 'chatgpt4'
                },
                timeout: 30000
            });

            if (!response.data || !response.data.answer) {
                throw new Error('API error');
            }

            let aiResponse = response.data.answer;
            
            // Clean up response
            aiResponse = aiResponse.trim();
            aiResponse = makeBold(aiResponse);
            
            // Save to JSON file
            await updateConversation(senderId, message, aiResponse);
            
            // Send auto-save confirmation (optional, can be removed)
            // await sendMessage(senderId, { text: '💾 Saved to conversations.json' }, pageAccessToken);

            const chunks = splitMessage(aiResponse);

            for (let i = 0; i < chunks.length; i++) {
                const isFirst = i === 0;
                const isLast = i === chunks.length - 1;

                let fullMessage = chunks[i];
                if (isFirst) fullMessage = header + fullMessage;
                if (isLast) fullMessage = fullMessage + footer;

                await sendMessage(senderId, { text: fullMessage }, pageAccessToken);
            }

        } catch (error) {
            console.error('AI Error:', error.message);
            await sendMessage(senderId, {
                text: header + '❌ Something went wrong. Please try again.\n\n💡 Tip: Try "ai reset" to start fresh!' + footer
            }, pageAccessToken);
        }
    }
};