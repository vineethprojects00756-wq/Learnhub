import React, { useState, useEffect } from 'react'
import { Button, styled, TableRow, TableHead, TableContainer, Paper, Table, TableBody, TableCell, tableCellClasses } from '@mui/material'
import axiosInstance from '../common/AxiosInstance'



const StyledTableCell = styled(TableCell)(({ theme }) => ({
   [`&.${tableCellClasses.head}`]: {
      backgroundColor: theme.palette.common.black,
      color: theme.palette.common.white,
   },
   [`&.${tableCellClasses.body}`]: {
      fontSize: 14,
   },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
   '&:nth-of-type(odd)': {
      backgroundColor: theme.palette.action.hover,
   },
   // hide last border
   '&:last-child td, &:last-child th': {
      border: 0,
   },
}));


const AdminHome = () => {
   const [allUsers, setAllUsers] = useState([])

   const allUsersList = async () => {
      try {
         const res = await axiosInstance.get('api/admin/getallusers', {
            headers: {
               "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
         })
         if (res.data.success) {
            setAllUsers(res.data.data)
         }
         else {
            // ...existing code...
         }
      } catch (error) {
         // ...existing code...
      }
   }

   useEffect(() => {
      allUsersList()
   }, [])

   const deleteUser = async (userId) => {
      const confirmation = confirm('Are you sure you want to delete')
      if (!confirmation) {
         return;
      }
      try {
         const res = await axiosInstance.delete(`api/admin/deleteuser/${userId}`, {
            headers: {
               Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
         })
         if (res.data.success) {
            // ...existing code...
            allUsersList()
         } else {
            // ...existing code...
         }
      } catch (error) {
         // ...existing code...
      }
   }

   return (
      <TableContainer component={Paper}>
         <Table sx={{ minWidth: 700 }} aria-label="customized table">
            <TableHead>
               <TableRow>
                  <StyledTableCell>User ID</StyledTableCell>
                  <StyledTableCell align="left">User Name</StyledTableCell>
                  <StyledTableCell align="left">Email</StyledTableCell>
                  <StyledTableCell align="left">Type</StyledTableCell>
                  <StyledTableCell align="left">Action</StyledTableCell>
               </TableRow>
            </TableHead>
            <TableBody>
               {
                  allUsers.length > 0 ? (
                     allUsers.map((user) => (
                        <StyledTableRow key={user._id}>
                           <StyledTableCell component="th" scope="row">
                              {user._id}
                           </StyledTableCell>
                           <StyledTableCell component="th" scope="row">
                              {user.name}
                           </StyledTableCell>
                           <StyledTableCell component="th" scope="row">
                              {user.email}
                           </StyledTableCell>
                           <StyledTableCell component="th" scope="row">
                              {user.type}
                           </StyledTableCell>
                           <StyledTableCell component="th" scope="row">
                              <Button onClick={()=> deleteUser(user._id)} size='small' color="error">Delete</Button>
                              {/* <Button size='small' color="info">Update</Button> */}
                           </StyledTableCell>
                        </StyledTableRow>
                     )))
                     :
                     (<p className='px-2'>No users found</p>)
               }
            </TableBody>
         </Table>
      </TableContainer>
   )
}

export default AdminHome
