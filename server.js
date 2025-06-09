require('dotenv').config();
const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const app = express();
const PORT = process.env.PORT || 3000;

// Security: Ensure API key is set
const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) {
    console.error('❌ SECURITY ERROR: DEEPSEEK_API_KEY environment variable is not set!');
    console.error('Please set your API key in the environment variables before starting the server.');
    process.exit(1);
}

// Rate limiting to prevent abuse
const questionRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 requests per 5 minutes
    message: {
        error: 'Too many quiz requests. Please wait 5 minutes before generating more questions.',
        retryAfter: '5 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.log(`⚠️  Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many quiz requests. Please wait 5 minutes before generating more questions.',
            retryAfter: '5 minutes'
        });
    }
});

// General rate limiting for all routes
const generalRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per minute
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting
app.use(generalRateLimit);

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Middleware to serve static files (HTML, CSS, JS)
app.use(express.static('public'));

// Logging for monitoring
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

// API endpoint for generating questions with specific rate limiting
app.get('/api/questions', questionRateLimit, async (req, res) => {
    const startTime = Date.now();
    
    try {
        console.log(`🎓 Generating new educational quiz for IP: ${req.ip}`);
        
        const response = await axios.post(
            'https://api.deepseek.com/v1/chat/completions',
            {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: "You are a helpful assistant that generates quiz questions." },
                    {
                        role: 'user',
                        content: `Generate exactly 10 educational questions for a 4th grade student (9 years old) covering multiple subjects. Include questions from at least 6 of these subjects: **science, math, social studies, geography, history, literature/reading, health/safety, arts, nature/environment, and basic life skills**.

IMPORTANT: Create completely NEW and DIFFERENT questions each time. Vary the topics, difficulty levels, and question types. Use this random element: ${Math.random().toString(36).substring(7)} to ensure uniqueness.

Here are some topic ideas to choose from (pick different ones each time):
- Math: fractions, geometry, word problems, measurement, time, money
- Science: animals, plants, weather, space, human body, simple machines, states of matter
- Geography: continents, countries, capitals, landmarks, maps, climate
- History: important figures, events, inventions, cultures, timelines
- Social Studies: government, citizenship, community helpers, holidays, traditions
- Literature: story elements, authors, characters, reading comprehension
- Health/Safety: nutrition, exercise, first aid, hygiene, safety rules
- Arts: famous artists, music, colors, creativity, cultural arts
- Nature: ecosystems, conservation, seasons, natural disasters
- Life Skills: money management, time management, problem-solving, communication

Format each question exactly like this, with --- separators:

---

**Question 1:** (Subject: Topic) [Question text here]  
a) [Answer choice A]  
b) [Answer choice B]  
c) [Answer choice C]  
d) [Answer choice D]  
e) [Answer choice E]  
**Correct Answer:** [letter]  
**Explanation:** [Brief, child-friendly explanation of why this is correct]  
**Fun Fact:** [An interesting related fact to spark curiosity]  

---

**Question 2:** (Subject: Topic) [Question text here]  
a) [Answer choice A]  
b) [Answer choice B]  
c) [Answer choice C]  
d) [Answer choice D]  
e) [Answer choice E]  
**Correct Answer:** [letter]  
**Explanation:** [Brief, child-friendly explanation of why this is correct]  
**Fun Fact:** [An interesting related fact to spark curiosity]  

Continue this exact format for all 10 questions, ending each question block with --- and starting the next with ---.

Make sure questions are:
- Age-appropriate and engaging for 4th grade students
- Educational and teach valuable concepts that align with 4th grade curriculum
- Cover diverse topics to broaden knowledge
- Include both factual knowledge and basic reasoning skills
- Written in clear, simple language children can understand
- Designed to make learning fun and memorable
- Focus on practical knowledge that helps children understand their world
- COMPLETELY DIFFERENT from any previous quiz you may have generated

Include questions that require thinking skills like: comparing and contrasting, cause and effect, problem-solving, making connections between ideas, and applying knowledge to new situations.`,
                    },
                ],
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${API_KEY}`,
                },
                timeout: 60000 // 60 second timeout
            }
        );

        const rawContent = response.data.choices[0].message.content;
        const questions = parseQuestions(rawContent);
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log(`✅ Successfully generated ${questions.length} questions in ${duration}s for IP: ${req.ip}`);
        
        if (!questions || questions.length === 0) {
            return res.status(500).json({ 
                error: 'No questions could be parsed from AI response'
            });
        }
        
        res.json(questions);
    } catch (error) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.error(`❌ Error generating questions after ${duration}s for IP: ${req.ip}:`, error.response?.data || error.message);
        
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ 
                error: 'Request timeout - please try again',
                details: 'The AI service took too long to respond'
            });
        }
        
        res.status(500).json({ 
            error: 'Failed to generate questions', 
            details: 'Please try again in a moment'
        });
    }
});

function parseQuestions(content) {
    const questions = [];
    const blocks = content.split('---').filter(block => block.trim().length > 0);
    
    for (let block of blocks) {
        if (!block.includes('**Question')) continue;
        
        const lines = block.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        let question = {
            content: '',
            choices: [],
            correctAnswer: null,
            explanation: null,
            funFact: null
        };
        
        let currentSection = null;
        
        for (let line of lines) {
            // Question title line: **Question X:** (Subject: Topic) Question text
            if (line.startsWith('**Question') && line.includes(':**')) {
                // Extract everything after the colon, including subject label
                const contentMatch = line.match(/^\*\*Question\s+\d+:\*\*\s*(.+)$/);
                if (contentMatch) {
                    question.content = contentMatch[1].trim();
                }
                currentSection = 'question';
            }
            
            // Choice lines: a) Choice text
            else if (/^[a-e]\)\s/.test(line)) {
                const choice = line.replace(/^[a-e]\)\s*/, '');
                question.choices.push(choice);
                currentSection = 'choices';
            }
            
            // Correct Answer line: **Correct Answer:** letter
            else if (line.startsWith('**Correct Answer:**')) {
                const answerMatch = line.match(/\*\*Correct Answer:\*\*\s*([a-e])/);
                if (answerMatch) {
                    question.correctAnswer = answerMatch[1].toLowerCase();
                }
                currentSection = 'answer';
            }
            
            // Explanation line: **Explanation:** text
            else if (line.startsWith('**Explanation:**')) {
                question.explanation = line.replace(/^\*\*Explanation:\*\*\s*/, '');
                currentSection = 'explanation';
            }
            
            // Fun Fact line: **Fun Fact:** text
            else if (line.startsWith('**Fun Fact:**')) {
                question.funFact = line.replace(/^\*\*Fun Fact:\*\*\s*/, '');
                currentSection = 'funfact';
            }
            
            // Continue previous section if it's a continuation line
            else if (line.length > 0 && currentSection) {
                if (currentSection === 'question' && question.content) {
                    question.content += ' ' + line;
                } else if (currentSection === 'explanation' && question.explanation) {
                    question.explanation += ' ' + line;
                } else if (currentSection === 'funfact' && question.funFact) {
                    question.funFact += ' ' + line;
                }
            }
        }
        
        // Validate and add question
        if (question.content && question.choices.length >= 5 && question.correctAnswer) {
            questions.push(question);
        }
    }
    
    return questions;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🎓 Secure Educational Quiz Server running on http://localhost:${PORT}`);
    console.log(`🔒 Security features enabled:`);
    console.log(`   ✅ API key protection`);
    console.log(`   ✅ Rate limiting (10 quizzes per 5 minutes per IP)`);
    console.log(`   ✅ Security headers`);
    console.log(`   ✅ Request logging`);
    console.log(`Ready to generate awesome 4th grade questions safely!`);
});