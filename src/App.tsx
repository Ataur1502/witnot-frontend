import { BrowserRouter as Router, Routes, Route, Navigate} from 'react-router-dom';
import Login from './Components/login';
import Quiz from './Components/Quiz';
import Feedback from './Components/feedback';
import Thinku from './Components/Thinku';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const accessToken = localStorage.getItem('accessToken');
  return accessToken ? children : <Navigate to="/" />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
             <Quiz onEnd={() => { console.log("Quiz ended"); }} />
            </ProtectedRoute>
          }
        />
        <Route path="/feedback" element={<Feedback />} />
        <Route
          path="/thankyou"
          element={
            <ProtectedRoute>
              <Thinku onNext={() => { console.log("Next clicked"); }} />
            </ProtectedRoute>
          }
        />
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
