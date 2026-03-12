import React, { useState, useEffect } from 'react';
import { Alert, Button as BsButton, Container, Row, Col, ProgressBar } from 'react-bootstrap';
import axiosInstance from '../../common/AxiosInstance';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@mui/material';
import { getErrorMessage } from '../../../utils/adminApi';
import { getRealtimeSocket } from '../../../utils/realtimeSocket';

const EnrolledCoursesWithProgress = () => {
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchEnrolledCourses = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await axiosInstance.get('/api/user/getallcoursesuser', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (res.data.success) {
        setEnrolledCourses(res.data.data);
      } else {
        setError(res.data.message || 'Unable to load enrolled courses');
      }
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to load enrolled courses'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrolledCourses();
    const socket = getRealtimeSocket();
    const refresh = () => fetchEnrolledCourses();
    socket.on('student:progress-updated', refresh);
    socket.on('student:enrolled-course', refresh);
    return () => {
      socket.off('student:progress-updated', refresh);
      socket.off('student:enrolled-course', refresh);
    };
  }, []);

  const calculateProgress = (course) => {
    if (!course.sections || course.sections.length === 0) return 0;
    const completedSections = course.progressCount ?? course.completedSections?.length ?? 0;
    return Math.round((completedSections / course.sections.length) * 100);
  };

  const getProgressColor = (progress) => {
    if (progress === 100) return 'success';
    if (progress >= 75) return 'info';
    if (progress >= 50) return 'warning';
    return 'danger';
  };

  if (isLoading) {
    return (
      <Container className="py-5">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-4"
      >
        Your Enrolled Courses
      </motion.h2>
      <div className="d-flex align-items-center gap-2 mb-3">
        <BsButton size="sm" variant="outline-secondary" onClick={fetchEnrolledCourses} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </BsButton>
      </div>
      {error && <Alert variant="warning">{error}</Alert>}

      {enrolledCourses?.length > 0 ? (
        <Row className="g-4">
          {enrolledCourses.map((course, index) => {
            const progress = calculateProgress(course);
            const progressColor = getProgressColor(progress);

            return (
              <Col lg={6} key={course._id}>
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="card h-100 shadow-sm"
                >
                  <div className="card-body">
                    <h5 className="card-title">{course.C_title}</h5>
                    <p className="card-text text-muted small">
                      by <strong>{course.C_educator}</strong>
                    </p>

                    {/* Course Stats */}
                    <div className="mb-3 p-3 bg-light rounded">
                      <Row className="g-2">
                        <Col xs={6}>
                          <small className="text-muted">Sections</small>
                          <p className="mb-0">
                            <strong>{course.sections?.length || 0}</strong>
                          </p>
                        </Col>
                        <Col xs={6}>
                          <small className="text-muted">Completed</small>
                          <p className="mb-0">
                            <strong>
                              {course.completedSections?.length || 0}/
                              {course.sections?.length || 0}
                            </strong>
                          </p>
                        </Col>
                      </Row>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label className="form-label mb-0">
                          <small>Course Progress</small>
                        </label>
                        <span className="badge bg-secondary">{progress}%</span>
                      </div>
                      <ProgressBar
                        now={progress}
                        variant={progressColor}
                        striped
                        animated={progress < 100}
                        className="mb-0"
                      />
                    </div>

                    {/* Progress Message */}
                    <p className="small text-muted mb-3">
                      {progress === 100
                        ? 'Congratulations! Course completed.'
                        : progress === 0
                        ? 'Get started with your course.'
                        : `Keep going! You're ${progress}% done.`}
                    </p>
                    {progress < 100 && (
                      <p className="small text-muted mb-2">
                        Continue from section {Number(course.lastAccessedSection || 0) + 1}
                      </p>
                    )}

                    {/* Action Button */}
                    <Link to={`/courseSection/${course._id}/${course.C_title}`}>
                      <Button fullWidth variant="contained" color="primary">
                        {progress === 100 ? 'Review Course' : 'Continue Learning'}
                      </Button>
                    </Link>

                    {/* Certificate Info */}
                    {progress === 100 && (
                      <div className="mt-3 p-2 bg-success bg-opacity-10 border border-success rounded">
                        <small className="text-success">
                          ✓ Certificate available upon course completion
                        </small>
                      </div>
                    )}
                  </div>
                </motion.div>
              </Col>
            );
          })}
        </Row>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-5"
        >
          <p className="text-muted fs-5">
            You haven't enrolled in any courses yet.
          </p>
          <Link to="/courses">
            <Button variant="contained">Explore Courses</Button>
          </Link>
        </motion.div>
      )}
    </Container>
  );
};

export default EnrolledCoursesWithProgress;
