import { BrowserRouter as Router, Routes, Route, Navigate} from 'react-router-dom';
import Login from './Components/login';
import Quiz from './Components/Quiz';
import Feedback from './Components/feedback';
import Thinku from './Components/Thinku';
import ExamDashboard from './Components/ExamDashboard';
import React, { useEffect } from "react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = localStorage.getItem('accessToken');
  return accessToken ? children : <Navigate to="/" />;
}

function App() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && (event.key === 'c' || event.key === 'v' || event.key === 'a')) {
        event.preventDefault();
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleInspect = (event: KeyboardEvent) => {
      if (event.key === 'F12' || (event.ctrlKey && event.shiftKey && event.key === 'I') || (event.ctrlKey && event.shiftKey && event.key === 'J') || (event.ctrlKey && event.shiftKey && event.key === 'C')) {
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleInspect);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleInspect);
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
          <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
             <ExamDashboard/>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
             <Quiz onEnd={() => { console.log("Quiz ended"); }} />
            </ProtectedRoute>
          }
        />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/thankyou" element={<Thinku onNext={() => { console.log("Next clicked"); }} />} />
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
