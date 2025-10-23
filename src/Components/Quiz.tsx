import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Quiz.css';
//import Feedback from './feedback';
import { useNavigate } from 'react-router-dom';

interface QuizOption {
  key: string;
  text: string;
}

interface QuizQuestion {
  id: number;
  questionText: string;
  options: QuizOption[];
  marks: number;
  imageUrl: string | null;
  userAnswer: string | null;
  isPenalized: boolean;
}

interface SubmissionData {
  questionId: number;
  userAnswer: string;
  isPenalized: boolean;
}

interface NotificationProps {
  message: string;
  isError?: boolean;
  duration?: number;
}

//const FEADBACK_PAGE_URL = 'feedback.tsx';
const LOGIN_PAGE_URL = '/login'; // Changed to standard react-router-dom path
const API_BASE_URL = 'http://13.51.72.93/api/';
const userName = localStorage.getItem('userName');

// 🚨 BUG FIX: Added missing '$' for template literal interpolation
const QUIZ_FETCH_API_FULL_URL = `${API_BASE_URL}exam/${userName}/`;
const QUIZ_SUBMIT_API_URL = `${API_BASE_URL}exam/${userName}/submit/`;

const TOTAL_QUESTIONS_CONSTANT = 40; // Renamed to avoid confusion
const TOTAL_TIME_SECONDS = 60 * 60;
const MAX_WARNINGS_BEFORE_DEDUCTION = 5;
const PENALIZED_MARKS = 0.5;
const FINAL_SUBMISSION_WINDOW_SECONDS = 60 * 60;
const VIOLATION_DEBOUNCE_TIME = 500;

const getInitialWarningCount = (): number => {
  const savedWarnings = localStorage.getItem('quiz_warnings');
  try { return savedWarnings ? parseInt(savedWarnings, 10) : 0; } 
  catch { return 0; }
};

const saveWarningsToLocalStorage = (count: number) => {
  try { localStorage.setItem('quiz_warnings', count.toString()); } 
  catch (error) { console.error("Could not save warnings:", error); }
};

const saveAnswersToLocalStorage = (answers: QuizQuestion[]) => {
  try { localStorage.setItem('quiz_answers', JSON.stringify(answers)); } 
  catch (error) { console.error("Could not save answers:", error); }
};

const getAnswersFromLocalStorage = (): QuizQuestion[] | null => {
  try { 
    const val = localStorage.getItem('quiz_answers');
    return val ? JSON.parse(val) : null;
  } catch { return null; }
};

const getTimeFromLocalStorage = (): number | null => {
  const val = localStorage.getItem('quiz_time_remaining');
  return val ? parseInt(val, 10) : null;
};

