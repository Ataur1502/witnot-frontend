import { BrowserRouter as Router, Routes, Route, Navigate} from 'react-router-dom';
import Login from './Components/login';
import Quiz from './Components/Quiz';
import Feedback from './Components/feedback';
import Thinku from './Components/Thinku';
<<<<<<< HEAD
import ExamDashboard from './Components/ExamDashboard';
import React, { useEffect } from "react";
=======
import React from "react";
>>>>>>> 3f7799f9e41092fdc22d6ae05a731d41533f2d93

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
<<<<<<< HEAD
        <Route path="/thankyou" element={<Thinku onNext={() => { console.log("Next clicked"); }} />} />
=======
        <Route
          path="/thankyou"
          element={
            <ProtectedRoute>
              <Thinku onNext={() => { console.log("Next clicked"); }} />
            </ProtectedRoute>
          }
        />
>>>>>>> 3f7799f9e41092fdc22d6ae05a731d41533f2d93
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
