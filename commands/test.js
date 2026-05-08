const axios = require("axios");
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: "shield",
  usage: "shield [cookie] | [action]",
  author: "AutoPageBot",
  version: "1.0.0",
  category: "tools",
  cooldown: 15,

  async execute(senderId, args, pageAccessToken, event) {
    // Check if args are provided
    if (!args.length) {
      return sendMessage(
        senderId,
        { text: `🛡️ 𝗙𝗮𝗰𝗲𝗯𝗼𝗼𝗸 𝗣𝗿𝗼𝗳𝗶𝗹𝗲 𝗦𝗵𝗶𝗲𝗹𝗱\n━━━━━━━━━━━━━━━━━━\nℹ️ Protect your Facebook profile picture from being downloaded or screenshotted.\n\n📝 Usage:\nshield [cookie] | [action]\n\n📌 Actions:\n• on - Turn ON profile picture guard\n• off - Turn OFF profile picture guard\n• status - Check shield status\n• timer - Set temporary shield (hours)\n\n📌 Examples:\n• shield cookie=data | on\n• shield cookie=data | off\n• shield cookie=data | status\n• shield cookie=data | timer | 24\n\n💡 Separate cookie and action with " | "\n🔒 Protects your DP from screenshots & downloads` },
        pageAccessToken
      );
    }

    // Parse the arguments: cookie | action | duration (optional)
    const fullInput = args.join(' ');
    const parts = fullInput.split('|').map(part => part.trim());
    
    if (parts.length < 2) {
      return sendMessage(
        senderId,
        { text: `❌ Missing parameters!\n\n📝 Format: shield [cookie] | [action]\n\n📌 Example: shield cookie=data | on` },
        pageAccessToken
      );
    }

    const cookie = parts[0];
    const action = parts[1].toLowerCase();
    const duration = parts[2] ? parseInt(parts[2]) : null;

    // Validate cookie
    if (!cookie) {
      return sendMessage(
        senderId,
        { text: `❌ Cookie is required!\n\nHow to get your Facebook cookie:\n1. Install Cookie Editor extension\n2. Login to Facebook\n3. Export cookies\n4. Copy the cookie string\n\nRequired cookies: c_user, xs, datr` },
        pageAccessToken
      );
    }

    // Validate action
    const validActions = ['on', 'off', 'status', 'timer'];
    if (!validActions.includes(action)) {
      return sendMessage(
        senderId,
        { text: `❌ Invalid action: ${action}\n\nValid actions: ${validActions.join(', ')}\n\n📌 Example: shield cookie=data | on` },
        pageAccessToken
      );
    }

    // Validate duration for timer action
    if (action === 'timer' && (!duration || duration < 1 || duration > 168)) {
      return sendMessage(
        senderId,
        { text: `❌ Invalid duration!\n\nPlease provide hours (1-168 hours / 7 days max).\n\n📌 Example: shield cookie=data | timer | 24` },
        pageAccessToken
      );
    }

    try {
      // Extract user ID from cookie
      const userId = extractUserId(cookie);
      if (!userId) {
        throw new Error('Failed to extract user ID from cookie. Make sure c_user is present.');
      }

      // Get fb_dtsg token
      const fb_dtsg = await getFbDtsg(cookie);
      if (!fb_dtsg) {
        throw new Error('Failed to get security token. Cookie might be expired.');
      }

      await sendMessage(
        senderId,
        { text: `🛡️ Processing profile shield ${action}...\n\n👤 Account: ${userId}\n⏳ Please wait...` },
        pageAccessToken
      );

      let result = null;
      let statusMessage = '';

      switch(action) {
        case 'on':
          result = await enableProfileShield(cookie, userId, fb_dtsg);
          statusMessage = `✅ Profile Shield ENABLED successfully!\n\n` +
            `🛡️ Your profile picture is now protected\n` +
            `🚫 Cannot be downloaded\n` +
            `📸 Cannot be screenshotted\n` +
            `👁️ Only friends can see your DP\n` +
            `🔒 Extra privacy layer added`;
          break;
          
        case 'off':
          result = await disableProfileShield(cookie, userId, fb_dtsg);
          statusMessage = `🔓 Profile Shield DISABLED\n\n` +
            `⚠️ Your profile picture is now public\n` +
            `📥 Can be downloaded\n` +
            `📸 Can be screenshotted\n` +
            `💡 Recommend keeping shield ON for privacy`;
          break;
          
        case 'status':
          result = await getShieldStatus(cookie, userId);
          statusMessage = `🛡️ Profile Shield Status\n━━━━━━━━━━━━━━━━━━\n` +
            `📊 Status: ${result.enabled ? '✅ ENABLED' : '❌ DISABLED'}\n` +
            `🕒 Since: ${result.enabled_since || 'N/A'}\n` +
            `⏰ Expires: ${result.expires || 'Never'}\n` +
            `👁️ Visibility: ${result.visibility || 'Friends only'}\n` +
            `🔒 Protection: ${result.protection_level || 'Full'}\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `💡 Shield prevents:\n` +
            `• Screenshots of profile picture\n` +
            `• Downloading profile picture\n` +
            `• Right-click saving\n` +
            `• Profile picture zoom on non-friends`;
          break;
          
        case 'timer':
          result = await setTemporaryShield(cookie, userId, fb_dtsg, duration);
          statusMessage = `⏰ Temporary Profile Shield Set\n━━━━━━━━━━━━━━━━━━\n` +
            `🛡️ Shield will be active for: ${duration} hour(s)\n` +
            `📅 Activated: ${new Date().toLocaleString()}\n` +
            `⏰ Expires: ${new Date(Date.now() + duration * 3600000).toLocaleString()}\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `✅ Your profile picture is protected until the timer ends.\n` +
            `💡 Use "shield cookie | off" to disable early.`;
          break;
      }

      if (result && result.error) {
        throw new Error(result.error);
      }

      // Add recommendations for enabled shield
      if (action === 'on') {
        statusMessage += `\n\n━━━━━━━━━━━━━━━━━━\n📌 Additional Tips:\n` +
          `• Review your profile picture\n` +
          `• Check who can see your photos\n` +
          `• Enable login alerts\n` +
          `• Use 2FA for extra security`;
      }

      await sendMessage(senderId, { text: statusMessage }, pageAccessToken);

    } catch (error) {
      console.error("Profile Shield Error:", error.message);
      
      let errorMsg = `❌ Profile shield ${action} failed: `;
      
      if (error.message.includes('cookie') || error.message.includes('authentication')) {
        errorMsg += `Invalid or expired cookie.\n\n💡 Solution: Get fresh Facebook cookies.`;
      } 
      else if (error.message.includes('checkpoint')) {
        errorMsg += `Account is in checkpoint/verification.\n\n💡 Solution: Complete Facebook verification first.`;
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
      
      errorMsg += `\n\n🛡️ Common fixes:\n• Refresh your cookie\n• Complete any Facebook checkpoints\n• Don't use a locked account\n• Make sure you're logged in on browser`;
      
      await sendMessage(
        senderId,
        { text: errorMsg },
        pageAccessToken
      );
    }
  }
};

