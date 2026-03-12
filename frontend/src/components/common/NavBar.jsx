import React, { useContext, useEffect, useState } from 'react'
import { Navbar, Nav, Button, Container, Offcanvas, Badge } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { UserContext } from '../../App';
import axiosInstance from './AxiosInstance';
import { getRealtimeSocket } from '../../utils/realtimeSocket';

const NavBar = ({ setSelectedComponent }) => {
  const user = useContext(UserContext)
  const navigate = useNavigate();
  const role = (user?.userData?.type || '').toLowerCase();
  const isLearnerOrTeacher = role === 'teacher' || role === 'student';
  const [showMenu, setShowMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  }

  const handleOptionClick = (component) => {
    if (typeof setSelectedComponent === 'function') {
      setSelectedComponent(component);
      return;
    }

    navigate(`/dashboard?view=${encodeURIComponent(component)}`);
  };

  const handleMenuAction = (component) => {
    handleOptionClick(component);
    setShowMenu(false);
  };

  const fetchNotifications = async () => {
    if (!isLearnerOrTeacher) return;
    try {
      const res = await axiosInstance.get('/api/user/notifications', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (res?.data?.success) {
        setNotifications(res.data.data || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (error) {
      // Ignore notification polling errors to keep navbar stable.
    }
  };

  const markNotificationRead = async (notificationId) => {
    try {
      await axiosInstance.put(`/api/user/notifications/${notificationId}/read`, {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setNotifications((prev) =>
        prev.map((item) => (item._id === notificationId ? { ...item, isRead: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      // no-op
    }
  };

  const markAllRead = async () => {
    try {
      await axiosInstance.put('/api/user/notifications/read-all', {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      // no-op
    }
  };

  useEffect(() => {
    if (!isLearnerOrTeacher) return;
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30000);
    const socket = getRealtimeSocket();
    const refresh = () => fetchNotifications();
    socket.on('notification:new', refresh);
    socket.on('student:reminder-updated', refresh);
    return () => {
      clearInterval(id);
      socket.off('notification:new', refresh);
      socket.off('student:reminder-updated', refresh);
    };
  }, [isLearnerOrTeacher]);

  if (!user) {
    return null;
  }

  return (
    <Navbar expand="lg" className="bg-body-tertiary">
      <Container fluid>
        <Navbar.Brand>
          <h3>LearnHub: Your Center for Skill Enhancement</h3>
        </Navbar.Brand>
        <div className="ms-auto d-flex align-items-center gap-2">
          <Link to="/dashboard" className="text-decoration-none text-dark d-none d-md-inline">Home</Link>
          <Link to="/search" className="text-decoration-none text-dark d-none d-md-inline">Search</Link>
          <Link to="/profile" className="text-decoration-none text-dark d-none d-lg-inline">Profile</Link>
          {isLearnerOrTeacher && (
            <Button variant="outline-primary" size="sm" onClick={() => setShowMenu(true)}>
              Alerts {unreadCount > 0 && <Badge bg="danger">{unreadCount}</Badge>}
            </Button>
          )}
          <small className="text-muted d-none d-md-inline">Hi {user?.userData?.name || 'User'}</small>
          <Button
            variant="outline-secondary"
            onClick={() => setShowMenu(true)}
            aria-label="Open menu"
          >
            Menu
          </Button>
        </div>
      </Container>

      <Offcanvas show={showMenu} onHide={() => setShowMenu(false)} placement="start">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Menu</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Nav className="flex-column">
            <Link to="/dashboard" className="mb-2 text-decoration-none text-dark" onClick={() => setShowMenu(false)}>Home</Link>
            <Link to="/search" className="mb-2 text-decoration-none text-dark" onClick={() => setShowMenu(false)}>Search Courses</Link>

            {role === 'teacher' && (
              <>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('addcourse')}>
                  Add Course
                </button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('teacher-course')}>Course Management</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('teacher-modules')}>Modules and Uploads</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('teacher-versions')}>Version History</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('teacher-assignments')}>Assignments</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('teacher-monitoring')}>Student Monitoring</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('teacher-communication')}>Communication</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('teacher-discussion')}>Discussion Board</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('teacher-earnings')}>Earnings</button>
              </>
            )}

            {role === 'admin' && (
              <>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('courses')}>Courses</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('users')}>Users</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('course-management')}>Course Management</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('analytics-dashboard')}>Analytics</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('financial-controls')}>Financial</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('platform-settings')}>Platform</button>
                <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('security-moderation')}>Security</button>
              </>
            )}

            {role === 'student' && (
              <button type="button" className="nav-action-link mb-2 text-start" onClick={() => handleMenuAction('enrolledcourse')}>
                Enrolled Courses
              </button>
            )}

            {isLearnerOrTeacher && (
              <>
                <hr />
                <div className="d-flex justify-content-between align-items-center">
                  <strong>Notifications</strong>
                  {unreadCount > 0 && (
                    <button type="button" className="nav-action-link" onClick={markAllRead}>
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 && (
                  <small className="text-muted mt-2">No notifications yet.</small>
                )}
                {notifications.slice(0, 6).map((item) => (
                  <div key={item._id} className="border rounded p-2 my-2">
                    <div className="d-flex justify-content-between align-items-start">
                      <small className="fw-bold">{item.title}</small>
                      {!item.isRead && (
                        <button
                          type="button"
                          className="nav-action-link text-primary"
                          onClick={() => markNotificationRead(item._id)}
                        >
                          Read
                        </button>
                      )}
                    </div>
                    <small className="text-muted">{item.message}</small>
                  </div>
                ))}
              </>
            )}

            <Link to="/profile" className="mb-2 text-decoration-none text-dark" onClick={() => setShowMenu(false)}>Profile</Link>
            <Button onClick={handleLogout} size="sm" variant="outline-danger" className="mt-2">Log Out</Button>
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>
    </Navbar>
  )
}

export default NavBar
