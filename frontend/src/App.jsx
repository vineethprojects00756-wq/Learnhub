
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect, createContext } from "react";
import "./App.css";
import Home from "./components/common/Home";
import Login from "./components/common/Login";
import Register from "./components/common/Register";
import Dashboard from "./components/common/Dashboard";
import CourseContent from "./components/user/student/CourseContent";
import AllCourses from "./components/common/AllCourses";
import SearchCourses from "./components/common/SearchCourses";
import UserProfile from "./components/common/UserProfile";
import Footer from "./components/common/Footer";
import ForgotPassword from "./components/common/ForgotPassword";

export const UserContext = createContext();

function App() {
  const [userData, setUserData] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });
  const [userLoggedIn, setUserLoggedIn] = useState(() =>
    Boolean(localStorage.getItem("user") || localStorage.getItem("token"))
  );

  useEffect(() => {
    setUserLoggedIn(Boolean(userData || localStorage.getItem("token")));
  }, [userData]);

  return (
    <UserContext.Provider value={{ userData, userLoggedIn, setUserData, setUserLoggedIn }}>
      <div className="App">
        <Router>
          <div className="content">
            <Routes>
              <Route exact path="/" element={<Home />} />
              <Route
                path="/login"
                element={userLoggedIn ? <Navigate to="/dashboard" replace /> : <Login />}
              />
              <Route
                path="/register"
                element={userLoggedIn ? <Navigate to="/dashboard" replace /> : <Register />}
              />
              <Route path="/reset-password" element={<ForgotPassword />} />
              <Route path="/courses" element={<AllCourses />} />
              <Route path="/search" element={<SearchCourses />} />
              <Route
                path="/dashboard"
                element={userLoggedIn ? <Dashboard /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/courseSection/:courseId/:courseTitle"
                element={userLoggedIn ? <CourseContent /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/profile"
                element={userLoggedIn ? <UserProfile /> : <Navigate to="/login" replace />}
              />
              <Route path="/my-profile" element={<Navigate to="/profile" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <Footer />
        </Router>
      </div>
    </UserContext.Provider>
  );
}

export default App;
