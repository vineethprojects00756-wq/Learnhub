import React, { useState, useEffect } from 'react';
import { Button, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Alert } from '@mui/material';
import axiosInstance from '../common/AxiosInstance';
import { getErrorMessage } from '../../utils/adminApi';

const AdminCourseManagement = () => {
  const [courses, setCourses] = useState([]);
  const [globalDiscount, setGlobalDiscount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState('');

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get('api/admin/getallcourses');
      if (res.data.success) setCourses(res.data.data);
      else setMessage(res.data.message || 'Unable to fetch courses');
    } catch (err) {
      setMessage(getErrorMessage(err, 'Failed to fetch courses'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCourses(); }, []);

  const handleCourseAction = async (id, endpoint, successMessage, key) => {
    setActionKey(key);
    setMessage('');
    try {
      const res = await axiosInstance.put(`api/admin/${endpoint}/${id}`, {});
      setMessage(res.data.message || successMessage);
      await fetchCourses();
    } catch (err) {
      setMessage(getErrorMessage(err, 'Course action failed'));
    } finally {
      setActionKey('');
    }
  };

  const handleGlobalDiscount = async () => {
    const parsed = Number(globalDiscount);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      setMessage('Discount should be a number between 0 and 100');
      return;
    }

    setActionKey('global-discount');
    setMessage('');
    try {
      const res = await axiosInstance.put('api/admin/apply-global-discount', { discount: parsed });
      setMessage(res.data.message || 'Global discount applied');
      setGlobalDiscount('');
      await fetchCourses();
    } catch (err) {
      setMessage(getErrorMessage(err, 'Failed to apply global discount'));
    } finally {
      setActionKey('');
    }
  };

  return (
    <Paper style={{ padding: 24, margin: '24px 0' }}>
      <Typography variant="h6">Course Management</Typography>
      {message && <Alert severity="info" style={{ margin: '12px 0' }}>{message}</Alert>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TextField
          label="Global Discount (%)"
          value={globalDiscount}
          onChange={e => setGlobalDiscount(e.target.value)}
          disabled={actionKey === 'global-discount'}
        />
        <Button
          variant="contained"
          onClick={handleGlobalDiscount}
          disabled={actionKey === 'global-discount'}
        >
          {actionKey === 'global-discount' ? 'Applying...' : 'Apply Discount'}
        </Button>
      </div>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Educator</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && courses.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">No courses found</TableCell>
              </TableRow>
            )}
            {courses.map(course => (
              <TableRow key={course._id}>
                <TableCell>{course.C_title}</TableCell>
                <TableCell>{course.C_educator}</TableCell>
                <TableCell>{course.C_categories}</TableCell>
                <TableCell>{course.C_price}</TableCell>
                <TableCell>{course.approved ? 'Approved' : 'Pending'}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    color="success"
                    disabled={actionKey === `approve-${course._id}`}
                    onClick={() => handleCourseAction(course._id, 'approve-course', 'Course approved', `approve-${course._id}`)}
                  >
                    {actionKey === `approve-${course._id}` ? 'Approving...' : 'Approve'}
                  </Button>
                  <Button
                    size="small"
                    color="info"
                    disabled={actionKey === `feature-${course._id}`}
                    onClick={() => handleCourseAction(course._id, 'feature-course', 'Course featured', `feature-${course._id}`)}
                  >
                    {actionKey === `feature-${course._id}` ? 'Featuring...' : 'Feature'}
                  </Button>
                  <Button
                    size="small"
                    color="warning"
                    disabled={actionKey === `archive-${course._id}`}
                    onClick={() => handleCourseAction(course._id, 'archive-course', 'Course archived', `archive-${course._id}`)}
                  >
                    {actionKey === `archive-${course._id}` ? 'Archiving...' : 'Archive'}
                  </Button>
                  {/* Add more actions: edit, categorize, control pricing, etc. */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default AdminCourseManagement;
