const { sendMessage } = require('../handles/sendMessage');
const os = require('os');

module.exports = {
    name: ['uptime', 'alive'],
    usage: 'uptime',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'system',
    cooldown: 3,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        // Get process uptime
        const processUptime = process.uptime();
        const processHours = Math.floor(processUptime / 3600);
        const processMinutes = Math.floor((processUptime % 3600) / 60);
        const processSeconds = Math.floor(processUptime % 60);

        // Get system uptime
        const systemUptime = os.uptime();
        const systemHours = Math.floor(systemUptime / 3600);
        const systemMinutes = Math.floor((systemUptime % 3600) / 60);
        const systemSeconds = Math.floor(systemUptime % 60);

        // Get memory usage
        const memoryUsage = process.memoryUsage();
        const memoryUsedMB = Math.round(memoryUsage.rss / 1024 / 1024);
        const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

        // Get current time
        const currentTime = new Date();
        const timeString = currentTime.toLocaleString();

        const message = `🤖 𝗕𝗼𝘁 𝗨𝗽𝘁𝗶𝗺𝗲 𝗜𝗻𝗳𝗼

⏱️ 𝗕𝗼𝘁 𝗨𝗽𝘁𝗶𝗺𝗲:
• ${processHours}h ${processMinutes}m ${processSeconds}s

🖥️ 𝗦𝘆𝘀𝘁𝗲𝗺 𝗨𝗽𝘁𝗶𝗺𝗲:
• ${systemHours}h ${systemMinutes}m ${systemSeconds}s

💾 𝗠𝗲𝗺𝗼𝗿𝘆 𝗨𝘀𝗮𝗴𝗲:
• RSS: ${memoryUsedMB} MB
• Heap: ${heapUsedMB} MB / ${heapTotalMB} MB

📅 𝗦𝗲𝗿𝘃𝗲𝗿 𝗧𝗶𝗺𝗲:
• ${timeString}

🟢 𝗦𝘁𝗮𝘁𝘂𝘀: Online
⚡ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻: 2.1.0`;

        await sendMessage(senderId, { text: message }, pageAccessToken);
    }
};