// Using built-in fetch instead of axios (Node 18+ has native fetch)

// Simple in-memory rate limiting (resets on cold starts)
const rateLimitMap = new Map();

function checkRateLimit(ip) {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const maxRequests = 10;
    
    if (!rateLimitMap.has(ip)) {
        rateLimitMap.set(ip, { count: 0, resetTime: now + windowMs });
    }
    
    const record = rateLimitMap.get(ip);
    
    if (now > record.resetTime) {
        record.count = 0;
        record.resetTime = now + windowMs;
    }
    
    if (record.count >= maxRequests) {
        return false;
    }
    
    record.count++;
    return true;
}

export default async function handler(req, res) {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const startTime = Date.now();
    const clientIP = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
    let rawContent = null; // Declare here to ensure it's in scope
    
    try {
        console.log(`🎓 Generating new educational quiz for IP: ${clientIP}`);
        
        // Rate limiting
        if (!checkRateLimit(clientIP)) {
            console.log(`⚠️  Rate limit exceeded for IP: ${clientIP}`);
            return res.status(429).json({
                error: 'Too many quiz requests. Please wait 5 minutes before generating more questions.',
                retryAfter: '5 minutes'
            });
        }
        
        // Check API key
        const API_KEY = process.env.DEEPSEEK_API_KEY;
        if (!API_KEY) {
            console.error('❌ No API key available');
            return res.status(500).json({ 
                error: 'Server configuration error',
                details: 'API key not configured properly'
            });
        }

        console.log('📡 Making request to DeepSeek API...');
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: "You are a helpful assistant that generates quiz questions." },
                    {
                        role: 'user',
                        content: `Generate exactly 10 educational questions for a 4th grade student (9 years old) covering multiple subjects. Include questions from at least 6 of these subjects: **science, math, social studies, geography, history, literature/reading, health/safety, arts, nature/environment, and basic life skills**.

CRITICAL: This request has unique ID: ${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)} and timestamp: ${new Date().toISOString()}. Create COMPLETELY NEW and UNIQUE questions that have NEVER been generated before. Each question must be totally different from any previous quiz.

VARIATION REQUIREMENTS:
- Use different question formats: multiple choice, scenario-based, "what if" questions, comparison questions
- Vary difficulty within 4th grade level (some easier, some more challenging)
- Mix factual recall with critical thinking and application questions
- Use different contexts and real-world examples each time
- Include questions that require students to analyze, compare, predict, or solve problems

TOPIC ROTATION (pick 6-8 different subjects each time):
- **Math**: ${['basic fractions and decimals', 'geometry shapes and angles', 'word problems with money', 'measurement and units', 'time and elapsed time', 'multiplication and division', 'area and perimeter', 'patterns and sequences'][Math.floor(Math.random() * 8)]}
- **Science**: ${['animal adaptations', 'plant life cycles', 'weather patterns', 'solar system', 'states of matter', 'simple machines', 'ecosystems', 'human body systems'][Math.floor(Math.random() * 8)]}
- **Geography**: ${['US states and capitals', 'world continents', 'landforms and bodies of water', 'maps and directions', 'climate zones', 'natural resources', 'famous landmarks', 'cultural regions'][Math.floor(Math.random() * 8)]}
- **History**: ${['American Revolution', 'Native American cultures', 'explorers and discoveries', 'colonial life', 'inventors and inventions', 'Civil War era', 'westward expansion', 'early settlements'][Math.floor(Math.random() * 8)]}
- **Social Studies**: ${['government and citizenship', 'community helpers', 'economics and money', 'cultures and traditions', 'rights and responsibilities', 'democracy and voting', 'laws and rules', 'diversity and inclusion'][Math.floor(Math.random() * 8)]}
- **Literature**: ${['story elements and plot', 'character development', 'poetry and rhyme', 'authors and illustrators', 'genres and types', 'reading comprehension', 'main idea and details', 'cause and effect'][Math.floor(Math.random() * 8)]}
- **Health/Safety**: ${['nutrition and food groups', 'exercise and fitness', 'personal hygiene', 'safety rules', 'first aid basics', 'mental health', 'sleep and rest', 'preventing illness'][Math.floor(Math.random() * 8)]}
- **Arts**: ${['famous artists and paintings', 'music and instruments', 'theater and drama', 'art techniques', 'cultural arts', 'creativity and expression', 'color theory', 'art history'][Math.floor(Math.random() * 8)]}
- **Nature**: ${['conservation and recycling', 'endangered species', 'natural disasters', 'seasons and changes', 'life cycles', 'food chains', 'habitats', 'environmental protection'][Math.floor(Math.random() * 8)]}
- **Life Skills**: ${['time management', 'problem solving', 'communication', 'teamwork', 'goal setting', 'decision making', 'organization', 'responsibility'][Math.floor(Math.random() * 8)]}

QUESTION VARIETY EXAMPLES (use different ones each time):
- Scenario: "If you were planning a garden..."
- Comparison: "Which is larger/smaller/faster..."
- Application: "How would you use this knowledge to..."
- Analysis: "What would happen if..."
- Real-world: "In your daily life, when might you..."
- Problem-solving: "A student needs to figure out..."

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

Continue this exact format for all 10 questions. Make sure questions are:
- Age-appropriate and engaging for 4th grade students
- Educational and teach valuable concepts that align with 4th grade curriculum
- Cover diverse topics to broaden knowledge
- Include both factual knowledge and basic reasoning skills
- Written in clear, simple language children can understand
- Designed to make learning fun and memorable
- Focus on practical knowledge that helps children understand their world
- ABSOLUTELY UNIQUE and different from any previous quiz

Remember: EVERY question must be completely original and never repeated!`,
                    },
                ],
            })
        });

        console.log('✅ Received response from DeepSeek API');
        console.log('📊 Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API Error:', response.status, errorText);
            return res.status(500).json({ 
                error: 'API request failed',
                details: `Status: ${response.status}, ${errorText}`
            });
        }

        const data = await response.json();

        console.log('📊 Full API response structure:', JSON.stringify(data, null, 2));

        if (!data || !data.choices || !data.choices[0]) {
            console.error('❌ Invalid API response structure:', data);
            return res.status(500).json({ 
                error: 'Invalid response from AI service',
                details: 'The AI service returned an unexpected response format'
            });
        }

        console.log('📊 Message object:', JSON.stringify(data.choices[0].message, null, 2));
        rawContent = data.choices[0].message?.content;
        
        console.log('📝 Raw content extracted:', rawContent ? `${rawContent.length} characters` : 'NULL/UNDEFINED');
        console.log('📝 Raw content preview:', rawContent ? rawContent.substring(0, 200) + '...' : 'NO CONTENT');

        if (!rawContent) {
            console.error('❌ No content in API response');
            return res.status(500).json({ 
                error: 'Empty response from AI service',
                details: 'The AI service did not return any content'
            });
        }

        console.log('📝 Raw content length:', rawContent.length);
        
        const questions = parseQuestions(rawContent);
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log(`✅ Successfully generated ${questions.length} questions in ${duration}s for IP: ${clientIP}`);
        
        if (!questions || questions.length === 0) {
            console.error('❌ No questions parsed from response');
            return res.status(500).json({ 
                error: 'Failed to parse questions',
                details: 'Could not extract valid questions from AI response',
                rawContentPreview: rawContent ? rawContent.substring(0, 500) : 'No content available'
            });
        }
        
        const validQuestions = questions.filter(q => 
            q.content && q.choices && q.choices.length >= 5 && q.correctAnswer
        );
        
        if (validQuestions.length === 0) {
            console.error('❌ No valid questions after filtering');
            return res.status(500).json({ 
                error: 'No valid questions generated',
                details: 'All generated questions were incomplete or invalid'
            });
        }
        
        console.log(`📋 Sending ${validQuestions.length} valid questions`);
        res.status(200).json(validQuestions);
        
    } catch (error) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.error(`❌ Error generating questions after ${duration}s for IP: ${clientIP}:`);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        
        if (error.status) {
            console.error('API Error Status:', error.status);
        }
        
        if (error.name === 'TimeoutError' || error.code === 'ECONNABORTED') {
            return res.status(504).json({ 
                error: 'Request timeout - please try again',
                details: 'The AI service took too long to respond'
            });
        }
        
        if (error.status === 401) {
            return res.status(500).json({ 
                error: 'API authentication failed',
                details: 'Please check API key configuration'
            });
        }
        
        res.status(500).json({ 
            error: 'Failed to generate questions', 
            details: error.message || 'Unknown error occurred',
            errorType: error.constructor.name
        });
    }
}

