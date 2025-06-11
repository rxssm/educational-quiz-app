// Using built-in fetch instead of axios (Node 18+ has native fetch)

// Simple in-memory rate limiting (resets on cold starts)
const rateLimitMap = new Map();

// Fallback questions for when API is slow or fails
const FALLBACK_QUESTIONS = [
    {
        content: "What tool would scientists use to look at very tiny things like bacteria?",
        choices: ["Telescope", "Microscope", "Magnifying glass", "Binoculars", "Camera"],
        correctAnswer: "b",
        explanation: "A microscope magnifies tiny objects so we can see details that are invisible to the naked eye.",
        funFact: "The most powerful microscopes can magnify objects up to 2 million times!"
    },
    {
        content: "If you have 24 stickers and want to share them equally among 6 friends, how many stickers will each friend get?",
        choices: ["3 stickers", "4 stickers", "5 stickers", "6 stickers", "8 stickers"],
        correctAnswer: "b",
        explanation: "24 divided by 6 equals 4, so each friend gets 4 stickers.",
        funFact: "Division is just repeated subtraction - you could subtract 6 from 24 four times to get the same answer!"
    },
    {
        content: "Which of these is the largest ocean on Earth?",
        choices: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean", "Southern Ocean"],
        correctAnswer: "d",
        explanation: "The Pacific Ocean covers about one-third of Earth's surface and is larger than all the land on Earth combined!",
        funFact: "The Pacific Ocean is so big that all the continents could fit inside it with room to spare!"
    },
    {
        content: "Who was the first person to walk on the moon?",
        choices: ["Buzz Aldrin", "Neil Armstrong", "John Glenn", "Alan Shepard", "Michael Collins"],
        correctAnswer: "b",
        explanation: "Neil Armstrong was the commander of Apollo 11 and the first human to step foot on the moon on July 20, 1969.",
        funFact: "Neil Armstrong's famous words were: 'That's one small step for man, one giant leap for mankind!'"
    },
    {
        content: "What do we call a group of people who make laws for a country or state?",
        choices: ["Army", "Legislature", "Police force", "Fire department", "Hospital staff"],
        correctAnswer: "b",
        explanation: "A legislature is a group of elected people who create, discuss, and vote on laws.",
        funFact: "The word 'legislature' comes from Latin words meaning 'to propose laws'!"
    },
    {
        content: "In the story 'The Three Little Pigs,' what material made the strongest house?",
        choices: ["Straw", "Sticks", "Bricks", "Paper", "Leaves"],
        correctAnswer: "c",
        explanation: "The brick house was strong enough to protect the pig from the big bad wolf who couldn't blow it down.",
        funFact: "This story teaches us about the importance of hard work and planning ahead!"
    },
    {
        content: "Which food group do apples, oranges, and bananas belong to?",
        choices: ["Vegetables", "Grains", "Proteins", "Fruits", "Dairy"],
        correctAnswer: "d",
        explanation: "Apples, oranges, and bananas are all fruits that grow on trees and plants.",
        funFact: "Eating different colored fruits gives your body different vitamins and nutrients!"
    },
    {
        content: "What colors do you mix together to make green paint?",
        choices: ["Red and white", "Blue and yellow", "Red and blue", "Yellow and red", "Black and white"],
        correctAnswer: "b",
        explanation: "Blue and yellow are primary colors that combine to create the secondary color green.",
        funFact: "Artists call red, blue, and yellow the 'primary colors' because you can't make them by mixing other colors!"
    },
    {
        content: "What should you do first if you see a fire in your home?",
        choices: ["Hide under a bed", "Get out safely and call 911", "Try to put it out yourself", "Open all the windows", "Take pictures"],
        correctAnswer: "b",
        explanation: "Safety first! Get out of the house quickly and call 911 for help from trained firefighters.",
        funFact: "Fire trucks are red because red is easy to see and means 'emergency' or 'danger'!"
    },
    {
        content: "How many days are in a leap year?",
        choices: ["365 days", "366 days", "364 days", "367 days", "360 days"],
        correctAnswer: "b",
        explanation: "A leap year has 366 days instead of the usual 365 days, with the extra day added to February.",
        funFact: "Leap years happen every 4 years to keep our calendar in sync with Earth's orbit around the sun!"
    }
];

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
    let rawContent = null;
    let usedFallback = false;
    
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
        
        let questions = [];
        
        try {
            // Add timeout to prevent Vercel timeout issues
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout
            
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                },
                signal: controller.signal,
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

            // Clear the timeout since we got a response
            clearTimeout(timeoutId);

            console.log('✅ Received response from DeepSeek API');
            console.log('📊 Response status:', response.status);

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();

            if (!data || !data.choices || !data.choices[0]) {
                throw new Error('Invalid API response structure');
            }

            rawContent = data.choices[0].message?.content;
            
            if (!rawContent) {
                throw new Error('No content in API response');
            }

            console.log('📝 Raw content length:', rawContent.length);
            
            questions = parseQuestions(rawContent);
            
            // Validate we got enough valid questions
            const validQuestions = questions.filter(q => 
                q.content && q.choices && q.choices.length >= 5 && q.correctAnswer
            );
            
            if (validQuestions.length < 5) {
                throw new Error(`Only got ${validQuestions.length} valid questions, need at least 5`);
            }
            
            questions = validQuestions;
            
        } catch (apiError) {
            console.error('❌ API Error occurred:', apiError.message);
            console.log('🔄 Falling back to pre-generated questions...');
            
            // Use fallback questions with some randomization
            questions = [...FALLBACK_QUESTIONS].sort(() => Math.random() - 0.5);
            usedFallback = true;
        }
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log(`✅ Successfully generated ${questions.length} questions in ${duration}s for IP: ${clientIP}`);
        if (usedFallback) {
            console.log('📋 Used fallback questions due to API issues');
        }
        
        if (!questions || questions.length === 0) {
            console.error('❌ No questions available');
            return res.status(500).json({ 
                error: 'Failed to generate questions',
                details: 'Could not get valid questions from either API or fallback'
            });
        }
        
        // Add metadata to response
        const response_data = {
            questions: questions,
            metadata: {
                source: usedFallback ? 'fallback' : 'api',
                generated_at: new Date().toISOString(),
                duration_seconds: duration
            }
        };
        
        console.log(`📋 Sending ${questions.length} questions (source: ${usedFallback ? 'fallback' : 'api'})`);
        res.status(200).json(response_data);
        
    } catch (error) {
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.error(`❌ Error generating questions after ${duration}s for IP: ${clientIP}:`);
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        
        if (error.status) {
            console.error('API Error Status:', error.status);
        }
        
        if (error.name === 'TimeoutError' || error.code === 'ECONNABORTED' || error.name === 'AbortError') {
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
        console.log('🔧 Starting improved question parsing...');
        console.log('📄 Content to parse:', content.substring(0, 1000) + '...');
        
        const questions = [];
        
        // Split by --- separators and filter out empty blocks
        let blocks = content.split('---').filter(block => block.trim().length > 0);
        
        console.log('📊 Found blocks:', blocks.length);
        
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i].trim();
            if (!block.includes('Question') || block.length < 50) {
                console.log(`⏭️  Skipping block ${i} (too short or no Question marker)`);
                continue;
            }
            
            console.log(`🔍 Parsing block ${i + 1}:`, block.substring(0, 200) + '...');
            
            const lines = block.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            let question = {
                content: '',
                choices: [],
                correctAnswer: null,
                explanation: null,
                funFact: null
            };
            
            let currentSection = null;
            let foundQuestionLine = false;
            let questionLines = []; // Collect all question text lines
            
            for (let j = 0; j < lines.length; j++) {
                const line = lines[j];
                
                // Question detection - improved logic
                if (line.includes('**Question') && line.includes(':**') && !foundQuestionLine) {
                    foundQuestionLine = true;
                    currentSection = 'question';
                    
                    // Extract question text from this line if it exists after the subject
                    if (line.includes('(Subject:')) {
                        // Format: **Question 1:** (Subject: Math) What is...
                        const parts = line.split(')');
                        if (parts.length > 1) {
                            const afterSubject = parts.slice(1).join(')').trim();
                            if (afterSubject) {
                                questionLines.push(afterSubject);
                            }
                        }
                    } else {
                        // Try to extract question text directly
                        const questionMatch = line.match(/\*\*Question\s+\d+:\*\*\s*(.+)$/);
                        if (questionMatch && questionMatch[1].trim()) {
                            questionLines.push(questionMatch[1].trim());
                        }
                    }
                    console.log(`  ✅ Found question header, current text: "${questionLines.join(' ')}"`)
                }
                
                // Collect question text lines (between question header and first choice)
                else if (currentSection === 'question' && !line.match(/^[a-e]\)\s+/) && 
                         !line.includes('**Correct Answer') && !line.includes('**Explanation') && 
                         !line.includes('**Fun Fact') && foundQuestionLine) {
                    questionLines.push(line);
                    console.log(`  📝 Added question line: "${line}"`);
                }
                
                // Multiple choice detection
                else if (/^[a-e]\)\s+/.test(line) && foundQuestionLine) {
                    // Finalize question text when we hit first choice
                    if (currentSection === 'question' && questionLines.length > 0) {
                        question.content = questionLines.join(' ').trim();
                        console.log(`  ✅ Finalized question: "${question.content.substring(0, 50)}..."`);
                    }
                    
                    const choice = line.replace(/^[a-e]\)\s+/, '').trim();
                    if (choice && !choice.includes('**Question')) {
                        question.choices.push(choice);
                        console.log(`  ✅ Added choice ${question.choices.length}: ${choice.substring(0, 30)}...`);
                    }
                    currentSection = 'choices';
                }
                
                // Correct answer detection
                else if (line.toLowerCase().includes('correct answer') && line.includes(':')) {
                    const answerPatterns = [
                        /(?:correct\s+)?answer:?\s*\*?\*?\s*([a-e])/i,
                        /\*\*(?:correct\s+)?answer:?\*\*\s*([a-e])/i
                    ];
                    
                    for (const pattern of answerPatterns) {
                        const match = line.match(pattern);
                        if (match) {
                            question.correctAnswer = match[1].toLowerCase();
                            console.log(`  ✅ Correct answer: ${question.correctAnswer}`);
                            break;
                        }
                    }
                    currentSection = 'answer';
                }
                
                // Explanation detection
                else if (line.toLowerCase().includes('explanation') && line.includes(':')) {
                    question.explanation = line.replace(/.*explanation:?\*?\*?\s*/i, '').trim();
                    if (question.explanation) {
                        console.log(`  ✅ Found explanation: ${question.explanation.substring(0, 30)}...`);
                    }
                    currentSection = 'explanation';
                }
                
                // Fun fact detection
                else if (line.toLowerCase().includes('fun fact') && line.includes(':')) {
                    question.funFact = line.replace(/.*fun\s+fact:?\*?\*?\s*/i, '').trim();
                    if (question.funFact) {
                        console.log(`  ✅ Found fun fact: ${question.funFact.substring(0, 30)}...`);
                    }
                    currentSection = 'funfact';
                }
                
                // Continue previous section if it's a continuation line
                else if (line.length > 0 && currentSection && !line.includes('**') && 
                         !line.includes('Question') && !line.match(/^[a-e]\)\s+/)) {
                    if (currentSection === 'explanation' && question.explanation) {
                        question.explanation += ' ' + line;
                    } else if (currentSection === 'funfact' && question.funFact) {
                        question.funFact += ' ' + line;
                    }
                }
            }
            
            // If we collected question lines but didn't finalize yet, do it now
            if (questionLines.length > 0 && !question.content) {
                question.content = questionLines.join(' ').trim();
                console.log(`  ✅ Final question text: "${question.content.substring(0, 50)}..."`);
            }
            
            // Validate question
            const isValid = question.content && 
                           question.choices.length >= 4 && 
                           question.correctAnswer &&
                           ['a', 'b', 'c', 'd', 'e'].includes(question.correctAnswer);
            
            if (isValid) {
                // Ensure we have exactly 5 choices for consistency
                while (question.choices.length < 5) {
                    question.choices.push('Not applicable');
                }
                
                questions.push(question);
                console.log(`  ✅ Added complete question ${questions.length}:`, {
                    content: question.content.substring(0, 50) + '...',
                    choicesCount: question.choices.length,
                    correctAnswer: question.correctAnswer
                });
            } else {
                console.log(`  ❌ Skipped incomplete question:`, {
                    hasContent: !!question.content,
                    contentLength: question.content ? question.content.length : 0,
                    choicesCount: question.choices.length,
                    hasAnswer: !!question.correctAnswer,
                    questionLines: questionLines.length,
                    content: question.content?.substring(0, 100) || 'NO CONTENT',
                    choices: question.choices.slice(0, 3)
                });
            }
        }
        
        console.log(`🎯 Parsing complete: ${questions.length} valid questions out of ${blocks.length} blocks`);
        
        return questions;
        
    } catch (parseError) {
        console.error('❌ Error in parseQuestions:', parseError);
        console.error('❌ Parse error stack:', parseError.stack);
        return [];
    }
}