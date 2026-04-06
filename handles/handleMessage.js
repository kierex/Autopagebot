const fs = require('fs');
const path = require('path');
const { sendMessage } = require('./sendMessage');
const tokenManager = require('./tokenManager');

// Load command modules
const commands = new Map();
const lastImageByUser = new Map();
const lastVideoByUser = new Map();
const prefix = '-';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Load commands with support for multiple command names
const loadCommands = () => {
    const commandsDir = path.join(__dirname, '../commands');

    if (!fs.existsSync(commandsDir)) {
        fs.mkdirSync(commandsDir, { recursive: true });
        console.log('📁 Created commands directory');
        return;
    }

    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
        try {
            delete require.cache[require.resolve(`../commands/${file}`)];
            const command = require(`../commands/${file}`);

            const names = Array.isArray(command.name) ? command.name : [command.name];
            names.forEach(name => {
                if (typeof name === 'string') {
                    commands.set(name.toLowerCase(), command);
                }
            });
            console.log(`📦 Loaded command: ${names.join(', ')}`);
        } catch (error) {
            console.error(`Error loading command ${file}:`, error.message);
        }
    }
};

loadCommands();

// Clear image cache periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of lastImageByUser) {
        if (now - value.timestamp > CACHE_TTL) {
            lastImageByUser.delete(key);
        }
    }
    for (const [key, value] of lastVideoByUser) {
        if (now - value.timestamp > CACHE_TTL) {
            lastVideoByUser.delete(key);
        }
    }
}, CACHE_TTL);

async function handleMessage(event, pageAccessToken, pageId) {
    const senderId = event?.sender?.id;
    if (!senderId) return console.error('Invalid event object');

    // Increment message counter
    await tokenManager.incrementMessages();

    const messageText = event?.message?.text?.trim();
    const attachments = event?.message?.attachments || [];

    // Detect current attachments if present
    const imageAttachment = attachments.find(a => a.type === 'image');
    const videoAttachment = attachments.find(a => a.type === 'video');

    const imageUrl = imageAttachment?.payload?.url;
    const videoUrl = videoAttachment?.payload?.url;

    // Save to cache with timestamps
    if (imageUrl) {
        lastImageByUser.set(senderId, {
            url: imageUrl,
            timestamp: Date.now()
        });
    }
    if (videoUrl) {
        lastVideoByUser.set(senderId, {
            url: videoUrl,
            timestamp: Date.now()
        });
    }

    // Get latest media (prioritize current, fallback to previous)
    const cachedImage = lastImageByUser.get(senderId);
    const cachedVideo = lastVideoByUser.get(senderId);
    const lastImage = imageUrl || cachedImage?.url;
    const lastVideo = videoUrl || cachedVideo?.url;
    const mediaToUpload = lastImage || lastVideo;

    if (!messageText) return console.log('Received message without text');

    const [rawCommand, ...args] = messageText.startsWith(prefix)
        ? messageText.slice(prefix.length).split(' ')
        : messageText.split(' ');

    const commandKey = rawCommand.toLowerCase();
    const mediaCommands = ['remini', 'gem', 'imgbb', '4k', 'restore', 'ocr', 'removebg', 'gemini', 'imgur', 'zombie', 'blur', 'vampire', 'catmoe'];

    try {
        console.log(`📝 Received command: ${commandKey}, args: ${args.join(' ')} for page ${pageId} from user ${senderId}`);

        if (mediaCommands.includes(commandKey)) {
            switch (commandKey) {
                case 'remini':
                case '4k':
                case 'restore':
                case 'removebg':
                case 'zombie':
                case 'blur':
                case 'vampire':
                    if (lastImage) {
                        await commands.get(commandKey).execute(senderId, [], pageAccessToken, lastImage);
                        lastImageByUser.delete(senderId);
                    } else {
                        await sendMessage(senderId, {
                            text: `❌ Please send an image first, then type "${commandKey}".`
                        }, pageAccessToken);
                    }
                    break;

                case 'gemini':
                    await commands.get('gemini').execute(senderId, args, pageAccessToken, event, lastImage);
                    lastImageByUser.delete(senderId);
                    break;

                case 'gem':
                    await commands.get('gem').execute(senderId, args, pageAccessToken, event, lastImage);
                    lastImageByUser.delete(senderId);
                    break;

                case 'imgbb':
                    if (mediaToUpload) {
                        await commands.get('imgbb').execute(senderId, [], pageAccessToken, mediaToUpload);
                        lastImageByUser.delete(senderId);
                        lastVideoByUser.delete(senderId);
                    } else {
                        await sendMessage(senderId, {
                            text: '❌ Please send an image or video first, then type "imgbb".'
                        }, pageAccessToken);
                    }
                    break;

                case 'imgur':
                    if (mediaToUpload) {
                        await commands.get('imgur').execute(senderId, [], pageAccessToken, mediaToUpload);
                        lastImageByUser.delete(senderId);
                        lastVideoByUser.delete(senderId);
                    } else {
                        await sendMessage(senderId, {
                            text: '❌ Please send an image or video first, then type "imgur".'
                        }, pageAccessToken);
                    }
                    break;

                case 'ocr':
                    if (mediaToUpload) {
                        await commands.get('ocr').execute(senderId, [], pageAccessToken, mediaToUpload);
                        lastImageByUser.delete(senderId);
                        lastVideoByUser.delete(senderId);
                    } else {
                        await sendMessage(senderId, {
                            text: '❌ Please send an image first, then type "ocr".'
                        }, pageAccessToken);
                    }
                    break;

                case 'catmoe':
                    if (mediaToUpload) {
                        await commands.get('catmoe').execute(senderId, [], pageAccessToken, mediaToUpload);
                        lastImageByUser.delete(senderId);
                        lastVideoByUser.delete(senderId);
                    } else {
                        await sendMessage(senderId, {
                            text: '❌ Please send an image first, then type "catmoe".'
                        }, pageAccessToken);
                    }
                    break;
            }
            return;
        }

        // Normal command
        if (commands.has(commandKey)) {
            await commands.get(commandKey).execute(senderId, args, pageAccessToken, event, sendMessage, lastImageByUser);
        } else if (commands.has('ai')) {
            await commands.get('ai').execute(senderId, [messageText], pageAccessToken, event, sendMessage, lastImageByUser);
        } else {
            await sendMessage(senderId, {
                text: '❓ Unknown command and AI fallback is unavailable.'
            }, pageAccessToken);
        }

    } catch (error) {
        console.error(`Error executing command "${commandKey}":`, error.message);
        await sendMessage(senderId, {
            text: error.message || `❌ There was an error executing "${commandKey}".`
        }, pageAccessToken);
    }
}

module.exports = { handleMessage };