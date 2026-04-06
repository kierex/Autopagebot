const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['fbcover', 'cover', 'facebookcover'],
    usage: 'fbcover [options]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'canvas',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎨 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗖𝗢𝗩𝗘𝗥 𝗠𝗔𝗞𝗘𝗥

📝 𝗨𝘀𝗮𝗴𝗲: fbcover [name] | [address] | [email] | [color]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• fbcover Mark | Bacolod | hello@email.com | red
• fbcover John | Manila | john@mail.com | blue
• fbcover Sarah | Cebu | sarah@mail.com | green

🎨 𝗔𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲 𝗖𝗼𝗹𝗼𝗿𝘀:
red, blue, green, yellow, purple, pink, orange, black, white, gradient

📝 𝗙𝗼𝗿𝗺𝗮𝘁:
fbcover [name] | [address] | [email] | [color]

💡 Tip: Use | to separate fields`
            }, pageAccessToken);
        }

        // Parse input
        const input = args.join(' ');
        let name = 'User';
        let address = '';
        let email = '';
        let color = 'red';
        let subname = '';
        let sdt = '';

        if (input.includes('|')) {
            const parts = input.split('|');
            name = parts[0]?.trim() || 'User';
            address = parts[1]?.trim() || '';
            email = parts[2]?.trim() || '';
            color = parts[3]?.trim()?.toLowerCase() || 'red';
            subname = parts[4]?.trim() || '';
            sdt = parts[5]?.trim() || '';
        } else {
            const words = input.split(' ');
            name = words[0] || 'User';
            if (words[1]) address = words.slice(1).join(' ');
        }

        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `fbcover_${Date.now()}.png`);
        
        await fs.mkdir(tempDir, { recursive: true });

        // Send loading message
        await sendMessage(senderId, { 
            text: '🎨 Creating your Facebook cover image... Please wait.' 
        }, pageAccessToken);

        try {
            // Using the API
            const apiUrl = `https://hiroshi-api.onrender.com/canvas/fbcoverv2?name=${encodeURIComponent(name)}&color=${encodeURIComponent(color)}&address=${encodeURIComponent(address)}&email=${encodeURIComponent(email)}&subname=${encodeURIComponent(subname)}&sdt=${encodeURIComponent(sdt)}&uid=${senderId}`;
            
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
                text: `✅ 𝗙𝗮𝗰𝗲𝗯𝗼𝗼𝗸 𝗰𝗼𝘃𝗲𝗿 𝗰𝗿𝗲𝗮𝘁𝗲𝗱!

📛 Name: ${name}
📍 Address: ${address || 'Not specified'}
📧 Email: ${email || 'Not specified'}
🎨 Color: ${color}

💡 Try: fbcover [name] | [address] | [email] | [color]`
            }, pageAccessToken);
            
            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}
            
        } catch (error) {
            console.error('FBCover Error:', error.message);
            
            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}
            
            // Alternative: Create fallback image using another API
            try {
                const fallbackUrl = `https://placekitten.com/851/315?text=${encodeURIComponent(name)}`;
                const fallbackResponse = await axios.get(fallbackUrl, { responseType: 'arraybuffer' });
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
                    text: `✅ Fallback cover created!\n📛 Name: ${name}\n\n⚠️ API was down, used alternative.`
                }, pageAccessToken);
                
                try { unlinkSync(tempFile); } catch(e) {}
                return;
                
            } catch (fallbackError) {
                await sendMessage(senderId, {
                    text: `❌ Failed to create Facebook cover.

📝 Tips:
• Check your input format
• Try: fbcover Mark | Bacolod | email@test.com | red
• Use simple text without special characters

💡 Example: fbcover John | Manila | john@mail.com | blue`
                }, pageAccessToken);
            }
        }
    }
};