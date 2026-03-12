import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Container, Form } from 'react-bootstrap';
import axiosInstance from './AxiosInstance';

const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';
  const initialToken = searchParams.get('token') || '';

  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [info, setInfo] = useState('');

  const sendReset = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosInstance.post('/api/user/forgot-password', { email });
      setInfo(res.data?.message || 'Reset link sent');
    } catch (error) {
      setInfo(error?.response?.data?.message || 'Failed to send reset link');
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosInstance.post('/api/user/reset-password', { email, token, newPassword });
      setInfo(res.data?.message || 'Password reset successful');
    } catch (error) {
      setInfo(error?.response?.data?.message || 'Password reset failed');
    }
  };

  return (
    <Container className="py-4" style={{ maxWidth: 640 }}>
      <h4 className="mb-3">Forgot Password</h4>
      {info && <p className="text-info">{info}</p>}

      <Form onSubmit={sendReset} className="mb-4 border p-3 rounded">
        <h6>Request Reset Link</h6>
        <Form.Control className="mb-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Button type="submit" size="sm">Send Reset Link</Button>
      </Form>

      <Form onSubmit={resetPassword} className="border p-3 rounded">
        <h6>Reset Using Token</h6>
        <Form.Control className="mb-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Form.Control className="mb-2" type="text" placeholder="Token" value={token} onChange={(e) => setToken(e.target.value)} required />
        <Form.Control className="mb-2" type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        <Button type="submit" size="sm" variant="outline-primary">Reset Password</Button>
      </Form>
    </Container>
  );
};

export default ForgotPassword;
