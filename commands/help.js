const fs = require('fs');    
const path = require('path');    
const axios = require('axios');    
const { sendMessage } = require('../handles/sendMessage');    

const COMMANDS_PATH = path.join(__dirname, '../commands');    

const CATEGORY_MAP = {    
  ai: '🤖 | 𝗔𝗜',    
  music: '🎧 | 𝗠𝗨𝗦𝗜𝗖',    
  images: '🖼️ | 𝗜𝗠𝗔𝗚𝗘𝗦',    
  search: '🔍 | 𝗦𝗘𝗔𝗥𝗖𝗛',
  tools: '⚒️ | 𝗧𝗢𝗢𝗟𝗦',    
  uploader: '📥 | 𝗨𝗣𝗟𝗢𝗔𝗗𝗘𝗥',    
  others: '🗂️ | 𝗢𝗧𝗛𝗘𝗥𝗦',  
  system: '⚙️ | 𝗕𝗢𝗧 𝗦𝗬𝗦𝗧𝗘𝗠'  
};    

const ALLOWED_CATEGORIES = ['ai', 'search', 'music', 'images', 'tools', 'system', 'uploader'];    

module.exports = {    
  name: ['help', 'commands', 'menu'],        
  usage: 'help [command name]',    
  author: 'AutoPageBot',    
  version: '2.1.0',
  category: 'tools',
  cooldown: 3, // 3 seconds cooldown (0-20 range)

  async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {    
    try {    
      const files = fs.readdirSync(COMMANDS_PATH).filter(file => file.endsWith('.js'));    

      const commands = files.map(file => {    
        try {    
          const cmd = require(path.join(COMMANDS_PATH, file));    
          const category = ALLOWED_CATEGORIES.includes(cmd.category) ? cmd.category : 'others';    

          // Handle both string and array command names
          let cmdName = cmd.name;
          if (Array.isArray(cmd.name)) {
            cmdName = cmd.name[0]; // Use first name as primary
          }

          return {    
            name: cmdName,    
            allNames: Array.isArray(cmd.name) ? cmd.name : [cmd.name],
            description: cmd.description || 'No description.',    
            usage: cmd.usage || 'Not specified.',    
            author: cmd.author || 'Unknown',    
            version: cmd.version || '1.0.0',
            category,
            cooldown: cmd.cooldown || 0
          };    
        } catch(err) {    
          console.error(`Error loading ${file}:`, err.message);
          return null;    
        }    
      }).filter(Boolean);    

      // If specific command is requested    
      if (args.length > 0) {    
        const input = args[0].toLowerCase();    
        const cmd = commands.find(c => 
          c.name.toLowerCase() === input || 
          (c.allNames && c.allNames.some(name => name.toLowerCase() === input))
        );    

        if (!cmd) {    
          return sendMessage(senderId, {    
            text: `❌ Command "${input}" not found.\n\n📚 Type "help" to see all available commands.`    
          }, pageAccessToken);    
        }    

        // Show cooldown info if command has cooldown
        const cooldownInfo = cmd.cooldown > 0 ? `\n• 𝗖𝗼𝗼𝗹𝗱𝗼𝘄𝗻: ${cmd.cooldown} seconds` : '';

        const response = 
`📖 𝗖𝗼𝗺𝗺𝗮𝗻𝗱 𝗗𝗲𝘁𝗮𝗶𝗹𝘀

• 𝗡𝗮𝗺𝗲: ${cmd.name}
• 𝗗𝗲𝘀𝗰𝗿𝗶𝗽𝘁𝗶𝗼𝗻: ${cmd.description}
• 𝗨𝘀𝗮𝗴𝗲: ${cmd.usage}
• 𝗩𝗲𝗿𝘀𝗶𝗼𝗻: ${cmd.version}
• 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝘆: ${CATEGORY_MAP[cmd.category] || '🗂️ 𝗢𝗧𝗛𝗘𝗥𝗦'}
• 𝗔𝘂𝘁𝗵𝗼𝗿: ${cmd.author}${cooldownInfo}`;    

        return sendMessage(senderId, { text: response }, pageAccessToken);    
      }    

      // Group all commands by category    
      const grouped = {};    
      for (const cat of Object.keys(CATEGORY_MAP)) grouped[cat] = [];    

      for (const cmd of commands) {    
        grouped[cmd.category || 'others'].push(`→ ${cmd.name}`);    
      }    

      const totalCount = commands.length;    
      let message = `📖 𝗛𝗲𝗹𝗽 𝗠𝗲𝗻𝘂: [ ${totalCount} ]\n\n`;    

      for (const cat of Object.keys(CATEGORY_MAP)) {    
        if (grouped[cat].length > 0) {    
          message += `${CATEGORY_MAP[cat]}:\n${grouped[cat].join('\n')}\n\n`;    
        }    
      }    

      message += "🛠 𝗧𝗶𝗽: Use `help <command>` to view command info.\n\n";    
      message += "⏱️ 𝗡𝗼𝘁𝗲: Some commands have cooldowns (3-20 seconds) to prevent spam.\n\n";

      // Fetch random fact    
      let factText = null;    
      try {    
        const factRes = await axios.get("https://api.popcat.xyz/v2/fact");    
        if (factRes.data && factRes.data.message && factRes.data.message.fact) {    
          factText = factRes.data.message.fact;    
        }    
      } catch (err) {    
        factText = null;    
      }    

      if (factText) {    
        message += `👍 𝗥𝗔𝗡𝗗𝗢𝗠 𝗙𝗔𝗖𝗧:\n\n[ ${factText} ]`;    
      }    

      await sendMessage(senderId, { text: message }, pageAccessToken);    

    } catch (error) {    
      console.error('Help command error:', error.message);    
      await sendMessage(senderId, {    
        text: `❌ Error while showing help menu:\n${error.message}`    
      }, pageAccessToken);    
    }    
  }    
};