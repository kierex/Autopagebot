const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

function splitMessage(text) {
  const maxLength = 1900;
  const chunks = [];

  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }

  return chunks;
}

module.exports = {
    name: ['arxiv'],
    usage: 'arxiv [search query]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'search',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken) {
        if (!args.length) {
            return sendMessage(senderId, {
                text: `📚 𝗔𝗥𝗫𝗜𝗩 𝗔𝗖𝗔𝗗𝗘𝗠𝗜𝗖 𝗦𝗘𝗔𝗥𝗖𝗛

📝 𝗨𝘀𝗮𝗴𝗲: arxiv [search query]

✨ 𝗘𝘅𝗮𝗺𝗽𝗹𝗲𝘀:
• arxiv machine learning
• arxiv quantum physics
• arxiv artificial intelligence
• arxiv covid 19 vaccine

🔬 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀:
• Search academic papers
• Get paper titles and authors
• View abstracts and summaries
• Direct links to PDFs

📌 Source: arXiv.org (Cornell University)

💡 Tip: Use specific keywords for better results!`
            }, pageAccessToken);
        }

        const query = args.join(' ');
        const encodedQuery = encodeURIComponent(query);

        // Send loading message
        await sendMessage(senderId, { 
            text: '📚 Searching arXiv for academic papers... Please wait.' 
        }, pageAccessToken);

        try {
            // arXiv API search
            const apiUrl = `http://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=5&sortBy=relevance&sortOrder=descending`;
            
            const response = await axios.get(apiUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AutoPageBot/1.0)'
                }
            });
            
            const data = response.data;
            
            // Parse XML response
            const entries = [];
            const entryMatches = data.match(/<entry>([\s\S]*?)<\/entry>/g);
            
            if (!entryMatches || entryMatches.length === 0) {
                return sendMessage(senderId, {
                    text: `❌ No papers found for "${query}".\n\nTry different keywords or visit arxiv.org directly.`
                }, pageAccessToken);
            }
            
            for (const entry of entryMatches) {
                // Extract title
                const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
                const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : 'No title';
                
                // Extract authors
                const authorMatches = entry.match(/<name>([\s\S]*?)<\/name>/g);
                const authors = authorMatches ? authorMatches.map(a => a.replace(/<\/?name>/g, '').trim()).join(', ') : 'Unknown';
                
                // Extract summary
                const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
                let summary = summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ') : 'No summary available';
                if (summary.length > 300) summary = summary.substring(0, 300) + '...';
                
                // Extract PDF link
                const pdfMatch = entry.match(/<link title="pdf" href="([^"]+)"/);
                const pdfUrl = pdfMatch ? pdfMatch[1] : '';
                
                // Extract published date
                const dateMatch = entry.match(/<published>([^<]+)<\/published>/);
                const date = dateMatch ? dateMatch[1].split('T')[0] : 'Unknown';
                
                entries.push({
                    title,
                    authors,
                    summary,
                    pdfUrl,
                    date
                });
            }
            
            const phTime = new Date().toLocaleString('en-PH', {
                timeZone: 'Asia/Manila',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            
            let message = `📚 𝗔𝗥𝗫𝗜𝗩 𝗦𝗘𝗔𝗥𝗖𝗛 𝗥𝗘𝗦𝗨𝗟𝗧𝗦\n🔍 Query: ${query}\n📅 ${phTime}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            entries.forEach((paper, index) => {
                message += `📄 ${index + 1}. ${paper.title}\n`;
                message += `👤 Author(s): ${paper.authors}\n`;
                message += `📅 Published: ${paper.date}\n`;
                message += `📝 Abstract: ${paper.summary}\n`;
                if (paper.pdfUrl) {
                    message += `🔗 PDF: ${paper.pdfUrl}\n`;
                }
                message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            });
            
            message += `💡 Tip: Use -arxiv [specific topic] for more results\n📌 Source: arXiv.org (Cornell University)`;
            
            const chunks = splitMessage(message);
            
            for (const chunk of chunks) {
                await sendMessage(senderId, { text: chunk }, pageAccessToken);
            }

        } catch (error) {
            console.error('ArXiv Error:', error.message);
            
            // Fallback response
            const fallbackMessage = `📚 𝗔𝗥𝗫𝗜𝗩 𝗦𝗘𝗔𝗥𝗖𝗛\n🔍 Query: ${query}

❌ Failed to fetch papers. Please try again later.

💡 You can search directly at: https://arxiv.org/search/?query=${encodedQuery}&searchtype=all

📌 arXiv is a free distribution service for academic papers in physics, mathematics, computer science, and more.`;

            await sendMessage(senderId, { text: fallbackMessage }, pageAccessToken);
        }
    }
};