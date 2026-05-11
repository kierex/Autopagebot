const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['donation'],
    description: 'Show donation information to support the bot service',
    usage: 'donation',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'system',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        try {
            // First send the text message with GCash info and admin contact
            const donationText = `💝 *Support AutoPageBot* 💝\n\n` +
                                 `━━━━━━━━━━━━━━━━━━━━\n\n` +
                                 `Your donations help keep this bot running and improve the service for everyone!\n\n` +
                                 `📱 *GCash Account:*\n` +
                                 `└ 0997 993 9317 - C.C\n\n` +
                                 `━━━━━━━━━━━━━━━━━━━━\n\n` +
                                 `👨‍💻 *Admin Contact:*\n` +
                                 `└ 📧 Gmail: mythiannnj@gmail.com\n\n` +
                                 `━━━━━━━━━━━━━━━━━━━━\n\n` +
                                 `✨ *Scan the QR code below* or send to the GCash number above.\n\n` +
                                 `🙏 Thank you for your support! Every donation matters.`;
            
            await sendMessage(senderId, { text: donationText }, pageAccessToken);
            
            // Then send the QR code image
            const qrImageUrl = 'https://i.ibb.co/HfKJjYzH/GCash-My-QR-05012026134509-PNG-2.jpg';
            
            await sendMessage(senderId, {
                attachment: {
                    type: 'image',
                    payload: {
                        url: qrImageUrl,
                        is_reusable: true
                    }
                }
            }, pageAccessToken);
            
            console.log(`💰 Donation info sent to user ${senderId}`);
            
        } catch (error) {
            console.error('Error in donation command:', error);
            
            // Fallback message if image fails
            await sendMessage(senderId, { 
                text: `💝 *Support AutoPageBot* 💝\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `📱 *GCash Account:*\n` +
                      `└ 0997 993 9317 - C.C\n\n` +
                      `👨‍💻 *Admin Contact:*\n` +
                      `└ 📧 Gmail: mythiannnj@gmail.com\n\n` +
                      `🙏 Thank you for your support!` 
            }, pageAccessToken);
        }
    }
};