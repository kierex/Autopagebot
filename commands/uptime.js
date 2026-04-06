const { sendMessage } = require('../handles/sendMessage');
const fs = require('fs');
const path = require('path');

const START_TIME_FILE = path.join(__dirname, '../start_time.json');

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

// Format uptime function
function formatUptime(seconds) {
    if (seconds < 0) seconds = 0;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

module.exports = {
    name: ['uptime', 'upt'],
    usage: 'uptime',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'system',
    cooldown: 3,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        // Get persistent server uptime
        const serverStartTime = getServerStartTime();
        const serverUptime = Math.floor((Date.now() - serverStartTime) / 1000);
        
        // Get current process uptime
        const processUptime = process.uptime();
        
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
        
        // Get bot version
        const botVersion = '2.1.0';
        
        const message = `🤖 𝗕𝗢𝗧 𝗨𝗣𝗧𝗜𝗠𝗘

━━━━━━━━━━━━━━━━━━━━━━━

⏱️ 𝗕𝗼𝘁 𝗨𝗽𝘁𝗶𝗺𝗲 (Persistent):
${formatUptime(serverUptime)}

⚡ 𝗖𝘂𝗿𝗿𝗲𝗻𝘁 𝗦𝗲𝘀𝘀𝗶𝗼𝗻:
${formatUptime(processUptime)}

━━━━━━━━━━━━━━━━━━━━━━━

📅 𝗦𝘁𝗮𝗿𝘁𝗲𝗱 𝗔𝘁:
${startDate}

🕐 𝗖𝘂𝗿𝗿𝗲𝗻𝘁 𝗧𝗶𝗺𝗲 (PHT):
${phTime}

━━━━━━━━━━━━━━━━━━━━━━━

🤖 𝗩𝗲𝗿𝘀𝗶𝗼𝗻: ${botVersion}
🟢 𝗦𝘁𝗮𝘁𝘂𝘀: Online
💚 𝗛𝗲𝗮𝗹𝘁𝗵: Healthy

━━━━━━━━━━━━━━━━━━━━━━━

💡 Type -ping to check response time
📊 Uptime persists across restarts!`;

        await sendMessage(senderId, { text: message }, pageAccessToken);
    }
};