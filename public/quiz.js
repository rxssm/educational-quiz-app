// Quiz state variables
let currentQuestions = [];
let userAnswers = {};
let quizCompleted = false;
let lastQuizSource = null; // Track if questions came from API or fallback

// Quiz configuration variables
let quizConfig = {
    gradeLevel: '4',
    questionCount: 10,
    timer: 'off',
    subjects: []
};

// Timer variables
let timerInterval = null;
let timeRemaining = 0; // in seconds
let timerStarted = false;

// Loading tips for kids (dynamic based on grade level)
function getLoadingTips(gradeLevel) {
    const baseGrade = parseInt(gradeLevel) || 4;
    if (gradeLevel === 'college') {
        return [
            "Preparing advanced questions for your level!",
            "Get ready to tackle some challenging concepts! 🎓",
            "Time to put your knowledge to the test! 💪",
            "These questions will challenge your understanding! 🧠",
            "Ready for some college-level thinking? 📚",
            "Let's see what you've learned! ⚡",
            "Advanced knowledge coming your way! 🎯"
        ];
    } else if (baseGrade <= 3) {
        return [
            "Get ready for some fun learning! 🌟",
            "Time to show what you know! 😊",
            "Learning is like playing - let's have fun! 🎈",
            "You're going to do great! 💪",
            "Every question is a new adventure! 🚀",
            "Get your thinking cap on! 🎩",
            "Fun facts are coming your way! 🎯"
        ];
    } else if (baseGrade <= 6) {
        return [
            "Get ready to learn something amazing!",
            "Did you know? Learning new things grows your brain! 🧠",
            "Every question is a chance to discover something cool! 🌟",
            "You're about to become smarter in just a few minutes! 💪",
            "Learning is like a superpower - you're about to use yours! ⚡",
            "Fun facts are coming your way! 🎯",
            "Get your thinking cap on! 🎩"
        ];
    } else {
        return [
            "Ready to tackle some challenging questions! 🎯",
            "Time to demonstrate your knowledge! 🧠",
            "Get ready for some thought-provoking questions! 💭",
            "Let's see how much you've learned! 📚",
            "Challenge yourself with these questions! 💪",
            "Knowledge is power - let's use it! ⚡",
            "Advanced thinking mode activated! 🚀"
        ];
    }
}

let loadingTips = getLoadingTips('4');
let tipIndex = 0;

function cycleTips() {
    const tipElement = document.getElementById('loading-tip');
    if (tipElement) {
        tipElement.style.opacity = '0';
        setTimeout(() => {
            tipIndex = (tipIndex + 1) % loadingTips.length;
            tipElement.textContent = loadingTips[tipIndex];
            tipElement.style.opacity = '1';
        }, 500);
    }
}

function startTipCycling() {
    cycleTips(); // Start immediately
    return setInterval(cycleTips, 3000); // Change every 3 seconds
}

