const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const memory = require('../utils/memoryManager');

// Configuration - Primary Gemini API
const PRIMARY_API_KEY = 'AIzaSyDUiXWMggX4H7K1kFQ8VzHJi1tlPNeNYE4';
const SECONDARY_API_KEY = 'AIzaSyBTPvMLsIAnAo8da4XMVR5RQ4sJB-t_WJw';
const TERTIARY_API_KEY = 'AIzaSyDlVfmiRTKkNiaW4-At74LWx49YhIIugGQ';
const MODEL = "gemini-2.5-flash";

// Secondary backup API (Norch)
const SECONDARY_API_URL = 'https://norch-project.gleeze.com/api/gemini';

// Array of API keys for rotation
const API_KEYS = [PRIMARY_API_KEY, SECONDARY_API_KEY, TERTIARY_API_KEY];

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

// Function to call primary Gemini API with key rotation
async function callPrimaryGeminiAPI(conversation, imageUrl = null) {
  let lastError = null;
  
  for (let i = 0; i < API_KEYS.length; i++) {
    const apiKey = API_KEYS[i];
    try {
      let payload = { contents: conversation };
      
      // If there's an image, we need to handle it differently
      if (imageUrl) {
        // Fetch and convert image to base64
        const imageResp = await axios.get(imageUrl, { 
          responseType: 'arraybuffer',
          timeout: 15000
        });
        const imageData = Buffer.from(imageResp.data, 'binary').toString('base64');
        
        // Modify the last user message to include image
        const lastUserIndex = conversation.length - 1;
        if (conversation[lastUserIndex]?.role === 'user') {
          conversation[lastUserIndex].parts = [
            { text: conversation[lastUserIndex].parts[0].text },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageData
              }
            }
          ];
          payload.contents = conversation;
        }
      }
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
        payload,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`✅ Primary API successful with key index ${i}`);
        return {
          response: response.data.candidates[0].content.parts[0].text,
          apiType: 'primary'
        };
      } else {
        throw new Error('Invalid response from Gemini API');
      }
    } catch (error) {
      console.error(`Primary API failed with key index ${i}:`, error.message);
      lastError = error;
      continue; // Try next API key
    }
  }
  
  throw lastError || new Error('All primary API keys failed');
}

// Function to call secondary backup API
async function callSecondaryAPI(prompt, imageUrl = null) {
  try {
    const params = {
      prompt: prompt
    };
    
    if (imageUrl) {
      params.imageurl = imageUrl;
    }
    
    const response = await axios.get(SECONDARY_API_URL, {
      params: params,
      timeout: 45000
    });
    
    if (response.data && response.data.response) {
      console.log(`✅ Secondary API successful`);
      return {
        response: response.data.response,
        apiType: 'secondary'
      };
    } else {
      throw new Error('Invalid response from secondary API');
    }
  } catch (error) {
    console.error('Secondary API failed:', error.message);
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
                text: `🤖 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻𝗮𝗹 𝗔𝗜 (Gemini Vision)

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

        // Prepare conversation for Gemini
        let conversation = [];

        if (context) {
            // Parse previous messages from context
            const contextLines = context.split('\n');
            for (let i = 0; i < contextLines.length; i++) {
                const line = contextLines[i];
                if (line.startsWith('User: ')) {
                    conversation.push({ role: 'user', parts: [{ text: line.substring(6) }] });
                } else if (line.startsWith('Assistant: ')) {
                    conversation.push({ role: 'model', parts: [{ text: line.substring(11) }] });
                }
            }
        }

        // Add current user message
        conversation.push({ role: 'user', parts: [{ text: cleanMessage || "Describe this image" }] });

        let aiResponse = null;
        let apiUsed = null;

        try {
            // Try primary API with key rotation first
            const primaryResult = await callPrimaryGeminiAPI(conversation, imageUrl);
            aiResponse = primaryResult.response;
            apiUsed = primaryResult.apiType;
        } catch (primaryError) {
            console.error('All primary APIs failed, trying secondary backup:', primaryError.message);
            
            // Try secondary API as fallback
            try {
                const secondaryResult = await callSecondaryAPI(cleanMessage || "Describe this image", imageUrl);
                aiResponse = secondaryResult.response;
                apiUsed = 'secondary (backup)';
            } catch (secondaryError) {
                console.error('Secondary API also failed:', secondaryError.message);
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
        const modifiedHeader = `${apiIndicator} | 𝗔𝗜 𝗔𝘀𝘀𝗶𝘀𝘁𝗮𝗻𝘁${apiUsed === 'secondary (backup)' ? ' (Backup)' : ''}\n・────────────・\n`;

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