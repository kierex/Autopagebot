const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['brat'],
    usage: 'brat [text]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'downloader',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎵 BRAT TEXT GENERATOR

📝 Usage: brat [your text]

✨ Examples:
• brat bossing na uulol
• brat kana ba
• brat hello world
• brat ang ganda mo

💡 Create a brat-style text image with your message!
🔤 Short text works best.

🎨 Category: Downloader`
            }, pageAccessToken);
        }

        const text = encodeURIComponent(args.join(' '));
        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `brat_${Date.now()}.png`);

        await fs.mkdir(tempDir, { recursive: true });

        // Send loading message
        await sendMessage(senderId, { 
            text: '🎵 Creating your brat text image... Please wait.' 
        }, pageAccessToken);

        try {
            // Using the brat API
            const apiUrl = `https://betadash-api-swordslush-production.up.railway.app/brat?text=${text}`;

            const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
            await fs.writeFile(tempFile, Buffer.from(response.data));

            // Upload to Facebook
            const form = new FormData();
            form.append('message', JSON.stringify({
                attachment: { type: 'image', payload: { is_reusable: true } }
            }));
            form.append('filedata', createReadStream(tempFile));

            const uploadRes = await axios.post(
                `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${pageAccessToken}`,
                form,
                { headers: form.getHeaders() }
            );

            // Send image
            await axios.post(
                `https://graph.facebook.com/v23.0/me/messages?access_token=${pageAccessToken}`,
                {
                    recipient: { id: senderId },
                    message: {
                        attachment: {
                            type: 'image',
                            payload: { attachment_id: uploadRes.data.attachment_id }
                        }
                    }
                }
            );

            // Send success message
            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            await sendMessage(senderId, {
                text: `✅ BRAT text image created!

📝 Text: ${args.join(' ')}
📅 Created: ${phTime}

💡 Try: brat [your text]`
            }, pageAccessToken);

            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}

        } catch (error) {
            console.error('Brat Error:', error.message);

            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}

            await sendMessage(senderId, {
                text: '❌ Failed to create brat text image. Please try again with shorter text.'
            }, pageAccessToken);
        }
    }
};