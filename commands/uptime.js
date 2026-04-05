const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['uptime'],
    usage: 'uptime',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'system',
    cooldown: 3,

    async execute(senderId, args, pageAccessToken) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        let uptimeString = '';
        if (days > 0) uptimeString += `${days}d `;
        if (hours > 0) uptimeString += `${hours}h `;
        if (minutes > 0) uptimeString += `${minutes}m `;
        uptimeString += `${seconds}s`;
        
        // Get Philippine Time
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
        
        const message = `⏱️ 𝗕𝗢𝗧 𝗨𝗣𝗧𝗜𝗠𝗘
        
Bot has been running for: ${uptimeString}

🟢 Status: Online
🤖 Version: 2.1.0

📅 Current Time (PHT):
${phTime}

💡 Type -ping to check response time`;

        await sendMessage(senderId, { text: message }, pageAccessToken);
    }
};