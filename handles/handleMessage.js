const fs = require('fs');
const path = require('path');
const { sendMessage } = require('./sendMessage');
const tokenManager = require('./tokenManager');

const commands = new Map();
const imageCache = new Map();
const lastImageByUser = new Map();
const lastVideoByUser = new Map();
const prefix = '-';
const CACHE_TTL = 10 * 60 * 1000; 

// Load commands on startup
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
    for (const [key, value] of imageCache) {
        if (now - value.timestamp > CACHE_TTL) {
            imageCache.delete(key);
        }
    }
}, CACHE_TTL);

const handleMessage = async (event, pageAccessToken, pageId) => {
    const senderId = event?.sender?.id;
    if (!senderId) return;

    // Increment message counter
    await tokenManager.incrementMessages();

    const messageText = event?.message?.text?.trim();
    const attachments = event?.message?.attachments || [];

    // Detect current attachments if present
    const imageAttachment = attachments.find(a => a.type === 'image');
    const videoAttachment = attachments.find(a => a.type === 'video');

    const imageUrl = imageAttachment?.payload?.url;
    const videoUrl = videoAttachment?.payload?.url;

    // Save to cache
    if (imageUrl) {
        imageCache.set(senderId, {
            url: imageUrl,
            timestamp: Date.now()
        });
        lastImageByUser.set(senderId, imageUrl);
    }
    if (videoUrl) lastVideoByUser.set(senderId, videoUrl);

    // Get latest media (prioritize current, fallback to previous)
    const lastImage = imageUrl || lastImageByUser.get(senderId);
    const lastVideo = videoUrl || lastVideoByUser.get(senderId);
    const mediaToUpload = lastImage || lastVideo;

    if (!messageText) return;

    const isCommand = messageText.startsWith(prefix);
    const [commandName, ...args] = isCommand 
        ? messageText.slice(prefix.length).split(' ')
        : messageText.split(' ');

    const normalizedCommand = commandName.toLowerCase();
    
    // Media commands list
    const mediaCommands = ['remini', 'gem', 'imgbb', '4k', 'restore', 'ocr', 'removebg', 'gemini', 'imgur', 'zombie', 'blur', 'vampire'];

    try {
        console.log(`Received command: ${normalizedCommand}, args: ${args.join(' ')}`);

        // Handle media commands
        if (mediaCommands.includes(normalizedCommand)) {
            switch (normalizedCommand) {
                case 'remini':
                case '4k':
                case 'restore':
                case 'removebg':
                case 'zombie':
                case 'blur':
                case 'vampire':
                    if (lastImage) {
                        await commands.get(normalizedCommand).execute(senderId, [], pageAccessToken, lastImage);
                        lastImageByUser.delete(senderId);
                    } else {
                        await sendMessage(senderId, {
                            text: `❌ Please send an image first, then type "${normalizedCommand}".`
                        }, pageAccessToken);
                    }
                    break;

                case 'gemini':
                    if (commands.has('gemini')) {
                        await commands.get('gemini').execute(senderId, args, pageAccessToken, event, lastImage);
                        lastImageByUser.delete(senderId);
                    } else {
                        await sendMessage(senderId, { text: '❌ Gemini command not found.' }, pageAccessToken);
                    }
                    break;

                case 'gem':
                    if (commands.has('gem')) {
                        await commands.get('gem').execute(senderId, args, pageAccessToken, event, lastImage);
                        lastImageByUser.delete(senderId);
                    } else {
                        await sendMessage(senderId, { text: '❌ Gem command not found.' }, pageAccessToken);
                    }
                    break;

                case 'imgbb':
                    if (mediaToUpload && commands.has('imgbb')) {
                        await commands.get('imgbb').execute(senderId, [], pageAccessToken, mediaToUpload);
                        lastImageByUser.delete(senderId);
                        lastVideoByUser.delete(senderId);
                    } else if (!commands.has('imgbb')) {
                        await sendMessage(senderId, { text: '❌ ImgBB command not found.' }, pageAccessToken);
                    } else {
                        await sendMessage(senderId, {
                            text: '❌ Please send an image or video first, then type "imgbb".'
                        }, pageAccessToken);
                    }
                    break;
                    
                case 'imgur':
                    if (mediaToUpload && commands.has('imgur')) {
                        await commands.get('imgur').execute(senderId, [], pageAccessToken, mediaToUpload);
                        lastImageByUser.delete(senderId);
                        lastVideoByUser.delete(senderId);
                    } else if (!commands.has('imgur')) {
                        await sendMessage(senderId, { text: '❌ ImgUr command not found.' }, pageAccessToken);
                    } else {
                        await sendMessage(senderId, {
                            text: '❌ Please send an image or video first, then type "imgur".'
                        }, pageAccessToken);
                    }
                    break;
                    
                case 'ocr':
                    if (mediaToUpload && commands.has('ocr')) {
                        await commands.get('ocr').execute(senderId, [], pageAccessToken, mediaToUpload);
                        lastImageByUser.delete(senderId);
                        lastVideoByUser.delete(senderId);
                    } else if (!commands.has('ocr')) {
                        await sendMessage(senderId, { text: '❌ OCR command not found.' }, pageAccessToken);
                    } else {
                        await sendMessage(senderId, {
                            text: '❌ Please send an image first, then type "ocr".'
                        }, pageAccessToken);
                    }
                    break;
                    
                default:
                    await sendMessage(senderId, { text: '❌ Unknown media command.' }, pageAccessToken);
            }
            return;
        }

        // Normal command
        const command = commands.get(normalizedCommand);

        if (command) {
            console.log(`📝 Executing command: ${normalizedCommand} for page ${pageId} from user ${senderId}`);
            await command.execute(senderId, args, pageAccessToken, event, sendMessage, imageCache);
        } else if (commands.has('ai')) {
            await commands.get('ai').execute(senderId, [messageText], pageAccessToken, event, sendMessage, imageCache);
        } else {
            await sendMessage(senderId, { text: '🤖 Unknown command. Type "help" for available commands.' }, pageAccessToken);
        }
    } catch (error) {
        console.error('Command execution error:', error.message);
        await sendMessage(senderId, { text: error.message || '❌ Command execution failed. Please try again later.' }, pageAccessToken);
    }
};

module.exports = { handleMessage };