const Quiz: React.FC<{ onEnd: () => void }> = ({ onEnd }) => {
  const [quizData, setQuizData] = useState<QuizQuestion[]>([]);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quizProgress, setQuizProgress] = useState<string[]>(Array(TOTAL_QUESTIONS_CONSTANT).fill('unanswered')); // Use constant for initial state
  const [quizActive, setQuizActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TOTAL_TIME_SECONDS);
  const [showInstructionModal, setShowInstructionModal] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [notifications, setNotifications] = useState<Array<NotificationProps & { id: number }>>([]);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // 🚨 BUG FIX: Use template literals correctly and with the constant
  const [initialTotalQ, setInitialTotalQ] = useState(`${TOTAL_QUESTIONS_CONSTANT} Questions`);
  const [initialTimeLimit, setInitialTimeLimit] = useState('1 Hour (60 Minutes)');
  const [progressText, setProgressText] = useState(`0/${TOTAL_QUESTIONS_CONSTANT}`);
  const [breadcrumb, setBreadcrumb] = useState('Loading...');
  const [timeText, setTimeText] = useState('Loading...');
  const [progressOffset, setProgressOffset] = useState(0);
  const [isInFullscreen, setIsInFullscreen] = useState(false);
  
  // New state to hold the actual question count from the API
  const [totalQuestions, setTotalQuestions] = useState(TOTAL_QUESTIONS_CONSTANT);

  const timerRef = useRef<number | undefined>(undefined);
  const notifRef = useRef(0);
  const warnRef = useRef(getInitialWarningCount());
  const lastViolationTimeRef = useRef(0);

  const accessToken = localStorage.getItem('accessToken');
  const userName = localStorage.getItem('userName');
  const navigate = useNavigate();

  const showNotification = useCallback((msg: string, isError = false, duration = 4000) => {
    const id = notifRef.current++;
    setNotifications(p => [...p, { id, message: msg, isError, duration }]);
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), duration);
  }, []);

  const calculateMarks = (questionId: number) => (questionId >= 1 && questionId <= 50 ? 1 : 2);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    // 🚨 BUG FIX: Fixed template literal issue in formatTime
    return (h > 0 ? `${h} Hour(s) ` : '') + (m > 0 ? `${m} Minute(s)` : '30 Minutes');
  };

  const handleLogout = useCallback(() => {
    
    // Navigate to feedback page after quiz submission
    navigate('/feedback', { replace: true });
  }, [navigate]);

  const endQuiz = useCallback((_reason: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setQuizActive(false);
    localStorage.removeItem('quiz_warnings');
    localStorage.removeItem('quiz_time_remaining');
    localStorage.removeItem('quiz_answers');
    onEnd();
  }, [onEnd]);

  const initializeQuizSession = useCallback(async () => {
    const accessToken = localStorage.getItem('accessToken');
    const userName = localStorage.getItem('userName');
    if (!accessToken || !userName) {
      // 🚨 FIX: Using navigate instead of window.location.href
      navigate(LOGIN_PAGE_URL, { replace: true });
      return;
    }
    try {
      const response = await fetch(QUIZ_FETCH_API_FULL_URL, {
        method: 'GET',
        // 🚨 BUG FIX: Added missing '$' for template literal interpolation
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to fetch exam data.');

      if (data.questions.length === 0) {
        showNotification('No exam scheduled at this time. Please try again later.', true, 10000);
        return;
      }
      
      const actualTotalQuestions = data.questions.length;
      setTotalQuestions(actualTotalQuestions); // Set the actual count

      let questions: QuizQuestion[] = data.questions.map((q: any) => ({
        id: q.id,
        questionText: q.text,
        options: Object.keys(q.options).map(key => ({ key, text: q.options[key] })),
        marks: calculateMarks(q.id),
        imageUrl: q.image_url,
        userAnswer: null,
        isPenalized: q.penalties > 0,
      }));

      // Restore answers from local storage
      const savedAnswers = getAnswersFromLocalStorage();
      if (savedAnswers) {
        questions = questions.map(q => {
          const saved = savedAnswers.find(s => s.id === q.id);
          return saved ? { ...q, userAnswer: saved.userAnswer, isPenalized: saved.isPenalized } : q;
        });
      }

      setQuizData(questions);
      // Ensure time remaining doesn't exceed the max time from API or constant
      const initialTime = Math.min(data.timer, getTimeFromLocalStorage() || TOTAL_TIME_SECONDS);
      setTimeRemaining(initialTime);
      setQuizProgress(questions.map(q => q.userAnswer ? (q.isPenalized ? 'penalized' : 'answered') : 'unanswered'));
      
      // 🚨 BUG FIX: Fixed template literal issue and used actual count
      setInitialTotalQ(`${actualTotalQuestions} Questions`);
      setInitialTimeLimit(`Remaining: ${formatTime(initialTime)}`);
      setProgressText(`0/${actualTotalQuestions}`);
    } catch (error: any) {
      showNotification(error.message || 'Failed to load exam data.', true, 10000);
    }
  }, [accessToken, userName, showNotification, navigate]); // 🚨 FIX: Added navigate to dependencies

  const fetchQuestion = useCallback((q: number) => {
    // 🚨 BUG FIX: Use the dynamic 'totalQuestions' state instead of the fixed constant
    if (q < 1 || q > totalQuestions) { endQuiz('completed'); return; } 
    setLoading(true);
    const question = quizData[q - 1];
    setCurrentQuestion(question);
    setCurrentQuestionNumber(q);
    setSelectedOption(question.userAnswer);
    // 🚨 BUG FIX: Used the dynamic 'totalQuestions' state
    setBreadcrumb(`Question ${q} of ${totalQuestions}`);
    setLoading(false);
  }, [quizData, endQuiz, totalQuestions]); // 🚨 FIX: Added totalQuestions to dependencies

  const handleOptionClick = useCallback((key: string) => {
    if (!quizActive || !currentQuestion || !isInFullscreen) return;
    setSelectedOption(key);
    const idx = currentQuestionNumber - 1;
    
    // 🚨 FIX: Mutating quizData directly is bad. Create a copy and update the state.
    const newQuizData = [...quizData];
    newQuizData[idx] = { ...newQuizData[idx], userAnswer: key };

    if (!newQuizData[idx].isPenalized) {
      setQuizProgress(prev => { const p = [...prev]; p[idx] = 'answered'; return p; });
    }
    setQuizData(newQuizData); // Update state with the new copy
    saveAnswersToLocalStorage(newQuizData);
  }, [quizActive, currentQuestion, currentQuestionNumber, quizData, isInFullscreen]);

  const handlePrevious = useCallback(() => {
    if (quizActive && currentQuestionNumber > 1 && isInFullscreen) fetchQuestion(currentQuestionNumber - 1);
  }, [quizActive, currentQuestionNumber, fetchQuestion, isInFullscreen]);

  const handleNext = useCallback(() => {
    if (!quizActive || !isInFullscreen) return;
    const idx = currentQuestionNumber - 1;
    
    // 🚨 FIX: Mutating quizData directly is bad. Create a copy for local storage.
    const newQuizData = [...quizData];

    if (newQuizData[idx].userAnswer === null && quizProgress[idx] === 'unanswered') {
      setQuizProgress(prev => { const p = [...prev]; p[idx] = 'skipped'; return p; });
    }
    
    // 🚨 BUG FIX: Used the dynamic 'totalQuestions' state
    if (currentQuestionNumber < totalQuestions) fetchQuestion(currentQuestionNumber + 1);
    
    saveAnswersToLocalStorage(newQuizData); // Save the current state of answers
    
  }, [quizActive, currentQuestionNumber, quizData, quizProgress, fetchQuestion, isInFullscreen, totalQuestions]); // 🚨 FIX: Added totalQuestions to dependencies

  const submitFullQuiz = useCallback(async () => {
    if (!quizActive) return;
    const finalSubmission: SubmissionData[] = quizData.map(q => ({
      questionId: q.id,
      userAnswer: q.userAnswer || 'N',
      isPenalized: q.isPenalized,
    }));

    try {
      const response = await fetch(QUIZ_SUBMIT_API_URL, {
        method: 'POST',
        // 🚨 BUG FIX: Added missing '$' for template literal interpolation
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizSessionId: userName, totalWarnings: warnRef.current, submittedAnswers: finalSubmission }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to submit quiz.');
      if (timerRef.current) clearInterval(timerRef.current);
      setQuizActive(false);
      handleLogout();
    } catch (error: any) {
      showNotification(error.message || 'Error submitting quiz.', true, 5000);
      endQuiz('submission_error');
    }
  }, [quizActive, quizData, accessToken, userName, showNotification, handleLogout, endQuiz]);

  const handleSubmitClick = useCallback(() => {
    if (!quizActive) return;
    if (timeRemaining > FINAL_SUBMISSION_WINDOW_SECONDS) {
      const minutesRemaining = Math.ceil((timeRemaining - FINAL_SUBMISSION_WINDOW_SECONDS) / 60);
      // 🚨 BUG FIX: Fixed template literal issue
      showNotification(`Manual submission allowed in last 15 minutes. ${minutesRemaining} minutes remaining.`, true, 5000);
      return;
    }
    setShowSubmitModal(true);
  }, [quizActive, timeRemaining, showNotification]);

  const startQuiz = useCallback(() => {
    setShowInstructionModal(false);
    setQuizActive(true);
    fetchQuestion(1);
    enterFullscreen();
    setIsInFullscreen(true);
  }, [fetchQuestion]);

  const enterFullscreen = () => {
    const element = document.documentElement;
    // 🚨 FIX: Added a check for an existing full-screen element to prevent error logs on a successful request
    if (!document.fullscreenElement) {
        (element.requestFullscreen || (element as any).webkitRequestFullscreen || (element as any).mozRequestFullScreen || (element as any).msRequestFullscreen)?.call(element).catch(() => {});
    }
  };

  const handleViolation = useCallback(() => {
    const now = Date.now();
    if (now - lastViolationTimeRef.current < VIOLATION_DEBOUNCE_TIME) return;
    lastViolationTimeRef.current = now;
    if (!quizActive) return;
    
    // 🚨 FIX: Using standard fullscreenElement check
    const isFullscreen = document.fullscreenElement !== null;
    const violationType = !isFullscreen ? 'exited Full Screen mode' : 'switched tabs or lost focus';
    warnRef.current++;
    saveWarningsToLocalStorage(warnRef.current);
    
    const idx = currentQuestionNumber - 1;
    
    if (warnRef.current <= MAX_WARNINGS_BEFORE_DEDUCTION) {
      const remaining = MAX_WARNINGS_BEFORE_DEDUCTION - warnRef.current;
      // 🚨 BUG FIX: Fixed template literal issue
      showNotification(`⚠ Warning ${warnRef.current}. You ${violationType}. Warnings left before deductions: ${remaining}.`, false, 8000);
    } else {
      // 🚨 FIX: Mutating quizData directly is bad. Create a copy and update the state.
      const newQuizData = [...quizData];
      if (currentQuestion && !newQuizData[idx].isPenalized) {
        newQuizData[idx].isPenalized = true;
        setQuizData(newQuizData); // Update state with the new copy
        saveAnswersToLocalStorage(newQuizData);
      }
      setQuizProgress(prev => { const p = [...prev]; p[idx] = 'penalized'; return p; });
      showNotification(`🚫 MARK DEDUCTION WARNING! Violation ${warnRef.current}. Further violations result in deduction for the current question.`, true, 10000);
    }
  }, [quizActive, currentQuestionNumber, currentQuestion, quizData, showNotification]);

  useEffect(() => { initializeQuizSession(); }, [initializeQuizSession]);

  useEffect(() => {
    if (!quizActive) return;
    const onVis = () => { if (document.hidden) handleViolation(); };
    const onBlur = () => handleViolation();
    const onFS = () => { 
        const isCurrentlyFullscreen = !!document.fullscreenElement;
        setIsInFullscreen(isCurrentlyFullscreen); 
        if (!isCurrentlyFullscreen) handleViolation(); 
    };
    
    // The fullscreenchange event is not fired on window, but document
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFS);
    
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFS);
    };
  }, [quizActive, handleViolation]);

  useEffect(() => {
    if (!quizActive) return;
    timerRef.current = window.setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0) { clearInterval(timerRef.current); submitFullQuiz(); return 0; }
        localStorage.setItem('quiz_time_remaining', (prev-1).toString());
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [quizActive, submitFullQuiz]);

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    // 🚨 BUG FIX: Fixed template literal issue
    return (h > 0 ? `${h}:` : '') + `${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
  };

  const getProgressPct = () => Math.max(0, timeRemaining / TOTAL_TIME_SECONDS);
  const answeredCount = quizProgress.filter(s => s === 'answered' || s === 'penalized').length;

  useEffect(() => {
    // 🚨 BUG FIX: Used the dynamic 'totalQuestions' state
    setProgressText(`${answeredCount}/${totalQuestions}`);
    setTimeText(formatTimer(timeRemaining));
    const PERIM = 2 * Math.PI * 48;
    setProgressOffset(PERIM * (1 - getProgressPct()));
  }, [timeRemaining, answeredCount, totalQuestions]); // 🚨 FIX: Added totalQuestions to dependencies

  return (
    <>
      {showInstructionModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Technical Assignment Examination</h2>
            <p>Welcome to the final assessment. Please read the following instructions carefully before starting the exam.</p>
            <div style={{ background: 'var(--accent-soft)', padding: '15px', borderRadius: '8px', border: '1px solid var(--accent)', color: '#0f0f66' }}>
              <strong>Exam Details:</strong><br />
              <ul><li>Total Questions: <b>{initialTotalQ}</b></li><li>Time Limit: <b>{initialTimeLimit}</b></li></ul>
            </div>
            <ul className="instructions-list">
              <li><b>Note:</b> This is an <b>internal examination</b> conducted exclusively for authorized participants under institutional guidelines.</li>
              <li>This exam must be taken in <b>Full Screen</b> mode.</li>
              <li><b>Do not switch tabs or minimize the window.</b> Doing so will trigger a warning.</li>
              {/* 🚨 BUG FIX: Used the constant correctly */}
              <li>You have a grace period of <b>{MAX_WARNINGS_BEFORE_DEDUCTION} warnings</b>. Starting from the <b>{MAX_WARNINGS_BEFORE_DEDUCTION + 1}th warning</b>, the mark for the <b>current question</b> will be penalized to <b>{PENALIZED_MARKS} marks</b>.</li>
              <li>Ensure a stable internet connection throughout the test.</li>
              <li>The <b>'Next Question'</b> button allows you to move forward, even if you skip the current question.</li>
              <li>You can return to any <b>skipped</b> question using the question progress panel.</li>
              <li>The examination will be <b>automatically submitted</b> upon completion of the allotted <b>1-hour duration</b>. Participants may choose to submit their responses manually during the <b>final 15 minutes</b> of the exam period.</li>
            </ul>
            <div className="start-control">
              <label className="checkbox-group">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                I have read and agree to follow all the instructions.
              </label>
              <button className="btn start-btn" disabled={!agreed} onClick={startQuiz}>Start Exam</button>
            </div>
          </div>
        </div>
      )}

      {showSubmitModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <h2>Confirm Final Submission</h2>
            <p>Are you sure you want to submit the quiz? You cannot make changes after submission.</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 25 }}>
              <button className="btn" style={{ background: '#555', boxShadow: 'none' }} onClick={() => setShowSubmitModal(false)}>Cancel</button>
              <button className="btn" onClick={() => { setShowSubmitModal(false); submitFullQuiz(); }}>Yes, Submit</button>
            </div>
          </div>
        </div>
      )}
      
      <div className="wrap" style={{ display: quizActive ? 'flex' : 'none' }}>
        <main className="container" role="main">
          <section className="left">
            <div className={!isInFullscreen ? 'blurred' : ''}>
              <div className="breadcrumb">{breadcrumb}</div>
              {currentQuestion && (
                <>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--muted)' }}>[Marks: {currentQuestion.marks}]</span>
                  </div>
                  <h1 className="title">{currentQuestion.questionText}</h1>
                  {currentQuestion.imageUrl && (
                    <div className="question-image-container">
                      <img src={currentQuestion.imageUrl} alt="Question Image" />
                    </div>
                  )}
                  <div className="options" role="list">
                    {currentQuestion.options.map(option => {
                      const isSelected = option.key === selectedOption;
                      // 🚨 BUG FIX: Fixed template literal issue in className
                      return (
                        <div key={option.key} className={`option ${isSelected ? 'selected' : ''}`} onClick={() => handleOptionClick(option.key)} role="button" tabIndex={0}>
                          <div className="letter">{option.key}</div>
                          <div className="text">{option.text}</div>
                          {isSelected && (
                            <div className="check" style={{ display: 'flex' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              {loading && (
                <div className="loading-question">
                  <div className="loading-spinner"></div>
                  Fetching question data...
                </div>
              )}
            </div>
            {currentQuestion && (
              <div className="submit-row">
                {currentQuestionNumber > 1 && <button className="btn" onClick={handlePrevious}>Previous</button>}
                <b>  </b>
                {/* 🚨 BUG FIX: Used the dynamic 'totalQuestions' state */}
                {currentQuestionNumber < totalQuestions ? (
                  <button className="nxt-btn" onClick={handleNext}>Save & Next Question</button>
                ) : (
                  <button className="btn" onClick={()=>{
                    handleNext();
                    handleSubmitClick();
                  }}>Submit Quiz</button>
                )}
                <br></br>
                <br></br>
                {!isInFullscreen && (
                  <button className="btn" onClick={enterFullscreen}>Re-enter Full Screen</button>
                )}
              </div>
            )}
          </section>

          <section className="right">
            <div className="card timer-wrap">
              <div className="donut">
                <svg viewBox="0 0 120 120" width="120" height="120">
                  <defs><linearGradient id="g1" x1="0" x2="1"><stop offset="0%" stopColor="#2f8b6b"/><stop offset="100%" stopColor="#62b183"/></linearGradient></defs>
                  <circle cx="60" cy="60" r="48" stroke="#e7efe9" strokeWidth="14" fill="none" />
                  <circle cx="60" cy="60" r="48" stroke="url(#g1)" strokeWidth="14" strokeLinecap="round" strokeDasharray="302.88" strokeDashoffset={progressOffset} fill="none" style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
                </svg>
                {/* 🚨 BUG FIX: Fixed template literal issue */}
                <div className="center"><div>{timeText}</div></div>
              </div>
              <div className="label">Timer Remaining</div>
            </div>

            <div className="card">
              <div style={{ fontWeight: 700, marginBottom: '10px' }}>Question Progress ({progressText})</div>
              <div className="quiz-list">
                {quizProgress.map((status, index) => {
                  const qNum = index + 1;
                  const isCurrent = qNum === currentQuestionNumber;
                  // 🚨 BUG FIX: Fixed template literal issue in className
                  return (
                    <div
                      key={qNum}
                      className={`q-item ${isCurrent ? 'current' : ''} ${status}`}
                      onClick={() => !isCurrent && fetchQuestion(qNum)}
                    >
                      Question {qNum}
                      {!isCurrent && status === 'answered' && <span>✔</span>}
                      {!isCurrent && status === 'penalized' && <span>🚫</span>}
                      {!isCurrent && (status === 'skipped' || status === 'unanswered') && <span>❓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </main>
      </div>

      <div id="notification-container">
        {notifications.map(n => (
          // 🚨 BUG FIX: Fixed template literal issue in className
          <div key={n.id} className={`notification show ${n.isError ? 'error' : ''}`}>
            {n.message}
          </div>
        ))}
      </div>

      <footer id="page-footer">
        &copy; 2024 MISS Electronics. All rights reserved by MISS Electronics and its affiliates.
      </footer>
    </>
  );
};

export default Quiz;
