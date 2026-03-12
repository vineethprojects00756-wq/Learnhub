import React, { useContext, useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import { UserContext } from '../../App';
import TeacherHome from '../user/teacher/TeacherHome';
import AdminHome from '../admin/AdminHome';
import StudentHome from '../user/student/StudentHome';
// import axiosInstance from './AxiosInstance';

const UserHome = ({ setSelectedComponent }) => {
   const user = useContext(UserContext);
   const role = (user?.userData?.type || '').toLowerCase();
   let content;
   {
      switch (role) {
         case "teacher":
            content = <TeacherHome setSelectedComponent={setSelectedComponent} />
            break;
         case "admin":
            content = <AdminHome />
            break;
         case "student":
            content = <StudentHome />
            break;

         default:
            break;
      }
   }

   return (
      <Container>
         {content}
      </Container>
   );
};

export default UserHome;
