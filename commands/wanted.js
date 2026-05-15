const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['wanted', 'wantedposter'],
    usage: 'wanted [facebook_uid]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'canvas',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        // Check if user provided Facebook UID
        let uid = args[0];
        
        if (!uid) {
            return sendMessage(senderId, {
                text: `📢 WANTED POSTER MAKER

📝 Usage: wanted [facebook_uid]

✨ Examples:
• wanted 1000123456789
• wanted 61551234567890
• wanted 4

💡 Create a wanted poster with Facebook profile!
👤 UID should be a valid Facebook User ID.

📝 Alias: wantedposter

🔍 How to get Facebook UID:
• Use uid command
• Check profile page source
• Use Facebook ID lookup tools`
            }, pageAccessToken);
        }

        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `wanted_${Date.now()}.png`);

        await fs.mkdir(tempDir, { recursive: true });

        // Send loading message
        await sendMessage(senderId, { 
            text: '📢 Creating wanted poster for Facebook UID: ' + uid + '... Please wait.' 
        }, pageAccessToken);

        try {
            // Using the wanted API with Facebook UID
            const apiUrl = `https://jerome-web.gleeze.com/service/api/wanted?uid=${uid}`;

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
                text: `✅ Wanted poster created!

👤 Facebook UID: ${uid}
📅 Created: ${phTime}

💡 Try: wanted [another_uid]`
            }, pageAccessToken);

            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}

        } catch (error) {
            console.error('Wanted Error:', error.message);

            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}

            await sendMessage(senderId, {
                text: `❌ Failed to create wanted poster.

Please check if the Facebook UID "${uid}" is valid and try again.

💡 Tip: Make sure you're using a numeric Facebook User ID.`
            }, pageAccessToken);
        }
    }
};