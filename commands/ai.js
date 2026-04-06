const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

// API Keys (Primary + Backups)
const API_KEYS = [
  'AIzaSyD5U9SFqJ4FiSQv00pXb06Kv3ZH9H76JjI', // Primary
  'AIzaSyDQ4TD9hnEnAt3JGcVjIm9yWbmuc9cGt1M', // Backup 1
  'AIzaSyC5KE1o0o5sA4G5mYXS7GSemdHf2wQ8y3g', // Backup 2
  'AIzaSyDuOaOrtTvx9W5Jw6eQOIJb613uEP-vgWQ', // Backup 3
  'AIzaSyB_UMcCeW7_cnkigbePnh7GVWWEIrziaFQ'  // Backup 4
];

function makeBold(text) {
  return text.replace(/\*\*(.+?)\*\*/g, (match, word) => {
    let boldText = '';
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (char >= 'a' && char <= 'z') {
        boldText += String.fromCharCode(char.charCodeAt(0) + 0x1D41A - 97);
      } else if (char >= 'A' && char <= 'Z') {
        boldText += String.fromCharCode(char.charCodeAt(0) + 0x1D400 - 65);
      } else if (char >= '0' && char <= '9') {
        boldText += String.fromCharCode(char.charCodeAt(0) + 0x1D7CE - 48);
      } else {
        boldText += char;
      }
    }
    return boldText;
  });
}

function splitMessage(text) {
  const maxLength = 1900;
  const chunks = [];

  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }

  return chunks;
}

module.exports = {
    name: ['ai'],
    usage: 'ai [question]',
    version: '1.0.0',
    author: 'AutoPagebot',
    category: 'ai',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        const message = args.join(' ');

        if (!args.length) {
            return sendMessage(senderId, { 
                text: '🤖 Please provide a question.\n\n📝 Usage: ai what is the meaning of life?\n\n✨ Example: ai tell me a joke' 
            }, pageAccessToken);
        }

        const header = '💬 | 𝗔𝗜 𝗔𝘀𝘀𝗶𝘀𝘁𝗮𝗻𝘁\n・────────────・\n';
        const footer = '\n・────────────・';

        let aiResponse = null;
        let lastError = null;

        // Try each API key until one works
        for (let i = 0; i < API_KEYS.length; i++) {
            try {
                const response = await axios.get('https://kryptonite-api-library.onrender.com/api/gemini-vision', {
                    params: { 
                        prompt: message,
                        uid: senderId,
                        imgUrl: '',
                        apikey: API_KEYS[i]
                    }
                });

                if (response.data && response.data.status === true && response.data.response) {
                    aiResponse = response.data.response;
                    console.log(`✅ API key ${i + 1} worked successfully`);
                    break;
                } else {
                    throw new Error('Invalid API response');
                }
            } catch (error) {
                lastError = error;
                console.log(`❌ API key ${i + 1} failed:`, error.message);
                // Continue to next key
            }
        }

        if (!aiResponse) {
            console.error('AI Error:', lastError?.message);
            await sendMessage(senderId, {
                text: header + '❌ All API keys failed. Please try again later.\n\n💡 Tip: The server might be busy!' + footer
            }, pageAccessToken);
            return;
        }

        aiResponse = aiResponse.trim();
        aiResponse = makeBold(aiResponse);

        const chunks = splitMessage(aiResponse);

        for (let i = 0; i < chunks.length; i++) {
            const isFirst = i === 0;
            const isLast = i === chunks.length - 1;

            let fullMessage = chunks[i];
            if (isFirst) fullMessage = header + fullMessage;
            if (isLast) fullMessage = fullMessage + footer;

            await sendMessage(senderId, { text: fullMessage }, pageAccessToken);
        }
    }
};