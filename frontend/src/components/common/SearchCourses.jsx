import AddCourse from '../user/teacher/AddCourse';
import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import axiosInstance from './AxiosInstance';
import { motion } from 'framer-motion';
import { Button } from '@mui/material';
import NavBar from './NavBar';
import { UserContext } from '../../App';
import { useNavigate } from 'react-router-dom';

const SearchCourses = () => {
  const navigate = useNavigate();
  const user = useContext(UserContext);
  const [allCourses, setAllCourses] = useState([]);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPrice, setSelectedPrice] = useState('');
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState('search');
  const [error, setError] = useState('');

  const isPaidCourse = (course) => /\d/.test(course.C_price);

  const fetchAllCourses = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please login to search courses');
        setIsLoading(false);
        return;
      }

      const res = await axiosInstance.get('/api/user/getallcourses', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.data.success) {
        setAllCourses(res.data.data);
        setFilteredCourses(res.data.data);
        const uniqueCategories = [...new Set(res.data.data.map((c) => c.C_categories))];
        setCategories(uniqueCategories);
      } else {
        setError('Failed to load courses');
      }
    } catch (error) {
      // ...existing code...
      setError('Error loading courses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllCourses();
  }, []);

  useEffect(() => {
    let results = allCourses;

    // Filter by search term
    if (searchTerm) {
      results = results.filter(
        (course) =>
          course.C_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          course.C_educator?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory) {
      results = results.filter((course) => course.C_categories === selectedCategory);
    }

    // Filter by price
    if (selectedPrice === 'free') {
      results = results.filter((course) => !isPaidCourse(course));
    } else if (selectedPrice === 'paid') {
      results = results.filter((course) => isPaidCourse(course));
    }

    setFilteredCourses(results);
  }, [searchTerm, selectedCategory, selectedPrice, allCourses]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedPrice('');
  };

  const handleNavbarSelection = (component) => {
    if (component === 'addcourse') {
      setSelectedComponent('addcourse');
      return;
    }
    navigate(`/dashboard?view=${encodeURIComponent(component)}`);
  };

  return (
    <>
      {user?.userLoggedIn && <NavBar setSelectedComponent={handleNavbarSelection} />}
      {selectedComponent === 'addcourse' ? (
        <AddCourse setSelectedComponent={setSelectedComponent} />
      ) : (
        <Container className="py-5">
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-4"
          >
            Search & Explore Courses
          </motion.h2>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="alert alert-warning text-center mb-4"
              role="alert"
            >
              {error}
              {error.includes('login') && (
                <div className="mt-2">
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => navigate('/login')}
                  >
                    Go to Login
                  </Button>
                </div>
              )}
            </motion.div>
          )}

        {/* Search & Filter Section */}
        {!error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-light p-4 rounded mb-4"
        >
          <Row className="g-3">
            <Col md={4}>
              <input
                type="text"
                className="form-control"
                placeholder="Search by course name or instructor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </Col>
            <Col md={3}>
              <select
                className="form-select"
                value={selectedPrice}
                onChange={(e) => setSelectedPrice(e.target.value)}
              >
                <option value="">All Prices</option>
                <option value="free">Free Courses</option>
                <option value="paid">Paid Courses</option>
              </select>
            </Col>
            <Col md={2}>
              <Button
                variant="outlined"
                fullWidth
                onClick={resetFilters}
                className="h-100"
              >
                Clear Filters
              </Button>
            </Col>
          </Row>
        </motion.div>
        )}

        {/* Results Count */}
        {!error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted mb-3"
        >
          Found <strong>{filteredCourses.length}</strong> course(s)
        </motion.p>
        )}

        {/* Courses Grid */}
        {!error && (
        <>
        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : filteredCourses.length > 0 ? (
          <Row className="g-4">
            {filteredCourses.map((course, index) => (
              <Col md={6} lg={4} key={course._id}>
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="card h-100 shadow-sm hover-shadow"
                >
                  <div className="card-body">
                    <h5 className="card-title">{course.C_title}</h5>
                    <p className="card-text text-muted small">{course.C_categories}</p>
                    <p className="card-text small">
                      <strong>Instructor:</strong> {course.C_educator}
                    </p>
                    <p className="card-text small">
                      <strong>Sections:</strong> {course.sections?.length || 0}
                    </p>
                    <p className="card-text small">
                      <strong>Enrolled:</strong> {course.enrolled || 0} students
                    </p>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="badge bg-primary">
                        {isPaidCourse(course) ? `Rs.${course.C_price}` : 'Free'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </Col>
            ))}
          </Row>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-5"
          >
            <p className="text-muted fs-5">No courses found matching your criteria.</p>
          </motion.div>
        )}
        </>
        )}
        </Container>
      )}
    </>
  );
};

export default SearchCourses;
