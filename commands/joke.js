// commands/joke.js
const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['joke'],
    usage: 'joke',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'fun',
    cooldown: 0,

    async execute(senderId, args, pageAccessToken) {
        try {
            const response = await axios.get('https://official-joke-api.appspot.com/random_joke');
            const joke = `𝗥𝗮𝗻𝗱𝗼𝗺 𝗝𝗼𝗸𝗲:n\n\ ${response.data.setup}\n\n${response.data.punchline}`;
            await sendMessage(senderId, { text: joke }, pageAccessToken);
        } catch (error) {
            await sendMessage(senderId, { text: '❌ No joke found. Try again!' }, pageAccessToken);
        }
    }
};