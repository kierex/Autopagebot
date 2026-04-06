const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

module.exports = {
    name: ['birdfact', 'bird', 'birdfacts', 'avian'],
    usage: 'birdfact',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'fun',
    cooldown: 3,

    async execute(senderId, args, pageAccessToken) {
        // Send typing indicator
        await sendMessage(senderId, { text: '🦜 Fetching a bird fact...' }, pageAccessToken);

        try {
            const apiUrl = 'https://kryptonite-api-library.onrender.com/api/birdfact';
            const response = await axios.get(apiUrl);
            const data = response.data;

            if (!data || !data.fact) {
                throw new Error('No fact found');
            }

            const fact = data.fact;
            const operator = data.operator || 'Krypton';

            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            const message = `🦜 𝗕𝗜𝗥𝗗 𝗙𝗔𝗖𝗧

━━━━━━━━━━━━━━━━━━━━━━━

📖 ${fact}

━━━━━━━━━━━━━━━━━━━━━━━

📅 ${phTime}

💡 Type -birdfact for another fact!`;

            await sendMessage(senderId, { text: message }, pageAccessToken);

        } catch (error) {
            console.error('Bird Fact Error:', error.message);
            
            // Fallback facts
            const fallbackFacts = [
                "Crows are known to hold grudges against specific people.",
                "Pigeons were used as message carriers during wars.",
                "Owls can rotate their heads up to 270 degrees.",
                "Hummingbirds are the only birds that can fly backwards.",
                "Flamingos are born grey and turn pink due to their diet.",
                "Penguins propose to their mates with a pebble.",
                "A group of crows is called a murder.",
                "The ostrich has the largest eyes of any land animal.",
                "Some birds can sleep while flying.",
                "The peregrine falcon is the fastest animal on Earth."
            ];
            
            const randomFact = fallbackFacts[Math.floor(Math.random() * fallbackFacts.length)];
            
            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            const fallbackMessage = `🦜 𝗕𝗜𝗥𝗗 𝗙𝗔𝗖𝗧 (Fallback)

━━━━━━━━━━━━━━━━━━━━━━━

📖 ${randomFact}

━━━━━━━━━━━━━━━━━━━━━━━

📅 ${phTime}

💡 Type -birdfact for another fact!`;

            await sendMessage(senderId, { text: fallbackMessage }, pageAccessToken);
        }
    }
};