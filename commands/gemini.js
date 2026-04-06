const axios = require("axios");
const { sendMessage } = require('../handles/sendMessage');

// New Gemini API configuration
const GEMINI_API_URL = 'https://kryptonite-api-library.onrender.com/api/gemini-vision';

module.exports = {
  name: "gemini",
  usage: "ask or reply image",
  author: "AutoPageBot",
  version: "2.1.0",
  category: "ai",
  cooldown: 3,

  async execute(senderId, args, pageAccessToken, event, imageUrl, sendMessageFunc, imageCache) {
    const userPrompt = args.join(" ");

    // Check if there's a question or image
    if (!userPrompt && !imageUrl) {
      return sendMessage(
        senderId,
        { text: `✨ 𝗚𝗲𝗺𝗶𝗻𝗶 𝗔𝗜\n━━━━━━━━━━━━━━━━━━\nℹ️ Please provide a question or image.\n\n📝 Usage:\n• Text: gemini what is AI?\n• Image: gemini describe this [reply image]` },
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

      let aiResponse;

      if (finalImageUrl && finalPrompt) {
        // Image + Text mode using Krypton API
        const encodedPrompt = encodeURIComponent(finalPrompt);
        const encodedImageUrl = encodeURIComponent(finalImageUrl);
        const apiUrl = `${GEMINI_API_URL}?prompt=${encodedPrompt}&uid=${senderId}&imgUrl=${encodedImageUrl}&apikey=AIzaSyD5U9SFqJ4FiSQv00pXb06Kv3ZH9H76JjI`;
        
        const response = await axios.get(apiUrl, {
          timeout: 60000 // 60 seconds timeout
        });
        
        if (response.data && response.data.status === true) {
          aiResponse = response.data.response;
        } else {
          throw new Error(response.data?.message || "Failed to get response from Gemini API");
        }
      } 
      else if (finalPrompt) {
        // Text-only mode (no image)
        const encodedPrompt = encodeURIComponent(finalPrompt);
        const apiUrl = `${GEMINI_API_URL}?prompt=${encodedPrompt}&uid=${senderId}&apikey=AIzaSyD5U9SFqJ4FiSQv00pXb06Kv3ZH9H76JjI`;
        
        const response = await axios.get(apiUrl, {
          timeout: 60000
        });
        
        if (response.data && response.data.status === true) {
          aiResponse = response.data.response;
        } else {
          throw new Error(response.data?.message || "Failed to get response from Gemini API");
        }
      }
      else {
        return sendMessage(senderId, { text: `❌ Please provide a question or image.` }, pageAccessToken);
      }

      if (!aiResponse) {
        throw new Error('No response from Gemini API');
      }

      // Format and send response
      const message = `✨ 𝗚𝗲𝗺𝗶𝗻𝗶 𝗔𝗜\n━━━━━━━━━━━━━━━━━\n${aiResponse}\n━━━━━━━━━━━━━━━━━`;
      
      await sendConcatenatedMessage(senderId, message, pageAccessToken);

    } catch (error) {
      console.error("Gemini Error:", error);
      
      let errorMsg = `❌ Error: `;
      
      if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
        errorMsg += `Request timeout. Please try again.`;
      } 
      else if (error.response?.status === 403 || error.message.includes('API key')) {
        errorMsg += `API key error. Please contact support.`;
      }
      else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        errorMsg += `Network error. Please check your connection.`;
      }
      else {
        errorMsg += error.message || "Something went wrong.";
      }
      
      await sendMessage(senderId, { text: errorMsg }, pageAccessToken);
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