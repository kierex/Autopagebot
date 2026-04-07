const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['fbcover', 'cover', 'facebookcover', 'fb'],
    usage: 'fbcover [name] [color] [address] [email] [subname] [sdt]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'canvas',
    cooldown: 10,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `🎨 𝗙𝗮𝗰𝗲𝗯𝗼𝗼𝗸 𝗖𝗼𝘃𝗲𝗿 𝗠𝗮𝗸𝗲𝗿

📝 𝗨𝘀𝗮𝗴𝗲: fbcover [name] [color] [address] [email] [subname] [sdt]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• fbcover Mark red Bacolod hello@email.com hello 132
• fbcover John blue Manila john@mail.com welcome 123
• fbcover Sarah green Cebu sarah@mail.com test 456

🎨 𝗔𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲 𝗖𝗼𝗹𝗼𝗿𝘀:
red, blue, green, yellow, purple, pink, orange, black, white

📝 𝗣𝗮𝗿𝗮𝗺𝗲𝘁𝗲𝗿𝘀:
• name - Your name (required)
• color - Cover color (optional, default: red)
• address - Your address (optional)
• email - Your email (optional)
• subname - Subtitle name (optional)
• sdt - Additional text (optional)

💡 Example: fbcover Mark red Bacolod hello@email.com welcome 132`
            }, pageAccessToken);
        }

        // Parse parameters
        let name = args[0] || 'User';
        let color = args[1] || 'red';
        let address = args[2] || '';
        let email = args[3] || '';
        let subname = args[4] || '';
        let sdt = args[5] || '';

        // If more than 6 args, join remaining
        if (args.length > 6) {
            sdt = args.slice(5).join(' ');
        }

        // Validate color
        const validColors = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'black', 'white'];
        if (!validColors.includes(color.toLowerCase())) {
            color = 'red';
        }

        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `fbcover_${Date.now()}.png`);
        
        await fs.mkdir(tempDir, { recursive: true });

        // Send loading message
        await sendMessage(senderId, { 
            text: '🎨 Creating your Facebook cover image... Please wait.' 
        }, pageAccessToken);

        try {
            // Build API URL with parameters
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
            
            // Send success message with details
            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            let details = `✅ 𝗙𝗮𝗰𝗲𝗯𝗼𝗼𝗸 𝗰𝗼𝘃𝗲𝗿 𝗰𝗿𝗲𝗮𝘁𝗲𝗱!\n\n`;
            details += `📛 Name: ${name}\n`;
            details += `🎨 Color: ${color}\n`;
            if (address) details += `📍 Address: ${address}\n`;
            if (email) details += `📧 Email: ${email}\n`;
            if (subname) details += `📝 Subname: ${subname}\n`;
            if (sdt) details += `🔢 SDT: ${sdt}\n`;
            details += `📅 Created: ${phTime}\n\n`;
            details += `💡 Try: fbcover [name] [color] [address] [email] [subname] [sdt]`;
            
            await sendMessage(senderId, { text: details }, pageAccessToken);
            
            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}
            
        } catch (error) {
            console.error('FBCover Error:', error.message);
            
            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}
            
            await sendMessage(senderId, {
                text: `❌ Failed to create Facebook cover.

📝 Tips:
• Check your input format
• Use: fbcover [name] [color] [address] [email] [subname] [sdt]
• Color options: red, blue, green, yellow, purple, pink, orange, black, white

💡 Example: fbcover Mark red Bacolod hello@email.com welcome 132`
            }, pageAccessToken);
        }
    }
};