import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from 'react-bootstrap/Navbar';
import { Container, Nav } from 'react-bootstrap';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import axiosInstance from './AxiosInstance';
import { motion } from 'framer-motion';

const Login = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({
    email: '',
    password: '',
  });
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData({ ...data, [name]: value });
  };

  const completeLogin = (payload) => {
    localStorage.setItem('token', payload.token);
    localStorage.setItem('user', JSON.stringify(payload.userData));
    const role = (payload.userData?.type || '').toLowerCase();
    let target = '/dashboard';
    if (role === 'teacher') {
      target = '/dashboard?view=teacher-advanced';
    }
    setTimeout(() => {
      navigate(target);
    }, 200);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!data?.email || !data?.password) {
      return alert('Please fill all fields');
    }

    if (twoFactorToken) {
      if (!twoFactorCode) return alert('Enter verification code');
      axiosInstance
        .post('/api/user/login/verify-2fa', { twoFactorToken, code: twoFactorCode })
        .then((res) => {
          if (res.data.success) {
            alert(res.data.message || 'Login successful');
            completeLogin(res.data);
          } else {
            alert(res.data.message || 'Verification failed');
          }
        })
        .catch((err) => {
          alert(err?.response?.data?.message || 'Verification failed');
        });
      return;
    }

    axiosInstance
      .post('/api/user/login', data)
      .then((res) => {
        if (res.data.requiresTwoFactor) {
          setTwoFactorToken(res.data.twoFactorToken || '');
          alert(res.data.message || 'Verification code sent to your email');
          return;
        }
        if (res.data.success) {
          alert(res.data.message);
          completeLogin(res.data);
        } else {
          alert(res.data.message);
        }
      })
      .catch((err) => {
        if (err.response && err.response.status === 401) {
          alert("Invalid email or password");
        } else if (err.response) {
          alert(err.response.data?.message || "Login failed");
        } else {
          alert("An error occurred. Please try again.");
        }
      });
  };

  return (
    <>
      <Navbar expand="lg" className="bg-body-tertiary shadow-sm">
        <Container fluid>
          <Navbar.Brand>
            <h2>LearnHub: Your Center for Skill Enhancement</h2>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="navbarScroll" />
          <Navbar.Collapse id="navbarScroll">
            <Nav className="me-auto" navbarScroll />
            <Nav>
              <Link className="nav-link" to={'/'}>
                Home
              </Link>
              <Link className="nav-link" to={'/login'}>
                Login
              </Link>
              <Link className="nav-link" to={'/register'}>
                Register
              </Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container
        component="main"
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Box
            sx={{
              p: 4,
              background: '#f9fafb',
              borderRadius: 2,
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              <Avatar sx={{ bgcolor: 'secondary.main', width: 56, height: 56 }} />
            </motion.div>

            <Typography component="h1" variant="h5" mt={1}>
              Sign In
            </Typography>

            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2 }}>
              <motion.div whileFocus={{ scale: 1.02 }} whileHover={{ scale: 1.02 }}>
                <TextField
                  margin="normal"
                  fullWidth
                  id="email"
                  label="Email Address"
                  name="email"
                  value={data.email}
                  onChange={handleChange}
                  autoComplete="email"
                  autoFocus
                />
              </motion.div>
              <motion.div whileFocus={{ scale: 1.02 }} whileHover={{ scale: 1.02 }}>
                <TextField
                  margin="normal"
                  fullWidth
                  name="password"
                  value={data.password}
                  onChange={handleChange}
                  label="Password"
                  type="password"
                  id="password"
                  autoComplete="current-password"
                />
              </motion.div>
              {twoFactorToken && (
                <motion.div whileFocus={{ scale: 1.02 }} whileHover={{ scale: 1.02 }}>
                  <TextField
                    margin="normal"
                    fullWidth
                    name="twoFactorCode"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    label="Email verification code"
                    type="text"
                    helperText="Enter the 6-digit code sent to your email."
                  />
                </motion.div>
              )}
              <Box mt={3}>
                <motion.div whileHover={{ scale: 1.05 }}>
                  <Button type="submit" variant="contained" fullWidth sx={{ py: 1.5 }}>
                    {twoFactorToken ? 'Verify & Sign In' : 'Sign In'}
                  </Button>
                </motion.div>
              </Box>

              <Grid container mt={2} justifyContent="center">
                <Grid item>
                  Have an account?{' '}
                  <Link style={{ color: 'blue' }} to={'/register'}>
                    Sign Up
                  </Link>
                </Grid>
              </Grid>

              <Grid container mt={2} justifyContent="center">
                <Grid item>
                  <Link style={{ color: 'blue' }} to={'/reset-password'}>
                    Forgot password?
                  </Link>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </motion.div>
      </Container>
    </>
  );
};

export default Login;
