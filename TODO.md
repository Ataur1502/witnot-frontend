# TODO: Implement Dashboard Navigation and API Integration

## Overview
Modify the login flow to navigate to a dashboard page after login, from which users can attend the exam. Integrate API call to fetch exam details on dashboard load.

## Tasks
- [x] Update App.tsx: Add /dashboard route with ProtectedRoute wrapping ExamDashboard component.
- [x] Update login.tsx: Change navigation from '/quiz' to '/dashboard' after successful login.
- [x] Update ExamDashboard.tsx:
  - [x] Import useNavigate from 'react-router-dom'.
  - [x] Set rollNumber from localStorage.getItem('userName').
  - [x] Add useEffect to call /api/dashboard API on component mount.
  - [x] Parse API response to set examName and examUnlockTime.
  - [x] Replace hardcoded exam name with dynamic examName.
  - [x] Add onClick handler to "Start Exam" button to navigate to '/quiz' if exam is unlocked.
  - [x] Handle loading and error states for API call.
- [x] Test the flow: Login -> Dashboard -> Start Exam (if unlocked) -> Quiz.

## Notes
- API URL: http://10.128.155.254:8000/api/dashboard
- Use accessToken for authorization in API call.
- Exam unlock based on exam_start time from API.
- Ensure dashboard is protected like the quiz route.