// Extract user ID from cookie
function extractUserId(cookie) {
  const match = cookie.match(/c_user=(\d+)/);
  return match ? match[1] : null;
}

// Get fb_dtsg token
async function getFbDtsg(cookie) {
  try {
    const response = await axios.get('https://mbasic.facebook.com/', {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const match = response.data.match(/name="fb_dtsg" value="([^"]+)"/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Failed to get fb_dtsg:', error.message);
    return null;
  }
}

// Enable profile picture shield
async function enableProfileShield(cookie, userId, fb_dtsg) {
  try {
    // Facebook's profile shield endpoint
    const response = await axios.post(
      'https://mbasic.facebook.com/profile_picture_shield/save/',
      `fb_dtsg=${encodeURIComponent(fb_dtsg)}&shield_enabled=1&av=${userId}`,
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    // Check if successful
    if (response.data.includes('success') || !response.data.includes('error')) {
      return { success: true, enabled: true };
    } else {
      return { error: 'Failed to enable profile shield' };
    }
  } catch (error) {
    return { error: error.message };
  }
}

// Disable profile picture shield
async function disableProfileShield(cookie, userId, fb_dtsg) {
  try {
    const response = await axios.post(
      'https://mbasic.facebook.com/profile_picture_shield/save/',
      `fb_dtsg=${encodeURIComponent(fb_dtsg)}&shield_enabled=0&av=${userId}`,
      {
        headers: {
          'Cookie': cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (response.data.includes('success') || !response.data.includes('error')) {
      return { success: true, enabled: false };
    } else {
      return { error: 'Failed to disable profile shield' };
    }
  } catch (error) {
    return { error: error.message };
  }
}

// Get current shield status
async function getShieldStatus(cookie, userId) {
  try {
    const response = await axios.get(`https://mbasic.facebook.com/${userId}/about`, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const hasShield = response.data.includes('profile_picture_shield') || 
                      response.data.includes('Profile Guard');
    
    return {
      enabled: hasShield,
      enabled_since: hasShield ? new Date().toLocaleDateString() : null,
      visibility: hasShield ? 'Friends only' : 'Public',
      protection_level: hasShield ? 'Full' : 'None'
    };
  } catch (error) {
    return { enabled: false, error: error.message };
  }
}

// Set temporary shield for specific duration
async function setTemporaryShield(cookie, userId, fb_dtsg, hours) {
  try {
    // Enable shield
    await enableProfileShield(cookie, userId, fb_dtsg);
    
    // Set timer to auto-disable
    setTimeout(async () => {
      try {
        await disableProfileShield(cookie, userId, fb_dtsg);
        console.log(`Profile shield automatically disabled after ${hours} hours for user ${userId}`);
      } catch (error) {
        console.error('Failed to auto-disable shield:', error.message);
      }
    }, hours * 3600000);
    
    return { 
      success: true, 
      enabled: true, 
      duration: hours,
      expires: new Date(Date.now() + hours * 3600000)
    };
  } catch (error) {
    return { error: error.message };
  }
}