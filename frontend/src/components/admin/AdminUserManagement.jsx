import React, { useState, useEffect } from 'react';
import { Button, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Select, MenuItem, Alert } from '@mui/material';
import axiosInstance from '../common/AxiosInstance';
import { getErrorMessage } from '../../utils/adminApi';

const AdminUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'student' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosInstance.get('api/admin/getallusers');
      if (res.data.success) setUsers(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load users'));
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async () => {
    try {
      setError('');
      const endpoint = newUser.role === 'teacher' ? 'create-teacher' : 'create-student';
      const res = await axiosInstance.post(`api/admin/${endpoint}`, newUser);
      if (res.data.success) {
        setNewUser({ name: '', email: '', password: '', role: 'student' });
        fetchUsers();
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create user'));
    }
  };

  const handleSuspend = async (id) => {
    await axiosInstance.put(`api/admin/suspend-user/${id}`, {});
    fetchUsers();
  };

  const handleDelete = async (id) => {
    await axiosInstance.delete(`api/admin/deleteuser/${id}`);
    fetchUsers();
  };

  return (
    <Paper style={{ padding: 24, margin: '24px 0' }}>
      <Typography variant="h6">User Management</Typography>
      {error && <Alert severity="error" style={{ margin: '12px 0' }}>{error}</Alert>}
      {loading && <Typography variant="body2">Loading users...</Typography>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TextField label="Name" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
        <TextField label="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
        <TextField label="Password" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
        <Select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
          <MenuItem value="student">Student</MenuItem>
          <MenuItem value="teacher">Teacher</MenuItem>
        </Select>
        <Button variant="contained" onClick={handleCreateUser}>Create</Button>
      </div>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(user => (
              <TableRow key={user._id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.type || user.role || 'N/A'}</TableCell>
                <TableCell>
                  <Button size="small" color="error" onClick={() => handleDelete(user._id)}>Delete</Button>
                  <Button size="small" color="warning" onClick={() => handleSuspend(user._id)}>Suspend</Button>
                  {/* Add more actions: update, assign role, reset password, etc. */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default AdminUserManagement;
