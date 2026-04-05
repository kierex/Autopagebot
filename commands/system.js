const { sendMessage } = require('../handles/sendMessage');
const os = require('os');

module.exports = {
    name: ['system', 'sysinfo', 'server'],
    usage: 'system',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'system',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024);
        const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024);
        const usedMem = totalMem - freeMem;
        
        const loadAvg = os.loadavg();
        const platform = os.platform();
        const release = os.release();
        const hostname = os.hostname();
        
        const message = `🖥️ 𝗦𝗬𝗦𝗧𝗘𝗠 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡

📡 𝗛𝗼𝘀𝘁: ${hostname}
💻 𝗢𝗦: ${platform} ${release}
⚙️ 𝗔𝗿𝗰𝗵: ${os.arch()}

💾 𝗠𝗲𝗺𝗼𝗿𝘆:
• Total: ${totalMem} GB
• Used: ${usedMem} GB
• Free: ${freeMem} GB

📊 𝗟𝗼𝗮𝗱 𝗔𝘃𝗲𝗿𝗮𝗴𝗲:
• 1 min: ${loadAvg[0].toFixed(2)}
• 5 min: ${loadAvg[1].toFixed(2)}
• 15 min: ${loadAvg[2].toFixed(2)}

🤖 Node Version: ${process.version}
🟢 Status: Online`;

        await sendMessage(senderId, { text: message }, pageAccessToken);
    }
};