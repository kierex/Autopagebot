const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');
const memory = require('../utils/memoryManager');

// Model configurations
const MODEL_LIST = {
    chatgpt4: {
        api: 'https://stablediffusion.fr/gpt4/predict2',
        referer: 'https://stablediffusion.fr/chatgpt4',
        name: 'ChatGPT-4'
    },
    chatgpt3: {
        api: 'https://stablediffusion.fr/gpt3/predict',
        referer: 'https://stablediffusion.fr/chatgpt3',
        name: 'ChatGPT-3'
    }
};

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
    author: 'AutoPageBot',
    category: 'ai',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        if (!args.length) {
            const stats = memory.getStats(senderId);
            return sendMessage(senderId, {
                text: `🤖 𝗖𝗵𝗮𝘁𝗚𝗣𝗧 𝗔𝗜 𝗔𝘀𝘀𝗶𝘀𝘁𝗮𝗻𝘁 (GPT-4)

📝 𝗨𝘀𝗮𝗴𝗲: chatgpt [your question]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• chatgpt Hello! How are you?
• chatgpt What is artificial intelligence?
• chatgpt Tell me a joke

🤖 𝗠𝗼𝗱𝗲𝗹𝘀:
• GPT-4 (default) - Latest model
• GPT-3 - Legacy model (use -chatgpt3)

🔄 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀:
• chatgpt reset - Clear conversation history
• chatgpt stats - Show conversation stats

📊 Session: ${stats.messageCount} messages

💡 The AI remembers your conversation!`
            }, pageAccessToken);
        }

        const message = args.join(' ');
        
        // Handle reset command
        if (message.toLowerCase() === 'reset' || message.toLowerCase() === 'clear') {
            memory.clearConversation(senderId);
            return sendMessage(senderId, {
                text: '🧹 Conversation history cleared!\n\n💬 Start a fresh conversation.'
            }, pageAccessToken);
        }

        // Handle stats command
        if (message.toLowerCase() === 'stats') {
            const stats = memory.getStats(senderId);
            const lastActive = new Date(stats.lastActive).toLocaleString('en-PH', {
                timeZone: 'Asia/Manila'
            });
            const created = new Date(stats.createdAt).toLocaleString('en-PH', {
                timeZone: 'Asia/Manila'
            });

            return sendMessage(senderId, {
                text: `📊 𝗖𝗼𝗻𝘃𝗲𝗿𝘀𝗮𝘁𝗶𝗼𝗻 𝗦𝘁𝗮𝘁𝘀

• Messages: ${stats.messageCount}
• Created: ${created}
• Last active: ${lastActive}
• Storage: memory/conversations.json

💡 Use "chatgpt reset" to clear history`
            }, pageAccessToken);
        }

        // Check for model override (if user starts with gpt3)
        let model = 'chatgpt4';
        let prompt = message;
        
        if (message.toLowerCase().startsWith('gpt3') || message.toLowerCase().startsWith('chatgpt3')) {
            model = 'chatgpt3';
            prompt = message.replace(/^(gpt3|chatgpt3)/i, '').trim();
        }

        if (!prompt) {
            return sendMessage(senderId, {
                text: `❌ Please provide a question!\n\n📝 Example: chatgpt What is the meaning of life?`
            }, pageAccessToken);
        }

        const header = `💬 | ${MODEL_LIST[model].name}\n・────────────・\n`;
        const footer = '\n・────────────・';

        // Build context from conversation history
        const context = memory.getContext(senderId, 10);
        let fullPrompt = prompt;

        if (context) {
            fullPrompt = `Previous conversation:\n${context}\nUser: ${prompt}\nAssistant:`;
        }

        let aiResponse = null;
        let lastError = null;

        try {
            // Get referer to receive cookies
            const refererResp = await axios.get(MODEL_LIST[model].referer, { timeout: 10000 });
            const setCookie = refererResp.headers && refererResp.headers['set-cookie'];
            const cookieHeader = Array.isArray(setCookie) ? setCookie.join('; ') : undefined;

            const response = await axios.post(
                MODEL_LIST[model].api,
                { prompt: fullPrompt },
                {
                    headers: {
                        'accept': '*/*',
                        'content-type': 'application/json',
                        'origin': 'https://stablediffusion.fr',
                        'referer': MODEL_LIST[model].referer,
                        ...(cookieHeader ? { cookie: cookieHeader } : {}),
                        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36'
                    },
                    timeout: 60000
                }
            );

            if (response.data && response.data.message) {
                aiResponse = response.data.message;
            } else {
                throw new Error('Invalid API response');
            }

        } catch (error) {
            lastError = error;
            console.error(`${MODEL_LIST[model].name} Error:`, error.message);
        }

        if (!aiResponse) {
            await sendMessage(senderId, {
                text: header + `❌ ${MODEL_LIST[model].name} is currently unavailable. Please try again later.\n\n💡 Tip: Try again in a few seconds.` + footer
            }, pageAccessToken);
            return;
        }

        // Save to conversation memory
        memory.addMessage(senderId, 'user', prompt);
        memory.addMessage(senderId, 'assistant', aiResponse);

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