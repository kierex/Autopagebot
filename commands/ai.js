const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const memory = require('../utils/memoryManager');

// GPT-4o API configuration
const GPT4O_API_URL = 'https://haji-mix-api.gleeze.com/api/openai';
const API_KEY = '79d08d76a3deae3fae1c7637141db818ec02faf1e3597e302c4ed9e1d5211d89';

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

// Function to extract image URL from message if present
function extractImageUrl(message) {
  const urlPattern = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/i;
  const match = message.match(urlPattern);
  return match ? match[0] : null;
}

// Function to call GPT-4o API
async function callGPT4oAPI(prompt, imageUrl = null, senderId = null) {
  try {
    const params = {
      ask: prompt,
      model: 'gpt-4o',
      uid: senderId || 'defaultUser',
      roleplay: 'Smart Assistant',
      max_tokens: '',
      stream: false,
      img_url: imageUrl || '',
      api_key: API_KEY
    };

    const response = await axios.get(GPT4O_API_URL, {
      params: params,
      timeout: 60000
    });

    if (response.data && response.data.answer) {
      console.log(`✅ GPT-4o API successful`);
      return {
        response: response.data.answer,
        modelUsed: response.data.model_used,
        success: true
      };
    } else {
      throw new Error('Invalid response from GPT-4o API');
    }
  } catch (error) {
    console.error('GPT-4o API failed:', error.message);
    throw error;
  }
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
        const imageUrl = extractImageUrl(message);

        // Clean message by removing image URL if present
        let cleanMessage = message;
        if (imageUrl) {
            cleanMessage = message.replace(imageUrl, '').trim();
        }

        if (!args.length) {
            const stats = memory.getStats(senderId);
            return sendMessage(senderId, { 
                text: `🤖 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻𝗮𝗹 𝗔𝗜 (GPT-4o)

📝 Usage: ai [your question]

✨ Examples:
• ai Hello! My name is John
• ai What's my name? (remembers context)
• ai Tell me a joke
• ai What's in this image? https://example.com/image.jpg

🔄 Commands:
• ai reset - Clear conversation history
• ai stats - Show conversation stats

📊 Session: ${stats.messageCount} messages

💡 Powered by GPT-4o - Supports image analysis!`
            }, pageAccessToken);
        }

        // Handle reset command
        if (cleanMessage.toLowerCase() === 'reset' || cleanMessage.toLowerCase() === 'clear') {
            memory.clearConversation(senderId);
            return sendMessage(senderId, {
                text: '🧹 Conversation history cleared from memory/conversations.json!\n\n💬 Start a fresh conversation.'
            }, pageAccessToken);
        }

        // Handle stats command
        if (cleanMessage.toLowerCase() === 'stats') {
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

        if (!cleanMessage && !imageUrl) {
            return sendMessage(senderId, {
                text: '❌ Please provide a question!\n\nExample: ai What is this? https://example.com/image.jpg'
            }, pageAccessToken);
        }

        const header = '💬 | 𝗔𝗜 𝗔𝘀𝘀𝗶𝘀𝘁𝗮𝗻𝘁\n・────────────・\n';
        const footer = '\n・────────────・';

        // Build context from conversation history
        const context = memory.getContext(senderId, 10);

        // Prepare conversation prompt with context
        let fullPrompt = cleanMessage || "Describe this image";
        if (context) {
            fullPrompt = `Previous conversation:\n${context}\n\nUser: ${fullPrompt}\n\nAssistant:`;
        }

        let aiResponse = null;
        let modelUsed = null;

        try {
            // Call GPT-4o API
            const result = await callGPT4oAPI(fullPrompt, imageUrl, senderId);
            aiResponse = result.response;
            modelUsed = result.modelUsed;
        } catch (primaryError) {
            console.error('GPT-4o API failed:', primaryError.message);
            await sendMessage(senderId, {
                text: header + '❌ GPT-4o API is currently unavailable. Please try again later.\n\n💡 Service might be temporarily down.' + footer
            }, pageAccessToken);
            return;
        }

        if (!aiResponse) {
            await sendMessage(senderId, {
                text: header + '❌ Failed to get response from GPT-4o. Please try again.' + footer
            }, pageAccessToken);
            return;
        }

        // Save to conversation memory
        memory.addMessage(senderId, 'user', cleanMessage || "Image analysis request");
        memory.addMessage(senderId, 'assistant', aiResponse);

        aiResponse = aiResponse.trim();
        aiResponse = makeBold(aiResponse);

        // Add API indicator with model info
        const modifiedHeader = `✨ | 𝗔𝗜 𝗔𝘀𝘀𝗶𝘀𝘁𝗮𝗻𝘁 (GPT-4o)\n・────────────・\n`;

        const chunks = splitMessage(aiResponse);

        for (let i = 0; i < chunks.length; i++) {
            const isFirst = i === 0;
            const isLast = i === chunks.length - 1;

            let fullMessage = chunks[i];
            if (isFirst) fullMessage = modifiedHeader + fullMessage;
            if (isLast) fullMessage = fullMessage + footer;

            await sendMessage(senderId, { text: fullMessage }, pageAccessToken);
        }
    }
};