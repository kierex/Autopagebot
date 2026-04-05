const { sendMessage } = require('../handles/sendMessage');
const os = require('os');

module.exports = {
    name: ['botstats', 'stats', 'botinfo'],
    usage: 'botstats',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'system',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        const memoryUsage = process.memoryUsage();
        const memoryUsedMB = Math.round(memoryUsage.rss / 1024 / 1024);
        
        const cpuCores = os.cpus().length;
        const platform = os.platform();
        
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
        
        const message = `🤖 𝗕𝗢𝗧 𝗦𝗬𝗦𝗧𝗘𝗠 𝗦𝗧𝗔𝗧𝗦

⏱️ 𝗨𝗽𝘁𝗶𝗺𝗲: ${hours}h ${minutes}m ${seconds}s
💾 𝗠𝗲𝗺𝗼𝗿𝘆: ${memoryUsedMB} MB
🖥️ 𝗖𝗣𝗨 𝗖𝗼𝗿𝗲𝘀: ${cpuCores}
📡 𝗣𝗹𝗮𝘁𝗳𝗼𝗿𝗺: ${platform}
🤖 𝗩𝗲𝗿𝘀𝗶𝗼𝗻: 2.1.0
🟢 𝗦𝘁𝗮𝘁𝘂𝘀: Online

📅 𝗣𝗵𝗶𝗹𝗶𝗽𝗽𝗶𝗻𝗲 𝗧𝗶𝗺𝗲:
${phTime}

💡 Type -help to see available commands`;

        await sendMessage(senderId, { text: message }, pageAccessToken);
    }
};