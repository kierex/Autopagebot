const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['poli', 'pollinations', 'generate', 'imagine', 'create'],
    usage: 'poli [prompt]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'images',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎨 𝗣𝗢𝗟𝗟𝗜𝗡𝗔𝗧𝗜𝗢𝗡𝗦 𝗔𝗜 𝗜𝗠𝗔𝗚𝗘 𝗚𝗘𝗡𝗘𝗥𝗔𝗧𝗢𝗥

📝 𝗨𝘀𝗮𝗴𝗲: poli [prompt]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• poli dog
• poli beautiful sunset
• poli cyberpunk city
• poli cute cat sleeping

🎨 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• AI-powered image generation
• Fast response
• High quality images
• Multiple styles

💡 Be creative with your prompts!`
            }, pageAccessToken);
        }

        const prompt = args.join(' ');
        const encodedPrompt = encodeURIComponent(prompt);
        
        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `poli_${Date.now()}.png`);
        
        await fs.mkdir(tempDir, { recursive: true });

        // Send loading message
        await sendMessage(senderId, { 
            text: `🎨 Generating "${prompt}"... Please wait.` 
        }, pageAccessToken);

        try {
            // Using the Pollinations API
            const apiUrl = `https://kryptonite-api-library.onrender.com/api/pollinations?prompt=${encodedPrompt}`;
            
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
                text: `✅ Image generated successfully!

🎨 Prompt: ${prompt}
🤖 Model: Pollinations AI

💡 Try: poli [different prompt]`
            }, pageAccessToken);
            
            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}
            
        } catch (error) {
            console.error('Pollinations Error:', error.message);
            
            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}
            
            // Try alternative Pollinations API
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
                    text: `✅ Image generated (fallback)!\n🎨 Prompt: ${prompt}`
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

💡 Example: poli beautiful sunset`
                }, pageAccessToken);
            }
        }
    }
};