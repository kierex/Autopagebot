const axios = require("axios");
const { sendMessage } = require('../handles/sendMessage');

// Track active sessions
const activeSessions = new Map();

module.exports = {
  name: "autoshare",
  usage: "autoshare [cookie] | [link] | [limit]",
  author: "AutoPageBot",
  version: "1.0.0",
  category: "tools",
  cooldown: 10,

  async execute(senderId, args, pageAccessToken, event) {
    // Check if user already has an active session
    if (activeSessions.has(senderId)) {
      return sendMessage(
        senderId,
        { text: `⏳ You already have an active share process running!\n\nPlease wait for it to complete before starting a new one.` },
        pageAccessToken
      );
    }

    // Check if args are provided
    if (!args.length) {
      return sendMessage(
        senderId,
        { text: `🔗 𝗔𝘂𝘁𝗼 𝗦𝗵𝗮𝗿𝗲 𝗧𝗼𝗼𝗹\n━━━━━━━━━━━━━━━━━━\nℹ️ Automatically share Facebook posts.\n\n📝 Usage:\nautoshare [cookie] | [link] | [limit]\n\n📌 Example:\nautoshare cookie=data1; data2 | https://facebook.com/post/123 | 50\n\n💡 Separate with " | "\n⚠️ Limit is required! No maximum limit.` },
        pageAccessToken
      );
    }

    // Parse the arguments: cookie | link | limit
    const fullInput = args.join(' ');
    const parts = fullInput.split('|').map(part => part.trim());

    if (parts.length < 3) {
      return sendMessage(
        senderId,
        { text: `❌ Missing parameters!\n\n📝 Format: autoshare [cookie] | [link] | [limit]\n\n📌 Example: autoshare cookie=data1; data2 | https://facebook.com/post/123 | 50\n\n⚠️ Limit is required!` },
        pageAccessToken
      );
    }

    const cookie = parts[0];
    const link = parts[1];
    const limit = parseInt(parts[2]);

    // Validate cookie and link
    if (!cookie || !link) {
      return sendMessage(
        senderId,
        { text: `❌ Cookie and link are required!\n\n✓ Cookie: ${cookie ? 'Provided' : 'Missing'}\n✓ Link: ${link ? 'Provided' : 'Missing'}\n✓ Limit: ${limit || 'Missing'}` },
        pageAccessToken
      );
    }

    // Validate limit
    if (isNaN(limit)) {
      return sendMessage(
        senderId,
        { text: `❌ Invalid limit! Please provide a valid number.\n\n📌 Example: autoshare cookie | link | 50\n\n⚠️ Limit must be at least 1` },
        pageAccessToken
      );
    }

    if (limit < 1) {
      return sendMessage(
        senderId,
        { text: `❌ Limit must be at least 1!\n\n📌 Example: autoshare cookie | link | 50` },
        pageAccessToken
      );
    }

    // Validate link format
    if (!link.includes('facebook.com') && !link.includes('fb.com')) {
      return sendMessage(
        senderId,
        { text: `❌ Invalid Facebook link! Please provide a valid Facebook post URL.\n\nExample: https://facebook.com/post/123` },
        pageAccessToken
      );
    }

    // Mark session as active
    activeSessions.set(senderId, true);

    try {
      // Encode parameters for URL
      const encodedCookie = encodeURIComponent(cookie);
      const encodedLink = encodeURIComponent(link);

      // Build API URL with user-specified limit (no cap)
      const apiUrl = `https://vern-rest-api.vercel.app/api/share?cookie=${encodedCookie}&link=${encodedLink}&limit=${limit}`;

      // Send initial processing message
      await sendMessage(
        senderId,
        { text: `🔄 Processing share request...\n\n🔗 Target: ${link}\n📊 Limit: ${limit} share${limit > 1 ? 's' : ''}\n⏳ Please wait...\n\n⚠️ Do not send another command until this completes.` },
        pageAccessToken
      );

      const response = await axios.get(apiUrl, {
        timeout: 300000, // 5 minutes for large limits
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.data && response.data.status === true) {
        const successCount = response.data.success_count || 0;
        const message = `✅ AutoShare Complete!\n━━━━━━━━━━━━━━━━━━\n📊 Requested: ${limit}\n✅ Completed: ${successCount}\n📈 Success rate: ${Math.round((successCount / limit) * 100)}%\n\nThank you for using AutoShare!`;

        return sendMessage(
          senderId,
          { text: message },
          pageAccessToken
        );
      } else {
        throw new Error(response.data?.message || 'Share failed');
      }

    } catch (error) {
      console.error("AutoShare Error:", error.message);

      let errorMsg = `❌ Share failed: `;

      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMsg += `Request timeout. The limit may be too high. Please try with a smaller limit.`;
      } 
      else if (error.response?.status === 400) {
        errorMsg += `Invalid cookie or link. Please check your input.`;
      }
      else if (error.response?.status === 401) {
        errorMsg += `Authentication failed. Cookie may be expired.`;
      }
      else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        errorMsg += `Network error. Please check your connection.`;
      }
      else {
        errorMsg += error.message || "Something went wrong.";
      }

      await sendMessage(
        senderId,
        { text: errorMsg },
        pageAccessToken
      );
    } finally {
      // Always remove session whether success or error
      activeSessions.delete(senderId);
    }
  }
};