const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['fotor', 'fotorai', 'aigen', 'aiimage'],
    usage: 'fotor [prompt]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'images',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎨 𝗙𝗢𝗧𝗢𝗥 𝗔𝗜 𝗜𝗠𝗔𝗚𝗘 𝗚𝗘𝗡𝗘𝗥𝗔𝗧𝗢𝗥

📝 𝗨𝘀𝗮𝗴𝗲: fotor [prompt]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• fotor sad robot
• fotor beautiful landscape
• fotor cyberpunk city
• fotor cute cat

🎨 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• AI-powered image generation
• High quality output
• Fast response time
• Creative AI models

💡 Be creative with your prompts!`
            }, pageAccessToken);
        }

        const prompt = args.join(' ');
        const encodedPrompt = encodeURIComponent(prompt);
        
        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `fotor_${Date.now()}.png`);
        
        await fs.mkdir(tempDir, { recursive: true });

        // Send loading message
        await sendMessage(senderId, { 
            text: `🎨 Generating "${prompt}" using Fotor AI... Please wait.` 
        }, pageAccessToken);

        try {
            // Using the Fotor API
            const apiUrl = `https://kryptonite-api-library.onrender.com/api/fotor?prompt=${encodedPrompt}`;
            
            const response = await axios.get(apiUrl, { 
                responseType: 'arraybuffer',
                timeout: 30000
            });
            
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
                text: `✅ 𝗜𝗺𝗮𝗴𝗲 𝗴𝗲𝗻𝗲𝗿𝗮𝘁𝗲𝗱 𝘀𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆!

🎨 Prompt: ${prompt}
🤖 Model: Fotor AI

💡 Try: fotor [different prompt]`
            }, pageAccessToken);
            
            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}
            
        } catch (error) {
            console.error('Fotor Error:', error.message);
            
            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}
            
            // Try alternative API (Pollinations)
            try {
                const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;
                const fallbackResponse = await axios.get(fallbackUrl, { responseType: 'arraybuffer', timeout: 30000 });
                await fs.writeFile(tempFile, Buffer.from(fallbackResponse.data));
                
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
                    text: `✅ Image generated (fallback mode)!\n🎨 Prompt: ${prompt}\n🤖 Model: Pollinations AI`
                }, pageAccessToken);
                
                try { unlinkSync(tempFile); } catch(e) {}
                return;
                
            } catch (fallbackError) {
                await sendMessage(senderId, {
                    text: `❌ Failed to generate image.

📝 Tips:
• Try a different prompt
• Use simpler words
• Avoid special characters

💡 Example: fotor beautiful sunset`
                }, pageAccessToken);
            }
        }
    }
};