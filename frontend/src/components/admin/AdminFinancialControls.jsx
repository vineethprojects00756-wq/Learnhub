import React, { useState, useEffect } from 'react';
import { Paper, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert } from '@mui/material';
import axiosInstance from '../common/AxiosInstance';
import { formatDateTime, getErrorMessage } from '../../utils/adminApi';

const AdminFinancialControls = () => {
  const [transactions, setTransactions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({ totalTransactions: 0 });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [transRes, logsRes] = await Promise.all([
        axiosInstance.get('api/admin/transaction-reports'),
        axiosInstance.get('api/admin/payment-gateway-logs'),
      ]);

      setSummary({ totalTransactions: transRes.data.totalTransactions || 0 });
      setTransactions(transRes.data.transactions || []);
      setLogs(logsRes.data.logs || []);
    } catch (err) {
      setMessage(getErrorMessage(err, 'Failed to fetch financial data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runAction = async (endpoint, successMessage, key) => {
    setAction(key);
    setMessage('');
    try {
      const res = await axiosInstance.post(endpoint, {});
      setMessage(res.data.message || successMessage);
      await fetchData();
    } catch (err) {
      setMessage(getErrorMessage(err, `${successMessage} failed`));
    } finally {
      setAction('');
    }
  };

  return (
    <Paper style={{ padding: 24, margin: '24px 0' }}>
      <Typography variant="h6">Financial Controls</Typography>
      {message && <Alert severity="info" style={{ margin: '12px 0' }}>{message}</Alert>}
      <Typography variant="body2" style={{ marginBottom: 12 }}>
        Total Transactions: {loading ? 'Loading...' : summary.totalTransactions}
      </Typography>

      <Button
        variant="contained"
        color="primary"
        disabled={action === 'commission'}
        onClick={() => runAction('api/admin/commission-management', 'Commission action completed', 'commission')}
        style={{ marginRight: 8 }}
      >
        {action === 'commission' ? 'Processing...' : 'Manage Commission'}
      </Button>
      <Button
        variant="contained"
        color="success"
        disabled={action === 'withdraw'}
        onClick={() => runAction('api/admin/withdraw-approval', 'Withdraw approval action completed', 'withdraw')}
        style={{ marginRight: 8 }}
      >
        {action === 'withdraw' ? 'Processing...' : 'Approve Withdraw'}
      </Button>
      <Button
        variant="contained"
        color="warning"
        disabled={action === 'refund'}
        onClick={() => runAction('api/admin/refund-approval', 'Refund approval action completed', 'refund')}
      >
        {action === 'refund' ? 'Processing...' : 'Approve Refund'}
      </Button>
      <Button variant="text" onClick={fetchData} disabled={loading} style={{ marginLeft: 8 }}>
        Reload
      </Button>

      <Typography variant="subtitle1" style={{ marginTop: 24 }}>Transaction Reports</Typography>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">No transactions found</TableCell>
              </TableRow>
            )}
            {transactions.map((tx) => (
              <TableRow key={tx._id}>
                <TableCell>{tx._id}</TableCell>
                <TableCell>{tx.amount ?? tx.totalAmount ?? '-'}</TableCell>
                <TableCell>{tx.status || '-'}</TableCell>
                <TableCell>{formatDateTime(tx.date || tx.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="subtitle1" style={{ marginTop: 24 }}>Payment Gateway Logs</Typography>
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
            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">No logs found</TableCell>
              </TableRow>
            )}
            {logs.map((log) => (
              <TableRow key={log._id}>
                <TableCell>{log._id}</TableCell>
                <TableCell>{log.message || log.event || '-'}</TableCell>
                <TableCell>{formatDateTime(log.date || log.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default AdminFinancialControls;
