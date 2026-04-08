const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream, unlinkSync } = require('fs');
const path = require('path');
const FormData = require('form-data');
const { sendMessage } = require('../handles/sendMessage');

// Store enabled status per user (since no thread concept in Messenger API)
const enabledUsers = new Map();

// API endpoints
const FB_API = "https://yin-api.vercel.app/downloader/fbdl";
const TIKTOK_API = "https://markdevs-last-api-p2y6.onrender.com/api/tiktokdl";
const IG_API = "https://yin-api.vercel.app/downloader/ig-dl";

module.exports = {
    name: ['autodl'],
    usage: 'autodl [on/off/status]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'downloader',
    cooldown: 2,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        // Handle on/off commands
        if (args.length > 0) {
            const command = args[0].toLowerCase();

            if (command === 'on') {
                enabledUsers.set(senderId, true);
                return sendMessage(senderId, {
                    text: '✅ Auto-download is now **ENABLED** for you.\nI will automatically download videos from Facebook, TikTok, and Instagram when you share links.'
                }, pageAccessToken);
            }
            else if (command === 'off') {
                enabledUsers.set(senderId, false);
                return sendMessage(senderId, {
                    text: '❌ Auto-download is now **DISABLED** for you.\nI will no longer automatically download videos from links you share.'
                }, pageAccessToken);
            }
            else if (command === 'status') {
                const status = enabledUsers.get(senderId) !== false ? 'ENABLED' : 'DISABLED';
                return sendMessage(senderId, {
                    text: `📊 Auto-download status: **${status}**\n\nTo change: autodl on/off`
                }, pageAccessToken);
            }
            else {
                return sendMessage(senderId, {
                    text: '❌ Invalid command. Use: autodl on, autodl off, or autodl status'
                }, pageAccessToken);
            }
        }

        // Just status check if no args
        const status = enabledUsers.get(senderId) !== false ? 'ENABLED' : 'DISABLED';
        return sendMessage(senderId, {
            text: `📊 Auto-download is currently **${status}** for you.\n\nUse: autodl on/off to toggle.`
        }, pageAccessToken);
    },

    // This function will be called from handleMessage for automatic detection
    async onLink(senderId, message, pageAccessToken) {
        // Check if autodl is enabled for this user (default to enabled if not set)
        const isEnabled = enabledUsers.get(senderId) !== false;
        if (!isEnabled) return;

        // Extract URL from message
        const linkMatch = message.match(/(https?:\/\/[^\s]+)/);
        if (!linkMatch) return;

        const url = linkMatch[0];

        // Detect platform from URL
        let platform = '';
        let platformName = '';
        let apiUrl = '';
        let videoUrl = '';

        if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.com')) {
            platform = 'facebook';
            platformName = 'Facebook';
            apiUrl = `${FB_API}?url=${encodeURIComponent(url)}`;
        }
        else if (url.includes('tiktok.com') || url.includes('vt.tiktok') || url.includes('vm.tiktok')) {
            platform = 'tiktok';
            platformName = 'TikTok';
            apiUrl = `${TIKTOK_API}?link=${encodeURIComponent(url)}`;
        }
        else if (url.includes('instagram.com') || url.includes('instagr.am') || url.includes('reel')) {
            platform = 'instagram';
            platformName = 'Instagram';
            apiUrl = `${IG_API}?url=${encodeURIComponent(url)}`;
        }
        else {
            return; // Unsupported platform, silently ignore
        }

        try {
            // Send typing indicator
            await sendMessage(senderId, { text: '⏳ Processing your link...' }, pageAccessToken);

            // Fetch from API
            const response = await axios.get(apiUrl, { timeout: 30000 });
            const data = response.data;

            if (!data) {
                await sendMessage(senderId, { text: '❌ Failed to process link' }, pageAccessToken);
                return;
            }

            // Handle platform responses
            if (platform === 'facebook') {
                if (!data.answer || !data.answer.url) throw new Error('Invalid Facebook API response');
                videoUrl = data.answer.url;
            }
            else if (platform === 'tiktok') {
                if (!data.url) throw new Error('Invalid TikTok API response');
                videoUrl = data.url;
            }
            else if (platform === 'instagram') {
                if (!data.answer || !data.answer.videoUrl) throw new Error('Invalid Instagram API response');
                videoUrl = data.answer.videoUrl;
            }

            if (!videoUrl) {
                await sendMessage(senderId, { text: '❌ No video found' }, pageAccessToken);
                return;
            }

            await downloadAndSendVideo(senderId, videoUrl, platformName, pageAccessToken);

        } catch (error) {
            console.error('AutoDL Error:', error.message);
            await sendMessage(senderId, { text: '❌ Failed to download video' }, pageAccessToken);
        }
    }
};

async function downloadAndSendVideo(senderId, videoUrl, platform, pageAccessToken) {
    const tempDir = path.join(__dirname, '../temp');
    const tempFile = path.join(tempDir, `video_${Date.now()}.mp4`);
    
    await fs.mkdir(tempDir, { recursive: true });

    try {
        // Download video
        const videoResponse = await axios.get(videoUrl, {
            responseType: 'arraybuffer',
            timeout: 60000
        });

        await fs.writeFile(tempFile, Buffer.from(videoResponse.data));

        // Upload to Facebook
        const form = new FormData();
        form.append('message', JSON.stringify({
            attachment: { type: 'video', payload: { is_reusable: true } }
        }));
        form.append('filedata', createReadStream(tempFile));

        const uploadRes = await axios.post(
            `https://graph.facebook.com/v23.0/me/message_attachments?access_token=${pageAccessToken}`,
            form,
            { headers: form.getHeaders() }
        );

        // Send video (no caption)
        await axios.post(
            `https://graph.facebook.com/v23.0/me/messages?access_token=${pageAccessToken}`,
            {
                recipient: { id: senderId },
                message: {
                    attachment: {
                        type: 'video',
                        payload: { attachment_id: uploadRes.data.attachment_id }
                    }
                }
            }
        );

        // Cleanup
        try { unlinkSync(tempFile); } catch(e) {}

    } catch (error) {
        console.error('Download Error:', error.message);
        try { unlinkSync(tempFile); } catch(e) {}
        throw error;
    }
}