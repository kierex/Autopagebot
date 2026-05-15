const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['phub'],
    usage: 'ph <text1> | <text2>',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'image',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {

        const input = args.join(' ').split('|');

        const text1 = input[0]?.trim();
        const text2 = input[1]?.trim();

        if (!text1 || !text2) {
            return sendMessage(senderId, {
                text: `📢 PORNHUB STYLE IMAGE

📝 Usage:
ph <text1> | <text2>

✨ Example:
• ph yawa | ka
• ph hello | world

💡 Creates a Pornhub-style logo image.`
            }, pageAccessToken);
        }

        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `ph_${Date.now()}.png`);

        await fs.mkdir(tempDir, { recursive: true });

        // Loading message
        await sendMessage(senderId, {
            text: `📢 Creating image...\n\n📝 Text1: ${text1}\n📝 Text2: ${text2}`
        }, pageAccessToken);

        try {

            const apiUrl = `https://yin-api.vercel.app/image/pornhub?text1=${encodeURIComponent(text1)}&text2=${encodeURIComponent(text2)}`;

            const response = await axios.get(apiUrl, {
                responseType: 'arraybuffer'
            });

            await fs.writeFile(tempFile, Buffer.from(response.data));

            // Upload image
            const form = new FormData();

            form.append('message', JSON.stringify({
                attachment: {
                    type: 'image',
                    payload: {
                        is_reusable: true
                    }
                }
            }));

            form.append('filedata', createReadStream(tempFile));

            const uploadRes = await axios.post(
                `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${pageAccessToken}`,
                form,
                {
                    headers: form.getHeaders()
                }
            );

            // Send image
            await axios.post(
                `https://graph.facebook.com/v23.0/me/messages?access_token=${pageAccessToken}`,
                {
                    recipient: {
                        id: senderId
                    },
                    message: {
                        attachment: {
                            type: 'image',
                            payload: {
                                attachment_id: uploadRes.data.attachment_id
                            }
                        }
                    }
                }
            );

            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            // Success message
            await sendMessage(senderId, {
                text: `✅ Pornhub style image created!

📝 Text1: ${text1}
📝 Text2: ${text2}
📅 Created: ${phTime}`
            }, pageAccessToken);

            // Cleanup
            try {
                unlinkSync(tempFile);
            } catch (e) {}

        } catch (error) {

            console.error('PH Error:', error.message);

            // Cleanup
            try {
                unlinkSync(tempFile);
            } catch (e) {}

            await sendMessage(senderId, {
                text: `❌ Failed to create image.

Please try again later.`
            }, pageAccessToken);
        }
    }
};