import React, { useState } from 'react';
import axiosInstance from '../common/AxiosInstance';
import { Button, TextField, Paper, Typography, Alert } from '@mui/material';
import { getErrorMessage } from '../../utils/adminApi';

const AdminLogin = ({ setAdminLoggedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axiosInstance.post('api/admin/login', { email, password });
      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        if (res.data.userData) {
          localStorage.setItem('user', JSON.stringify(res.data.userData));
        }
        setAdminLoggedIn(true);
      } else {
        setError(res.data.message || 'Login failed');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={3} style={{ padding: 24, maxWidth: 400, margin: '40px auto' }}>
      <Typography variant="h5" gutterBottom>Admin Login</Typography>
      <form onSubmit={handleLogin}>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          fullWidth
          margin="normal"
          required
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          fullWidth
          margin="normal"
          required
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" variant="contained" color="primary" fullWidth style={{ marginTop: 16 }} disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </form>
    </Paper>
  );
};

export default AdminLogin;
