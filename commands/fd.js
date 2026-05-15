const axios = require("axios");
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: 'feedback',
    aliases: ['fb', 'feed', 'comment'],
    description: 'Collects user feedback about the bot',
    usage: 'feedback <your feedback message>',
    author: 'cliff',
    category: 'system',
    cooldown: 60,

    async execute(senderId, args, token, event, sendMessageFunc, imageCache) {
        // Admin UID
        const ADMIN_UID = '6158923309617';

        // If no feedback message provided
        if (!args || args.length === 0) {
            await sendMessage(senderId, {
                text: `📝 FEEDBACK COMMAND

Hi! I'd love to hear your thoughts about me.

📌 How to use:
feedback <your message>

✨ Examples:
• feedback The bot is very helpful!
• feedback I love the download command
• feedback Suggestion: Add more features
• feedback Bug: The spotify command isn't working

💡 Your feedback helps me improve!
🔒 Messages are sent privately to the admin.

Thank you for helping make me better! 🙏`
            }, token);
            return;
        }

        // Get user's feedback message
        const userFeedback = args.join(' ');
        const timestamp = new Date().toLocaleString('en-PH', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        // Fetch user profile info
        let userName = 'Facebook User';
        let profilePicUrl = '';
        let userLocale = '';

        try {
            const userInfo = await axios.get(`https://graph.facebook.com/me?fields=id,name,picture.width(720).height(720).as(picture_large),locale&access_token=${token}`);
            
            if (userInfo.data) {
                userName = userInfo.data.name || 'Facebook User';
                if (userInfo.data.picture_large && userInfo.data.picture_large.data) {
                    profilePicUrl = userInfo.data.picture_large.data.url;
                }
                userLocale = userInfo.data.locale || 'Unknown';
            }
        } catch (error) {
            console.error('Error fetching user info:', error.message);
        }

        // Send confirmation to user
        await sendMessage(senderId, {
            text: `✅ Feedback Received!

Thank you ${userName} for your feedback! 🙏

📋 Your message:
"${userFeedback}"

📅 Sent: ${timestamp}

The admin will review your feedback and may respond to you directly.

💡 To send another feedback, just use: feedback <message>`
        }, token);

        // Prepare feedback for admin
        const adminMessage = `📝 NEW FEEDBACK FROM USER

━━━━━━━━━━━━━━━━━━━━
👤 USER DETAILS
━━━━━━━━━━━━━━━━━━━━
Name: ${userName}
UID: ${senderId}
Locale: ${userLocale}
Profile: https://facebook.com/${senderId}

━━━━━━━━━━━━━━━━━━━━
💬 FEEDBACK
━━━━━━━━━━━━━━━━━━━━
"${userFeedback}"

━━━━━━━━━━━━━━━━━━━━
📅 RECEIVED
━━━━━━━━━━━━━━━━━━━━
${timestamp}

━━━━━━━━━━━━━━━━━━━━
📊 FEEDBACK STATS
━━━━━━━━━━━━━━━━━━━━
Word Count: ${userFeedback.split(' ').length}
Char Count: ${userFeedback.length}
Type: ${userFeedback.toLowerCase().includes('bug') ? 'Bug Report' : 
       userFeedback.toLowerCase().includes('suggest') ? 'Suggestion' : 
       userFeedback.toLowerCase().includes('love') || userFeedback.toLowerCase().includes('good') ? 'Positive' : 
       'General'}

━━━━━━━━━━━━━━━━━━━━
💡 QUICK REPLY
━━━━━━━━━━━━━━━━━━━━
reply ${senderId} <your response>`;

        try {
            // Send text feedback to admin
            await axios.post(
                `https://graph.facebook.com/v23.0/me/messages?access_token=${token}`,
                {
                    recipient: { id: ADMIN_UID },
                    message: { text: adminMessage }
                }
            );

            // Send user's profile picture to admin if available
            if (profilePicUrl) {
                await axios.post(
                    `https://graph.facebook.com/v23.0/me/messages?access_token=${token}`,
                    {
                        recipient: { id: ADMIN_UID },
                        message: {
                            attachment: {
                                type: 'image',
                                payload: { url: profilePicUrl, is_reusable: true }
                            }
                        }
                    }
                );
            }

            console.log(`✅ Feedback forwarded to admin ${ADMIN_UID} from ${userName} (${senderId})`);

        } catch (error) {
            console.error('Failed to send feedback to admin:', error.message);
            
            // Notify user but don't alarm them
            console.log(`⚠️ Feedback from ${userName} couldn't reach admin due to: ${error.message}`);
        }
    }
};