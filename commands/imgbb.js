const axios = require('axios');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

const IMGBB_API_KEY = "1b4d99fa0c3195efe42ceb62670f2a25";

module.exports = {
  name: ['imgbb'],
  usage: 'Reply to an image with "imgbb"',
  version: '1.0.0',
  author: 'AutoPageBot',
  category: 'uploaders',
  cooldown: 5,

  async execute(senderId, args, pageAccessToken, imageUrl) {
    if (!imageUrl) {
      return sendMessage(senderId, {
        text: '❌ No attachment detected. Please send or reply to an image first.'
      }, pageAccessToken);
    }

    await sendMessage(senderId, { 
      text: '⌛ Uploading the image to ImgBB, please wait...' 
    }, pageAccessToken);

    try {
      // Download the image from Facebook URL
      const imageResponse = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000
      });
      
      // Prepare form data for ImgBB
      const formData = new FormData();
      formData.append('image', Buffer.from(imageResponse.data, 'binary'), { 
        filename: `image_${Date.now()}.jpg` 
      });

      // Upload to ImgBB
      const uploadResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data'
        },
        params: {
          key: IMGBB_API_KEY
        },
        timeout: 30000
      });

      if (!uploadResponse.data?.data?.url) {
        throw new Error('ImgBB URL not found in the response');
      }

      const imgbbLink = uploadResponse.data.data.url;
      const deleteUrl = uploadResponse.data.data.delete_url || 'Not available';

      await sendMessage(senderId, {
        text: `✅ Uploaded Successfully to ImgBB!\n\n🔗 Link: ${imgbbLink}\n🗑️ Delete URL: ${deleteUrl}`
      }, pageAccessToken);

    } catch (error) {
      console.error('Error uploading image to ImgBB:', error.response?.data || error.message);
      
      let errorMessage = 'An error occurred while uploading the image to ImgBB.';
      
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid image format or API error.';
      }
      
      await sendMessage(senderId, {
        text: `❌ ${errorMessage} Please try again later.`
      }, pageAccessToken);
    }
  }
};