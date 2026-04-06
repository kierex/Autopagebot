const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: ['imgur'],
  usage: 'Send an image and type "imgur" to upload to Imgur',
  version: '1.0.0',
  author: 'AutoPageBot',
  category: 'uploader',
  cooldown: 0,

  async execute(senderId, args, pageAccessToken, imageUrl) {
    if (!imageUrl) {
      return sendMessage(senderId, {
        text: '❌ No attachment detected. Please send an image first.'
      }, pageAccessToken);
    }

    await sendMessage(senderId, { text: '⌛ 𝗨𝗽𝗹𝗼𝗮𝗱𝗶𝗻𝗴 𝘁𝗵𝗲 𝗶𝗺𝗮𝗴𝗲 𝘁𝗼 𝗜𝗺𝗴𝘂𝗿, 𝗽𝗹𝗲𝗮𝘀𝗲 𝘄𝗮𝗶𝘁...' }, pageAccessToken);

    try {
      // Updated API endpoint
      const response = await axios.get(`https://betadash-api-swordslush-production.up.railway.app/imgur?link=${encodeURIComponent(imageUrl)}`);
      const imgurLink = response?.data?.uploaded?.image;

      if (!imgurLink) {
        throw new Error('❌ Imgur link not found in the response');
      }

      await sendMessage(senderId, {
        text: `✅ 𝗨𝗽𝗹𝗼𝗮𝗱𝗲𝗱 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆\n\n${imgurLink}`
      }, pageAccessToken);
    } catch (error) {
      console.error('❌ Error uploading image to Imgur:', error.response?.data || error.message);
      await sendMessage(senderId, {
        text: '❌ An error occurred while uploading the image to Imgur. Please try again later.'
      }, pageAccessToken);
    }
  }
};