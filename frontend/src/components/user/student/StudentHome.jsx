import React, { useEffect, useState } from 'react';
import AllCourses from '../../common/AllCourses';
import axiosInstance from '../../common/AxiosInstance';
import { Alert, Button, Card, Col, Container, Row } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { getErrorMessage } from '../../../utils/adminApi';
import { getRealtimeSocket } from '../../../utils/realtimeSocket';
import './StudentHome.css';

const StudentHome = () => {
  const [summary, setSummary] = useState({
    enrolledCourses: 0,
    completedCourses: 0,
    averageProgress: 0,
    availableCourses: 0,
    unreadCount: 0,
    points: 0,
    badges: [],
    streakDays: 0,
    wishlistCount: 0,
    reminderEnabled: false,
    reminderTime: '19:00',
    latestEnrolled: [],
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState('');

  const fetchSummary = async () => {
    setError('');
    try {
      const res = await axiosInstance.get('/api/user/student/dashboard', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (res?.data?.success) {
        setSummary(res.data.data || {});
      } else {
        setError(res?.data?.message || 'Unable to load dashboard summary');
      }
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load dashboard summary'));
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await axiosInstance.get('/api/user/student/leaderboard', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res?.data?.success) {
        setLeaderboard(res.data.data || []);
      }
    } catch (error) {
      // keep stable
    }
  };

  const toggleReminder = async () => {
    try {
      await axiosInstance.patch('/api/user/student/reminders', {
        reminderEnabled: !summary.reminderEnabled,
        reminderTime: summary.reminderTime || '19:00',
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      await fetchSummary();
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to update reminders'));
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchLeaderboard();
    const socket = getRealtimeSocket();
    const refresh = () => {
      fetchSummary();
      fetchLeaderboard();
    };
    socket.on('notification:new', refresh);
    socket.on('student:progress-updated', refresh);
    socket.on('student:gamification-updated', refresh);
    socket.on('student:wishlist-updated', refresh);
    socket.on('student:assignment-submitted', refresh);
    socket.on('assignment:graded', refresh);
    return () => {
      socket.off('notification:new', refresh);
      socket.off('student:progress-updated', refresh);
      socket.off('student:gamification-updated', refresh);
      socket.off('student:wishlist-updated', refresh);
      socket.off('student:assignment-submitted', refresh);
      socket.off('assignment:graded', refresh);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <Container fluid className="py-4">
        <motion.h1
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mb-4"
        >
          Welcome to Your Courses
        </motion.h1>

        {error && <Alert variant="warning">{error}</Alert>}
        <Row className="g-3 mb-4 align-items-stretch">
          <Col xs={6} md={4} lg={2}>
            <Card className="student-stat-card h-100">
              <Card.Body>
                <div className="student-stat-value">{summary.enrolledCourses || 0}</div>
                <div className="student-stat-label">Enrolled</div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6} md={4} lg={2}>
            <Card className="student-stat-card h-100">
              <Card.Body>
                <div className="student-stat-value">{summary.completedCourses || 0}</div>
                <div className="student-stat-label">Completed</div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6} md={4} lg={2}>
            <Card className="student-stat-card h-100">
              <Card.Body>
                <div className="student-stat-value">{summary.averageProgress || 0}%</div>
                <div className="student-stat-label">Avg Progress</div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6} md={4} lg={2}>
            <Card className="student-stat-card h-100">
              <Card.Body>
                <div className="student-stat-value">{summary.availableCourses || 0}</div>
                <div className="student-stat-label">Available</div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6} md={4} lg={2}>
            <Card className="student-stat-card h-100">
              <Card.Body>
                <div className="student-stat-value">{summary.unreadCount || 0}</div>
                <div className="student-stat-label">Alerts</div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6} md={4} lg={2}>
            <Card className="student-stat-card h-100">
              <Card.Body>
                <div className="student-stat-value">{summary.points || 0}</div>
                <div className="student-stat-label">Points</div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6} md={4} lg={2}>
            <Card className="student-stat-card h-100">
              <Card.Body>
                <div className="student-stat-value">{summary.streakDays || 0}</div>
                <div className="student-stat-label">Streak Days</div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6} md={4} lg={2}>
            <Card className="student-stat-card h-100">
              <Card.Body>
                <div className="student-stat-value">{summary.wishlistCount || 0}</div>
                <div className="student-stat-label">Wishlist</div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={6} md={4} lg={2} className="d-flex align-items-stretch">
            <div className="student-refresh-wrap w-100">
              <Button variant="outline-secondary" size="sm" onClick={fetchSummary}>
                Refresh
              </Button>
            </div>
          </Col>
        </Row>

        <Card className="mb-4 shadow-sm border-0">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="mb-1">Reminders</h6>
              <Button variant={summary.reminderEnabled ? "success" : "outline-secondary"} size="sm" onClick={toggleReminder}>
                {summary.reminderEnabled ? 'Enabled' : 'Enable Daily Reminder'}
              </Button>
            </div>
            <div className="small text-muted">Preferred time: {summary.reminderTime || '19:00'}</div>
          </Card.Body>
        </Card>

        <Card className="mb-4 shadow-sm border-0">
          <Card.Body>
            <h6 className="mb-2">Badges</h6>
            {summary.badges?.length > 0 ? summary.badges.map((badge) => (
              <span key={badge} className="badge bg-dark me-2 mb-2">{badge}</span>
            )) : <div className="small text-muted">Complete lessons and quizzes to unlock badges.</div>}
          </Card.Body>
        </Card>

        {summary.latestEnrolled?.length > 0 && (
          <Card className="mb-4 shadow-sm border-0">
            <Card.Body>
              <h6 className="mb-2">Recently Enrolled</h6>
              {summary.latestEnrolled.map((item) => (
                <div key={`${item.courseId}-${item.enrolledAt}`} className="small text-muted">
                  {item.title} by {item.educator}
                </div>
              ))}
            </Card.Body>
          </Card>
        )}

        <Card className="mb-4 shadow-sm border-0">
          <Card.Body>
            <h6 className="mb-2">Leaderboard</h6>
            {leaderboard.slice(0, 8).map((item) => (
              <div key={item.userId} className="small d-flex justify-content-between border-bottom py-1">
                <span>#{item.rank} {item.name}</span>
                <span>{item.points} pts</span>
              </div>
            ))}
          </Card.Body>
        </Card>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0, scale: 0.95 },
            visible: { opacity: 1, scale: 1, transition: { duration: 0.5, delay: 0.3 } }
          }}
        >
          <AllCourses />
        </motion.div>
      </Container>
    </motion.div>
  );
};

export default StudentHome;
