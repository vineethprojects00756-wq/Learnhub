import AdminSecurityModeration from '../admin/AdminSecurityModeration';
import AdminPlatformSettings from '../admin/AdminPlatformSettings';
import AdminFinancialControls from '../admin/AdminFinancialControls';
import AdminAnalyticsDashboard from '../admin/AdminAnalyticsDashboard';
import AdminCourseManagement from '../admin/AdminCourseManagement';
import React, { useContext, useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

import NavBar from './NavBar';
import UserHome from "./UserHome";
import AddCourse from '../user/teacher/AddCourse';
import AdminHome from '../admin/AdminHome';
import EnrolledCoursesWithProgress from '../user/student/EnrolledCoursesWithProgress';
import CourseContent from '../user/student/CourseContent';
import AdminAllCourses from '../admin/AllCourses';
import AllCourses from './AllCourses';
import UserProfile from './UserProfile';
import { UserContext } from '../../App';
import AdminUserManagement from '../admin/AdminUserManagement';
import TeacherAdvancedCenter from '../user/teacher/TeacherAdvancedCenter';

const Dashboard = () => {
  const user = useContext(UserContext);
  const location = useLocation();
  const [selectedComponent, setSelectedComponent] = useState('home');
  const role = (user?.userData?.type || "").toLowerCase();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const view = params.get('view');
    if (view) {
      setSelectedComponent(view);
    }
  }, [location.search]);

  const renderSelectedComponent = () => {
    if (role === 'admin') {
      switch (selectedComponent) {
        case 'home':
          return <AdminHome />;
        case 'courses':
          return <AdminAllCourses />;
        case 'users':
          return <AdminUserManagement />;
        case 'course-management':
          return <AdminCourseManagement />;
        case 'analytics-dashboard':
          return <AdminAnalyticsDashboard />;
        case 'financial-controls':
          return <AdminFinancialControls />;
        case 'platform-settings':
          return <AdminPlatformSettings />;
        case 'security-moderation':
          return <AdminSecurityModeration />;
        // Add more admin views here as needed
        default:
          return <AdminHome />;
      }
    } else {
      switch (selectedComponent) {
        case 'home':
          return <UserHome setSelectedComponent={setSelectedComponent} />;
        case 'addcourse':
          return <AddCourse setSelectedComponent={setSelectedComponent} />;
        case 'teacher-advanced':
          return <TeacherAdvancedCenter defaultSection="course" />;
        case 'teacher-course':
          return <TeacherAdvancedCenter defaultSection="course" />;
        case 'teacher-modules':
          return <TeacherAdvancedCenter defaultSection="modules" />;
        case 'teacher-versions':
          return <TeacherAdvancedCenter defaultSection="versions" />;
        case 'teacher-assignments':
          return <TeacherAdvancedCenter defaultSection="assignments" />;
        case 'teacher-monitoring':
          return <TeacherAdvancedCenter defaultSection="monitoring" />;
        case 'teacher-communication':
          return <TeacherAdvancedCenter defaultSection="communication" />;
        case 'teacher-discussion':
          return <TeacherAdvancedCenter defaultSection="discussion" />;
        case 'teacher-earnings':
          return <TeacherAdvancedCenter defaultSection="earnings" />;
        case 'enrolledcourse':
          return <EnrolledCoursesWithProgress />;
        case 'enrolledcourses':
          return <EnrolledCoursesWithProgress />;
        case 'coursesection':
          return <CourseContent />;
        case 'courses':
          return <AllCourses />;
        case 'profile':
          return <UserProfile />;
        default:
          return <UserHome />;
      }
    }
  };

  return (
    <>
      <NavBar setSelectedComponent={setSelectedComponent} />
      <Container className="my-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedComponent}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            {renderSelectedComponent()}
          </motion.div>
        </AnimatePresence>
      </Container>
    </>
  );
};

export default Dashboard;
