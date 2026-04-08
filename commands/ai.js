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
                text: `🤖 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻𝗮𝗹 𝗔𝗜

📝 Usage: ai [your question]

✨ Examples:
• ai Hello! My name is John
• ai What's my name? (remembers context)
• ai Tell me a joke

🔄 Commands:
• ai reset - Clear conversation history
• ai stats - Show conversation stats

📊 Session: ${stats.messageCount} messages

💡 The AI remembers your conversation!`
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
                text: `📊 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻 𝗦𝘁𝗮𝘁𝘀

• Messages: ${stats.messageCount}
• Created: ${created}
• Last active: ${lastActive}
• Storage: memory/conversations.json

💡 Use "ai reset" to clear history`
            }, pageAccessToken);
        }

        const header = '💬 | 𝗔𝗜 𝗔𝘀𝘀𝗶𝘀𝘁𝗮𝗻𝘁\n・────────────・\n';
        const footer = '\n・────────────・';

        // Build context from conversation history
        const context = memory.getContext(senderId, 10);
        let prompt = message;

        if (context) {
            prompt = `Previous conversation:\n${context}\nUser: ${message}\nAssistant:`;
        }

        let aiResponse = null;
        let lastError = null;

        try {
            const response = await axios.get('https://kryptonite-api-library.onrender.com/api/chatgptfree', {
                params: { 
                    prompt: prompt,
                    uid: senderId,
                    model: 'chatgpt4'
                },
                timeout: 30000
            });

            if (response.data && response.data.response) {
                aiResponse = response.data.response;
                console.log(`✅ API request successful - Response time: ${response.data.responseTime}`);
            }
        } catch (error) {
            lastError = error;
            console.log('❌ API request failed');
        }

        if (!aiResponse) {
            console.error('AI Error:', lastError?.message);
            await sendMessage(senderId, {
                text: header + '❌ API request failed. Please try again later.\n\n💡 Tip: The server might be busy!' + footer
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
            const isFirst = i === 0;
            const isLast = i === chunks.length - 1;

            let fullMessage = chunks[i];
            if (isFirst) fullMessage = header + fullMessage;
            if (isLast) fullMessage = fullMessage + footer;

            await sendMessage(senderId, { text: fullMessage }, pageAccessToken);
        }
    }
};