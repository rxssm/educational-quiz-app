let currentQuestions = [];
let userAnswers = {};
let quizCompleted = false;
let lastQuizSource = null; // Track if questions came from API or fallback

// Loading tips for kids
let loadingTips = [
    "Get ready to learn something amazing!",
    "Did you know? Learning new things grows your brain! 🧠",
    "Every question is a chance to discover something cool! 🌟",
    "You're about to become smarter in just a few minutes! 💪",
    "These questions were made just for 4th graders like you! 🎒",
    "Learning is like a superpower - you're about to use yours! ⚡",
    "Fun facts are coming your way! 🎯",
    "Get your thinking cap on! 🎩"
];
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
        questionsContainer.innerHTML = `
            <div id="loading" class="loading">
                <div class="loading-content">
                    <div class="spinner-container">
                        <div class="spinner"></div>
                        <div class="loading-books">📚✨📖</div>
                    </div>
                    <h2>🧠 Preparing Your Quiz! 🎓</h2>
                    <p class="loading-message">Our AI teacher is creating brand new questions just for you...</p>
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
        
        const response = await fetch('/api/questions');
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
                    <h2>😅 Oops! Something went wrong</h2>
                    <p>We're having trouble creating your quiz right now. This might be due to:</p>
                    <ul style="text-align: left; max-width: 300px; margin: 1rem auto;">
                        <li>Slow AI service response</li>
                        <li>Temporary network issues</li>
                        <li>High server demand</li>
                    </ul>
                    <p>Don't worry - please try again!</p>
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
    
    htmlContent += '<h2>4th Grade Educational Quiz</h2>';
    
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
    
    // Hide submit button and show refresh button
    const submitButton = document.getElementById('submit-quiz');
    submitButton.style.display = 'none';
    
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.style.display = 'block';
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
    
    document.body.appendChild(refreshButton);
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    generateQuestions();
    addRefreshButton();
});