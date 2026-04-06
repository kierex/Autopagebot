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

    try {
      // Updated API endpoint
      const apiUrl = `https://api-library-kohi.onrender.com/api/removebg?url=${encodeURIComponent(imageUrl)}`;
      const response = await axios.get(apiUrl);

      // Check the new response structure
      if (response.data?.status && response.data?.data?.url) {
        await sendMessage(senderId, {
          attachment: {
            type: "image",
            payload: {
              url: response.data.data.url
            }
          }
        }, pageAccessToken);
      } else {
        await sendMessage(senderId, {
          text: `❌ Failed to remove background. Reason: ${response.data?.message || 'Unknown error'}`
        }, pageAccessToken);
      }

    } catch (err) {
      console.error("❌ Error removing background:", err);
      await sendMessage(senderId, {
        text: `❌ An error occurred while removing the background. Please try again later.`
      }, pageAccessToken);
    }
  }
};