const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['profile'],
    usage: 'profile [uid]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'search',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        let uid = args[0] || senderId;

        if (!args.length) {
            return sendMessage(senderId, {
                text: `👤 𝗣𝗥𝗢𝗙𝗜𝗟𝗘 𝗜𝗠𝗔𝗚𝗘 𝗙𝗘𝗧𝗖𝗛𝗘𝗥

📝 𝗨𝘀𝗮𝗴𝗲: profile [uid]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• profile (your profile)
• profile 100000123456789
• profile 4

💡 Get Facebook profile picture`
            }, pageAccessToken);
        }

        const tempDir = path.join(__dirname, '../temp');
        const tempFile = path.join(tempDir, `profile_${Date.now()}.jpg`);
        
        await fs.mkdir(tempDir, { recursive: true });

        try {
            // Fetch profile info from Betadash API
            const apiUrl = `https://betadash-api-swordslush-production.up.railway.app/profile?uid=${uid}`;
            const response = await axios.get(apiUrl);
            const profile = response.data;

            if (!profile || profile.error) {
                throw new Error('Profile not found');
            }

            // Get profile picture URL from the API response
            let profilePicUrl = profile.avatar || profile.profilePicture || profile.picture;
            
            if (!profilePicUrl) {
                // Fallback to Facebook Graph API
                profilePicUrl = `https://graph.facebook.com/${uid}/picture?type=large&width=720&height=720`;
            }
            
            // Download profile picture
            const picResponse = await axios.get(profilePicUrl, { 
                responseType: 'arraybuffer',
                timeout: 15000
            });
            
            await fs.writeFile(tempFile, Buffer.from(picResponse.data));
            
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
            
            // Send ONLY the profile image
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
            
            // Cleanup
            try { unlinkSync(tempFile); } catch(e) {}
            
        } catch (error) {
            console.error('Profile Error:', error.message);
            
            // Cleanup on error
            try { unlinkSync(tempFile); } catch(e) {}
            
            await sendMessage(senderId, {
                text: `❌ Profile picture not found for UID: ${uid}\n\n💡 Example: profile 100000123456789`
            }, pageAccessToken);
        }
    }
};