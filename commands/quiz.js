const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

// Store active quizzes per user
const activeQuizzes = new Map();

module.exports = {
    name: ['quiz', 'trivia', 'test'],
    usage: 'quiz [category] or quiz answer [1-4]',
    version: '1.0.0',
    author: 'AutoPageBot',
    category: 'fun',
    cooldown: 5,

    async execute(senderId, args, pageAccessToken, event, sendMessageFunc, imageCache) {
        // Check if this is an answer (quiz answer [number])
        if (args[0] && args[0].toLowerCase() === 'answer' && args[1]) {
            return await handleAnswer(senderId, args[1], pageAccessToken);
        }
        
        // Otherwise, start a new quiz
        return await startNewQuiz(senderId, args, pageAccessToken);
    }
};

async function startNewQuiz(senderId, args, pageAccessToken) {
    // Check if user already has an active quiz
    if (activeQuizzes.has(senderId)) {
        return sendMessage(senderId, {
            text: '❌ You already have an active quiz! Answer it using:\n\n📝 quiz answer [1-4]\n\n✨ Example: quiz answer 2'
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
        const url = categoryId 
            ? `https://opentdb.com/api.php?amount=1&category=${categoryId}&type=multiple`
            : 'https://opentdb.com/api.php?amount=1&type=multiple';
        
        const response = await axios.get(url);
        
        if (!response.data.results || response.data.results.length === 0) {
            throw new Error('No questions found');
        }

        const questionData = response.data.results[0];
        
        const answers = [...questionData.incorrect_answers, questionData.correct_answer];
        // Shuffle answers
        for (let i = answers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [answers[i], answers[j]] = [answers[j], answers[i]];
        }
        
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
💡 Type: quiz answer [1-4]
✨ Example: quiz answer 2`;

        await sendMessage(senderId, { text: message }, pageAccessToken);
        
    } catch (error) {
        console.error('Quiz Error:', error.message);
        await sendMessage(senderId, {
            text: '❌ Failed to fetch quiz question. Please try again later.'
        }, pageAccessToken);
    }
}

async function handleAnswer(senderId, answerNum, pageAccessToken) {
    // Check if user has an active quiz
    const quiz = activeQuizzes.get(senderId);
    
    if (!quiz) {
        return sendMessage(senderId, {
            text: '❌ You don\'t have an active quiz!\n\nStart a new quiz by typing: -quiz [category]\n\n✨ Example: -quiz science'
        }, pageAccessToken);
    }
    
    const answerNumber = parseInt(answerNum);
    
    // Validate answer number (1-4 only)
    if (isNaN(answerNumber) || answerNumber < 1 || answerNumber > 4) {
        return sendMessage(senderId, {
            text: '❌ Invalid answer! Please choose a number between 1 and 4 only.\n\n📝 Example: quiz answer 2'
        }, pageAccessToken);
    }
    
    // Get the selected answer
    const selectedAnswer = quiz.answers[answerNumber - 1];
    const isCorrect = selectedAnswer === quiz.correctAnswer;
    
    const decodeHtml = (text) => {
        return text.replace(/&quot;/g, '"')
                  .replace(/&#039;/g, "'")
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>');
    };
    
    const correctAnswerDecoded = decodeHtml(quiz.correctAnswer);
    const selectedAnswerDecoded = decodeHtml(selectedAnswer);
    
    let message;
    
    if (isCorrect) {
        message = `✅ 𝗖𝗢𝗥𝗥𝗘𝗖𝗧! 🎉
        
📌 Category: ${quiz.category}
⭐ Difficulty: ${quiz.difficulty}

Your answer (${answerNumber}): ${selectedAnswerDecoded}

✨ Great job! You got it right!

💡 Type -quiz to play again!`;
    } else {
        message = `❌ 𝗪𝗥𝗢𝗡𝗚 𝗔𝗡𝗦𝗪𝗘𝗥!
        
📌 Category: ${quiz.category}
⭐ Difficulty: ${quiz.difficulty}

Your answer (${answerNumber}): ${selectedAnswerDecoded}
✅ Correct answer: ${correctAnswerDecoded}

📚 Better luck next time!

💡 Type -quiz to try again!`;
    }
    
    // Remove quiz from active storage
    activeQuizzes.delete(senderId);
    
    await sendMessage(senderId, { text: message }, pageAccessToken);
}