async function generateQuestions() {
    try {
        // Reset quiz state
        currentQuestions = [];
        userAnswers = {};
        quizCompleted = false;
        lastQuizSource = null;
        
        // Show enhanced loading screen
        const questionsContainer = document.getElementById('questions');
        const gradeText = quizConfig.gradeLevel === 'college' ? 'College Level' : `Grade ${quizConfig.gradeLevel}`;
        const subjectText = quizConfig.subjects.length > 1 ? `${quizConfig.subjects.length} subjects` : quizConfig.subjects[0] || 'mixed subjects';
        questionsContainer.innerHTML = `
            <div id="loading" class="loading">
                <div class="loading-content">
                    <div class="spinner-container">
                        <div class="spinner"></div>
                        <div class="loading-books">📚✨📖</div>
                    </div>
                    <h2>🧠 Preparing Your ${gradeText} Quiz! 🎓</h2>
                    <p class="loading-message">Creating ${quizConfig.questionCount} questions about ${subjectText}...</p>
                    <div class="loading-dots">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                    </div>
                    <div class="loading-tips">
                        <p>💡 <span id="loading-tip">Get ready to learn something amazing!</span></p>
                    </div>
                </div>
            </div>
        `;
        
        // Start cycling tips
        const tipInterval = startTipCycling();
        
        // Hide refresh button
        const refreshButton = document.getElementById('refresh-button');
        if (refreshButton) {
            refreshButton.style.display = 'none';
        }
        
        // Prepare API request with configuration
        const requestBody = {
            gradeLevel: quizConfig.gradeLevel,
            questionCount: quizConfig.questionCount,
            subjects: quizConfig.subjects
        };
        
        console.log('Sending request with config:', requestBody);
        
        const response = await Promise.race([
            fetch('/api/questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), 50000) // 50 second frontend timeout
            )
        ]);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Server error:', errorData);
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received response:', data);
        
        // Handle both old format (array) and new format (object with questions/metadata)
        let questions;
        let metadata = null;
        
        if (Array.isArray(data)) {
            // Old format - direct array of questions
            questions = data;
            console.log('Using legacy response format');
        } else if (data && data.questions && Array.isArray(data.questions)) {
            // New format - object with questions and metadata
            questions = data.questions;
            metadata = data.metadata;
            lastQuizSource = metadata?.source || 'unknown';
            console.log('Using new response format, source:', lastQuizSource);
        } else {
            console.error('Invalid response format:', data);
            throw new Error('Invalid response format from server');
        }
        
        if (!questions || questions.length === 0) {
            console.error('No questions in response');
            throw new Error('No questions received from server');
        }
        
        currentQuestions = questions;
        
        // Stop cycling tips
        clearInterval(tipInterval);
        
        displayQuestions(currentQuestions, metadata);
        
    } catch (error) {
        console.error('Error:', error.message);
        const questionsContainer = document.getElementById('questions');
        questionsContainer.innerHTML = `
            <div class="loading">
                <div class="loading-content">
                    <h2>😅 Taking a bit longer than expected!</h2>
                    <p>The AI service is currently busy, but don't worry - we have backup questions ready!</p>
                    <p>This might be due to:</p>
                    <ul style="text-align: left; max-width: 300px; margin: 1rem auto;">
                        <li>High demand on AI services</li>
                        <li>Complex question generation</li>
                        <li>Network congestion</li>
                    </ul>
                    <p>Try again for AI-generated questions, or we'll use our curated backup questions!</p>
                    <button onclick="generateQuestions()" style="padding: 10px 20px; font-size: 16px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 1rem;">
                        🔄 Try Again
                    </button>
                    <p style="font-size: 0.9rem; margin-top: 1rem; opacity: 0.8;">
                        Error: ${error.message}
                    </p>
                </div>
            </div>
        `;
    }
}

function displayQuestions(questions, metadata) {
    const questionsContainer = document.getElementById('questions');
    
    if (!questions || questions.length === 0) {
        questionsContainer.innerHTML = '<h2>No questions available</h2>';
        return;
    }
    
    let htmlContent = '';
    
    // Add source indicator if available
    if (metadata) {
        const sourceInfo = getSourceInfo(metadata.source);
        htmlContent += `
            <div class="quiz-info">
                <div class="source-indicator ${metadata.source}">
                    ${sourceInfo.icon} ${sourceInfo.text}
                </div>
            </div>
        `;
    }
    
    const gradeText = quizConfig.gradeLevel === 'college' ? 'College Level' : `Grade ${quizConfig.gradeLevel}`;
    htmlContent += `<h2>${gradeText} Educational Quiz</h2>`;
    
    questions.forEach((question, questionIndex) => {
        if (question.content && question.choices && question.choices.length > 0) {
            htmlContent += `
                <div class="question-block" data-question="${questionIndex}">
                    <div class="question-number">${questionIndex + 1}.</div>
                    <div class="question-text">${question.content}</div>
                    <div class="choices-container">
            `;
            
            // Display choices (a-e)
            const letters = ['a', 'b', 'c', 'd', 'e'];
            for (let i = 0; i < Math.min(5, question.choices.length); i++) {
                htmlContent += `
                    <div class="mc-option" 
                         data-question="${questionIndex}" 
                         data-choice="${letters[i]}"
                         onclick="selectAnswer(${questionIndex}, '${letters[i]}')">
                        ${letters[i]}) ${question.choices[i]}
                    </div>
                `;
            }
            
            htmlContent += `
                    </div>
                </div>
            `;
        }
    });
    
    // Add submit button
    htmlContent += `
        <div class="submit-container">
            <button id="submit-quiz" onclick="submitQuiz()" class="submit-button">
                Submit Quiz
            </button>
        </div>
    `;
    
    questionsContainer.innerHTML = htmlContent;
}

function getSourceInfo(source) {
    switch (source) {
        case 'api':
            return {
                icon: '🤖',
                text: 'Fresh AI-generated questions'
            };
        case 'fallback':
            return {
                icon: '📚',
                text: 'Pre-selected educational questions'
            };
        default:
            return {
                icon: '❓',
                text: 'Educational questions'
            };
    }
}

function selectAnswer(questionIndex, choice) {
    if (quizCompleted) return;
    
    // Remove previous selection for this question
    const questionBlock = document.querySelector(`[data-question="${questionIndex}"]`);
    const previouslySelected = questionBlock.querySelector('.mc-option.selected');
    if (previouslySelected) {
        previouslySelected.classList.remove('selected');
    }
    
    // Add selection to clicked option
    const selectedOption = document.querySelector(`[data-question="${questionIndex}"][data-choice="${choice}"]`);
    selectedOption.classList.add('selected');
    
    // Store user's answer
    userAnswers[questionIndex] = choice;
    
    // Update submit button state
    updateSubmitButton();
}

