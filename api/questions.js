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