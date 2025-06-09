let currentQuestions = [];
let userAnswers = {};
let quizCompleted = false;

async function generateQuestions() {
    try {
        // Reset quiz state
        currentQuestions = [];
        userAnswers = {};
        quizCompleted = false;
        
        // Show loading message
        const questionsContainer = document.getElementById('questions');
        questionsContainer.innerHTML = '<h2>Loading questions...</h2>';
        
        // Hide refresh button
        const refreshButton = document.getElementById('refresh-button');
        if (refreshButton) {
            refreshButton.style.display = 'none';
        }
        
        const response = await fetch('/api/questions');
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            throw new Error(errorData.error || 'Failed to fetch questions');
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            console.error('Data is not an array:', data);
            throw new Error('Invalid data format received from server');
        }
        
        if (data.length === 0) {
            console.error('Empty array received');
            throw new Error('No questions received from server');
        }
        
        currentQuestions = data;
        displayQuestions(currentQuestions);
        
    } catch (error) {
        console.error('Error:', error.message);
        const questionsContainer = document.getElementById('questions');
        questionsContainer.innerHTML = `
            <h2>Error Loading Questions</h2>
            <p style="color: red;">Failed to load questions: ${error.message}</p>
            <button onclick="generateQuestions()" style="padding: 10px 20px; margin-top: 10px;">Try Again</button>
        `;
    }
}

function displayQuestions(questions) {
    const questionsContainer = document.getElementById('questions');
    
    if (!questions || questions.length === 0) {
        questionsContainer.innerHTML = '<h2>No questions available</h2>';
        return;
    }
    
    let htmlContent = '<h2>4th Grade Educational Quiz</h2>';
    
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