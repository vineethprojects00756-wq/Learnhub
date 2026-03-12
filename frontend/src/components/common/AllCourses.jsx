import React, { useState, useEffect, useContext } from 'react';
import axiosInstance from './AxiosInstance';
import { Button, Modal, Form } from 'react-bootstrap';
import { UserContext } from '../../App';
import { Link, useNavigate } from 'react-router-dom';
import { MDBCol, MDBInput, MDBRow } from "mdb-react-ui-kit";
import { motion } from 'framer-motion';
import { getRealtimeSocket } from '../../utils/realtimeSocket';
import './AllCourses.css';

const AllCourses = () => {
  const navigate = useNavigate();
  const user = useContext(UserContext);
  const [allCourses, setAllCourses] = useState([]);
  const [filterTitle, setFilterTitle] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState([]);
  const [cardDetails, setCardDetails] = useState({
    cardholdername: '',
    cardnumber: '',
    cvvcode: '',
    expmonthyear: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [wishlistCourseIds, setWishlistCourseIds] = useState([]);
  const [previewByCourse, setPreviewByCourse] = useState({});

  const handleChange = (e) => {
    setCardDetails({ ...cardDetails, [e.target.name]: e.target.value });
  };

  const handleShow = (courseIndex, coursePrice, courseId, courseTitle) => {
    if (Number(coursePrice || 0) === 0 || coursePrice === 'free') {
      handleSubmit(courseId);
      return navigate(`/courseSection/${courseId}/${courseTitle}`);
    }
    const updatedShowModal = [...showModal];
    updatedShowModal[courseIndex] = true;
    setShowModal(updatedShowModal);
  };

  const handleClose = (courseIndex) => {
    const updatedShowModal = [...showModal];
    updatedShowModal[courseIndex] = false;
    setShowModal(updatedShowModal);
  };

  const getAllCoursesUser = async () => {
    setIsLoading(true);
    setError('');
    try {
      const config = {
        method: 'get',
      };
      
      const token = localStorage.getItem('token');
      if (token) {
        config.headers = {
          Authorization: `Bearer ${token}`,
        };
      }

      const res = await axiosInstance.get(`/api/user/getallcourses`, config);
      if (res.data.success) {
        setAllCourses(res.data.data);
        setShowModal(Array(res.data.data.length).fill(false));
      } else {
        setError(res.data.message || 'Failed to load courses');
      }
    } catch (error) {
      setError(error?.response?.data?.message || 'Failed to load courses');
      setAllCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getAllCoursesUser();
  }, []);

  const fetchWishlist = async () => {
    if (!user.userLoggedIn) return setWishlistCourseIds([]);
    try {
      const res = await axiosInstance.get('/api/user/student/wishlist/course-ids');
      if (res?.data?.success) setWishlistCourseIds(res.data.data || []);
    } catch (error) {
      // keep stable
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, [user.userLoggedIn]);

  useEffect(() => {
    if (!user.userLoggedIn) return;
    const socket = getRealtimeSocket();
    const onWishlist = ({ courseId, inWishlist }) => {
      setWishlistCourseIds((prev) => {
        const has = prev.includes(String(courseId));
        if (inWishlist && !has) return [...prev, String(courseId)];
        if (!inWishlist && has) return prev.filter((id) => id !== String(courseId));
        return prev;
      });
    };
    socket.on('student:wishlist-updated', onWishlist);
    return () => {
      socket.off('student:wishlist-updated', onWishlist);
    };
  }, [user.userLoggedIn]);

  const isPaidCourse = (course) => Number(course.finalPrice ?? course.rawPrice ?? course.C_price ?? 0) > 0;

  const handleSubmit = async (courseId) => {
    const course = allCourses.find(c => c._id === courseId);
    const isFreeCourse = Number(course?.finalPrice ?? course?.C_price ?? 0) === 0 || course?.C_price === 'free';

    // Validate card details
    if (!isFreeCourse && (!cardDetails.cardholdername || !cardDetails.cardnumber || !cardDetails.cvvcode || !cardDetails.expmonthyear)) {
      // ...existing code...
      return;
    }

    // Basic card number validation
    if (!isFreeCourse && cardDetails.cardnumber.length < 13) {
      // ...existing code...
      return;
    }

    if (!isFreeCourse && cardDetails.cvvcode.length < 3) {
      // ...existing code...
      return;
    }

    try {
      const res = await axiosInstance.post(`/api/user/enrolledcourse/${courseId}`, cardDetails, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (res.data.success || res.data.message) {
        // ...existing code...
        // Reset form
        setCardDetails({
          cardholdername: '',
          cardnumber: '',
          cvvcode: '',
          expmonthyear: '',
        });
        navigate(`/courseSection/${courseId}/${course?.C_title || 'Course'}`);
      }
    } catch (error) {
      // ...existing code...
      // ...existing code...
    }
  };

  const toggleWishlist = async (courseId) => {
    try {
      const res = await axiosInstance.post(`/api/user/student/wishlist/${courseId}/toggle`);
      if (!res?.data?.success) {
        alert(res?.data?.message || 'Unable to update wishlist');
      }
    } catch (error) {
      alert(error?.response?.data?.message || 'Unable to update wishlist');
    }
  };

  const loadPreview = async (courseId) => {
    if (previewByCourse[courseId]) {
      setPreviewByCourse((prev) => ({ ...prev, [courseId]: null }));
      return;
    }
    try {
      const res = await axiosInstance.get(`/api/user/courses/${courseId}/preview`);
      if (res?.data?.success) {
        setPreviewByCourse((prev) => ({ ...prev, [courseId]: res.data.data }));
      }
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to load preview');
    }
  };

  return (
    <>
      <div className="all-courses-header mt-4">
        {error && <p className="text-warning mb-2">{error}</p>}
        <p className="mb-2 fw-semibold">Search By:</p>
        <div className="all-courses-filter-row">
          <input
            className="form-control"
            type="text"
            placeholder="Title"
            value={filterTitle}
            onChange={(e) => setFilterTitle(e.target.value)}
          />
          <select
            className="form-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Courses</option>
            <option value="Paid">Paid</option>
            <option value="Free">Free</option>
          </select>
        </div>
      </div>

      <div className="p-3">
        {isLoading ? (
          <p className="text-center">Loading courses...</p>
        ) : allCourses?.length > 0 ? (
          <div className="row g-4">
            {allCourses
              .filter(
                (course) =>
                  filterTitle === '' ||
                  course.C_title?.toLowerCase().includes(filterTitle.toLowerCase())
              )
              .filter((course) =>
                filterType === 'Free'
                  ? !isPaidCourse(course)
                  : filterType === 'Paid'
                  ? isPaidCourse(course)
                  : true
              )
              .map((course, index) => (
                <div key={course._id} className="col-12 col-md-6 col-xl-4">
                  <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="course-tile h-100"
                  >
                    <div className="course-tile-body">
                      <h2 className="course-tile-title">{course.C_title}</h2>
                      <p className="course-tile-category mb-1">{course.C_categories}</p>
                      <p className="course-tile-educator mb-2">by {course.C_educator}</p>
                      {course.featured && <p className="text-success small mb-2">Featured Course</p>}
                      <p className="mb-1">Sections: {course.sections?.length || 0}</p>
                      <p className="mb-1">
                        Price (Rs.): {Number(course.finalPrice ?? course.C_price ?? 0) === 0 ? 'Free' : (course.finalPrice ?? course.C_price)}
                        {Number(course.discount || 0) > 0 && ` (${course.discount}% off)`}
                      </p>
                      <p className="mb-3">Enrolled: {course.enrolled || 0}</p>

                      <div className="mt-auto">
                        {user.userLoggedIn ? (
                          <>
                            <Button
                              variant="outline-dark"
                              size="sm"
                              onClick={() => handleShow(index, course.finalPrice ?? course.C_price, course._id, course.C_title)}
                            >
                              Start Course
                            </Button>
                            <Button
                              className="ms-2"
                              variant={wishlistCourseIds.includes(String(course._id)) ? "dark" : "outline-secondary"}
                              size="sm"
                              onClick={() => toggleWishlist(course._id)}
                            >
                              {wishlistCourseIds.includes(String(course._id)) ? 'Wishlisted' : 'Wishlist'}
                            </Button>
                            <Button className="ms-2" variant="outline-primary" size="sm" onClick={() => loadPreview(course._id)}>
                              {previewByCourse[course._id] ? 'Hide Preview' : 'Preview'}
                            </Button>
                            <Modal show={showModal[index]} onHide={() => handleClose(index)} centered>
                              <Modal.Header closeButton>
                                <Modal.Title>Payment for {course.C_title}</Modal.Title>
                              </Modal.Header>
                              <Modal.Body>
                                <p>Educator: {course.C_educator}</p>
                                <p>Price: {Number(course.finalPrice ?? course.C_price ?? 0) === 0 ? 'Free' : (course.finalPrice ?? course.C_price)}</p>
                                <Form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSubmit(course._id);
                                  }}
                                >
                                  <MDBInput
                                    className="mb-2"
                                    label="Card Holder Name"
                                    name="cardholdername"
                                    value={cardDetails.cardholdername}
                                    onChange={handleChange}
                                    type="text"
                                    placeholder="Cardholder's Name"
                                    required
                                  />
                                  <MDBInput
                                    className="mb-2"
                                    label="Card Number"
                                    name="cardnumber"
                                    value={cardDetails.cardnumber}
                                    onChange={handleChange}
                                    type="number"
                                    placeholder="1234 5678 9012 3457"
                                    required
                                  />
                                  <MDBRow className="mb-2">
                                    <MDBCol md="6">
                                      <MDBInput
                                        label="Expiration"
                                        name="expmonthyear"
                                        value={cardDetails.expmonthyear}
                                        onChange={handleChange}
                                        placeholder="MM/YYYY"
                                        required
                                      />
                                    </MDBCol>
                                    <MDBCol md="6">
                                      <MDBInput
                                        label="CVV"
                                        name="cvvcode"
                                        value={cardDetails.cvvcode}
                                        onChange={handleChange}
                                        type="number"
                                        placeholder="123"
                                        required
                                      />
                                    </MDBCol>
                                  </MDBRow>
                                  <div className="d-flex justify-content-end">
                                    <Button variant="secondary" className="mx-2" onClick={() => handleClose(index)}>
                                      Close
                                    </Button>
                                    <Button type="submit" variant="primary">
                                      Pay Now
                                    </Button>
                                  </div>
                                </Form>
                              </Modal.Body>
                            </Modal>
                            {previewByCourse[course._id]?.previewLessons?.length > 0 && (
                              <div className="mt-3 border rounded p-2 bg-light">
                                <strong className="small">Preview Lessons</strong>
                                {previewByCourse[course._id].previewLessons.map((lesson) => (
                                  <div className="small text-muted" key={`${course._id}-${lesson.sectionId}`}>
                                    {lesson.sectionId + 1}. {lesson.title}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <Link to="/login">
                            <Button variant="outline-dark" size="sm">
                              Start Course
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-center">No courses at the moment</p>
        )}
      </div>
    </>
  );
};

export default AllCourses;
