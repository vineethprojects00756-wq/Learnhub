import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Container, Row, Col, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import axiosInstance from '../../common/AxiosInstance';
import { getErrorMessage } from '../../../utils/adminApi';

const TeacherHome = ({ setSelectedComponent }) => {
  const [allCourses, setAllCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [summary, setSummary] = useState({
    totalCourses: 0,
    approvedCourses: 0,
    pendingCourses: 0,
    archivedCourses: 0,
    totalEnrollments: 0,
    unreadCount: 0,
  });

  const getAllCoursesUser = async () => {
    setIsLoading(true);
    setMessage('');
    try {
      const res = await axiosInstance.get(`/api/user/getallcoursesteacher`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (res.data.success) {
        setAllCourses(res.data.data);
      } else {
        setMessage(res.data.message || 'Unable to load your courses');
      }
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to load your courses'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getAllCoursesUser();
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const res = await axiosInstance.get('/api/user/teacher/dashboard', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (res?.data?.success) {
        setSummary(res.data.data || {});
      }
    } catch (error) {
      // keep UI usable even if summary endpoint fails
    }
  };

  const toggleDescription = (courseId) => {
    setAllCourses((prevCourses) =>
      prevCourses.map((course) =>
        course._id === courseId
          ? { ...course, showFullDescription: !course.showFullDescription }
          : course
      )
    );
  };

  const deleteCourse = async (courseId) => {
    const confirmation = window.confirm('Are you sure you want to delete?');
    if (!confirmation) return;

    setDeletingId(courseId);
    setMessage('');
    try {
      const res = await axiosInstance.delete(`/api/user/deletecourse/${courseId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (res.data.success) {
        setMessage('Course deleted successfully');
        getAllCoursesUser();
      } else {
        setMessage(res.data.message || 'Unable to delete course');
      }
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to delete course'));
    } finally {
      setDeletingId('');
    }
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Your Courses</h4>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-primary" onClick={() => setSelectedComponent && setSelectedComponent('teacher-course')}>
            Teacher Center
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => {
              getAllCoursesUser();
              fetchSummary();
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>
      <Row className="g-2 mb-3">
        <Col md={2}><Alert variant="light" className="mb-0"><strong>{summary.totalCourses || 0}</strong><div>Total</div></Alert></Col>
        <Col md={2}><Alert variant="success" className="mb-0"><strong>{summary.approvedCourses || 0}</strong><div>Approved</div></Alert></Col>
        <Col md={2}><Alert variant="warning" className="mb-0"><strong>{summary.pendingCourses || 0}</strong><div>Pending</div></Alert></Col>
        <Col md={2}><Alert variant="secondary" className="mb-0"><strong>{summary.archivedCourses || 0}</strong><div>Archived</div></Alert></Col>
        <Col md={2}><Alert variant="info" className="mb-0"><strong>{summary.totalEnrollments || 0}</strong><div>Enrollments</div></Alert></Col>
        <Col md={2}><Alert variant="primary" className="mb-0"><strong>{summary.unreadCount || 0}</strong><div>Alerts</div></Alert></Col>
      </Row>
      {message && <Alert variant="info">{message}</Alert>}

      {isLoading ? (
        <div className="text-center py-4">
          <Spinner animation="border" />
        </div>
      ) : (
      <Row className="g-4">
        {allCourses?.length > 0 ? (
          allCourses.map((course) => (
            <Col key={course._id} md={6} lg={4}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="shadow-sm border-0 rounded-3">
                  <Card.Body>
                    <Card.Title className="fw-bold">{course.C_title}</Card.Title>
                    <Card.Text>
                      <p>
                        <strong>Status: </strong>
                        {course.archived
                          ? 'Archived'
                          : course.approved
                          ? 'Approved'
                          : 'Pending Approval'}
                        {course.featured ? ' | Featured' : ''}
                      </p>
                      <p>
                        <strong>Description: </strong>
                        {course.showFullDescription
                          ? course.C_description
                          : `${course.C_description.slice(0, 10)}...`}{' '}
                        {course.C_description.length > 10 && (
                          <motion.span
                            className="text-primary"
                            style={{ cursor: 'pointer' }}
                            whileHover={{ scale: 1.1 }}
                            onClick={() => toggleDescription(course._id)}
                          >
                            {course.showFullDescription ? 'Read Less' : 'Read More'}
                          </motion.span>
                        )}
                      </p>
                      <p>
                        <strong>Category: </strong>
                        {course.C_categories}
                      </p>
                      <p>
                        <strong>Sections: </strong> {course.sections.length}
                      </p>
                      <p className="text-muted">
                        <strong>Enrolled students: </strong> {course.enrolled}
                      </p>
                    </Card.Text>
                    <motion.div whileTap={{ scale: 0.9 }} className="text-end">
                      <Button variant="outline-primary" className="me-2" onClick={() => {
                        localStorage.setItem('editingCourseId', course._id);
                        if (setSelectedComponent) setSelectedComponent('addcourse');
                      }}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => deleteCourse(course._id)} disabled={deletingId === course._id}>
                        {deletingId === course._id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </motion.div>
                  </Card.Body>
                </Card>
              </motion.div>
            </Col>
          ))
        ) : (
          <div className="text-center text-muted">No courses found!!</div>
        )}
      </Row>
      )}
    </Container>
  );
};

export default TeacherHome;
