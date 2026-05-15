const { sendMessage } = require('../handles/sendMessage');
const tokenManager = require('../handles/tokenManager');
const fs = require('fs');
const path = require('path');

const START_TIME_FILE = path.join(__dirname, '../storage/start_time.json');

// Ensure storage directory exists
const STORAGE_DIR = path.join(__dirname, '../storage');
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Load or get server start time
function getServerStartTime() {
    try {
        if (fs.existsSync(START_TIME_FILE)) {
            const data = JSON.parse(fs.readFileSync(START_TIME_FILE, 'utf8'));
            return data.startTime;
        }
    } catch (error) {
        console.error('Error loading start time:', error.message);
    }
    return Date.now();
}

// Format uptime function (simplified)
function formatUptime(seconds) {
    if (seconds < 0) seconds = 0;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

// Calculate uptime for a specific bot/page
function getBotUptime(connectedAt) {
    if (!connectedAt) return 'N/A';
    const start = new Date(connectedAt).getTime();
    const now = Date.now();
    const uptimeSec = Math.floor((now - start) / 1000);
    return formatUptime(uptimeSec);
}

module.exports = {
    name: ['uptime', 'upt', 'status', 'botstatus'],
    usage: 'uptime [page_id]',
    description: 'Show bot uptime and status. Use "uptime list" to see all bots.',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'system',
    cooldown: 3,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        // Get current page ID from the event
        const currentPageId = event?.recipient?.id || event?.sender?.id;
        
        // Check if user wants to see all bots
        if (args && args[0] && args[0].toLowerCase() === 'list') {
            await showAllBotsStatus(senderId, pageAccessToken);
            return;
        }
        
        // Check if user specified a specific page ID
        let targetPageId = currentPageId;
        if (args && args[0] && args[0].match(/^\d+$/)) {
            targetPageId = args[0];
        }
        
        // Get bot info from tokenManager
        let botInfo = null;
        if (targetPageId) {
            botInfo = await tokenManager.getToken(targetPageId);
        }
        
        // Get server uptime
        const serverStartTime = getServerStartTime();
        const serverUptime = Math.floor((Date.now() - serverStartTime) / 1000);
        
        // Get current process uptime
        const processUptime = process.uptime();
        
        // Get current time in Manila timezone
        const phTime = new Date().toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        
        const startDate = new Date(serverStartTime).toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        
        const botVersion = '2.1.0';
        
        // Build message based on whether we have bot info
        let message = '';
        
        if (botInfo) {
            // Bot-specific uptime
            const botUptime = getBotUptime(botInfo.connectedAt);
            
            message = `🤖 𝗕𝗢𝗧 𝗨𝗣𝗧𝗜𝗠𝗘 - ${botInfo.name || 'Your Bot'}\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `📌 𝗕𝗼𝘁 𝗡𝗮𝗺𝗲: ${botInfo.name || 'N/A'}\n` +
                      `🆔 𝗣𝗮𝗴𝗲 𝗜𝗗: ${botInfo.id || targetPageId}\n` +
                      `👤 𝗢𝘄𝗻𝗲𝗿: ${botInfo.owner || 'N/A'}\n\n` +
                      `⏱️ 𝗕𝗼𝘁 𝗨𝗽𝘁𝗶𝗺𝗲:\n` +
                      `${botUptime}\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `🔧 𝗦𝗲𝗿𝘃𝗲𝗿 𝗨𝗽𝘁𝗶𝗺𝗲:\n` +
                      `${formatUptime(serverUptime)}\n\n` +
                      `⚡ 𝗖𝘂𝗿𝗿𝗲𝗻𝘁 𝗦𝗲𝘀𝘀𝗶𝗼𝗻:\n` +
                      `${formatUptime(processUptime)}\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `📅 𝗦𝘁𝗮𝗿𝘁𝗲𝗱 𝗔𝘁:\n${startDate}\n\n` +
                      `🕐 𝗖𝘂𝗿𝗿𝗲𝗻𝘁 𝗧𝗶𝗺𝗲 (PHT):\n${phTime}\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `🤖 𝗩𝗲𝗿𝘀𝗶𝗼𝗻: ${botVersion}\n` +
                      `🟢 𝗦𝘁𝗮𝘁𝘂𝘀: Online\n` +
                      `💚 𝗛𝗲𝗮𝗹𝘁𝗵: Healthy\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `📊 *Commands:*\n` +
                      `• uptime - This bot's uptime\n` +
                      `• uptime list - All connected bots\n` +
                      `• uptime <page_id> - Specific bot uptime`;
        } else {
            // Generic uptime without specific bot
            message = `🤖 𝗕𝗢𝗧 𝗨𝗣𝗧𝗜𝗠𝗘\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `⏱️ 𝗦𝗲𝗿𝘃𝗲𝗿 𝗨𝗽𝘁𝗶𝗺𝗲:\n` +
                      `${formatUptime(serverUptime)}\n\n` +
                      `⚡ 𝗖𝘂𝗿𝗿𝗲𝗻𝘁 𝗦𝗲𝘀𝘀𝗶𝗼𝗻:\n` +
                      `${formatUptime(processUptime)}\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `📅 𝗦𝘁𝗮𝗿𝘁𝗲𝗱 𝗔𝘁:\n${startDate}\n\n` +
                      `🕐 𝗖𝘂𝗿𝗿𝗲𝗻𝘁 𝗧𝗶𝗺𝗲 (PHT):\n${phTime}\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `🤖 𝗩𝗲𝗿𝘀𝗶𝗼𝗻: ${botVersion}\n` +
                      `🟢 𝗦𝘁𝗮𝘁𝘂𝘀: Online\n` +
                      `💚 𝗛𝗲𝗮𝗹𝘁𝗵: Healthy\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `📊 *Commands:*\n` +
                      `• uptime - This bot's uptime\n` +
                      `• uptime list - All connected bots\n` +
                      `• uptime <page_id> - Specific bot uptime`;
        }
        
        await sendMessage(senderId, { text: message }, pageAccessToken);
    }
};

