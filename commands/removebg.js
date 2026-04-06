const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const API_ENDPOINT = "https://api-library-kohi.onrender.com/api/removebg";

module.exports = {
  name: ['removebg', 'rbg', 'nobg', 'erasebg'],
  usage: 'Send an image and type "removebg"',
  version: '1.0.0',
  author: 'AutoPageBot',
  category: 'images',
  cooldown: 5,

  async execute(senderId, args, pageAccessToken, imageUrl) {
    if (!imageUrl) {
      return sendMessage(senderId, {
        text: `❌ Please send an image first, then type "removebg" to remove its background.`
      }, pageAccessToken);
    }

    await sendMessage(senderId, { 
      text: '🔄 Removing background, please wait...' 
    }, pageAccessToken);

    try {
      const encodedUrl = encodeURIComponent(imageUrl);
      const fullApiUrl = `${API_ENDPOINT}?url=${encodedUrl}`;
      
      const response = await axios.get(fullApiUrl, { timeout: 30000 });

      if (!response.data.status || !response.data.data || !response.data.data.url) {
        throw new Error("Invalid API response structure");
      }

      const processedImageUrl = response.data.data.url;

      await sendMessage(senderId, {
        text: '✅ Background removed successfully!',
        attachment: {
          type: 'image',
          payload: {
            url: processedImageUrl
          }
        }
      }, pageAccessToken);

    } catch (error) {
      console.error("RemoveBG Command Error:", error);
      
      let errorMessage = "An error occurred while removing background.";
      
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = "API endpoint not found (404).";
        } else if (error.response.status === 400) {
          errorMessage = "Invalid image URL or bad request.";
        } else {
          errorMessage = `HTTP Error: ${error.response.status}`;
        }
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        errorMessage = "Request timed out. The service might be busy. Please try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      await sendMessage(senderId, {
        text: `❌ ${errorMessage}`
      }, pageAccessToken);
    }
  }
};