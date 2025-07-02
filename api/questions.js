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

function generatePrompt(config) {
    const gradeText = config.gradeLevel === 'college' ? 'college level' : `${config.gradeLevel}th grade`;
    const ageText = config.gradeLevel === 'college' ? 'college students' : 
                   config.gradeLevel <= 3 ? `${parseInt(config.gradeLevel) + 5} years old` :
                   `${parseInt(config.gradeLevel) + 5} years old`;
    
    // Subject mapping for prompts
    const subjectMap = {
        'mathematics': 'Math',
        'science': 'Science',
        'history': 'History',
        'geography': 'Geography',
        'literature': 'Literature/Reading',
        'civics': 'Social Studies/Civics',
        'health': 'Health/Safety',
        'art': 'Arts',
        'music': 'Music',
        'physical-education': 'Physical Education',
        'computer-science': 'Computer Science',
        'economics': 'Economics',
        'psychology': 'Psychology',
        'chemistry': 'Chemistry',
        'physics': 'Physics'
    };
    
    let subjectInstruction;
    if (config.subjects.length > 0) {
        const mappedSubjects = config.subjects.map(s => subjectMap[s] || s).join(', ');
        subjectInstruction = `Focus specifically on these subjects: ${mappedSubjects}. Include questions from at least ${Math.min(config.subjects.length, Math.floor(config.questionCount / 2))} of these subjects.`;
    } else {
        subjectInstruction = 'Include questions from at least 6 of these subjects: **science, math, social studies, geography, history, literature/reading, health/safety, arts, nature/environment, and basic life skills**.';
    }
    
    // Difficulty adjustment based on grade level
    let difficultyInstruction;
    if (config.gradeLevel === 'college') {
        difficultyInstruction = 'DIFFICULTY: College level - include advanced concepts, critical thinking, analysis, and application of knowledge. Questions should challenge students with complex scenarios and require deeper understanding.';
    } else if (parseInt(config.gradeLevel) >= 9) {
        difficultyInstruction = 'DIFFICULTY: High school level - include analytical thinking, problem-solving, and real-world applications. Mix factual knowledge with reasoning and critical thinking skills.';
    } else if (parseInt(config.gradeLevel) >= 6) {
        difficultyInstruction = 'DIFFICULTY: Middle school level - balance factual recall with problem-solving and application. Include scenarios that require students to think beyond memorization.';
    } else {
        difficultyInstruction = 'DIFFICULTY: Elementary level - focus on foundational concepts with clear, age-appropriate language. Mix simple factual questions with basic reasoning skills.';
    }
    
    return `Generate exactly ${config.questionCount} educational questions for ${gradeText} students (${ageText}). ${subjectInstruction}

CRITICAL: This request has unique ID: ${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)} and timestamp: ${new Date().toISOString()}. Create COMPLETELY NEW and UNIQUE questions that have NEVER been generated before.

VARIATION REQUIREMENTS:
- Use different question formats: multiple choice, scenario-based, "what if" questions, comparison questions
- Vary difficulty within ${gradeText} level (some easier, some more challenging)
- Mix factual recall with critical thinking and application questions
- Use different contexts and real-world examples each time
- Include questions that require students to analyze, compare, predict, or solve problems

${difficultyInstruction}

Format each question exactly like this, with --- separators:

---

**Question 1:** (Subject: Topic) [Question text here]
a) [Answer choice A]
b) [Answer choice B]
c) [Answer choice C]
d) [Answer choice D]
e) [Answer choice E]
**Correct Answer:** [letter]
**Explanation:** [Brief, age-appropriate explanation of why this is correct]
**Fun Fact:** [An interesting related fact to spark curiosity]

---

Continue this exact format for all ${config.questionCount} questions. Make sure questions are:
- Age-appropriate and engaging for ${gradeText} students
- Educational and teach valuable concepts that align with ${gradeText} curriculum
- Cover diverse topics to broaden knowledge
- Include both factual knowledge and reasoning skills appropriate for the grade level
- Written in clear language students can understand
- Designed to make learning fun and memorable
- Focus on practical knowledge that helps students understand their world
- ABSOLUTELY UNIQUE and different from any previous quiz

Remember: EVERY question must be completely original and never repeated!`;
}

export default async function handler(req, res) {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Allow both GET and POST requests
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const startTime = Date.now();
    const clientIP = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
    let rawContent = null;
    let usedFallback = false;
    
    // Extract configuration parameters
    let config = {
        gradeLevel: '4',
        questionCount: 10,
        subjects: []
    };
    
    if (req.method === 'POST' && req.body) {
        config.gradeLevel = req.body.gradeLevel || '4';
        config.questionCount = Math.min(Math.max(parseInt(req.body.questionCount) || 10, 5), 20);
        config.subjects = Array.isArray(req.body.subjects) ? req.body.subjects.slice(0, 5) : [];
    }
    
    console.log('📝 Quiz configuration:', config);
    
    try {
        const gradeText = config.gradeLevel === 'college' ? 'College Level' : `Grade ${config.gradeLevel}`;
        console.log(`🎓 Generating ${gradeText} quiz (${config.questionCount} questions) for IP: ${clientIP}`);
        if (config.subjects.length > 0) {
            console.log(`📚 Subjects: ${config.subjects.join(', ')}`);
        }
        
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
                            content: generatePrompt(config)
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
            
            if (validQuestions.length < Math.min(5, config.questionCount)) {
                throw new Error(`Only got ${validQuestions.length} valid questions, need at least ${Math.min(5, config.questionCount)}`);
            }
            
            questions = validQuestions.slice(0, config.questionCount);
            
        } catch (apiError) {
            console.error('❌ API Error occurred:', apiError.message);
            console.log('🔄 Falling back to pre-generated questions...');
            
            // Use fallback questions with some randomization
            const shuffled = [...FALLBACK_QUESTIONS].sort(() => Math.random() - 0.5);
            questions = shuffled.slice(0, config.questionCount);
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
                duration_seconds: duration,
                config: config
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