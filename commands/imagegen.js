const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['imagegen', 'generate', 'imagine', 'draw', 'create'],
    usage: 'imagegen [prompt]',
    version: '1.0.0',
    author: 'coffee',
    category: 'images',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        if (!args.length) {
            return sendMessage(senderId, { 
                text: '🎨 Please provide a prompt.\n\n📝 Usage: imagegen a beautiful sunset\n\n✨ Example: imagegen cyberpunk city at night' 
            }, pageAccessToken);
        }

        const prompt = encodeURIComponent(args.join(' ').trim() + ', high definition.');
        const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?model=flux&width=1024&height=1024&nologo=true`;
        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `img_${Date.now()}.jpg`);

        // Ensure temp directory exists
        await fs.mkdir(tempDir, { recursive: true });

        // Send loading message
        await sendMessage(senderId, {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'generic',
                    elements: [{
                        title: '🎨 Generating your image...',
                        subtitle: `Prompt: ${args.join(' ').slice(0, 50)}${args.join(' ').length > 50 ? '...' : ''}`,
                        image_url: 'https://i.imgur.com/ovfQDJq.gif'
                    }]
                }
            }
        }, pageAccessToken);

        try {
            // Download image
            const { data } = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            await fs.writeFile(tempFile, Buffer.from(data));

            // Upload to Facebook
            const form = new FormData();
            form.append('message', JSON.stringify({
                attachment: { type: 'image', payload: { is_reusable: true } }
            }));
            form.append('filedata', createReadStream(tempFile));

            const { data: uploadData } = await axios.post(
                `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${pageAccessToken}`,
                form,
                { headers: form.getHeaders() }
            );

            // Send image to user
            await axios.post(
                `https://graph.facebook.com/v23.0/me/messages?access_token=${pageAccessToken}`,
                {
                    recipient: { id: senderId },
                    message: {
                        attachment: {
                            type: 'image',
                            payload: { attachment_id: uploadData.attachment_id }
                        }
                    }
                }
            );

            // Send confirmation message
            await sendMessage(senderId, {
                text: `✅ Image generated!\n\n🎨 Prompt: ${args.join(' ')}\n🖼️ Model: Flux\n📏 Resolution: 1024x1024\n⏱️ Cooldown: 10 seconds\n\n💡 Try: -imagegen ${args.join(' ')} cinematic lighting`
            }, pageAccessToken);

            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}

        } catch (error) {
            console.error('ImageGen Error:', error.message);

            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}

            return sendMessage(senderId, { 
                text: '❌ Failed to generate image.\n\n⚠️ Please try again later or use a different prompt.\n\n📝 Example: imagegen a cute cat sleeping' 
            }, pageAccessToken);
        }
    }
};