function updateSubmitButton() {
    const submitButton = document.getElementById('submit-quiz');
    const answeredQuestions = Object.keys(userAnswers).length;
    const totalQuestions = currentQuestions.length;
    
    if (answeredQuestions === totalQuestions) {
        submitButton.textContent = 'Submit Quiz';
        submitButton.disabled = false;
        submitButton.classList.remove('disabled');
    } else {
        submitButton.textContent = `Submit Quiz (${answeredQuestions}/${totalQuestions} answered)`;
        submitButton.disabled = false;
        submitButton.classList.add('partial');
    }
}

function submitQuiz() {
    if (quizCompleted) return;
    
    const answeredQuestions = Object.keys(userAnswers).length;
    const totalQuestions = currentQuestions.length;
    
    if (answeredQuestions < totalQuestions) {
        if (!confirm(`You have only answered ${answeredQuestions} out of ${totalQuestions} questions. Submit anyway?`)) {
            return;
        }
    }
    
    quizCompleted = true;
    gradeQuiz();
}

function gradeQuiz() {
    let correctCount = 0;
    let totalAnswered = 0;
    
    // Grade each question
    currentQuestions.forEach((question, questionIndex) => {
        const userAnswer = userAnswers[questionIndex];
        const correctAnswer = question.correctAnswer;
        const questionBlock = document.querySelector(`[data-question="${questionIndex}"]`);
        
        if (userAnswer) {
            totalAnswered++;
            const userOption = questionBlock.querySelector(`[data-choice="${userAnswer}"]`);
            
            // Normalize both answers to lowercase for comparison
            const normalizedUserAnswer = userAnswer.toLowerCase();
            const normalizedCorrectAnswer = correctAnswer ? correctAnswer.toLowerCase() : null;
            
            if (normalizedUserAnswer === normalizedCorrectAnswer) {
                correctCount++;
                userOption.classList.add('correct');
            } else {
                userOption.classList.add('incorrect');
            }
        }
        
        // Highlight correct answer
        if (correctAnswer) {
            const correctOption = questionBlock.querySelector(`[data-choice="${correctAnswer.toLowerCase()}"]`);
            if (correctOption) {
                correctOption.classList.add('correct-answer');
            }
        }
        
        // Add explanation and fun fact
        if (question.explanation) {
            const explanationDiv = document.createElement('div');
            explanationDiv.className = 'explanation';
            explanationDiv.innerHTML = `<strong>Explanation:</strong> ${question.explanation}`;
            questionBlock.appendChild(explanationDiv);
        }
        
        if (question.funFact) {
            const funFactDiv = document.createElement('div');
            funFactDiv.className = 'fun-fact';
            funFactDiv.innerHTML = `<strong>🌟 Fun Fact:</strong> ${question.funFact}`;
            questionBlock.appendChild(funFactDiv);
        }
        
        // Disable all options for this question
        const allOptions = questionBlock.querySelectorAll('.mc-option');
        allOptions.forEach(option => {
            option.style.pointerEvents = 'none';
        });
    });
    
    // Show results
    showResults(correctCount, totalAnswered, currentQuestions.length);
    
    // Hide submit button and show refresh/config buttons
    const submitButton = document.getElementById('submit-quiz');
    submitButton.style.display = 'none';
    
    // Stop timer
    stopTimer();
    
    const refreshButton = document.getElementById('refresh-button');
    const configButton = document.getElementById('config-button');
    if (refreshButton) {
        refreshButton.style.display = 'inline-block';
    }
    if (configButton) {
        configButton.style.display = 'inline-block';
    }
}

function showResults(correct, answered, total) {
    const percentage = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    const unanswered = total - answered;
    
    let resultMessage = `
        <div class="results-container">
            <h3>Quiz Results</h3>
            <div class="score-summary">
                <div class="score-item correct-score">Correct: ${correct}</div>
                <div class="score-item incorrect-score">Incorrect: ${answered - correct}</div>
                ${unanswered > 0 ? `<div class="score-item unanswered-score">Unanswered: ${unanswered}</div>` : ''}
            </div>
            <div class="percentage-score">Score: ${percentage}%</div>
            ${lastQuizSource === 'fallback' ? `
                <div class="quiz-note">
                    <small>📚 This quiz used pre-selected questions due to high AI demand. Try again for fresh questions!</small>
                </div>
            ` : ''}
        </div>
    `;
    
    // Insert results at the top of the questions container
    const questionsContainer = document.getElementById('questions');
    questionsContainer.insertAdjacentHTML('afterbegin', resultMessage);
    
    // Scroll to top to show results
    questionsContainer.scrollIntoView({ behavior: 'smooth' });
}

