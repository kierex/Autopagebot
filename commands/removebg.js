const axios = require("axios");
const { sendMessage } = require("../handles/sendMessage");

module.exports = {
  name: ['removebg'],
  usage: 'Send an image and type "removebg" to remove background',
  version: '1.0.0',
  author: 'AutoPageBot',
  category: 'images',
  cooldown: 0,

  async execute(senderId, args, pageAccessToken, imageUrl) {
    if (!imageUrl) {
      return sendMessage(senderId, {
        text: `❌ 𝗣𝗹𝗲𝗮𝘀𝗲 𝘀𝗲𝗻𝗱 𝗮𝗻 𝗶𝗺𝗮𝗴𝗲 𝗳𝗶𝗿𝘀𝘁, 𝘁𝗵𝗲𝗻 𝘁𝘆𝗽𝗲 "𝗿𝗲𝗺𝗼𝘃𝗲𝗯𝗴" 𝘁𝗼 𝗿𝗲𝗺𝗼𝘃𝗲 𝗶𝘁𝘀 𝗯𝗮𝗰𝗸𝗴𝗿𝗼𝘂𝗻𝗱.`
      }, pageAccessToken);
    }

    await sendMessage(senderId, {
      text: "⌛ 𝗥𝗲𝗺𝗼𝘃𝗶𝗻𝗴 𝗯𝗮𝗰𝗸𝗴𝗿𝗼𝘂𝗻𝗱, 𝗽𝗹𝗲𝗮𝘀𝗲 𝘄𝗮𝗶𝘁..."
    }, pageAccessToken);

    // Multiple API endpoints with fallback support
    const apis = [
      {
        name: 'Free Goat API',
        url: `https://free-goat-api.onrender.com/rbg?url=${encodeURIComponent(imageUrl)}`,
        extractImage: (data) => data?.image,
        validate: (url) => url && url.startsWith('http')
      },
      {
        name: 'Kohi API',
        url: `https://api-library-kohi.onrender.com/api/removebg?url=${encodeURIComponent(imageUrl)}`,
        extractImage: (data) => data?.data?.url,
        validate: (url) => url && data?.status === true
      },
      {
        name: 'BetaDash API',
        url: `https://betadash-api-swordslush-production.up.railway.app/removebg?imageUrl=${encodeURIComponent(imageUrl)}`,
        extractImage: (data) => data?.imageUrl || data?.image,
        validate: (url) => url && url.startsWith('http')
      }
    ];

    let lastError = null;

    for (let i = 0; i < apis.length; i++) {
      try {
        const api = apis[i];
        console.log(`Trying ${api.name}...`);
        
        const response = await axios.get(api.url, { timeout: 25000 }); // 25 second timeout
        
        const imageUrl_result = api.extractImage(response.data);
        
        if (imageUrl_result && api.validate(imageUrl_result)) {
          await sendMessage(senderId, {
            attachment: {
              type: "image",
              payload: { url: imageUrl_result }
            }
          }, pageAccessToken);
          return; // Success - exit function
        } else {
          console.log(`${api.name} returned invalid response:`, response.data);
        }
        
      } catch (error) {
        lastError = error;
        console.error(`${api.name} failed:`, error?.response?.data || error.message);
        
        // Special handling for BetaDash 500 errors
        if (error?.response?.status === 500) {
          console.log(`BetaDash API returned 500 - server error, skipping...`);
        }
        continue; // Try next API
      }
    }

    // All APIs failed
    console.error('All RemoveBG APIs failed:', lastError);
    
    let errorMessage = '❌ All background removal services are currently unavailable.\n';
    errorMessage += 'Possible reasons:\n';
    errorMessage += '• Server maintenance or downtime\n';
    errorMessage += '• Rate limiting exceeded\n';
    errorMessage += '• Invalid image URL format\n\n';
    errorMessage += '💡 Tip: Try with a different image or try again later.';
    
    await sendMessage(senderId, {
      text: errorMessage
    }, pageAccessToken);
  }
};