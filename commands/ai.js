const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const memory = require('../utils/memoryManager');

// GPT-4o API configuration
const GPT4O_API_URL = 'https://haji-mix-api.gleeze.com/api/openai';
const PRIMARY_API_KEY = '79d08d76a3deae3fae1c7637141db818ec02faf1e3597e302c4ed9e1d5211d89';
const SECONDARY_API_KEY = '66ec8aa6ce70b55c877c4489fa545c67fee8633a42442343771bd2ade432ecbd';

// Track which API key is currently active
let activeApiKey = PRIMARY_API_KEY;
let primaryFailed = false;

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

// Function to call GPT-4o API with automatic key fallback
async function callGPT4oAPI(prompt, imageUrl = null, senderId = null) {
  // Try with current active key
  let currentKey = activeApiKey;
  let isSecondaryAttempt = false;
  
  // If primary failed before, try secondary first
  if (primaryFailed) {
    currentKey = SECONDARY_API_KEY;
    isSecondaryAttempt = true;
  }
  
  try {
    const params = {
      ask: prompt,
      model: 'gpt-4o',
      uid: senderId || 'defaultUser',
      roleplay: 'Smart Assistant',
      max_tokens: '',
      stream: false,
      img_url: imageUrl || '',
      api_key: currentKey
    };

    const response = await axios.get(GPT4O_API_URL, {
      params: params,
      timeout: 60000
    });

    if (response.data && response.data.answer) {
      console.log(`✅ API successful with ${isSecondaryAttempt ? 'SECONDARY' : 'PRIMARY'} key`);
      
      // If we successfully used secondary, keep using it
      if (isSecondaryAttempt) {
        activeApiKey = SECONDARY_API_KEY;
        primaryFailed = true;
      } else {
        activeApiKey = PRIMARY_API_KEY;
        primaryFailed = false;
      }
      
      return {
        response: response.data.answer,
        modelUsed: response.data.model_used,
        success: true,
        keyUsed: isSecondaryAttempt ? 'Secondary' : 'Primary'
      };
    } else {
      throw new Error('Invalid response from API');
    }
  } catch (error) {
    console.error(`API failed with ${isSecondaryAttempt ? 'SECONDARY' : 'PRIMARY'} key:`, error.message);
    
    // If primary key failed and we haven't tried secondary yet
    if (!isSecondaryAttempt) {
      console.log('🔄 Switching to secondary API key...');
      primaryFailed = true;
      activeApiKey = SECONDARY_API_KEY;
      
      // Retry with secondary key
      try {
        const params = {
          ask: prompt,
          model: 'gpt-4o',
          uid: senderId || 'defaultUser',
          roleplay: 'Smart Assistant',
          max_tokens: '',
          stream: false,
          img_url: imageUrl || '',
          api_key: SECONDARY_API_KEY
        };

        const retryResponse = await axios.get(GPT4O_API_URL, {
          params: params,
          timeout: 60000
        });

        if (retryResponse.data && retryResponse.data.answer) {
          console.log(`✅ API successful with SECONDARY key (fallback)`);
          return {
            response: retryResponse.data.answer,
            modelUsed: retryResponse.data.model_used,
            success: true,
            keyUsed: 'Secondary (Fallback)'
          };
        } else {
          throw new Error('Invalid response from API with secondary key');
        }
      } catch (secondaryError) {
        console.error('Both API keys failed:', secondaryError.message);
        throw secondaryError;
      }
    } else {
      // Both keys failed
      throw error;
    }
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
• Active API Key: ${activeApiKey === PRIMARY_API_KEY ? 'Primary' : 'Secondary'}

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
        let keyUsed = null;

        try {
            // Call GPT-4o API with automatic fallback
            const result = await callGPT4oAPI(fullPrompt, imageUrl, senderId);
            aiResponse = result.response;
            modelUsed = result.modelUsed;
            keyUsed = result.keyUsed;
        } catch (primaryError) {
            console.error('Both API keys failed:', primaryError.message);
            await sendMessage(senderId, {
                text: header + '❌ All API services are currently unavailable. Please try again later.\n\n💡 Service might be temporarily down.' + footer
            }, pageAccessToken);
            return;
        }

        if (!aiResponse) {
            await sendMessage(senderId, {
                text: header + '❌ Failed to get response. Please try again.' + footer
            }, pageAccessToken);
            return;
        }

        // Save to conversation memory
        memory.addMessage(senderId, 'user', cleanMessage || "Image analysis request");
        memory.addMessage(senderId, 'assistant', aiResponse);

        aiResponse = aiResponse.trim();
        aiResponse = makeBold(aiResponse);

        // Add API indicator with model and key info
        const modifiedHeader = `✨ | 𝗔𝗜 𝗔𝘀𝘀𝗶𝘀𝘁𝗮𝗻𝘁\n・────────────・\n`;

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