function addRefreshButton() {
    const refreshButton = document.createElement('button');
    refreshButton.id = 'refresh-button';
    refreshButton.textContent = 'Generate New Questions';
    refreshButton.onclick = generateQuestions;
    refreshButton.className = 'refresh-button';
    refreshButton.style.display = 'none';
    
    // Add return to config button
    const configButton = document.createElement('button');
    configButton.id = 'config-button';
    configButton.textContent = 'New Quiz Configuration';
    configButton.onclick = returnToConfig;
    configButton.className = 'refresh-button';
    configButton.style.display = 'none';
    configButton.style.marginLeft = '10px';
    
    document.body.appendChild(refreshButton);
    document.body.appendChild(configButton);
}

// Configuration form handling
function setupConfigurationForm() {
    const form = document.getElementById('quiz-config-form');
    const subjectCheckboxes = document.querySelectorAll('input[name="subjects"]');
    const subjectError = document.getElementById('subject-error');
    
    // Subject selection validation
    subjectCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const checkedSubjects = document.querySelectorAll('input[name="subjects"]:checked');
            const checkedCount = checkedSubjects.length;
            
            if (checkedCount > 5) {
                this.checked = false;
                subjectError.textContent = 'You can select a maximum of 5 subjects.';
                subjectError.style.display = 'block';
                return;
            }
            
            if (checkedCount === 0) {
                subjectError.textContent = 'Please select at least 1 subject.';
                subjectError.style.display = 'block';
            } else {
                subjectError.style.display = 'none';
            }
        });
    });
    
    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validate subjects
        const checkedSubjects = document.querySelectorAll('input[name="subjects"]:checked');
        if (checkedSubjects.length === 0) {
            subjectError.textContent = 'Please select at least 1 subject.';
            subjectError.style.display = 'block';
            return;
        }
        if (checkedSubjects.length > 5) {
            subjectError.textContent = 'Please select no more than 5 subjects.';
            subjectError.style.display = 'block';
            return;
        }
        
        // Collect configuration
        const formData = new FormData(form);
        quizConfig = {
            gradeLevel: formData.get('grade-level') || document.getElementById('grade-level').value,
            questionCount: parseInt(formData.get('question-count')) || 10,
            timer: formData.get('timer') || 'off',
            subjects: Array.from(checkedSubjects).map(cb => cb.value)
        };
        
        console.log('Quiz configuration:', quizConfig);
        
        // Update loading tips based on grade level
        loadingTips = getLoadingTips(quizConfig.gradeLevel);
        
        // Hide configuration and start quiz
        document.getElementById('config-container').style.display = 'none';
        document.getElementById('questions').style.display = 'block';
        
        // Start timer if enabled
        if (quizConfig.timer !== 'off') {
            setupTimer(parseInt(quizConfig.timer));
        }
        
        // Generate questions with configuration
        generateQuestions();
    });
}

// Timer functionality
function setupTimer(minutes) {
    timeRemaining = minutes * 60; // Convert to seconds
    const timerContainer = document.getElementById('timer-container');
    const timerDisplay = document.getElementById('timer-display');
    
    timerContainer.style.display = 'block';
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        // Warning states
        if (timeRemaining <= 60) { // Last minute
            timerContainer.classList.add('critical');
            timerContainer.classList.remove('warning');
        } else if (timeRemaining <= 300) { // Last 5 minutes
            timerContainer.classList.add('warning');
        }
        
        // Time's up!
        if (timeRemaining <= 0) {
            timeUp();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timerDisplay = document.getElementById('timer-display');
    timerDisplay.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function timeUp() {
    clearInterval(timerInterval);
    if (!quizCompleted) {
        alert('⏰ Time\'s up! Your quiz will be submitted automatically.');
        submitQuiz();
    }
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    const timerContainer = document.getElementById('timer-container');
    timerContainer.style.display = 'none';
}

// Return to configuration
function returnToConfig() {
    // Reset quiz state
    currentQuestions = [];
    userAnswers = {};
    quizCompleted = false;
    lastQuizSource = null;
    
    // Stop timer
    stopTimer();
    
    // Show configuration, hide questions
    document.getElementById('config-container').style.display = 'block';
    document.getElementById('questions').style.display = 'none';
    
    // Clear questions container
    document.getElementById('questions').innerHTML = '';
    
    // Hide refresh button
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.style.display = 'none';
    }
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    setupConfigurationForm();
    addRefreshButton();
});