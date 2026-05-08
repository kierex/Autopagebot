const axios = require("axios");
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: "shield",
  usage: "fbshield [cookie] | [enable]",
  author: "AutoPageBot",
  version: "1.0.0",
  category: "tools",
  cooldown: 10,

  async execute(senderId, args, pageAccessToken, event) {
    // Check if args are provided
    if (!args.length) {
      return sendMessage(
        senderId,
        { text: `🛡️ 𝗙𝗮𝗰𝗲𝗯𝗼𝗼𝗸 𝗣𝗿𝗼𝗳𝗶𝗹𝗲 𝗚𝘂𝗮𝗿𝗱\n━━━━━━━━━━━━━━━━━━\nℹ️ Enable or disable Facebook profile picture guard using cookies.\n\n📝 Usage:\nfbshield [cookie] | [enable]\n\n📌 Examples:\n• fbshield cookie=c_user=123; xs=456 | true\n• fbshield cookie=c_user=123; xs=456 | false\n\n💡 Separate cookie and enable with " | "\n🔒 enable: true (on) or false (off)` },
        pageAccessToken
      );
    }

    // Parse the arguments: cookie | enable
    const fullInput = args.join(' ');
    const parts = fullInput.split('|').map(part => part.trim());
    
    if (parts.length < 2) {
      return sendMessage(
        senderId,
        { text: `❌ Missing parameters!\n\n📝 Format: fbshield [cookie] | [enable]\n\n📌 Example: fbshield c_user=123; xs=456 | true\n\n⚠️ enable must be 'true' or 'false'` },
        pageAccessToken
      );
    }

    const cookie = parts[0];
    const enable = parts[1].toLowerCase();

    // Validate cookie
    if (!cookie) {
      return sendMessage(
        senderId,
        { text: `❌ Cookie is required!\n\nHow to get your Facebook cookie:\n1. Install Cookie Editor extension\n2. Login to Facebook\n3. Export cookies\n4. Copy the cookie string\n\nRequired cookies: c_user, xs, datr` },
        pageAccessToken
      );
    }

    // Validate enable parameter
    if (enable !== 'true' && enable !== 'false') {
      return sendMessage(
        senderId,
        { text: `❌ Invalid enable value!\n\nUse: true to enable guard, false to disable guard\n\n📌 Example: fbshield cookie=data | true` },
        pageAccessToken
      );
    }

    // Extract user ID from cookie
    const userId = extractUserId(cookie);
    if (!userId) {
      return sendMessage(
        senderId,
        { text: `❌ Invalid cookie! Could not extract user ID.\n\nMake sure your cookie contains 'c_user=...'` },
        pageAccessToken
      );
    }

    try {
      // Send processing message
      await sendMessage(
        senderId,
        { text: `🔄 ${enable === 'true' ? 'Enabling' : 'Disabling'} profile guard...\n\n👤 User ID: ${userId}\n⏳ Please wait...` },
        pageAccessToken
      );

      // Get access token from cookie first
      const accessToken = await getAccessTokenFromCookie(cookie);
      if (!accessToken) {
        throw new Error('Failed to extract access token from cookie');
      }

      // Generate session IDs
      const session_id = generateUUID();
      const client_mutation_id = generateUUID();

      // Prepare GraphQL variables
      const variables = {
        "0": {
          is_shielded: enable === "true",
          session_id: session_id,
          client_mutation_id: client_mutation_id
        }
      };

      // Build GraphQL request
      const url = `https://graph.facebook.com/graphql`;
      const params = new URLSearchParams({
        variables: JSON.stringify(variables),
        method: "post",
        doc_id: "1477043292367183",
        query_name: "IsShieldedSetMutation",
        strip_defaults: "false",
        strip_nulls: "false",
        locale: "en_US",
        client_country_code: "US",
        fb_api_req_friendly_name: "IsShieldedSetMutation",
        fb_api_caller_class: "IsShieldedSetMutation",
        access_token: accessToken
      });

      const response = await axios.post(`${url}?${params.toString()}`, {}, {
        headers: {
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      // Check if successful
      if (response.data && !response.data.error) {
        const action = enable === 'true' ? 'enabled' : 'disabled';
        const message = `✅ Profile guard ${action} successfully!\n\n` +
          `🛡️ Status: ${enable === 'true' ? 'PROTECTED' : 'PUBLIC'}\n` +
          `👤 Account: ${userId}\n` +
          `🕒 Time: ${new Date().toLocaleString()}\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `${enable === 'true' ? 
            '🔒 Your profile picture is now protected:\n• Cannot be downloaded\n• Cannot be screenshotted\n• Friends only visibility' : 
            '⚠️ Your profile picture is now public:\n• Can be downloaded\n• Can be screenshotted\n• Visible to everyone'}\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `💡 ${enable === 'true' ? 'Keep your cookie secure!' : 'Recommend re-enabling guard for privacy'}`;

        await sendMessage(senderId, { text: message }, pageAccessToken);
      } else {
        throw new Error(response.data?.error?.message || 'Failed to toggle profile guard');
      }

    } catch (error) {
      console.error("FB Shield Error:", error.message);
      
      let errorMsg = `❌ Profile guard ${enable === 'true' ? 'enable' : 'disable'} failed: `;
      
      if (error.message.includes('cookie') || error.message.includes('access token')) {
        errorMsg += `Invalid or expired cookie.\n\n💡 Solution: Get fresh Facebook cookies.`;
      } 
      else if (error.message.includes('checkpoint') || error.message.includes('blocked')) {
        errorMsg += `Account is in checkpoint or temporarily blocked.\n\n💡 Solution: Complete Facebook verification first.`;
      }
      else if (error.message.includes('permission')) {
        errorMsg += `Insufficient permission.\n\n💡 Make sure you own this account.`;
      }
      else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMsg += `Request timeout.\n\n💡 Solution: Try again or check your connection.`;
      }
      else {
        errorMsg += error.message || "Something went wrong.";
      }
      
      errorMsg += `\n\n🛡️ Common fixes:\n• Refresh your cookie\n• Complete any Facebook checkpoints\n• Don't use a locked account\n• Make sure cookie has c_user and xs values`;
      
      await sendMessage(senderId, { text: errorMsg }, pageAccessToken);
    }
  }
};

// Extract user ID from cookie
function extractUserId(cookie) {
  const match = cookie.match(/c_user=(\d+)/);
  return match ? match[1] : null;
}

// Extract access token from cookie
async function getAccessTokenFromCookie(cookie) {
  try {
    // First try to get from cookie directly
    const tokenMatch = cookie.match(/access_token=([^;]+)/);
    if (tokenMatch) {
      return tokenMatch[1];
    }
    
    // If not in cookie, fetch from Facebook
    const response = await axios.get('https://mbasic.facebook.com/', {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // Extract EAA access token from page
    const tokenPattern = /EAA[A-Za-z0-9]+/;
    const match = response.data.match(tokenPattern);
    
    if (match) {
      return match[0];
    }
    
    // Fallback: try to get from Graph API
    const userId = extractUserId(cookie);
    if (userId) {
      const graphResponse = await axios.get(`https://graph.facebook.com/v21.0/${userId}`, {
        params: {
          fields: 'id,name',
          access_token: 'none'
        },
        headers: {
          'Cookie': cookie
        }
      });
      
      if (graphResponse.data && graphResponse.data.id) {
        // Return a basic token (may not work for all operations)
        return cookie;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get access token:', error.message);
    return null;
  }
}

// Generate UUID for session ID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}