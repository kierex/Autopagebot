const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['mark', 'zuck'],
    usage: 'mark [text]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'canvas',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `✏️ 𝗠𝗔𝗥𝗞𝗘𝗥 𝗗𝗥𝗔𝗪𝗜𝗡𝗚 𝗠𝗔𝗞𝗘𝗥

📝 𝗨𝘀𝗮𝗴𝗲: mark [your text]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• mark Hello
• mark I love you
• mark Good morning
• mark Stay safe

🎨 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Hand-drawn marker style
• Sketch-like appearance
• Perfect for notes and signs

💡 Aliases: mark, marker, drawing`
            }, pageAccessToken);
        }

        const text = encodeURIComponent(args.join(' '));
        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `marker_${Date.now()}.png`);
        
        await fs.mkdir(tempDir, { recursive: true });

        // Send loading message
        await sendMessage(senderId, { 
            text: '✏️ Creating your marker drawing... Please wait.' 
        }, pageAccessToken);

        try {
            // Using the marker API
            const apiUrl = `https://betadash-api-swordslush-production.up.railway.app/mark?text=${text}`;
            
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
            await sendMessage(senderId, {
                text: `✅ 𝗠𝗮𝗿𝗸𝗲𝗿 𝗱𝗿𝗮𝘄𝗶𝗻𝗴 𝗰𝗿𝗲𝗮𝘁𝗲𝗱!

✏️ Text: ${args.join(' ')}

💡 Try: mark [your text] for more drawings!`
            }, pageAccessToken);
            
            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}
            
        } catch (error) {
            console.error('Marker Error:', error.message);
            
            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}
            
            // Try fallback API
            try {
                const fallbackUrl = `https://quickchart.io/chart?cht=tx&chl=${text}`;
                const response = await axios.get(fallbackUrl, { responseType: 'arraybuffer' });
                await fs.writeFile(tempFile, Buffer.from(response.data));
                
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
                
                await sendMessage(senderId, {
                    text: `✅ Drawing created (fallback mode)!\n\nText: ${args.join(' ')}`
                }, pageAccessToken);
                
                try { unlinkSync(tempFile); } catch(e) {}
                return;
                
            } catch (fallbackError) {
                await sendMessage(senderId, {
                    text: '❌ Failed to create marker drawing. Please try again with shorter text.'
                }, pageAccessToken);
            }
        }
    }
};