// Show all connected bots status
async function showAllBotsStatus(senderId, pageAccessToken) {
    try {
        const { sendMessage } = require('../handles/sendMessage');
        const sessions = await tokenManager.getAllSessions();
        
        if (!sessions || sessions.length === 0) {
            await sendMessage(senderId, { 
                text: '📭 *No Active Bots*\n\nNo bots are currently connected. Use "addbot" command to connect a page.' 
            }, pageAccessToken);
            return;
        }
        
        let message = `📊 *ALL CONNECTED BOTS*\n\n` +
                     `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                     `Total: ${sessions.length} active bot(s)\n\n`;
        
        for (let i = 0; i < sessions.length; i++) {
            const bot = sessions[i];
            const uptime = getBotUptime(bot.connectedAt);
            const statusIcon = bot.lastActive && (Date.now() - new Date(bot.lastActive).getTime() < 60000) ? '🟢' : '🟡';
            
            message += `${i + 1}. ${statusIcon} *${bot.name || 'Unnamed'}*\n` +
                      `   🆔 ID: ${bot.id}\n` +
                      `   👤 Owner: ${bot.owner || 'Unknown'}\n` +
                      `   ⏱️ Uptime: ${uptime}\n` +
                      `   🔗 m.me/${bot.username || bot.id}\n\n`;
        }
        
        message += `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `🟢 Online (active in last minute)\n` +
                  `🟡 Idle (inactive)\n\n` +
                  `💡 Use "uptime <page_id>" for detailed bot info`;
        
        await sendMessage(senderId, { text: message }, pageAccessToken);
        
    } catch (error) {
        console.error('Error showing all bots:', error);
        await sendMessage(senderId, { text: '❌ Failed to retrieve bot list. Please try again.' }, pageAccessToken);
    }
}