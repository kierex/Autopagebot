const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const API_ENDPOINT = "https://api-library-kohi.onrender.com/api/upscale";
const BACKUP_API_ENDPOINT = "https://betadash-api-swordslush-production.up.railway.app/upscale";

module.exports = {
  name: ['remini'],
  usage: 'Send an image and type "remini"',
  version: '1.0.0',
  author: 'AutoPageBot',
  category: 'images',
  cooldown: 5,

  async execute(senderId, args, pageAccessToken, imageUrl) {
    if (!imageUrl) {
      return sendMessage(senderId, {
        text: `❌ Please send an image first, then type "remini" to enhance it.`
      }, pageAccessToken);
    }

    await sendMessage(senderId, { 
      text: '🔄 Enhancing image, please wait...' 
    }, pageAccessToken);

    // Try primary API first, then backup
    let enhancedImageUrl = null;
    let errorOccurred = null;

    // Try primary API
    try {
      const encodedUrl = encodeURIComponent(imageUrl);
      const fullApiUrl = `${API_ENDPOINT}?url=${encodedUrl}`;
      
      const response = await axios.get(fullApiUrl, { timeout: 30000 });

      if (response.data.status && response.data.data && response.data.data.url) {
        enhancedImageUrl = response.data.data.url;
      } else {
        throw new Error("Invalid response from primary API");
      }
    } catch (primaryError) {
      console.error("Primary API Error:", primaryError.message);
      errorOccurred = primaryError;
      
      // Try backup API
      try {
        const encodedUrl = encodeURIComponent(imageUrl);
        const backupApiUrl = `${BACKUP_API_ENDPOINT}?imageUrl=${encodedUrl}`;
        
        const backupResponse = await axios.get(backupApiUrl, { timeout: 30000 });

        if (backupResponse.data && backupResponse.data.imageUrl) {
          enhancedImageUrl = backupResponse.data.imageUrl;
        } else {
          throw new Error("Invalid response from backup API");
        }
      } catch (backupError) {
        console.error("Backup API Error:", backupError.message);
        throw backupError; // Throw the backup error if both fail
      }
    }

    // Send enhanced image if successful
    if (enhancedImageUrl) {
      try {
        await sendMessage(senderId, {
          text: '✅ Image enhanced successfully!',
          attachment: {
            type: 'image',
            payload: {
              url: enhancedImageUrl
            }
          }
        }, pageAccessToken);
      } catch (sendError) {
        console.error("Error sending image:", sendError);
        await sendMessage(senderId, {
          text: '✅ Image enhanced successfully!\n\n⚠️ Could not display image directly. Here is the URL:\n' + enhancedImageUrl
        }, pageAccessToken);
      }
    } else {
      throw new Error("No image URL returned from any API");
    }

  } catch (error) {
    console.error("Remini Command Error:", error);
    
    let errorMessage = "An error occurred during image enhancement.";
    
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
};