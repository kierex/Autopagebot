const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: ['remini'],
  usage: 'Send an image and type "remini" to enhance it',
  version: '1.0.0',
  author: 'AutoPageBot',
  category: 'images',
  cooldown: 0,

  async execute(senderId, args, pageAccessToken, imageUrl) {
    if (!imageUrl) {
      return sendMessage(senderId, {
        text: `❌ 𝗣𝗹𝗲𝗮𝘀𝗲 𝘀𝗲𝗻𝗱 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲 𝗳𝗶𝗿𝘀𝘁, 𝘁𝗵𝗲𝗻 𝘁𝘆𝗽𝗲 "𝗿𝗲𝗺𝗶𝗻𝗶" 𝘁𝗼 𝗲𝗻𝗵𝗮𝗻𝗰𝗲 𝗶𝘁.`
      }, pageAccessToken);
    }

    await sendMessage(senderId, { text: '🔄 𝗨𝗽𝘀𝗰𝗮𝗹𝗶𝗻𝗴 𝘁𝗵𝗲 𝗶𝗺𝗮𝗴𝗲, 𝗽𝗹𝗲𝗮𝘀𝗲 𝘄𝗮𝗶𝘁...' }, pageAccessToken);

    // Multiple API endpoints with fallback
    const apis = [
      {
        url: `https://free-goat-api.onrender.com/4k?url=${encodeURIComponent(imageUrl)}`,
        responseKey: 'image'
      },
      {
        url: `https://betadash-api-swordslush-production.up.railway.app/upscale?imageUrl=${encodeURIComponent(imageUrl)}`,
        responseKey: 'imageUrl'
      }
    ];

    let lastError = null;

    for (let i = 0; i < apis.length; i++) {
      try {
        const api = apis[i];
        const { data } = await axios.get(api.url, { timeout: 30000 }); // 30 second timeout
        
        const enhancedImage = data[api.responseKey];
        
        if (enhancedImage && enhancedImage.startsWith('http')) {
          await sendMessage(senderId, {
            attachment: {
              type: 'image',
              payload: { url: enhancedImage }
            }
          }, pageAccessToken);
          return; // Success - exit function
        }
      } catch (error) {
        lastError = error;
        console.error(`API ${i + 1} failed:`, error?.response?.data || error.message);
        continue; // Try next API
      }
    }

    // All APIs failed
    console.error('All Remini APIs failed:', lastError);
    await sendMessage(senderId, {
      text: '❌ All enhancement services are currently unavailable. Please try again later.'
    }, pageAccessToken);
  }
};