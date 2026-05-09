const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const memory = require('../utils/memoryManager');

// Primary API - Sakibin
const SAKIBIN_API_URL = 'https://sakibin.site/api/ai/chat';

// Secondary backup API - Norch
const NORCH_API_URL = 'https://norch-project.gleeze.com/api/gemini';

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

// Function to call primary Sakibin API
async function callSakibinAPI(prompt, imageUrl = null) {
  try {
    // Sakibin API doesn't support images, so if image is provided, we'll mention it in the prompt
    let finalPrompt = prompt;
    if (imageUrl) {
      finalPrompt = `[Image URL: ${imageUrl}] ${prompt}`;
    }
    
    const response = await axios.get(SAKIBIN_API_URL, {
      params: { message: finalPrompt },
      timeout: 30000
    });
    
    if (response.data && response.data.reply) {
      console.log(`✅ Sakibin API successful`);
      return {
        response: response.data.reply,
        apiType: 'primary'
      };
    } else {
      throw new Error('Invalid response from Sakibin API');
    }
  } catch (error) {
    console.error('Sakibin API failed:', error.message);
    throw error;
  }
}

// Function to call secondary Norch API
async function callNorchAPI(prompt, imageUrl = null) {
  try {
    const params = {
      prompt: prompt
    };
    
    if (imageUrl) {
      params.imageurl = imageUrl;
    }
    
    const response = await axios.get(NORCH_API_URL, {
      params: params,
      timeout: 45000
    });
    
    if (response.data && response.data.response) {
      console.log(`✅ Norch API successful`);
      return {
        response: response.data.response,
        apiType: 'secondary'
      };
    } else {
      throw new Error('Invalid response from Norch API');
    }
  } catch (error) {
    console.error('Norch API failed:', error.message);
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
                text: `🤖 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻𝗮𝗹 𝗔𝗜

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

💡 The AI remembers your conversation and can analyze images!`
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
        let apiUsed = null;

        try {
            // Try primary Sakibin API first
            const primaryResult = await callSakibinAPI(fullPrompt, imageUrl);
            aiResponse = primaryResult.response;
            apiUsed = primaryResult.apiType;
        } catch (primaryError) {
            console.error('Sakibin API failed, trying Norch backup:', primaryError.message);
            
            // Try secondary Norch API as fallback
            try {
                const secondaryResult = await callNorchAPI(cleanMessage || "Describe this image", imageUrl);
                aiResponse = secondaryResult.response;
                apiUsed = 'secondary';
            } catch (secondaryError) {
                console.error('Norch API also failed:', secondaryError.message);
                await sendMessage(senderId, {
                    text: header + '❌ All APIs are currently unavailable. Please try again later.\n\n💡 Both primary and backup services are down.' + footer
                }, pageAccessToken);
                return;
            }
        }

        if (!aiResponse) {
            await sendMessage(senderId, {
                text: header + '❌ Failed to get response from AI. Please try again.' + footer
            }, pageAccessToken);
            return;
        }

        // Save to conversation memory
        memory.addMessage(senderId, 'user', cleanMessage || "Image analysis request");
        memory.addMessage(senderId, 'assistant', aiResponse);

        aiResponse = aiResponse.trim();
        aiResponse = makeBold(aiResponse);

        // Add API indicator to header
        const apiIndicator = apiUsed === 'primary' ? '✨' : '🔄';
        const modifiedHeader = `${apiIndicator} | 𝗔𝗜 𝗔𝘀𝘀𝗶𝘀𝘁𝗮𝗻𝘁${apiUsed === 'secondary' ? ' (Backup)' : ''}\n・────────────・\n`;

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