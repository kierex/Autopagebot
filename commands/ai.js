const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const memory = require('../utils/memoryManager');

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
    name: ['ai'],
    usage: 'ai [question] or ai reset or ai stats',
    version: '1.0.0',
    author: 'AutoPagebot',
    category: 'ai',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        const message = args.join(' ');

        if (!args.length) {
            const stats = memory.getStats(senderId);
            return sendMessage(senderId, { 
                text: `🤖 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻𝗮𝗹 𝗔𝗜\n\n📝 Usage: ai [your question]\n\n✨ Examples:\n• ai Hello! My name is John\n• ai What's my name? (remembers context)\n• ai Tell me a joke\n\n🔄 Commands:\n• ai reset - Clear conversation history\n• ai stats - Show conversation stats\n\n📊 Session: ${stats.messageCount} messages\n\n💡 The AI remembers your conversation!`
            }, pageAccessToken);
        }

        // Handle reset command
        if (message.toLowerCase() === 'reset' || message.toLowerCase() === 'clear') {
            memory.clearConversation(senderId);
            return sendMessage(senderId, {
                text: '🧹 Conversation history cleared from memory/conversations.json!\n\n💬 Start a fresh conversation.'
            }, pageAccessToken);
        }

        // Handle stats command
        if (message.toLowerCase() === 'stats') {
            const stats = memory.getStats(senderId);
            const lastActive = new Date(stats.lastActive).toLocaleString('en-PH', {
                timeZone: 'Asia/Manila'
            });
            const created = new Date(stats.createdAt).toLocaleString('en-PH', {
                timeZone: 'Asia/Manila'
            });

            return sendMessage(senderId, {
                text: `📊 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻 𝗦𝘁𝗮𝘁𝘀\n\n• Messages: ${stats.messageCount}\n• Created: ${created}\n• Last active: ${lastActive}\n• Storage: memory/conversations.json\n\n💡 Use "ai reset" to clear history`
            }, pageAccessToken);
        }

        // Build context from conversation history
        const context = memory.getContext(senderId, 10);
        let prompt = message;

        if (context) {
            prompt = `Previous conversation:\n${context}\nUser: ${message}\nAssistant:`;
        }

        let aiResponse = null;

        try {
            const response = await axios.get('https://yin-api.vercel.app/ai/chatgptfree', {
                params: { 
                    prompt: prompt,
                    model: 'chatgpt4'
                },
                timeout: 30000
            });

            if (response.data && response.data.answer) {
                aiResponse = response.data.answer;
                console.log(`✅ AI response received in ${response.data.responseTime}`);
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('AI Error:', error?.message);
            await sendMessage(senderId, {
                text: '❌ Failed to get AI response. Please try again later.'
            }, pageAccessToken);
            return;
        }

        // Save to conversation memory
        memory.addMessage(senderId, 'user', message);
        memory.addMessage(senderId, 'assistant', aiResponse);

        aiResponse = aiResponse.trim();
        aiResponse = makeBold(aiResponse);

        const chunks = splitMessage(aiResponse);

        for (let i = 0; i < chunks.length; i++) {
            await sendMessage(senderId, { text: chunks[i] }, pageAccessToken);
        }
    }
};