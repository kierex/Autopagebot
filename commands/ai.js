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
    usage: 'ai [question] or ai reset',
    version: '1.0.0',
    author: 'AutoPagebot',
    category: 'ai',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        const message = args.join(' ');
        
        if (!args.length) {
            const stats = memory.getStats(senderId);
            return sendMessage(senderId, { 
                text: `🤖 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻𝗮𝗹 𝗔𝗜 (ChatGPT4)

📝 Usage: ai [your question]

✨ Examples:
• ai Hello! My name is John
• ai What's my name? (remembers context)
• ai Tell me a joke

🔄 Commands:
• ai reset - Clear conversation history
• ai stats - Show conversation stats

📊 Session: ${stats.messageCount} messages

💡 The AI remembers your conversation context!`
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

        const header = '💬 | 𝗔𝗜 𝗔𝘀𝘀𝗶𝘀𝘁𝗮𝗻𝘁 (ChatGPT4)\n・────────────・\n';
        const footer = '\n・────────────・';

        // Build context from conversation history
        const context = memory.getContext(senderId, 10);
        
        // Prepare prompt with context if available
        let fullPrompt = message;
        if (context) {
            fullPrompt = `Previous conversation:\n${context}\n\nUser: ${message}\n\nAssistant:`;
        }

        let aiResponse = null;

        try {
            // First, load referer to receive cookies
            const refererResp = await axios.get('https://stablediffusion.fr/chatgpt4');
            const setCookie = refererResp.headers && refererResp.headers['set-cookie'];
            const cookieHeader = Array.isArray(setCookie) ? setCookie.join('; ') : undefined;

            // Make request to ChatGPT4 API
            const response = await axios.post(
                'https://stablediffusion.fr/gpt4/predict2',
                { prompt: fullPrompt },
                {
                    headers: {
                        'accept': '*/*',
                        'content-type': 'application/json',
                        'origin': 'https://stablediffusion.fr',
                        'referer': 'https://stablediffusion.fr/chatgpt4',
                        ...(cookieHeader ? { cookie: cookieHeader } : {}),
                        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36'
                    },
                    timeout: 45000
                }
            );

            if (response.data && response.data.message) {
                aiResponse = response.data.message;
                console.log(`✅ ChatGPT4 API request successful`);
            } else {
                throw new Error('Invalid response from ChatGPT4 API');
            }
        } catch (error) {
            console.error('ChatGPT4 API Error:', error.message);
            await sendMessage(senderId, {
                text: header + '❌ API request failed. Please try again later.\n\n💡 Tip: The server might be busy!' + footer
            }, pageAccessToken);
            return;
        }

        if (!aiResponse) {
            await sendMessage(senderId, {
                text: header + '❌ Failed to get response from AI. Please try again.' + footer
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