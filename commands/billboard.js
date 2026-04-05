const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['billboard', 'bb'],
    usage: 'billboard [text]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'canvas',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `📢 𝗕𝗜𝗟𝗟𝗕𝗢𝗔𝗥𝗗 𝗠𝗔𝗞𝗘𝗥

📝 𝗨𝘀𝗮𝗴𝗲: billboard [your text]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• billboard Hello World
• billboard Welcome to my page
• billboard I love coding
• billboard Stay awesome

💡 Create a billboard-style sign with your text!
🔤 Short text works best for billboards.

📝 Aliases: bb`
            }, pageAccessToken);
        }

        const text = encodeURIComponent(args.join(' '));
        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `billboard_${Date.now()}.png`);
        
        await fs.mkdir(tempDir, { recursive: true });

        // Send loading message
        await sendMessage(senderId, { 
            text: '📢 Creating your billboard... Please wait.' 
        }, pageAccessToken);

        try {
            // Using the billboard API
            const apiUrl = `https://betadash-api-swordslush-production.up.railway.app/billboard?text=${text}`;
            
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
                text: `✅ 𝗕𝗶𝗹𝗹𝗯𝗼𝗮𝗿𝗱 𝗰𝗿𝗲𝗮𝘁𝗲𝗱!

📝 Text: ${args.join(' ')}
📅 Created: ${phTime}

💡 Try: billboard [your text]`
            }, pageAccessToken);
            
            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}
            
        } catch (error) {
            console.error('Billboard Error:', error.message);
            
            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}
            
            await sendMessage(senderId, {
                text: '❌ Failed to create billboard. Please try again with shorter text.'
            }, pageAccessToken);
        }
    }
};