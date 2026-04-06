const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: ['imgbb'],
  usage: 'Send an image and type "imgbb" to upload to ImgBB',
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

    await sendMessage(senderId, { text: '⌛ 𝗨𝗽𝗹𝗼𝗮𝗱𝗶𝗻𝗴 𝘁𝗵𝗲 𝗶𝗺𝗮𝗴𝗲 𝘁𝗼 𝗜𝗺𝗴𝗕𝗕, 𝗽𝗹𝗲𝗮𝘀𝗲 𝘄𝗮𝗶𝘁...' }, pageAccessToken);

    try {
      const response = await axios.get(`https://jerome-web.gleeze.com/service/api/upload-imgbbimage?imageUrl=${encodeURIComponent(imageUrl)}`);
      const imgbbLink = response?.data?.imgUrl;

      if (!imgbbLink) {
        throw new Error('❌ ImgBB link not found in the response');
      }

      await sendMessage(senderId, {
        text: `✅ 𝗨𝗽𝗹𝗼𝗮𝗱𝗲𝗱 𝗦𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆\n\n${imgbbLink}`
      }, pageAccessToken);
    } catch (error) {
      console.error('❌ Error uploading image to ImgBB:', error.response?.data || error.message);
      await sendMessage(senderId, {
        text: '❌ An error occurred while uploading the image to ImgBB. Please try again later.'
      }, pageAccessToken);
    }
  }
};