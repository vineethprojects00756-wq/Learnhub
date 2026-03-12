import React, { useState, useEffect } from 'react';
import { Paper, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert } from '@mui/material';
import axiosInstance from '../common/AxiosInstance';

const AdminSecurityModeration = () => {
  const [reportedContent, setReportedContent] = useState([]);
  const [logs, setLogs] = useState([]);
  const [apiUsage, setApiUsage] = useState([]);
  const [message, setMessage] = useState('');
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

  const fetchData = async () => {
    setMessage('');
    try {
      const reportRes = await axiosInstance.get('api/admin/view-reported-content', { headers });
      const logsRes = await axiosInstance.get('api/admin/view-system-logs', { headers });
      const apiRes = await axiosInstance.get('api/admin/api-usage-monitoring', { headers });
      setReportedContent(reportRes.data.content || []);
      setLogs(logsRes.data.logs || []);
      setApiUsage(apiRes.data.usage || []);
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to fetch security data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRemoveComment = async (id) => {
    try {
      const res = await axiosInstance.delete('api/admin/remove-inappropriate-comments', {
        data: { id },
        headers,
      });
      setMessage(res.data.message || 'Remove action completed');
      await fetchData();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to remove content');
    }
  };

  const handleBlockUser = async (id) => {
    try {
      const res = await axiosInstance.put('api/admin/block-abusive-user', { id }, { headers });
      setMessage(res.data.message || 'Block action completed');
      await fetchData();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Failed to block user');
    }
  };

  return (
    <Paper style={{ padding: 24, margin: '24px 0' }}>
      <Typography variant="h6">Security & Moderation</Typography>
      {message && <Alert severity="info" style={{ margin: '12px 0' }}>{message}</Alert>}
      <Button variant="text" onClick={fetchData} style={{ marginBottom: 8 }}>Reload</Button>
      <Typography variant="subtitle1" style={{ marginTop: 16 }}>Reported Content</Typography>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Content</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reportedContent.map(item => (
              <TableRow key={item._id}>
                <TableCell>{item._id}</TableCell>
                <TableCell>{item.content}</TableCell>
                <TableCell>{item.user}</TableCell>
                <TableCell>
                  <Button size="small" color="error" onClick={() => handleRemoveComment(item._id)}>Remove</Button>
                  <Button size="small" color="warning" onClick={() => handleBlockUser(item.user)}>Block User</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="subtitle1" style={{ marginTop: 24 }}>System Logs</Typography>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Log ID</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map(log => (
              <TableRow key={log._id}>
                <TableCell>{log._id}</TableCell>
                <TableCell>{log.message}</TableCell>
                <TableCell>{log.date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="subtitle1" style={{ marginTop: 24 }}>API Usage Monitoring</Typography>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>API</TableCell>
              <TableCell>Count</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {apiUsage.map(api => (
              <TableRow key={api.name}>
                <TableCell>{api.name}</TableCell>
                <TableCell>{api.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default AdminSecurityModeration;
