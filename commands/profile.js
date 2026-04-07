const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

// Facebook access token for profile picture fetching
const FB_ACCESS_TOKEN = '6628568379%7Cc1e620fa708a1d5696fb991c1bde5662';

module.exports = {
    name: ['pfp', 'avatar', 'profilepic', 'profilepicture', 'profileimg'],
    usage: 'pfp [uid or reply to message]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'tools',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        let uid = senderId; // Default to sender's own ID

        // Check if replying to a message
        if (event.message?.reply_to) {
            try {
                // Get the replied message to extract sender ID
                const replyResponse = await axios.get(
                    `https://graph.facebook.com/v23.0/${event.message.reply_to.mid}?access_token=${pageAccessToken}`
                );
                if (replyResponse.data && replyResponse.data.from) {
                    uid = replyResponse.data.from.id;
                }
            } catch (err) {
                console.error('Error getting replied message:', err.message);
            }
        }
        // Check if there are mentions
        else if (event.message?.mentions && event.message.mentions.length > 0) {
            uid = event.message.mentions[0].id;
        }
        // Check if UID is provided in arguments
        else if (args.length > 0) {
            const input = args[0];
            
            // If input is a number (UID)
            if (!isNaN(input)) {
                uid = input;
            }
            // If input is a Facebook profile link
            else if (input.includes('facebook.com/')) {
                // Extract UID from profile link
                const match = input.match(/(?:profile\.php\?id=|\/)(\d+)/);
                if (match) {
                    uid = match[1];
                } else {
                    // Handle vanity URL
                    const vanityMatch = input.match(/facebook\.com\/([^/?]+)/);
                    if (vanityMatch) {
                        try {
                            const vanityResponse = await axios.get(`https://www.facebook.com/${vanityMatch[1]}`);
                            const uidMatch = vanityResponse.data.match(/"userID":"(\d+)"/);
                            if (uidMatch) {
                                uid = uidMatch[1];
                            }
                        } catch (err) {
                            return sendMessage(senderId, {
                                text: '❌ Could not extract UID from profile link.'
                            }, pageAccessToken);
                        }
                    }
                }
            }
        }

        // Validate UID
        if (!uid || isNaN(uid)) {
            return sendMessage(senderId, {
                text: `👤 𝗣𝗿𝗼𝗳𝗶𝗹𝗲 𝗣𝗶𝗰𝘁𝘂𝗿𝗲 𝗙𝗲𝘁𝗰𝗵𝗲𝗿

📝 𝗨𝘀𝗮𝗴𝗲: pfp [uid or reply to message]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• pfp (your profile picture)
• pfp 100000123456789
• Reply to someone's message with pfp
• pfp https://facebook.com/username

💡 Get anyone's profile picture!`
            }, pageAccessToken);
        }

        // Send loading message
        await sendMessage(senderId, { 
            text: `🔍 Fetching profile picture for UID: ${uid}...` 
        }, pageAccessToken);

        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `pfp_${uid}_${Date.now()}.jpg`);
        
        await fs.mkdir(tempDir, { recursive: true });

        try {
            // Get user name (optional, for success message)
            let userName = '';
            try {
                const nameResponse = await axios.get(`https://graph.facebook.com/${uid}?access_token=${FB_ACCESS_TOKEN}&fields=name`);
                if (nameResponse.data && nameResponse.data.name) {
                    userName = nameResponse.data.name;
                }
            } catch (err) {
                userName = `UID ${uid}`;
            }

            // Get profile picture URL (high resolution)
            const avatarURL = `https://graph.facebook.com/${uid}/picture?width=720&height=720&access_token=${FB_ACCESS_TOKEN}`;
            
            // Download profile picture
            const response = await axios.get(avatarURL, { 
                responseType: 'arraybuffer',
                timeout: 15000
            });
            
            await fs.writeFile(tempFile, Buffer.from(response.data));
            
            // Upload to Facebook Messenger
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
            
            // Send profile picture
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
                text: `✅ 𝗣𝗿𝗼𝗳𝗶𝗹𝗲 𝗽𝗶𝗰𝘁𝘂𝗿𝗲 𝗼𝗳 ${userName}

🆔 UID: ${uid}
📅 Fetched: ${phTime}

💡 Try: pfp [another UID] or reply to a message`
            }, pageAccessToken);
            
            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}
            
        } catch (error) {
            console.error('PFP Error:', error.message);
            
            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}
            
            await sendMessage(senderId, {
                text: `❌ Could not fetch profile picture for UID: ${uid}

📝 Tips:
• Check if the UID is valid
• Make sure the profile is public
• Try a different UID

💡 Example: pfp 100000123456789`
            }, pageAccessToken);
        }
    }
};