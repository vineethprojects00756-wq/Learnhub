import React, { useState, useContext } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { UserContext } from '../../App';
import axiosInstance from './AxiosInstance';
import { Button, TextField, Avatar, Paper } from '@mui/material';

const UserProfile = () => {
  const user = useContext(UserContext);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user.userData?.name || '',
    email: user.userData?.email || '',
    type: user.userData?.type || '',
    phone: user.userData?.phone || '',
    bio: user.userData?.bio || '',
    profilePic: user.userData?.profilePicture || user.userData?.profilePic || '',
    qualifications: (user.userData?.qualifications || []).join(', '),
    joined: user.userData?.createdAt || '',
  });
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(!!user.userData?.twoFactorEnabled);
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData({ ...profileData, [name]: value });
  };
  const handleProfilePicChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePicFile(e.target.files[0]);
      setProfileData({ ...profileData, profilePic: URL.createObjectURL(e.target.files[0]) });
    }
  };
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswords({ ...passwords, [name]: value });
  };

  const handleUpdatePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      return alert('Please fill all password fields');
    }
    try {
      const res = await axiosInstance.put('/api/user/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.new,
        confirmPassword: passwords.confirm,
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.data.success) {
        alert('Password changed successfully');
        setPasswords({ current: '', new: '', confirm: '' });
        setShowPasswordSection(false);
      } else {
        alert(res.data.message || 'Failed to update password');
      }
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to update password');
    }
  };

  const request2FASetup = async () => {
    try {
      const res = await axiosInstance.post('/api/user/2fa/request-setup', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      alert(res.data.message || 'Verification code sent');
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to start 2FA setup');
    }
  };

  const confirm2FASetup = async () => {
    if (!twoFactorCode) return alert('Enter verification code');
    try {
      const res = await axiosInstance.post('/api/user/2fa/confirm-setup', { code: twoFactorCode }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.data.success) {
        const existing = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...existing, twoFactorEnabled: true }));
        setTwoFactorEnabled(true);
        setTwoFactorCode('');
        alert(res.data.message || '2FA enabled');
      } else {
        alert(res.data.message || 'Failed to enable 2FA');
      }
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to enable 2FA');
    }
  };

  const disable2FA = async () => {
    if (!passwords.current) return alert('Enter current password to disable 2FA');
    try {
      const res = await axiosInstance.post('/api/user/2fa/disable', { password: passwords.current }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.data.success) {
        const existing = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...existing, twoFactorEnabled: false }));
        setTwoFactorEnabled(false);
        alert(res.data.message || '2FA disabled');
      } else {
        alert(res.data.message || 'Failed to disable 2FA');
      }
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to disable 2FA');
    }
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      if (!profileData.name || !profileData.email) {
        // ...existing code...
        setIsLoading(false);
        return;
      }

      const updatePayload = {
        userId: user.userData._id,
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone,
        bio: profileData.bio,
        qualifications: profileData.qualifications,
      };
      const isTeacher = (user.userData?.type || '').toLowerCase() === 'teacher';
      let res;
      if (isTeacher) {
        const formData = new FormData();
        Object.entries(updatePayload).forEach(([key, value]) => formData.append(key, value || ''));
        if (profilePicFile) {
          formData.append('profileImage', profilePicFile);
        }
        res = await axiosInstance.put('/api/user/teacher/profile', formData, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        if (profilePicFile) {
          const formData = new FormData();
          Object.entries(updatePayload).forEach(([key, value]) => formData.append(key, value || ''));
          formData.append('profileImage', profilePicFile);
          res = await axiosInstance.put('/api/user/update-profile', formData, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'multipart/form-data',
            },
          });
        } else {
          res = await axiosInstance.put('/api/user/update-profile', updatePayload, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          });
        }
      }
      
      if (res.data.success) {
        const updatedUserData = res.data.data || res.data.userData;
        const userToStore = {
          ...user.userData,
          name: updatedUserData.name,
          email: updatedUserData.email,
        };
        localStorage.setItem('user', JSON.stringify(userToStore));
        setProfileData({
          name: updatedUserData.name || '',
          email: updatedUserData.email || '',
          type: user.userData?.type || '',
          phone: updatedUserData.phone || '',
          bio: updatedUserData.bio || '',
          profilePic: updatedUserData.profilePicture || updatedUserData.profilePic || '',
          qualifications: (updatedUserData.qualifications || []).join(', '),
          joined: updatedUserData.createdAt || '',
        });
        setIsEditing(false);
        // ...existing code...
      } else {
        // ...existing code...
      }
    } catch (error) {
      // ...existing code...
      // ...existing code...
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setProfileData({
      name: user.userData?.name || '',
      email: user.userData?.email || '',
      type: user.userData?.type || '',
      qualifications: (user.userData?.qualifications || []).join(', '),
    });
    setIsEditing(false);
  };

  if (!user.userData) {
    return (
      <Container>
        <div className="text-center py-5">
          <p>Loading profile...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="mb-4">My Profile</h2>
      </motion.div>

      <Row className="g-4">
        {/* Profile Card */}
        <Col lg={4}>
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Paper className="p-4 text-center h-100">
              <Avatar
                src={profileData.profilePic}
                sx={{
                  width: 100,
                  height: 100,
                  margin: '0 auto 20px',
                  bgcolor: '#0d6efd',
                }}
              >
                {(!profileData.profilePic && (user.userData?.name?.charAt(0) || 'U'))}
              </Avatar>
              {isEditing && (
                <div className="mb-2">
                  <input type="file" accept="image/*" onChange={handleProfilePicChange} />
                </div>
              )}
              <h4>{user.userData?.name}</h4>
              <p className="text-muted mb-2">{user.userData?.email}</p>
              <p className="small text-muted mb-2">
                <strong>Phone:</strong> {profileData.phone || <span className="text-secondary">Not set</span>}
              </p>
              <div className="mb-3">
                <span className="badge bg-info text-dark fs-6">
                  {user.userData?.type}
                </span>
              </div>
              <p className="small text-muted">
                <strong>User ID:</strong>
                <br />
                {user.userData?._id}
              </p>
              <p className="small text-muted mb-0">
                <strong>Date Joined:</strong>
                <br />
                {profileData.joined ? new Date(profileData.joined).toLocaleDateString() : 'N/A'}
              </p>
            </Paper>
          </motion.div>
        </Col>

        {/* Profile Details */}
        <Col lg={8}>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Paper className="p-5">
              {!isEditing ? (
                <>
                  <div className="mb-4">
                    <h5 className="mb-3">Profile Information</h5>
                    <div className="mb-3">
                      <label className="form-label text-muted small">Name</label>
                      <p className="fs-5">{profileData.name}</p>
                    </div>
                    <div className="mb-3">
                      <label className="form-label text-muted small">Email</label>
                      <p className="fs-5">{profileData.email}</p>
                    </div>
                    <div className="mb-3">
                      <label className="form-label text-muted small">Account Type</label>
                      <p className="fs-5">{profileData.type}</p>
                    </div>
                    <div className="mb-3">
                      <label className="form-label text-muted small">Phone</label>
                      <p className="fs-5">{profileData.phone || <span className="text-secondary">Not set</span>}</p>
                    </div>
                    <div className="mb-3">
                      <label className="form-label text-muted small">Bio</label>
                      <p className="fs-5">{profileData.bio || <span className="text-secondary">No bio set</span>}</p>
                    </div>
                    {String(profileData.type).toLowerCase() === 'teacher' && (
                      <div className="mb-3">
                        <label className="form-label text-muted small">Qualifications</label>
                        <p className="fs-5">{profileData.qualifications || <span className="text-secondary">Not set</span>}</p>
                      </div>
                    )}
                    <div className="mb-3">
                      <label className="form-label text-muted small">Date Joined</label>
                      <p className="fs-5">{profileData.joined ? new Date(profileData.joined).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
                  <Button
                    variant="contained"
                    onClick={() => setIsEditing(true)}
                    fullWidth
                  >
                    Edit Profile
                  </Button>
                  <Button
                    variant="outlined"
                    className="mt-2"
                    onClick={() => setShowPasswordSection((v) => !v)}
                    fullWidth
                  >
                    {showPasswordSection ? 'Hide Password Change' : 'Change Password'}
                  </Button>
                  {showPasswordSection && (
                    <div className="mt-3">
                      <h6>Change Password</h6>
                      <TextField
                        fullWidth
                        label="Current Password"
                        name="current"
                        type="password"
                        value={passwords.current}
                        onChange={handlePasswordChange}
                        className="mb-2"
                      />
                      <TextField
                        fullWidth
                        label="New Password"
                        name="new"
                        type="password"
                        value={passwords.new}
                        onChange={handlePasswordChange}
                        className="mb-2"
                      />
                      <TextField
                        fullWidth
                        label="Confirm New Password"
                        name="confirm"
                        type="password"
                        value={passwords.confirm}
                        onChange={handlePasswordChange}
                        className="mb-2"
                      />
                      <Button variant="contained" color="primary" fullWidth onClick={handleUpdatePassword}>
                        Update Password
                      </Button>
                    </div>
                  )}
                  <div className="mt-3">
                    <h6>Two-Factor Authentication</h6>
                    <p className="small text-muted mb-2">Status: {twoFactorEnabled ? 'Enabled' : 'Disabled'}</p>
                    {!twoFactorEnabled && (
                      <>
                        <Button variant="outlined" fullWidth onClick={request2FASetup}>
                          Send Setup Code
                        </Button>
                        <TextField
                          fullWidth
                          className="mt-2"
                          label="Verification code"
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value)}
                        />
                        <Button variant="contained" className="mt-2" fullWidth onClick={confirm2FASetup}>
                          Enable 2FA
                        </Button>
                      </>
                    )}
                    {twoFactorEnabled && (
                      <Button variant="outlined" color="error" fullWidth onClick={disable2FA}>
                        Disable 2FA
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h5 className="mb-4">Edit Profile</h5>
                  <div className="mb-3">
                    <TextField
                      fullWidth
                      label="Name"
                      name="name"
                      value={profileData.name}
                      onChange={handleChange}
                      variant="outlined"
                    />
                  </div>
                  <div className="mb-3">
                    <TextField
                      fullWidth
                      label="Email"
                      name="email"
                      type="email"
                      value={profileData.email}
                      onChange={handleChange}
                      variant="outlined"
                    />
                  </div>
                  <div className="mb-3">
                    <TextField
                      fullWidth
                      label="Phone"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleChange}
                      variant="outlined"
                    />
                  </div>
                  <div className="mb-3">
                    <TextField
                      fullWidth
                      label="Bio"
                      name="bio"
                      value={profileData.bio}
                      onChange={handleChange}
                      variant="outlined"
                      multiline
                      minRows={2}
                    />
                  </div>
                  {String(profileData.type).toLowerCase() === 'teacher' && (
                    <div className="mb-3">
                      <TextField
                        fullWidth
                        label="Qualifications (comma separated)"
                        name="qualifications"
                        value={profileData.qualifications}
                        onChange={handleChange}
                        variant="outlined"
                      />
                    </div>
                  )}
                  <div className="mb-4">
                    <TextField
                      fullWidth
                      label="Type"
                      name="type"
                      value={profileData.type}
                      disabled
                      variant="outlined"
                      helperText="Account type cannot be changed"
                    />
                  </div>
                  <div className="mb-3">
                    <input type="file" accept="image/*" onChange={handleProfilePicChange} />
                  </div>
                  <div className="d-flex gap-2">
                    <Button
                      variant="contained"
                      onClick={handleSaveProfile}
                      disabled={isLoading}
                      fullWidth
                    >
                      {isLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleCancel}
                      disabled={isLoading}
                      fullWidth
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </Paper>
          </motion.div>
        </Col>
      </Row>
    </Container>
  );
};

export default UserProfile;
