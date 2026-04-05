const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

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
    name: ['ai','gpt'],
    usage: 'ai [question]',
    version: '1.0.0',
    author: 'coffee',
    category: 'ai',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        const message = args.join(' ') || 'Hello';
        
        if (!args.length) {
            return sendMessage(senderId, { 
                text: '🤖 Please provide a question.\n\n📝 Usage: ai what is the meaning of life?\n\n✨ Example: ai tell me a joke' 
            }, pageAccessToken);
        }

        const header = '💬 | 𝗖𝗵𝗮𝘁𝗚𝗣𝗧 𝗔𝗜\n・────────────・\n';
        const footer = '\n・──── >ᴗ< ─────・';

        try {
            const response = await axios.get('https://yin-api.vercel.app/ai/chatgptfree', {
                params: { 
                    prompt: message,
                    model: 'chatgpt4'
                }
            });

            if (!response.data || !response.data.answer) {
                throw new Error('API error');
            }

            let aiResponse = response.data.answer;
            
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

        } catch (error) {
            console.error('AI Error:', error.message);
            await sendMessage(senderId, {
                text: header + '❌ Something went wrong. Please try again.\n\n💡 Tip: Try asking something else!' + footer
            }, pageAccessToken);
        }
    }
};