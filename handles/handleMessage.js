const fs = require('fs');
const path = require('path');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const imageCache = new Map();
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

// Cooldown functions (will be set from index.js)
let checkCooldownGlobal = null;
let setCooldownGlobal = null;

// Function to set cooldown functions from index.js
function setCooldownFunctions(checkFn, setFn) {
    checkCooldownGlobal = checkFn;
    setCooldownGlobal = setFn;
}

const handleMessage = async (event, pageAccessToken, pageId) => {
    const senderId = event?.sender?.id;
    if (!senderId) return;

    const messageText = event?.message?.text?.trim();
    const attachments = event?.message?.attachments || [];

    // Cache images
    for (const attachment of attachments) {
        if (attachment.type === 'image' && attachment.payload?.url) {
            imageCache.set(senderId, {
                url: attachment.payload.url,
                timestamp: Date.now()
            });
        }
    }

    if (!messageText) return;

    const isCommand = messageText.startsWith(prefix);
    
    if (!isCommand) return;
    
    const [commandName, ...args] = messageText.slice(prefix.length).split(' ');
    const normalizedCommand = commandName.toLowerCase();

    try {
        const command = commands.get(normalizedCommand);

        if (!command) {
            return await sendMessage(senderId, { 
                text: '❌ Unknown command. Type "help" for available commands.' 
            }, pageAccessToken);
        }

        // Check cooldown if function is available
        if (checkCooldownGlobal && command.cooldown > 0) {
            const cooldownStatus = checkCooldownGlobal(normalizedCommand, senderId);
            
            if (cooldownStatus.onCooldown) {
                return await sendMessage(senderId, { 
                    text: `⏱️ Please wait ${cooldownStatus.remaining} seconds before using the "${normalizedCommand}" command again.` 
                }, pageAccessToken);
            }
        }

        console.log(`📝 Executing command: ${normalizedCommand} for page ${pageId} from user ${senderId}`);
        
        // Execute command
        await command.execute(senderId, args, pageAccessToken, event, sendMessage, imageCache);
        
        // Set cooldown after successful execution
        if (setCooldownGlobal && command.cooldown > 0) {
            setCooldownGlobal(normalizedCommand, senderId, command.cooldown);
        }
        
    } catch (error) {
        console.error('Command execution error:', error.message);
        await sendMessage(senderId, { 
            text: `❌ Command execution failed: ${error.message}` 
        }, pageAccessToken);
    }
};

module.exports = { handleMessage, setCooldownFunctions };