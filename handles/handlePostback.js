const { sendMessage } = require('./sendMessage');
const tokenManager = require('./tokenManager');

const handlePostback = async (event, pageAccessToken, pageId) => {
    const senderId = event.sender?.id;
    const payload = event.postback?.payload;

    if (!senderId || !payload) return;

    console.log(`📌 Postback received: ${payload} for page ${pageId}`);

    try {
        if (payload === 'GET_STARTED') {
            return await sendMessage(senderId, {
                text: '🤖 Welcome to AutoPageBot v2.1!\n\nI can help you automate your Facebook Messenger.\n\n📚 Type "help" to see available commands\n🔗 Visit our dashboard for more features\n✨ Start by sending a message!',
                quick_replies: [
                    { content_type: 'text', title: 'Help', payload: 'CMD_HELP' },
                    { content_type: 'text', title: 'About', payload: 'CMD_ABOUT' }
                ]
            }, pageAccessToken);
        }

        if (payload.startsWith('CMD_')) {
            const command = payload.slice(4).toLowerCase();
            const { handleMessage } = require('./handleMessage');
            
            const fakeEvent = {
                sender: { id: senderId },
                message: { text: `-${command}` }
            };
            
            return await handleMessage(fakeEvent, pageAccessToken, pageId);
        }

        await sendMessage(senderId, {
            text: `📬 Received: ${payload}\n\nType "help" for available commands.`
        }, pageAccessToken);

    } catch (error) {
        console.error('Postback error:', error.message);
        await sendMessage(senderId, {
            text: '❌ Sorry, something went wrong. Please try again.'
        }, pageAccessToken);
    }
};

module.exports = { handlePostback };