let currentUser = null;
let quiz = null;
let currentQuestionIndex = 0;
let answers = [];
let questionTimer;
const QUESTION_TIME_LIMIT = 45;
const MAX_ATTEMPTS = 3;

const API_URL = "http://localhost:3000";

async function fetchAPI(endpoint, method = "GET", body = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function showLoginForm() {
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = `
        <div class="auth-container">
            <h2>Welcome to QuizMaster</h2>
            <form id="login-form" class="auth-form">
                <div class="form-group">
                    <input type="text" id="username" placeholder="Username" required>
                </div>
                <div class="form-group">
                    <input type="password" id="password" placeholder="Password" required>
                </div>
                <div class="form-group">
                    <select id="role" required>
                        <option value="">Select Role</option>
                        <option value="teacher">Teacher</option>
                        <option value="student">Student</option>
                    </select>
                </div>
                <button type="submit" class="btn-primary">Login</button>
                <p class="auth-switch">
                    Don't have an account? 
                    <a href="#" onclick="showRegisterForm(); return false;">Register</a>
                </p>
            </form>
        </div>
    `;

    document.getElementById("login-form").addEventListener("submit", handleLogin);
}

function showRegisterForm() {
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = `
        <h2>Create an Account</h2>
        <form id="register-form">
            <input type="text" id="username" placeholder="Username" required>
            <input type="password" id="password" placeholder="Password" required>
            <select id="role">
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
            </select>
            <button type="submit">Register</button>
        </form>
        <p>Already have an account? <a href="#" onclick="showLoginForm()">Login</a></p>
    `;

    document.getElementById("register-form").addEventListener("submit", handleRegister);
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const role = document.getElementById("role").value;

    try {
        const users = await fetchAPI("/users");
        if (users.some((user) => user.username === username)) {
            alert("Username already exists");
            return;
        }

        const newUser = {
            username,
            password,
            role,
        };

        await fetchAPI("/users", "POST", newUser);
        alert("Registration successful! Please login.");
        showLoginForm();
    } catch (error) {
        console.error("Registration error:", error);
        alert("An error occurred during registration. Please try again.");
    }
}

async function handleLogin(e) {
    e.preventDefault();
    try {
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;
        const role = document.getElementById("role").value;

        const users = await fetchAPI("/users");
        const user = users.find(
            (u) => u.username === username && 
                   u.password === password && 
                   u.role === role
        );

        if (user) {
            currentUser = user;
            saveUserSession(user);
            updateUserInfo();
            if (user.role === "teacher") {
                showTeacherDashboard();
            } else {
                showStudentDashboard();
            }
        } else {
            alert("Invalid credentials. Please try again.");
        }
    } catch (error) {
        console.error("Login error:", error);
        alert("An error occurred during login. Please try again.");
    }
}

function updateUserInfo() {
    const userInfo = document.getElementById("user-info");
    userInfo.innerHTML = `
        <div class="user-profile">
            <span>${currentUser.username} (${currentUser.role})</span>
            <button onclick="logout()" class="btn-logout">Logout</button>
        </div>
    `;
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    document.getElementById("user-info").innerHTML = "";
    showLoginForm();
}

async function showTeacherDashboard() {
    const mainContent = document.getElementById("main-content");
    const quizzes = await fetchAPI("/quizzes");
    const scores = await fetchAPI("/scores");
    const users = await fetchAPI("/users");
    
    const teacherQuizzes = quizzes.filter(quiz => quiz.teacherId === currentUser._id);
    const students = users.filter(user => user.role === 'student');
    
    // Calculate overall statistics
    const totalAttempts = scores.filter(score => 
        teacherQuizzes.some(quiz => quiz._id === score.quizId)
    ).length;
    
    const averageScore = calculateOverallAverage(scores, teacherQuizzes);
    const totalStudents = students.length;
    const totalQuizzes = teacherQuizzes.length;

    mainContent.innerHTML = `
        <div class="dashboard teacher-dashboard">
            <h2>Teacher Dashboard</h2>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">📚</div>
                    <div class="stat-value">${totalQuizzes}</div>
                    <div class="stat-label">Total Quizzes</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-value">${totalStudents}</div>
                    <div class="stat-label">Total Students</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">✍️</div>
                    <div class="stat-value">${totalAttempts}</div>
                    <div class="stat-label">Quiz Attempts</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${averageScore}%</div>
                    <div class="stat-label">Average Score</div>
                </div>
            </div>

            <div class="dashboard-actions">
                <button onclick="showCreateQuizForm()" class="btn-primary">
                    <i class="fas fa-plus"></i> Create New Quiz
                </button>
            </div>

            <div class="quizzes-section">
                <h3>Your Quizzes</h3>
                <ul id="quiz-list" class="quiz-list"></ul>
            </div>
        </div>
    `;

    updateQuizList();
}

function calculateOverallAverage(scores, teacherQuizzes) {
    const quizScores = scores.filter(score => 
        teacherQuizzes.some(quiz => quiz._id === score.quizId)
    );
    
    if (quizScores.length === 0) return 0;
    
    const totalPercentage = quizScores.reduce((sum, score) => {
        const quiz = teacherQuizzes.find(q => q._id === score.quizId);
        return sum + (score.score / quiz.questions.length * 100);
    }, 0);
    
    return (totalPercentage / quizScores.length).toFixed(1);
}

async function updateQuizList() {
    const quizList = document.getElementById("quiz-list");
    const quizzes = await fetchAPI("/quizzes");
    const teacherQuizzes = quizzes.filter((quiz) => quiz.teacherId === currentUser._id);

    quizList.innerHTML = teacherQuizzes
        .map(
            (quiz) => `
        <li class="quiz-item">
            <h4>${quiz.title}</h4>
            <p>Questions: ${quiz.questions.length}</p>
            <button onclick="editQuiz('${quiz._id}')">Edit</button>
            <button onclick="deleteQuiz('${quiz._id}')">Delete</button>
            <button onclick="viewQuizScores('${quiz._id}')">View Scores</button>
        </li>
    `
        )
        .join("");
}

function showCreateQuizForm() {
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = `
        <h2>Create New Quiz</h2>
        <form id="create-quiz-form">
            <input type="text" id="quiz-title" placeholder="Quiz Title" required>
            <div id="questions-container"></div>
            <button type="button" onclick="addQuestion()">Add Question</button>
            <button type="submit">Create Quiz</button>
        </form>
    `;

    document.getElementById("create-quiz-form").addEventListener("submit", handleCreateQuiz);
    addQuestion();
}

function addQuestion() {
    const container = document.getElementById("questions-container");
    const questionId = Date.now();
    const questionHtml = `
        <div class="question" id="question-${questionId}">
            <input type="text" placeholder="Question" required>
            <input type="text" placeholder="Option 1" required>
            <input type="text" placeholder="Option 2" required>
            <input type="text" placeholder="Option 3" required>
            <input type="text" placeholder="Option 4" required>
            <select required>
                <option value="">Select Correct Answer</option>
                <option value="0">Option 1</option>
                <option value="1">Option 2</option>
                <option value="2">Option 3</option>
                <option value="3">Option 4</option>
            </select>
            <button type="button" onclick="removeQuestion(${questionId})">Remove Question</button>
        </div>
    `;
    container.insertAdjacentHTML("beforeend", questionHtml);
}

function removeQuestion(questionId) {
    const questionElement = document.getElementById(`question-${questionId}`);
    questionElement.remove();
}

async function handleCreateQuiz(e) {
    e.preventDefault();
    const title = document.getElementById("quiz-title").value;
    const questionElements = document.querySelectorAll(".question");
    const questions = Array.from(questionElements).map((qElement) => {
        const inputs = qElement.querySelectorAll("input");
        return {
            question: inputs[0].value,
            options: [inputs[1].value, inputs[2].value, inputs[3].value, inputs[4].value],
            correctAnswer: parseInt(qElement.querySelector("select").value),
        };
    });

    const newQuiz = {
        title,
        teacherId: currentUser._id,
        questions,
    };

    await fetchAPI("/quizzes", "POST", newQuiz);
    alert("Quiz created successfully");
    showTeacherDashboard();
}

async function deleteQuiz(quizId) {
    if (confirm("Are you sure you want to delete this quiz?")) {
        await fetchAPI(`/quizzes/${quizId}`, "DELETE");
        updateQuizList();
    }
}

async function showStudentDashboard() {
    const scores = await fetchAPI("/scores");
    const quizzes = await fetchAPI("/quizzes");
    const studentScores = scores.filter(score => score.studentId === currentUser._id);
    
    const performanceData = calculatePerformanceData(studentScores, quizzes);
    
    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = `
        <div class="dashboard student-dashboard">
            <h2>Welcome, ${currentUser.username}!</h2>
            
            <div class="performance-overview">
                <div class="performance-chart">
                    <canvas id="performanceGraph"></canvas>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">📊</div>
                        <div class="stat-value">${performanceData.averageScore}%</div>
                        <div class="stat-label">Average Score</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">✅</div>
                        <div class="stat-value">${performanceData.completedQuizzes}</div>
                        <div class="stat-label">Completed Quizzes</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">🏆</div>
                        <div class="stat-value">${performanceData.certificates}</div>
                        <div class="stat-label">Certificates Earned</div>
                    </div>
                </div>
            </div>

            <div class="dashboard-sections">
                <section class="available-quizzes">
                    <h3>Available Quizzes</h3>
                    <ul id="available-quizzes" class="quiz-list"></ul>
                </section>

                <section class="quiz-history">
                    <h3>Your Quiz History</h3>
                    <ul id="quiz-history" class="quiz-list"></ul>
                </section>
            </div>
        </div>
    `;

    initPerformanceGraph(performanceData);
    updateAvailableQuizzes();
    updateQuizHistory();
}

async function updateAvailableQuizzes() {
    const quizList = document.getElementById("available-quizzes");
    const quizzes = await fetchAPI("/quizzes");
    const scores = await fetchAPI("/scores");
    
    // Filter out quizzes that the student has already taken
    const attemptedQuizIds = scores
        .filter(score => score.studentId === currentUser._id)
        .map(score => score.quizId);
    
    const availableQuizzes = quizzes.filter(quiz => 
        !attemptedQuizIds.includes(quiz._id));

    quizList.innerHTML = availableQuizzes
        .map(quiz => `
            <li class="quiz-item">
                <h4>${quiz.title}</h4>
                <p>Number of Questions: ${quiz.questions.length}</p>
                <button onclick="startQuiz('${quiz._id}')">Start Quiz</button>
            </li>
        `)
        .join("");
}

async function updateQuizHistory() {
    const historyList = document.getElementById("quiz-history");
    const scores = await fetchAPI("/scores");
    const quizzes = await fetchAPI("/quizzes");
    
    const studentScores = scores.filter(score => 
        score.studentId === currentUser._id
    );

    // Group attempts by quiz
    const attemptsByQuiz = {};
    studentScores.forEach(score => {
        if (!attemptsByQuiz[score.quizId]) {
            attemptsByQuiz[score.quizId] = [];
        }
        attemptsByQuiz[score.quizId].push(score);
    });

    historyList.innerHTML = await Promise.all(Object.entries(attemptsByQuiz).map(async ([quizId, attempts]) => {
        const quiz = quizzes.find(q => q._id === quizId);
        if (!quiz) return '';
        
        const latestAttempt = attempts.sort((a, b) => 
            new Date(b.completedAt) - new Date(a.completedAt)
        )[0];
        
        return `
            <li class="quiz-item">
                <h4>${quiz.title}</h4>
                <p>Best Score: ${Math.max(...attempts.map(a => a.percentage))}%</p>
                <p>Latest Score: ${latestAttempt.score}/${quiz.questions.length} (${latestAttempt.percentage}%)</p>
                <p>Attempts: ${attempts.length}/3</p>
                ${attempts.length < MAX_ATTEMPTS ? `
                    <button onclick="startQuiz('${quizId}')" class="btn-retake">Retake Quiz</button>
                ` : '<p class="max-attempts">Maximum attempts reached</p>'}
                ${latestAttempt.certificateId ? `
                    <div class="certificate-badge">
                        <span>🏆 Certified</span>
                        <button onclick="showCertificate(${JSON.stringify(latestAttempt)}, ${JSON.stringify(quiz)})" 
                                class="btn-view-cert">
                            View Certificate
                        </button>
                    </div>
                ` : ''}
            </li>
        `;
    })).then(items => items.join(""));
}

async function startQuiz(quizId) {
    try {
        // Check attempts
        const scores = await fetchAPI("/scores");
        const attempts = scores.filter(s => 
            s.quizId === quizId && s.studentId === currentUser._id
        ).length;

        if (attempts >= MAX_ATTEMPTS) {
            alert("You've reached the maximum number of attempts for this quiz.");
            return;
        }

        quiz = (await fetchAPI("/quizzes")).find((q) => q._id === quizId);
        if (!quiz) {
            alert("Quiz not found!");
            return;
        }

        currentQuestionIndex = 0;
        answers = new Array(quiz.questions.length).fill(null);
        showQuestion();
    } catch (error) {
        console.error("Error starting quiz:", error);
        alert("Failed to start quiz. Please try again.");
    }
}

function startQuestionTimer() {
    let timeLeft = QUESTION_TIME_LIMIT;
    clearInterval(questionTimer);
    
    const timerElement = document.getElementById('question-timer');
    const timeLeftElement = document.getElementById('time-left');
    
    if (!timerElement || !timeLeftElement) return;
    
    timerElement.style.width = '100%';
    timeLeftElement.textContent = timeLeft;
    
    questionTimer = setInterval(() => {
        timeLeft--;
        timeLeftElement.textContent = timeLeft;
        const percentage = (timeLeft / QUESTION_TIME_LIMIT) * 100;
        timerElement.style.width = `${percentage}%`;
        
        if (timeLeft <= 0) {
            clearInterval(questionTimer);
            if (currentQuestionIndex < quiz.questions.length - 1) {
                nextQuestion();
            } else {
                window.submitQuiz();
            }
        }
    }, 1000);
}

function selectAnswer(index) {
    answers[currentQuestionIndex] = index;
    // Refresh the options to show selection
    const options = document.querySelectorAll('.option-button');
    options.forEach((option, i) => {
        option.classList.toggle('selected', i === index);
    });
}

function showQuestion() {
    const question = quiz.questions[currentQuestionIndex];
    const mainContent = document.getElementById("main-content");
    
    mainContent.innerHTML = `
        <div class="quiz-container">
            <div class="rough-board-container">
                <div class="rough-board">
                    <canvas id="roughBoard"></canvas>
                    <button onclick="clearBoard()" class="btn-clear">Clear</button>
                </div>
                <div class="rough-board-toggle" onclick="toggleRoughBoard()">
                    Rough Board
                </div>
                <div class="drag-handle"></div>
            </div>

            <div class="quiz-header">
                <h2>${quiz.title}</h2>
                <div class="timer-wrapper">
                    <span id="time-left">45</span> seconds left
                    <div class="timer-container">
                        <div id="question-timer" class="timer-bar"></div>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress" style="width: ${(currentQuestionIndex + 1) / quiz.questions.length * 100}%"></div>
                </div>
            </div>

            <div class="question-content">
                <div class="question-area">
                    <h3>Question ${currentQuestionIndex + 1} of ${quiz.questions.length}</h3>
                    <p class="question-text">${question.question}</p>
                    
                    <div class="options">
                        ${question.options.map((option, index) => `
                            <button 
                                type="button"
                                onclick="selectAnswer(${index})"
                                class="option-button ${answers[currentQuestionIndex] === index ? 'selected' : ''}"
                            >
                                ${option}
                            </button>
                        `).join("")}
                    </div>
                </div>
            </div>

            <div class="navigation-buttons">
                ${currentQuestionIndex > 0 ? 
                    `<button onclick="previousQuestion()" class="btn-nav">Previous</button>` : 
                    `<button disabled class="btn-nav disabled">Previous</button>`}
                
                ${currentQuestionIndex < quiz.questions.length - 1 ? 
                    `<button onclick="nextQuestion()" class="btn-nav">Next</button>` : 
                    `<button onclick="window.submitQuiz()" class="btn-submit">Submit Quiz</button>`}
            </div>
        </div>
    `;

    initRoughBoard();
    startQuestionTimer();
    initDragHandle();
}

function generateCertificateId() {
    return 'CERT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function showCertificate(scoreData, quiz) {
    const mainContent = document.getElementById("main-content");
    const completionDate = new Date(scoreData.completedAt).toLocaleDateString();
    
    mainContent.innerHTML = `
        <div class="certificate">
            <div class="certificate-content">
                <div class="certificate-header">
                    <h1>Certificate of Completion</h1>
                    <div class="certificate-seal">🏆</div>
                </div>
                <div class="certificate-body">
                    <p>This is to certify that</p>
                    <h2>${currentUser.username}</h2>
                    <p>has successfully completed</p>
                    <h3>${quiz.title}</h3>
                    <p>with a score of</p>
                    <h4>${scoreData.percentage}%</h4>
                    <p class="certificate-date">Completed on ${completionDate}</p>
                    <p class="certificate-id">Certificate ID: ${scoreData.certificateId}</p>
                </div>
            </div>
            <div class="certificate-actions">
                <button onclick="downloadCertificate()" class="btn-primary">Download Certificate</button>
                <button onclick="showStudentDashboard()" class="btn-secondary">Back to Dashboard</button>
            </div>
        </div>
    `;
}

async function editQuiz(quizId) {
    const quiz = (await fetchAPI("/quizzes")).find(q => q._id === quizId);
    if (!quiz) return;

    const mainContent = document.getElementById("main-content");
    mainContent.innerHTML = `
        <div class="quiz-form-container">
            <h2>Edit Quiz: ${quiz.title}</h2>
            <form id="edit-quiz-form">
                <div class="form-group">
                    <input type="text" id="quiz-title" value="${quiz.title}" required>
                </div>
                <div id="questions-container">
                    ${quiz.questions.map((question, index) => `
                        <div class="question" id="question-${index}">
                            <input type="text" value="${question.question}" placeholder="Question" required>
                            ${question.options.map((option, optIndex) => `
                                <input type="text" value="${option}" placeholder="Option ${optIndex + 1}" required>
                            `).join('')}
                            <select required>
                                ${question.options.map((_, optIndex) => `
                                    <option value="${optIndex}" ${question.correctAnswer === optIndex ? 'selected' : ''}>
                                        Option ${optIndex + 1}
                                    </option>
                                `).join('')}
                            </select>
                            <button type="button" onclick="removeQuestion(${index})" class="btn-delete">Remove</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" onclick="addQuestion()" class="btn-add">Add Question</button>
                <button type="submit" class="btn-save">Save Changes</button>
                <button type="button" onclick="showTeacherDashboard()" class="btn-cancel">Cancel</button>
            </form>
        </div>
    `;

    document.getElementById("edit-quiz-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        await handleEditQuiz(e, quizId);
    });
}

async function handleEditQuiz(e, quizId) {
    const title = document.getElementById("quiz-title").value;
    const questionElements = document.querySelectorAll(".question");
    const questions = Array.from(questionElements).map((qElement) => {
        const inputs = qElement.querySelectorAll("input");
        return {
            question: inputs[0].value,
            options: [inputs[1].value, inputs[2].value, inputs[3].value, inputs[4].value],
            correctAnswer: parseInt(qElement.querySelector("select").value),
        };
    });

    const updatedQuiz = {
        title,
        questions,
        teacherId: currentUser._id,
    };

    try {
        await fetchAPI(`/quizzes/${quizId}`, "PUT", updatedQuiz);
        alert("Quiz updated successfully!");
        showTeacherDashboard();
    } catch (error) {
        console.error("Error updating quiz:", error);
        alert("Failed to update quiz. Please try again.");
    }
}

async function viewQuizScores(quizId) {
    try {
        // Fetch quiz, scores, and users data
        const quiz = (await fetchAPI("/quizzes")).find(q => q._id === quizId);
        const scores = await fetchAPI("/scores");
        const users = await fetchAPI("/users"); // Get all users to map student names
        
        // Filter scores for this quiz and add student names
        const quizScores = scores
            .filter(score => score.quizId === quizId)
            .map(score => {
                const student = users.find(user => user._id === score.studentId);
                return {
                    ...score,
                    studentName: student ? student.username : 'Unknown Student'
                };
            });

        const mainContent = document.getElementById("main-content");
        mainContent.innerHTML = `
            <div class="scores-container">
                <h2>Scores for: ${quiz.title}</h2>
                <div class="scores-summary">
                    <p>Total Attempts: ${quizScores.length}</p>
                    <p>Average Score: ${calculateAverageScore(quizScores, quiz.questions.length)}%</p>
                </div>
                <div class="scores-list">
                    <h3>Student Attempts</h3>
                    ${quizScores.length > 0 ? `
                        <table class="scores-table">
                            <thead>
                                <tr>
                                    <th>Student Name</th>
                                    <th>Score</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${quizScores.map(score => `
                                    <tr>
                                        <td>${score.studentName}</td>
                                        <td>${score.score}/${quiz.questions.length} 
                                            (${(score.score/quiz.questions.length*100).toFixed(1)}%)
                                        </td>
                                        <td>${new Date(score.completedAt).toLocaleDateString()}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>No attempts yet</p>'}
                </div>
                <button onclick="showTeacherDashboard()" class="btn-back">Back to Dashboard</button>
            </div>
        `;
    } catch (error) {
        console.error("Error fetching scores:", error);
        alert("Failed to load quiz scores. Please try again.");
    }
}

function calculateAverageScore(scores, totalQuestions) {
    if (scores.length === 0) return 0;
    const totalScore = scores.reduce((sum, score) => sum + (score.score / totalQuestions * 100), 0);
    return (totalScore / scores.length).toFixed(1);
}

function saveUserSession(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
}

function loadUserSession() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUserInfo();
        if (currentUser.role === "teacher") {
            showTeacherDashboard();
        } else {
            showStudentDashboard();
        }
        return true;
    }
    return false;
}

function initApp() {
    if (!loadUserSession()) {
        showLoginForm();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function showQuizResult(scoreData, quiz) {
    const mainContent = document.getElementById("main-content");
    const passed = scoreData.percentage >= 60;
    
    mainContent.innerHTML = `
        <div class="quiz-result ${passed ? 'pass' : 'fail'}">
            <div class="result-content">
                <div class="result-header">
                    <h2>${passed ? '🎉 Congratulations!' : '📚 Keep Learning!'}</h2>
                    <div class="score-display">
                        <div class="score-circle">
                            <span class="score-value">${scoreData.percentage}%</span>
                        </div>
                    </div>
                </div>
                
                <div class="result-details">
                    <h3>${quiz.title}</h3>
                    <p>Score: ${scoreData.score}/${quiz.questions.length}</p>
                    <p>Completed on: ${new Date(scoreData.completedAt).toLocaleDateString()}</p>
                </div>

                ${passed ? `
                    <div class="success-message">
                        <p>You've successfully passed the quiz!</p>
                        <button onclick="showCertificate(${JSON.stringify(scoreData)}, ${JSON.stringify(quiz)})" 
                                class="btn-view-cert">
                            View Certificate
                        </button>
                    </div>
                ` : `
                    <div class="encouragement-message">
                        <p>You need 60% to pass. Keep practicing and try again!</p>
                    </div>
                `}
                
                <div class="result-actions">
                    <button onclick="showStudentDashboard()" class="btn-primary">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    `;
}

function initRoughBoard() {
    const canvas = document.getElementById('roughBoard');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    function startDrawing(e) {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }

    function draw(e) {
        if (!isDrawing) return;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        [lastX, lastY] = [e.offsetX, e.offsetY];
    }

    function stopDrawing() {
        isDrawing = false;
    }
}

function clearBoard() {
    const canvas = document.getElementById('roughBoard');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function calculatePerformanceData(scores, quizzes) {
    const totalScores = scores.length;
    const passedScores = scores.filter(score => score.percentage >= 60).length;
    const averageScore = totalScores > 0 
        ? scores.reduce((sum, score) => sum + parseFloat(score.percentage), 0) / totalScores 
        : 0;

    return {
        averageScore: averageScore.toFixed(1),
        completedQuizzes: totalScores,
        certificates: passedScores,
        quizResults: scores.map(score => ({
            date: new Date(score.completedAt).toLocaleDateString(),
            score: score.percentage,
            quizName: quizzes.find(q => q._id === score.quizId)?.title || 'Unknown Quiz'
        }))
    };
}

function initPerformanceGraph(performanceData) {
    const ctx = document.getElementById('performanceGraph').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: performanceData.quizResults.map(r => r.date),
            datasets: [{
                label: 'Quiz Scores',
                data: performanceData.quizResults.map(r => r.score),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Fix the submit quiz function
window.submitQuiz = async () => {
    clearInterval(questionTimer);
    
    if (!confirm("Are you sure you want to submit the quiz?")) return;

    let score = 0;
    quiz.questions.forEach((question, index) => {
        if (answers[index] === question.correctAnswer) score++;
    });

    const percentage = (score / quiz.questions.length * 100).toFixed(1);
    const passed = percentage >= 60;

    try {
        const scoreData = {
            quizId: quiz._id,
            studentId: currentUser._id,
            score: score,
            completedAt: new Date().toISOString(),
            answers: answers,
            percentage: percentage,
            passed: passed,
            certificateId: passed ? generateCertificateId() : null
        };

        await fetchAPI("/scores", "POST", scoreData);
        showQuizResult(scoreData, quiz);
    } catch (error) {
        console.error("Error submitting quiz:", error);
        alert("Failed to submit quiz. Please try again.");
    }
};

function nextQuestion() {
    clearInterval(questionTimer);
    if (currentQuestionIndex < quiz.questions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    }
}

function previousQuestion() {
    clearInterval(questionTimer);
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion();
    }
}

function generateCertificateId() {
    return 'CERT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function toggleRoughBoard() {
    const container = document.querySelector('.rough-board-container');
    container.classList.toggle('open');
}

function initDragHandle() {
    const handle = document.querySelector('.drag-handle');
    const container = document.querySelector('.rough-board-container');
    let isResizing = false;
    let startWidth;
    let startX;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = container.offsetWidth;
        
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
    });

    function handleDrag(e) {
        if (!isResizing) return;
        
        const width = startWidth + (e.clientX - startX);
        if (width > 200 && width < 600) {
            container.style.width = `${width}px`;
        }
    }

    function stopDrag() {
        isResizing = false;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
    }
}