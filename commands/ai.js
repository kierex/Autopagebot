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
                text: '🧹 Conversation history cleared!\n\n💬 Start a fresh conversation.'
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
                text: `📊 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻 𝗦𝘁𝗮𝘁𝘀\n\n• Messages: ${stats.messageCount}\n• Created: ${created}\n• Last active: ${lastActive}\n\n💡 Use "ai reset" to clear history`
            }, pageAccessToken);
        }

        // Build context from conversation history
        const context = memory.getContext(senderId, 10);
        let prompt = message;

        if (context) {
            prompt = `Previous conversation:\n${context}\n\nUser: ${message}`;
        }

        try {
            const response = await axios.get('https://yin-api.vercel.app/ai/chatgptfree', {
                params: { 
                    prompt: prompt,
                    model: 'chatgpt4'
                },
                timeout: 30000
            });

            // Extract only the answer from the response
            if (response.data && response.data.answer) {
                const aiResponse = response.data.answer;
                
                // Save to conversation memory
                memory.addMessage(senderId, 'user', message);
                memory.addMessage(senderId, 'assistant', aiResponse);

                // Apply bold formatting
                const formattedResponse = makeBold(aiResponse.trim());
                
                // Split and send response
                const chunks = splitMessage(formattedResponse);
                for (const chunk of chunks) {
                    await sendMessage(senderId, { text: chunk }, pageAccessToken);
                }
            } else {
                throw new Error('No answer in response');
            }
        } catch (error) {
            console.error('AI Error:', error?.message);
            await sendMessage(senderId, {
                text: '❌ Failed to get AI response. Please try again later.'
            }, pageAccessToken);
        }
    }
};