function parseQuestions(content) {
    try {
        console.log('🔧 Starting question parsing...');
        const questions = [];
        const blocks = content.split('---').filter(block => block.trim().length > 0);
        
        console.log(`📊 Found ${blocks.length} blocks to parse`);
        
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            if (!block.includes('**Question')) {
                continue;
            }
            
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
                if (line.startsWith('**Question') && line.includes(':**')) {
                    const contentMatch = line.match(/^\*\*Question\s+\d+:\*\*\s*(.+)$/);
                    if (contentMatch) {
                        question.content = contentMatch[1].trim();
                    }
                    currentSection = 'question';
                }
                else if (/^[a-e]\)\s/.test(line)) {
                    const choice = line.replace(/^[a-e]\)\s*/, '');
                    question.choices.push(choice);
                    currentSection = 'choices';
                }
                else if (line.startsWith('**Correct Answer:**')) {
                    const answerMatch = line.match(/\*\*Correct Answer:\*\*\s*([a-e])/);
                    if (answerMatch) {
                        question.correctAnswer = answerMatch[1].toLowerCase();
                    }
                    currentSection = 'answer';
                }
                else if (line.startsWith('**Explanation:**')) {
                    question.explanation = line.replace(/^\*\*Explanation:\*\*\s*/, '');
                    currentSection = 'explanation';
                }
                else if (line.startsWith('**Fun Fact:**')) {
                    question.funFact = line.replace(/^\*\*Fun Fact:\*\*\s*/, '');
                    currentSection = 'funfact';
                }
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
            
            if (question.content && question.choices.length >= 5 && question.correctAnswer) {
                questions.push(question);
            }
        }
        
        console.log(`🎯 Parsing complete: ${questions.length} valid questions`);
        return questions;
        
    } catch (parseError) {
        console.error('❌ Error in parseQuestions:', parseError);
        return [];
    }
}