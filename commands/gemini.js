const axios = require("axios");
const { sendMessage } = require('../handles/sendMessage');

// Direct Gemini API configuration
const GEMINI_API_KEY = 'AIzaSyCKFCGtkOcBcTgxrwGpPvM4gBiHPgia4Ak';
const GEMINI_MODEL = "gemini-2.5-flash";

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
        // Image + Text mode using direct Gemini API
        aiResponse = await callGeminiVisionAPI(finalPrompt, finalImageUrl, senderId);
      } 
      else if (finalPrompt) {
        // Text-only mode using direct Gemini API
        aiResponse = await callGeminiTextAPI(finalPrompt, senderId);
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
      else if (error.response?.status === 429) {
        errorMsg += `Rate limit exceeded. Please try again later.`;
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

// Function to call Gemini Text API directly
async function callGeminiTextAPI(prompt, uid) {
  try {
    // Build conversation context (optional - can be expanded for memory)
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    };

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 60000
      }
    );

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid response from Gemini API');
    }
  } catch (error) {
    console.error("Gemini Text API Error:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
}

// Function to call Gemini Vision API with image
async function callGeminiVisionAPI(prompt, imageUrl, uid) {
  try {
    // Fetch and convert image to base64
    const imageResp = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    const imageData = Buffer.from(imageResp.data, 'binary').toString('base64');
    
    // Determine mime type from URL or default to jpeg
    let mimeType = 'image/jpeg';
    if (imageUrl.match(/\.png/i)) mimeType = 'image/png';
    else if (imageUrl.match(/\.gif/i)) mimeType = 'image/gif';
    else if (imageUrl.match(/\.webp/i)) mimeType = 'image/webp';
    
    // Build payload with image
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageData
              }
            }
          ]
        }
      ]
    };

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 90000 // 90 seconds for image processing
      }
    );

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid response from Gemini Vision API');
    }
  } catch (error) {
    console.error("Gemini Vision API Error:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
}

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