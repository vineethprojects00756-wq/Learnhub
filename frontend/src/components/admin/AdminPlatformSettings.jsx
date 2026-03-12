import React, { useEffect, useState } from 'react';
import { Paper, Typography, Button, TextField, Switch, FormControlLabel, Alert } from '@mui/material';
import axiosInstance from '../common/AxiosInstance';

const AdminPlatformSettings = () => {
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [notification, setNotification] = useState('');
  const [message, setMessage] = useState('');
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axiosInstance.get('api/admin/platform-settings', { headers });
        const settings = res?.data?.settings || {};
        setFeatureEnabled(Boolean(settings.featureEnabled));
        setMaintenanceMode(Boolean(settings.maintenanceMode));
      } catch (err) {
        setMessage(err?.response?.data?.message || 'Failed to load platform settings');
      }
    };

    fetchSettings();
  }, []);

  const handleCategory = async () => {
    try {
      const res = await axiosInstance.post('api/admin/manage-tags', { category }, { headers });
      setMessage(res.data.message || 'Category submitted');
      setCategory('');
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Category action failed');
    }
  };

  const handleTag = async () => {
    try {
      const res = await axiosInstance.post('api/admin/manage-tags', { tag }, { headers });
      setMessage(res.data.message || 'Tag submitted');
      setTag('');
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Tag action failed');
    }
  };

  const handleFeatureToggle = async () => {
    const nextValue = !featureEnabled;
    setFeatureEnabled(nextValue);
    try {
      const res = await axiosInstance.post('api/admin/enable-disable-feature', { enabled: nextValue }, { headers });
      setMessage(res.data.message || `Feature ${nextValue ? 'enabled' : 'disabled'}`);
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Feature toggle failed');
    }
  };

  const handleMaintenance = async () => {
    const nextValue = !maintenanceMode;
    setMaintenanceMode(nextValue);
    try {
      const res = await axiosInstance.post('api/admin/maintenance-mode', { enabled: nextValue }, { headers });
      setMessage(res.data.message || `Maintenance mode ${nextValue ? 'enabled' : 'disabled'}`);
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Maintenance action failed');
    }
  };

  const handleAnnouncement = async () => {
    try {
      const res = await axiosInstance.post('api/admin/announcement-system', { announcement }, { headers });
      setMessage(res.data.message || 'Announcement submitted');
      setAnnouncement('');
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Announcement action failed');
    }
  };

  const handleNotification = async () => {
    try {
      const res = await axiosInstance.post('api/admin/global-notifications', { notification }, { headers });
      setMessage(res.data.message || 'Notification submitted');
      setNotification('');
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Notification action failed');
    }
  };

  return (
    <Paper style={{ padding: 24, margin: '24px 0' }}>
      <Typography variant="h6">Platform Settings</Typography>
      {message && <Alert severity="info" style={{ margin: '12px 0' }}>{message}</Alert>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <TextField label="Category" value={category} onChange={e => setCategory(e.target.value)} />
        <Button variant="contained" onClick={handleCategory}>Add Category</Button>
        <TextField label="Tag" value={tag} onChange={e => setTag(e.target.value)} />
        <Button variant="contained" onClick={handleTag}>Add Tag</Button>
      </div>
      <FormControlLabel control={<Switch checked={featureEnabled} onChange={handleFeatureToggle} />} label="Enable Feature" />
      <FormControlLabel control={<Switch checked={maintenanceMode} onChange={handleMaintenance} />} label="Maintenance Mode" />
      <div style={{ marginTop: 16 }}>
        <TextField label="Announcement" value={announcement} onChange={e => setAnnouncement(e.target.value)} fullWidth />
        <Button variant="contained" onClick={handleAnnouncement} style={{ marginTop: 8 }}>Send Announcement</Button>
      </div>
      <div style={{ marginTop: 16 }}>
        <TextField label="Global Notification" value={notification} onChange={e => setNotification(e.target.value)} fullWidth />
        <Button variant="contained" onClick={handleNotification} style={{ marginTop: 8 }}>Send Notification</Button>
      </div>
    </Paper>
  );
};

export default AdminPlatformSettings;
