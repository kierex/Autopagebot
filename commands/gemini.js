const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { sendMessage } = require('../handles/sendMessage');

// Initialize Gemini with API key - YOU CAN CHANGE THIS
const GEMINI_API_KEY = "AIzaSyD5U9SFqJ4FiSQv00pXb06Kv3ZH9H76JjI"; // 👈 PASTE YOUR API KEY HERE

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

module.exports = {
  name: "gemini",
  description: "Interact with Gemini 1.5/1.5 Pro for text or image input (Official API)",
  author: "AutoPageBot",
  version: "2.0.0",
  category: "ai",
  cooldown: 3,

  async execute(senderId, args, pageAccessToken, event, imageUrl, sendMessageFunc, imageCache) {
    // Check if API key is configured
    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
      return sendMessage(senderId, { 
        text: `⚠️ 𝗚𝗲𝗺𝗶𝗻𝗶 𝗔𝗣𝗜 𝗞𝗲𝘆 𝗡𝗲𝗲𝗱𝗲𝗱\n━━━━━━━━━━━━━━━━━━\nPlease set your Gemini API key in the command file.\n\n📍 Location: commands/gemini.js\n🔑 Variable: GEMINI_API_KEY\n\n📝 Get your API key at:\nhttps://makersuite.google.com/app/apikey` 
      }, pageAccessToken);
    }

    const userPrompt = args.join(" ");

    // Check if there's a question or image
    if (!userPrompt && !imageUrl) {
      return sendMessage(
        senderId,
        { text: `✨ 𝗚𝗲𝗺𝗶𝗻𝗶 𝗔𝗜\n━━━━━━━━━━━━━━━━━━\nℹ️ Please provide a question or image.\n\n📝 Usage:\n• Text: gemini what is AI?\n• Image: gemini describe this [with image]\n• Image URL: gemini analyze` },
        pageAccessToken
      );
    }

    try {
      // Check for image URL in args if no direct imageUrl
      let finalImageUrl = imageUrl;
      let finalPrompt = userPrompt;

      if (!finalImageUrl) {
        const urlPattern = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|heic|heif|ico|jfif|avif|cur))/i;
        
        // Check if any argument is an image URL
        for (let i = 0; i < args.length; i++) {
          if (urlPattern.test(args[i])) {
            finalImageUrl = args[i];
            // Remove URL from prompt
            const argsWithoutUrl = [...args];
            argsWithoutUrl.splice(i, 1);
            finalPrompt = argsWithoutUrl.join(" ");
            break;
          }
        }

        // Check for replied image
        if (!finalImageUrl && event.message.reply_to && event.message.reply_to.mid) {
          finalImageUrl = await getRepliedImage(event.message.reply_to.mid, pageAccessToken);
        } 
        // Check for attached image
        else if (!finalImageUrl && event.message?.attachments && event.message.attachments[0]?.type === 'image') {
          finalImageUrl = event.message.attachments[0].payload.url;
        }
      }

      // Set default prompt if only image provided
      if (!finalPrompt && finalImageUrl) {
        finalPrompt = "Please describe this image in detail.";
      }

      // Initialize model
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      let result;
      let aiResponse;

      if (finalImageUrl && finalPrompt) {
        // Image + Text mode
        const imageResponse = await axios.get(finalImageUrl, {
          responseType: 'arraybuffer',
          timeout: 30000
        });
        
        const base64Image = Buffer.from(imageResponse.data).toString('base64');
        const mimeType = imageResponse.headers['content-type'] || 'image/jpeg';
        
        result = await model.generateContent([
          { text: finalPrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          }
        ]);
        
        aiResponse = await result.response.text();
      } 
      else if (finalPrompt) {
        // Text-only mode
        result = await model.generateContent(finalPrompt);
        aiResponse = await result.response.text();
      }
      else {
        return sendMessage(senderId, { text: `❌ Please provide a question or image.` }, pageAccessToken);
      }

      if (!aiResponse) {
        throw new Error('No response from Gemini API');
      }

      // Format and send response
      const message = `✨ 𝗚𝗲𝗺𝗶𝗻𝗶 𝗔𝗜\n━━━━━━━━━━━━━━━━━━\n${aiResponse}\n━━━━━━━━━━━━━━━━━━\n💡 Powered by Google Gemini 1.5 Flash`;
      
      await sendConcatenatedMessage(senderId, message, pageAccessToken);

    } catch (error) {
      console.error("Gemini Error:", error);
      
      let errorMsg = `❌ Error: `;
      
      if (error.message.includes('API key') || error.message.includes('403') || error.message.includes('401')) {
        errorMsg += `Invalid API key. Please check your Gemini API key in the command file.`;
      } 
      else if (error.message.includes('safety')) {
        errorMsg += `Content blocked by Gemini's safety filters. Please try a different prompt or image.`;
      }
      else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        errorMsg += `Request timeout. Please try again.`;
      }
      else if (error.message.includes('quota')) {
        errorMsg += `API quota exceeded. Please try again later.`;
      }
      else {
        errorMsg += error.message || "Something went wrong.";
      }
      
      sendMessage(senderId, { text: errorMsg }, pageAccessToken);
    }
  }
};

// Function to get image from replied message
async function getRepliedImage(mid, pageAccessToken) {
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v21.0/${mid}/attachments`,
      {
        params: { access_token: pageAccessToken }
      }
    );

    if (data?.data?.length > 0 && data.data[0].image_data) {
      return data.data[0].image_data.url;
    }
    return null;
  } catch (error) {
    console.error("Error getting replied image:", error.message);
    return null;
  }
}

// Send long messages in chunks
async function sendConcatenatedMessage(senderId, text, pageAccessToken) {
  const maxMessageLength = 1900;

  if (text.length > maxMessageLength) {
    const messages = splitMessageIntoChunks(text, maxMessageLength);
    for (let i = 0; i < messages.length; i++) {
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 500));
      await sendMessage(senderId, { text: messages[i] }, pageAccessToken);
    }
  } else {
    await sendMessage(senderId, { text }, pageAccessToken);
  }
}

// Split message into chunks
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}