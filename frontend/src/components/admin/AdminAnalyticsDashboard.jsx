import React, { useEffect, useState } from 'react';
import { Paper, Typography, Grid, CircularProgress, Alert, Button } from '@mui/material';
import axiosInstance from '../common/AxiosInstance';
import { getErrorMessage } from '../../utils/adminApi';

const AdminAnalyticsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');

    try {
      const [users, active, revenue, trends, teacher, student, dashboard] = await Promise.all([
        axiosInstance.get('api/admin/total-users'),
        axiosInstance.get('api/admin/active-users'),
        axiosInstance.get('api/admin/revenue-reports'),
        axiosInstance.get('api/admin/course-enrollment-trends'),
        axiosInstance.get('api/admin/teacher-performance-stats'),
        axiosInstance.get('api/admin/student-performance-stats'),
        axiosInstance.get('api/admin/real-time-dashboard'),
      ]);

      setStats({
        totalUsers: users.data.totalUsers,
        activeUsers: active.data.activeUsers,
        totalRevenue: revenue.data.totalRevenue,
        enrollmentTrends: trends.data.trends,
        teacherStats: teacher.data.stats,
        studentStats: student.data.stats,
        dashboard: dashboard.data.dashboard,
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load analytics data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return <CircularProgress style={{ margin: '40px auto', display: 'block' }} />;
  }

  return (
    <Paper style={{ padding: 24, margin: '24px 0' }}>
      <Typography variant="h6">Analytics Dashboard</Typography>
      <Button size="small" variant="outlined" onClick={fetchStats} disabled={loading} style={{ marginTop: 8 }}>
        Refresh
      </Button>
      {error && <Alert severity="error" style={{ margin: '12px 0' }}>{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Typography>Total Users: {stats?.totalUsers ?? 0}</Typography></Grid>
        <Grid item xs={12} md={4}><Typography>Active Users: {stats?.activeUsers ?? 0}</Typography></Grid>
        <Grid item xs={12} md={4}><Typography>Total Revenue: Rs. {stats?.totalRevenue ?? 0}</Typography></Grid>
        <Grid item xs={12} md={4}><Typography>Enrollment Trends: {stats?.enrollmentTrends?.length || 0} records</Typography></Grid>
        <Grid item xs={12} md={4}><Typography>Teacher Stats: {stats?.teacherStats?.length || 0} records</Typography></Grid>
        <Grid item xs={12} md={4}><Typography>Student Stats: {stats?.studentStats?.length || 0} records</Typography></Grid>
      </Grid>
    </Paper>
  );
};

export default AdminAnalyticsDashboard;
