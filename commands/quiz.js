const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

// Store active quizzes per user
const activeQuizzes = new Map();

module.exports = {
    name: ['quiz'],
    usage: 'quiz [category]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'fun',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        // Check if user already has an active quiz
        if (activeQuizzes.has(senderId)) {
            return sendMessage(senderId, {
                text: '❌ You already have an active quiz! Answer the current question first.\n\nType "answer [number]" to respond.'
            }, pageAccessToken);
        }

        const category = args[0] || 'random';
        
        // Category mapping
        const categories = {
            random: '',
            science: '17',
            math: '19',
            history: '23',
            geography: '22',
            art: '25',
            sports: '21',
            music: '12',
            film: '11',
            gaming: '15'
        };

        const categoryId = categories[category.toLowerCase()] || '';

        try {
            // Fetch quiz question from Open Trivia DB
            const url = categoryId 
                ? `https://opentdb.com/api.php?amount=1&category=${categoryId}&type=multiple`
                : 'https://opentdb.com/api.php?amount=1&type=multiple';
            
            const response = await axios.get(url);
            
            if (!response.data.results || response.data.results.length === 0) {
                throw new Error('No questions found');
            }

            const questionData = response.data.results[0];
            
            // Combine all answers
            const answers = [...questionData.incorrect_answers, questionData.correct_answer];
            // Shuffle answers
            for (let i = answers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [answers[i], answers[j]] = [answers[j], answers[i]];
            }
            
            // Decode HTML entities
            const decodeHtml = (text) => {
                return text.replace(/&quot;/g, '"')
                          .replace(/&#039;/g, "'")
                          .replace(/&amp;/g, '&')
                          .replace(/&lt;/g, '<')
                          .replace(/&gt;/g, '>');
            };
            
            const question = decodeHtml(questionData.question);
            const correctAnswer = decodeHtml(questionData.correct_answer);
            const categoryName = questionData.category;
            const difficulty = questionData.difficulty.toUpperCase();
            
            // Difficulty emoji
            const difficultyEmoji = {
                'EASY': '🟢',
                'MEDIUM': '🟡',
                'HARD': '🔴'
            }[difficulty] || '⚪';
            
            // Store quiz data
            activeQuizzes.set(senderId, {
                correctAnswer: correctAnswer,
                answers: answers,
                category: categoryName,
                difficulty: difficulty,
                timestamp: Date.now()
            });
            
            // Auto-cleanup after 60 seconds
            setTimeout(() => {
                if (activeQuizzes.has(senderId)) {
                    activeQuizzes.delete(senderId);
                }
            }, 60000);
            
            // Format answers with numbers
            let answerList = '';
            answers.forEach((answer, index) => {
                answerList += `\n${index + 1}. ${decodeHtml(answer)}`;
            });
            
            const message = `📚 𝗤𝗨𝗜𝗭 𝗧𝗜𝗠𝗘!
            
📌 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝘆: ${categoryName}
⭐ 𝗗𝗶𝗳𝗳𝗶𝗰𝘂𝗹𝘁𝘆: ${difficultyEmoji} ${difficulty}

❓ 𝗤𝘂𝗲𝘀𝘁𝗶𝗼𝗻:
${question}

📝 𝗖𝗵𝗼𝗼𝘀𝗲 𝘆𝗼𝘂𝗿 𝗮𝗻𝘀𝘄𝗲𝗿:${answerList}

⏱️ You have 60 seconds to answer!
💡 Type: answer [1-4]`;

            await sendMessage(senderId, { text: message }, pageAccessToken);
            
        } catch (error) {
            console.error('Quiz Error:', error.message);
            await sendMessage(senderId, {
                text: '❌ Failed to fetch quiz question. Please try again later.'
            }, pageAccessToken);
        }
    }
};