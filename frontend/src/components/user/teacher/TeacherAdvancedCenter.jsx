import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import axiosInstance from '../../common/AxiosInstance';
import { getRealtimeSocket } from '../../../utils/realtimeSocket';
import './TeacherAdvancedCenter.css';

const initialCourseForm = {
  courseId: '',
  C_educator: '',
  C_title: '',
  C_categories: '',
  C_price: 0,
  C_description: '',
  tags: '',
  prerequisites: '',
};

const TeacherAdvancedCenter = ({ defaultSection = 'course' }) => {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [dashboard, setDashboard] = useState({ summary: {}, courses: [], assignments: [] });
  const [students, setStudents] = useState([]);
  const [earnings, setEarnings] = useState({});
  const [performance, setPerformance] = useState({ courseStats: [] });
  const [assignments, setAssignments] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseForm, setCourseForm] = useState(initialCourseForm);
  const [schedulePublishAt, setSchedulePublishAt] = useState('');
  const [versionHistory, setVersionHistory] = useState([]);
  const [quizBuilder, setQuizBuilder] = useState([]);
  const [liveSessionBuilder, setLiveSessionBuilder] = useState([]);
  const [downloadableBuilder, setDownloadableBuilder] = useState([]);

  const [assignmentForm, setAssignmentForm] = useState({ courseId: '', title: '', description: '', deadline: '', autoGradeMCQ: false });
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [gradeForm, setGradeForm] = useState({});

  const [discussionText, setDiscussionText] = useState('');
  const [discussionFeed, setDiscussionFeed] = useState([]);
  const [directMessage, setDirectMessage] = useState({ recipientId: '', subject: '', body: '' });
  const [privateChat, setPrivateChat] = useState([]);
  const [bulkMessage, setBulkMessage] = useState({ courseId: '', subject: '', body: '' });
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', method: 'bank-transfer' });
  const [activeSection, setActiveSection] = useState(defaultSection);

  const sectionOptions = [
    { key: 'course', label: 'Course' },
    { key: 'modules', label: 'Modules' },
    { key: 'versions', label: 'Versions' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'monitoring', label: 'Monitoring' },
    { key: 'communication', label: 'Communication' },
    { key: 'discussion', label: 'Discussion' },
    { key: 'earnings', label: 'Earnings' },
  ];
  const [assetForm, setAssetForm] = useState({
    thumbnail: null,
    lessonVideo: null,
    lessonTitle: '',
    lessonDescription: '',
    moduleTitle: '',
    pdfFile: null,
    pdfTitle: '',
  });

  const selectedCourse = useMemo(
    () => dashboard.courses.find((course) => String(course._id) === String(selectedCourseId)),
    [dashboard.courses, selectedCourseId]
  );

  const showInfo = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 2200);
  };

  const fetchCore = async () => {
    const [dashRes, studentRes, earningRes, performanceRes, assignmentRes] = await Promise.all([
      axiosInstance.get('/api/user/teacher/advanced/dashboard'),
      axiosInstance.get('/api/user/teacher/students'),
      axiosInstance.get('/api/user/teacher/earnings'),
      axiosInstance.get('/api/user/teacher/performance-stats'),
      axiosInstance.get('/api/user/teacher/assignments'),
    ]);

    const dash = dashRes.data?.data || { summary: {}, courses: [], assignments: [] };
    setDashboard(dash);
    setStudents(studentRes.data?.data || []);
    setEarnings(earningRes.data?.data || {});
    setPerformance(performanceRes.data?.data || { courseStats: [] });
    setAssignments(assignmentRes.data?.data || []);

    const defaultCourseId = dash?.courses?.[0]?._id || '';
    setSelectedCourseId((prev) => prev || defaultCourseId);
  };

  const fetchDiscussions = async (courseId) => {
    if (!courseId) return setDiscussionFeed([]);
    const res = await axiosInstance.get(`/api/user/courses/${courseId}/discussions`);
    setDiscussionFeed(res.data?.data || []);
  };

  const fetchVersions = async (courseId) => {
    if (!courseId) return setVersionHistory([]);
    const res = await axiosInstance.get(`/api/user/teacher/courses/${courseId}/versions`);
    setVersionHistory(res.data?.data || []);
  };

  const fetchSubmissions = async (assignmentId) => {
    if (!assignmentId) return setSubmissions([]);
    const res = await axiosInstance.get(`/api/user/teacher/assignments/${assignmentId}/submissions`);
    const list = res.data?.data || [];
    setSubmissions(list);
    const seed = {};
    list.forEach((row) => {
      seed[row._id] = {
        marksAwarded: row.marksAwarded || 0,
        remarks: row.remarks || '',
      };
    });
    setGradeForm(seed);
  };

  const fetchPrivateMessages = async (withUserId) => {
    if (!withUserId) return setPrivateChat([]);
    const res = await axiosInstance.get(`/api/user/teacher/messages/private?withUserId=${withUserId}`);
    setPrivateChat(res.data?.data || []);
  };

  useEffect(() => {
    setActiveSection(defaultSection || 'course');
  }, [defaultSection]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      try {
        await fetchCore();
      } catch (error) {
        if (mounted) showInfo(error?.response?.data?.message || 'Failed to load teacher center');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();

    const socket = getRealtimeSocket();
    const refresh = () => fetchCore().catch(() => {});
    const refreshDiscussions = () => fetchDiscussions(selectedCourseId).catch(() => {});

    socket.on('teacher:course-updated', refresh);
    socket.on('teacher:course-publish-state', refresh);
    socket.on('assignment:submission', () => {
      refresh();
      fetchSubmissions(selectedAssignmentId).catch(() => {});
    });
    socket.on('assignment:graded', () => {
      refresh();
      fetchSubmissions(selectedAssignmentId).catch(() => {});
    });
    socket.on('message:bulk', refresh);
    socket.on('earnings:withdrawal-requested', refresh);
    socket.on('discussion:new', refreshDiscussions);

    return () => {
      mounted = false;
      socket.off('teacher:course-updated', refresh);
      socket.off('teacher:course-publish-state', refresh);
      socket.off('assignment:submission');
      socket.off('assignment:graded');
      socket.off('message:bulk', refresh);
      socket.off('earnings:withdrawal-requested', refresh);
      socket.off('discussion:new', refreshDiscussions);
    };
  }, [selectedCourseId, selectedAssignmentId]);

  useEffect(() => {
    fetchDiscussions(selectedCourseId).catch(() => {});
    fetchVersions(selectedCourseId).catch(() => {});
    const socket = getRealtimeSocket();
    if (selectedCourseId) socket.emit('join-course', { courseId: selectedCourseId });
    return () => {
      if (selectedCourseId) socket.emit('leave-course', { courseId: selectedCourseId });
    };
  }, [selectedCourseId]);

  useEffect(() => {
    fetchSubmissions(selectedAssignmentId).catch(() => {});
  }, [selectedAssignmentId]);

  useEffect(() => {
    if (!courseForm.courseId || !courseForm.C_title) return;
    const timer = setTimeout(async () => {
      try {
        await axiosInstance.patch(`/api/user/teacher/courses/${courseForm.courseId}/autosave`, {
          C_title: courseForm.C_title,
          C_description: courseForm.C_description,
          tags: courseForm.tags,
          prerequisites: courseForm.prerequisites,
        });
      } catch (error) {}
    }, 1100);
    return () => clearTimeout(timer);
  }, [courseForm]);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/api/user/teacher/courses', { ...courseForm, tags: courseForm.tags, prerequisites: courseForm.prerequisites });
      showInfo('Course created');
      setCourseForm(initialCourseForm);
      await fetchCore();
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to create course');
    }
  };

  const handleUseCourseForEdit = (course) => {
    setCourseForm({
      courseId: course._id,
      C_educator: course.C_educator || '',
      C_title: course.C_title || '',
      C_categories: course.C_categories || '',
      C_price: course.C_price === 'free' ? 0 : course.C_price,
      C_description: course.C_description || '',
      tags: Array.isArray(course.tags) ? course.tags.join(', ') : '',
      prerequisites: Array.isArray(course.prerequisites) ? course.prerequisites.join(', ') : '',
    });
    setQuizBuilder(
      (course.quizzes || []).map((quiz) => ({
        title: quiz.title || '',
        questions: (quiz.questions || []).map((question) => ({
          question: question.question || '',
          optionsCsv: Array.isArray(question.options) ? question.options.join(', ') : '',
          correctOptionIndex: question.correctOptionIndex ?? 0,
        })),
      }))
    );
    setLiveSessionBuilder(
      (course.liveSessions || []).map((session) => ({
        title: session.title || '',
        agenda: session.agenda || '',
        startTime: session.startTime ? String(session.startTime).slice(0, 16) : '',
        endTime: session.endTime ? String(session.endTime).slice(0, 16) : '',
        meetingLink: session.meetingLink || '',
      }))
    );
    setDownloadableBuilder(
      (course.downloadableFiles || []).map((item) => ({
        title: item.title || '',
        fileUrl: item.fileUrl || '',
        fileType: item.fileType || '',
      }))
    );
    setSelectedCourseId(course._id);
  };

  const handleUpdateCourse = async () => {
    if (!courseForm.courseId) return showInfo('Select a course to update');
    try {
      await axiosInstance.put(`/api/user/teacher/courses/${courseForm.courseId}`, courseForm);
      showInfo('Course updated');
      await fetchCore();
      await fetchVersions(courseForm.courseId);
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to update course');
    }
  };

  const handleUpdateAdvancedContent = async () => {
    if (!courseForm.courseId) return showInfo('Select a course first');
    try {
      await axiosInstance.put(`/api/user/teacher/courses/${courseForm.courseId}`, {
        quizzes: quizBuilder.map((quiz) => ({
          title: quiz.title,
          questions: (quiz.questions || []).map((question) => ({
            question: question.question,
            options: String(question.optionsCsv || '')
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
            correctOptionIndex: Number(question.correctOptionIndex || 0),
          })),
        })),
        liveSessions: liveSessionBuilder.map((session) => ({
          title: session.title,
          agenda: session.agenda,
          startTime: session.startTime,
          endTime: session.endTime,
          meetingLink: session.meetingLink,
        })),
        downloadableFiles: downloadableBuilder.map((item) => ({
          title: item.title,
          fileUrl: item.fileUrl,
          fileType: item.fileType,
        })),
      });
      showInfo('Quiz/live/download content updated');
      await fetchCore();
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Content update failed');
    }
  };

  const addQuiz = () => setQuizBuilder((prev) => [...prev, { title: '', questions: [] }]);
  const removeQuiz = (quizIndex) => setQuizBuilder((prev) => prev.filter((_, idx) => idx !== quizIndex));
  const addQuizQuestion = (quizIndex) =>
    setQuizBuilder((prev) =>
      prev.map((quiz, idx) =>
        idx === quizIndex
          ? {
              ...quiz,
              questions: [...(quiz.questions || []), { question: '', optionsCsv: '', correctOptionIndex: 0 }],
            }
          : quiz
      )
    );
  const removeQuizQuestion = (quizIndex, questionIndex) =>
    setQuizBuilder((prev) =>
      prev.map((quiz, idx) =>
        idx === quizIndex
          ? { ...quiz, questions: (quiz.questions || []).filter((_, qIdx) => qIdx !== questionIndex) }
          : quiz
      )
    );

  const addLiveSession = () =>
    setLiveSessionBuilder((prev) => [...prev, { title: '', agenda: '', startTime: '', endTime: '', meetingLink: '' }]);
  const removeLiveSession = (index) => setLiveSessionBuilder((prev) => prev.filter((_, idx) => idx !== index));

  const addDownloadable = () => setDownloadableBuilder((prev) => [...prev, { title: '', fileUrl: '', fileType: '' }]);
  const removeDownloadable = (index) => setDownloadableBuilder((prev) => prev.filter((_, idx) => idx !== index));

  const setPublishState = async (courseId, state, scheduledPublishAt) => {
    try {
      await axiosInstance.patch(`/api/user/teacher/courses/${courseId}/publish-state`, { state, scheduledPublishAt });
      showInfo(`Course set to ${state}`);
      await fetchCore();
      await fetchVersions(courseId);
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to update publish state');
    }
  };

  const handleSchedulePublish = async (courseId) => {
    if (!schedulePublishAt) return showInfo('Choose schedule date/time');
    await setPublishState(courseId, 'scheduled', schedulePublishAt);
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/api/user/teacher/assignments', { ...assignmentForm, type: 'mixed', questions: [] });
      showInfo('Assignment created');
      setAssignmentForm({ courseId: '', title: '', description: '', deadline: '', autoGradeMCQ: false });
      await fetchCore();
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to create assignment');
    }
  };

  const handleGradeSubmission = async (submissionId, returnSubmission = false) => {
    const row = gradeForm[submissionId] || { marksAwarded: 0, remarks: '' };
    try {
      await axiosInstance.patch(`/api/user/teacher/submissions/${submissionId}/grade`, {
        marksAwarded: Number(row.marksAwarded || 0),
        remarks: row.remarks || '',
        returnSubmission,
      });
      showInfo(returnSubmission ? 'Submission returned' : 'Submission graded');
      await fetchSubmissions(selectedAssignmentId);
      await fetchCore();
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to update submission');
    }
  };

  const handlePostDiscussion = async (e) => {
    e.preventDefault();
    if (!selectedCourseId || !discussionText.trim()) return;
    try {
      await axiosInstance.post(`/api/user/courses/${selectedCourseId}/discussions`, { message: discussionText });
      setDiscussionText('');
      await fetchDiscussions(selectedCourseId);
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to post discussion');
    }
  };

  const sendDirect = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/api/user/teacher/messages/direct', directMessage);
      await fetchPrivateMessages(directMessage.recipientId);
      showInfo('Direct message sent');
      setDirectMessage({ recipientId: '', subject: '', body: '' });
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to send direct message');
    }
  };

  const uploadAssets = async (e) => {
    e.preventDefault();
    const courseId = courseForm.courseId || selectedCourseId;
    if (!courseId) return showInfo('Select or edit a course first');
    if (!assetForm.thumbnail && !assetForm.lessonVideo && !assetForm.pdfFile) {
      return showInfo('Choose at least one file to upload');
    }
    try {
      const formData = new FormData();
      if (assetForm.thumbnail) formData.append('thumbnail', assetForm.thumbnail);
      if (assetForm.lessonVideo) {
        formData.append('lessonVideos', assetForm.lessonVideo);
        formData.append('lessonTitle_0', assetForm.lessonTitle || assetForm.lessonVideo.name);
        formData.append('lessonDescription_0', assetForm.lessonDescription || '');
        formData.append('moduleTitle_0', assetForm.moduleTitle || 'Module');
      }
      if (assetForm.pdfFile) {
        formData.append('pdfFiles', assetForm.pdfFile);
        formData.append('pdfTitle_0', assetForm.pdfTitle || assetForm.pdfFile.name);
      }

      await axiosInstance.post(`/api/user/teacher/courses/${courseId}/assets`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showInfo('Assets uploaded');
      setAssetForm({
        thumbnail: null,
        lessonVideo: null,
        lessonTitle: '',
        lessonDescription: '',
        moduleTitle: '',
        pdfFile: null,
        pdfTitle: '',
      });
      await fetchCore();
      await fetchVersions(courseId);
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Asset upload failed');
    }
  };

  const deleteCourse = async (courseId) => {
    if (!window.confirm('Delete this course and related assignment/discussion data?')) return;
    try {
      await axiosInstance.delete(`/api/user/teacher/courses/${courseId}`);
      showInfo('Course deleted');
      if (selectedCourseId === courseId) setSelectedCourseId('');
      await fetchCore();
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to delete course');
    }
  };

  const sendBulk = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/api/user/teacher/messages/bulk', bulkMessage);
      showInfo('Bulk message sent');
      setBulkMessage({ courseId: '', subject: '', body: '' });
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to send bulk message');
    }
  };

  const createWithdrawal = async (e) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/api/user/teacher/withdrawals', { amount: Number(withdrawForm.amount), method: withdrawForm.method });
      showInfo('Withdrawal request submitted');
      setWithdrawForm({ amount: '', method: 'bank-transfer' });
      await fetchCore();
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to request withdrawal');
    }
  };

  if (loading) return <div className="text-center py-5"><Spinner animation="border" /></div>;

  return (
    <div className="teacher-advanced-page">
      {message && <Alert variant="info">{message}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={2}><Card body><strong>{dashboard.summary.totalCourses || 0}</strong><div>Courses</div></Card></Col>
        <Col md={2}><Card body><strong>{dashboard.summary.published || 0}</strong><div>Published</div></Card></Col>
        <Col md={2}><Card body><strong>{dashboard.summary.totalDrafts || 0}</strong><div>Drafts</div></Card></Col>
        <Col md={2}><Card body><strong>{dashboard.summary.scheduled || 0}</strong><div>Scheduled</div></Card></Col>
        <Col md={2}><Card body><strong>{dashboard.summary.totalStudents || 0}</strong><div>Students</div></Card></Col>
        <Col md={2}><Card body><strong>{dashboard.summary.pendingSubmissions || 0}</strong><div>Pending Grading</div></Card></Col>
      </Row>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {sectionOptions.map((section) => (
          <Button
            key={section.key}
            size="sm"
            variant={activeSection === section.key ? 'primary' : 'outline-primary'}
            onClick={() => setActiveSection(section.key)}
          >
            {section.label}
          </Button>
        ))}
      </div>

      {activeSection === 'course' && (
      <Card className="mb-3">
        <Card.Header>Course Creation and Content Management</Card.Header>
        <Card.Body>
          <Form onSubmit={handleCreateCourse}>
            <Row className="g-2">
              <Col md={3}><Form.Control placeholder="Educator" value={courseForm.C_educator} onChange={(e) => setCourseForm((p) => ({ ...p, C_educator: e.target.value }))} /></Col>
              <Col md={3}><Form.Control placeholder="Course Title" value={courseForm.C_title} onChange={(e) => setCourseForm((p) => ({ ...p, C_title: e.target.value }))} required /></Col>
              <Col md={2}><Form.Control placeholder="Category" value={courseForm.C_categories} onChange={(e) => setCourseForm((p) => ({ ...p, C_categories: e.target.value }))} required /></Col>
              <Col md={2}><Form.Control placeholder="Price" value={courseForm.C_price} onChange={(e) => setCourseForm((p) => ({ ...p, C_price: e.target.value }))} /></Col>
              <Col md={2}><Form.Control placeholder="Tags (comma)" value={courseForm.tags} onChange={(e) => setCourseForm((p) => ({ ...p, tags: e.target.value }))} /></Col>
              <Col md={12}><Form.Control as="textarea" rows={2} placeholder="Description" value={courseForm.C_description} onChange={(e) => setCourseForm((p) => ({ ...p, C_description: e.target.value }))} required /></Col>
              <Col md={8}><Form.Control placeholder="Prerequisites (comma)" value={courseForm.prerequisites} onChange={(e) => setCourseForm((p) => ({ ...p, prerequisites: e.target.value }))} /></Col>
              <Col md={4} className="d-flex gap-2">
                <Button type="submit" size="sm">Create</Button>
                <Button type="button" size="sm" variant="outline-primary" onClick={handleUpdateCourse}>Update Selected</Button>
              </Col>
            </Row>
          </Form>

          <Row className="g-2 mt-2">
            <Col md={4}><Form.Control type="datetime-local" value={schedulePublishAt} onChange={(e) => setSchedulePublishAt(e.target.value)} /></Col>
            <Col md={8} className="small text-muted d-flex align-items-center">Schedule publish date/time and click Schedule for any course row.</Col>
          </Row>

          <Table responsive bordered hover size="sm" className="mt-3 mb-0">
            <thead><tr><th>Title</th><th>Status</th><th>Enrollments</th><th>Actions</th></tr></thead>
            <tbody>
              {dashboard.courses.map((course) => (
                <tr key={course._id}>
                  <td>{course.C_title}</td>
                  <td><Badge bg={course.publishStatus === 'published' ? 'success' : 'secondary'}>{course.publishStatus || 'draft'}</Badge></td>
                  <td>{course.enrolled || 0}</td>
                  <td className="d-flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline-dark" onClick={() => handleUseCourseForEdit(course)}>Edit</Button>
                    <Button size="sm" variant="outline-success" onClick={() => setPublishState(course._id, 'published')}>Publish</Button>
                    <Button size="sm" variant="outline-warning" onClick={() => setPublishState(course._id, 'draft')}>Draft</Button>
                    <Button size="sm" variant="outline-info" onClick={() => handleSchedulePublish(course._id)}>Schedule</Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => setPublishState(course._id, 'unpublished')}>Unpublish</Button>
                    <Button size="sm" variant="outline-danger" onClick={() => deleteCourse(course._id)}>Delete</Button>
                    <Button size="sm" variant="outline-primary" onClick={() => fetchVersions(course._id)}>Versions</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
      )}

      {activeSection === 'modules' && (
      <Row className="g-3">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header>Modules/Lessons + File Uploads</Card.Header>
            <Card.Body>
              <Form onSubmit={uploadAssets} className="mb-3">
                <Row className="g-2">
                  <Col md={12}><strong className="small">Thumbnail (image)</strong><Form.Control type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(e) => setAssetForm((p) => ({ ...p, thumbnail: e.target.files?.[0] || null }))} /></Col>
                  <Col md={4}><strong className="small">Module</strong><Form.Control placeholder="Module title" value={assetForm.moduleTitle} onChange={(e) => setAssetForm((p) => ({ ...p, moduleTitle: e.target.value }))} /></Col>
                  <Col md={4}><strong className="small">Lesson</strong><Form.Control placeholder="Lesson title" value={assetForm.lessonTitle} onChange={(e) => setAssetForm((p) => ({ ...p, lessonTitle: e.target.value }))} /></Col>
                  <Col md={4}><strong className="small">Lesson Video (.mp4)</strong><Form.Control type="file" accept=".mp4" onChange={(e) => setAssetForm((p) => ({ ...p, lessonVideo: e.target.files?.[0] || null }))} /></Col>
                  <Col md={8}><Form.Control placeholder="Lesson description" value={assetForm.lessonDescription} onChange={(e) => setAssetForm((p) => ({ ...p, lessonDescription: e.target.value }))} /></Col>
                  <Col md={4}><strong className="small">Download PDF</strong><Form.Control type="file" accept=".pdf" onChange={(e) => setAssetForm((p) => ({ ...p, pdfFile: e.target.files?.[0] || null }))} /></Col>
                  <Col md={8}><Form.Control placeholder="PDF title" value={assetForm.pdfTitle} onChange={(e) => setAssetForm((p) => ({ ...p, pdfTitle: e.target.value }))} /></Col>
                  <Col md={4}><Button size="sm" type="submit">Upload Assets</Button></Col>
                </Row>
              </Form>

              <Card className="mb-2"><Card.Body className="small">This uploader supports: module/lesson video, downloadable PDF, and course thumbnail.</Card.Body></Card>

              <hr />
              <h6 className="mb-2">Advanced Builders</h6>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong>Quizzes</strong>
                  <Button size="sm" variant="outline-secondary" onClick={addQuiz}>Add Quiz</Button>
                </div>
                <div className="teacher-scroll-list">
                  {quizBuilder.map((quiz, quizIndex) => (
                    <div className="border rounded p-2 mb-2" key={`quiz-${quizIndex}`}>
                      <Row className="g-2">
                        <Col md={9}>
                          <Form.Control
                            placeholder="Quiz Title"
                            value={quiz.title}
                            onChange={(e) =>
                              setQuizBuilder((prev) =>
                                prev.map((item, idx) => (idx === quizIndex ? { ...item, title: e.target.value } : item))
                              )
                            }
                          />
                        </Col>
                        <Col md={3}>
                          <Button size="sm" variant="outline-danger" onClick={() => removeQuiz(quizIndex)}>Remove</Button>
                        </Col>
                      </Row>
                      <div className="mt-2 mb-2 d-flex justify-content-between align-items-center">
                        <small className="text-muted">Questions</small>
                        <Button size="sm" variant="outline-primary" onClick={() => addQuizQuestion(quizIndex)}>Add Question</Button>
                      </div>
                      {(quiz.questions || []).map((question, questionIndex) => (
                        <div className="border rounded p-2 mb-2" key={`quiz-${quizIndex}-q-${questionIndex}`}>
                          <Form.Control
                            className="mb-2"
                            placeholder="Question"
                            value={question.question}
                            onChange={(e) =>
                              setQuizBuilder((prev) =>
                                prev.map((item, idx) =>
                                  idx === quizIndex
                                    ? {
                                        ...item,
                                        questions: item.questions.map((q, qIdx) =>
                                          qIdx === questionIndex ? { ...q, question: e.target.value } : q
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                          />
                          <Form.Control
                            className="mb-2"
                            placeholder="Options (comma separated)"
                            value={question.optionsCsv}
                            onChange={(e) =>
                              setQuizBuilder((prev) =>
                                prev.map((item, idx) =>
                                  idx === quizIndex
                                    ? {
                                        ...item,
                                        questions: item.questions.map((q, qIdx) =>
                                          qIdx === questionIndex ? { ...q, optionsCsv: e.target.value } : q
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                          />
                          <Row className="g-2">
                            <Col md={8}>
                              <Form.Control
                                type="number"
                                min={0}
                                placeholder="Correct option index"
                                value={question.correctOptionIndex}
                                onChange={(e) =>
                                  setQuizBuilder((prev) =>
                                    prev.map((item, idx) =>
                                      idx === quizIndex
                                        ? {
                                            ...item,
                                            questions: item.questions.map((q, qIdx) =>
                                              qIdx === questionIndex ? { ...q, correctOptionIndex: e.target.value } : q
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }
                              />
                            </Col>
                            <Col md={4}>
                              <Button size="sm" variant="outline-danger" onClick={() => removeQuizQuestion(quizIndex, questionIndex)}>
                                Remove Q
                              </Button>
                            </Col>
                          </Row>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong>Live Sessions</strong>
                  <Button size="sm" variant="outline-secondary" onClick={addLiveSession}>Add Session</Button>
                </div>
                <div className="teacher-scroll-list">
                  {liveSessionBuilder.map((session, idx) => (
                    <div className="border rounded p-2 mb-2" key={`session-${idx}`}>
                      <Form.Control className="mb-2" placeholder="Title" value={session.title} onChange={(e) => setLiveSessionBuilder((prev) => prev.map((item, pIdx) => pIdx === idx ? { ...item, title: e.target.value } : item))} />
                      <Form.Control className="mb-2" placeholder="Agenda" value={session.agenda} onChange={(e) => setLiveSessionBuilder((prev) => prev.map((item, pIdx) => pIdx === idx ? { ...item, agenda: e.target.value } : item))} />
                      <Row className="g-2 mb-2">
                        <Col md={6}><Form.Control type="datetime-local" value={session.startTime} onChange={(e) => setLiveSessionBuilder((prev) => prev.map((item, pIdx) => pIdx === idx ? { ...item, startTime: e.target.value } : item))} /></Col>
                        <Col md={6}><Form.Control type="datetime-local" value={session.endTime} onChange={(e) => setLiveSessionBuilder((prev) => prev.map((item, pIdx) => pIdx === idx ? { ...item, endTime: e.target.value } : item))} /></Col>
                      </Row>
                      <Row className="g-2">
                        <Col md={8}><Form.Control placeholder="Meeting Link" value={session.meetingLink} onChange={(e) => setLiveSessionBuilder((prev) => prev.map((item, pIdx) => pIdx === idx ? { ...item, meetingLink: e.target.value } : item))} /></Col>
                        <Col md={4}><Button size="sm" variant="outline-danger" onClick={() => removeLiveSession(idx)}>Remove</Button></Col>
                      </Row>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong>Downloadables</strong>
                  <Button size="sm" variant="outline-secondary" onClick={addDownloadable}>Add File</Button>
                </div>
                <div className="teacher-scroll-list">
                  {downloadableBuilder.map((file, idx) => (
                    <div className="border rounded p-2 mb-2" key={`file-${idx}`}>
                      <Form.Control className="mb-2" placeholder="Title" value={file.title} onChange={(e) => setDownloadableBuilder((prev) => prev.map((item, pIdx) => pIdx === idx ? { ...item, title: e.target.value } : item))} />
                      <Form.Control className="mb-2" placeholder="File URL" value={file.fileUrl} onChange={(e) => setDownloadableBuilder((prev) => prev.map((item, pIdx) => pIdx === idx ? { ...item, fileUrl: e.target.value } : item))} />
                      <Row className="g-2">
                        <Col md={8}><Form.Control placeholder="File Type (pdf/doc/etc)" value={file.fileType} onChange={(e) => setDownloadableBuilder((prev) => prev.map((item, pIdx) => pIdx === idx ? { ...item, fileType: e.target.value } : item))} /></Col>
                        <Col md={4}><Button size="sm" variant="outline-danger" onClick={() => removeDownloadable(idx)}>Remove</Button></Col>
                      </Row>
                    </div>
                  ))}
                </div>
              </div>
              <Button size="sm" onClick={handleUpdateAdvancedContent}>Update Content Blocks</Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      )}

      {activeSection === 'versions' && (
      <Row className="g-3">
        <Col lg={12}>
          <Card className="h-100">
            <Card.Header>Version History</Card.Header>
            <Card.Body>
              <div className="teacher-scroll-list">
                {versionHistory.length === 0 && <div className="text-muted small">No versions loaded</div>}
                {versionHistory.slice().reverse().map((v) => (
                  <div key={`${v.version}-${v.changedAt}`} className="border rounded p-2 mb-2">
                    <strong>v{v.version}</strong> - {v.summary || '-'}
                    <div className="small text-muted">{new Date(v.changedAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      )}

      {activeSection === 'assignments' && (
      <Row className="g-3 mt-1">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header>Assignments</Card.Header>
            <Card.Body>
              <Form onSubmit={handleCreateAssignment} className="mb-3">
                <Row className="g-2">
                  <Col md={6}>
                    <Form.Select value={assignmentForm.courseId} onChange={(e) => setAssignmentForm((p) => ({ ...p, courseId: e.target.value }))} required>
                      <option value="">Select Course</option>
                      {dashboard.courses.map((course) => <option key={course._id} value={course._id}>{course.C_title}</option>)}
                    </Form.Select>
                  </Col>
                  <Col md={6}><Form.Control type="datetime-local" value={assignmentForm.deadline} onChange={(e) => setAssignmentForm((p) => ({ ...p, deadline: e.target.value }))} required /></Col>
                  <Col md={12}><Form.Control placeholder="Assignment title" value={assignmentForm.title} onChange={(e) => setAssignmentForm((p) => ({ ...p, title: e.target.value }))} required /></Col>
                  <Col md={12}><Form.Control as="textarea" rows={2} placeholder="Assignment description" value={assignmentForm.description} onChange={(e) => setAssignmentForm((p) => ({ ...p, description: e.target.value }))} /></Col>
                  <Col md={7}><Form.Check type="switch" label="Auto-grade MCQs" checked={assignmentForm.autoGradeMCQ} onChange={(e) => setAssignmentForm((p) => ({ ...p, autoGradeMCQ: e.target.checked }))} /></Col>
                  <Col md={5}><Button type="submit" size="sm">Create Assignment</Button></Col>
                </Row>
              </Form>

              <Form.Select className="mb-2" value={selectedAssignmentId} onChange={(e) => setSelectedAssignmentId(e.target.value)}>
                <option value="">Select assignment to grade</option>
                {assignments.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}
              </Form.Select>

              <div className="teacher-scroll-list">
                {submissions.map((sub) => (
                  <div key={sub._id} className="border rounded p-2 mb-2">
                    <div><strong>{sub.studentId?.name || 'Student'}</strong> ({sub.studentId?.email || '-'})</div>
                    <div className="small text-muted mb-1">Status: {sub.status}</div>
                    <Row className="g-2">
                      <Col md={3}><Form.Control type="number" value={gradeForm[sub._id]?.marksAwarded ?? 0} onChange={(e) => setGradeForm((p) => ({ ...p, [sub._id]: { ...(p[sub._id] || {}), marksAwarded: e.target.value } }))} /></Col>
                      <Col md={9}><Form.Control value={gradeForm[sub._id]?.remarks ?? ''} placeholder="Remarks" onChange={(e) => setGradeForm((p) => ({ ...p, [sub._id]: { ...(p[sub._id] || {}), remarks: e.target.value } }))} /></Col>
                      <Col md={12} className="d-flex gap-2">
                        <Button size="sm" onClick={() => handleGradeSubmission(sub._id, false)}>Grade</Button>
                        <Button size="sm" variant="outline-secondary" onClick={() => handleGradeSubmission(sub._id, true)}>Return</Button>
                      </Col>
                    </Row>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      )}

      {activeSection === 'monitoring' && (
      <Row className="g-3 mt-1">
        <Col lg={12}>
          <Card className="h-100">
            <Card.Header>Student Monitoring</Card.Header>
            <Card.Body>
              <div className="mb-2"><a href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/user/teacher/students/export`} target="_blank" rel="noreferrer">Export performance CSV</a></div>
              <div className="teacher-scroll-list">
                {students.map((student) => (
                  <div key={student.enrollmentId} className="border rounded p-2 mb-2">
                    <strong>{student.studentName}</strong> <span className="text-muted small">({student.studentEmail})</span>
                    <div className="small">Completion: {student.completionPercent}%</div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      )}

      {activeSection === 'communication' && (
      <Row className="g-3 mt-1">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header>Communication</Card.Header>
            <Card.Body>
              <Form onSubmit={sendDirect} className="mb-3">
                <h6 className="mb-2">Direct Message</h6>
                <Row className="g-2">
                  <Col md={4}><Form.Control placeholder="Recipient User ID" value={directMessage.recipientId} onChange={(e) => setDirectMessage((p) => ({ ...p, recipientId: e.target.value }))} required /></Col>
                  <Col md={4}><Form.Control placeholder="Subject" value={directMessage.subject} onChange={(e) => setDirectMessage((p) => ({ ...p, subject: e.target.value }))} /></Col>
                  <Col md={4} className="d-flex gap-2">
                    <Button type="submit" size="sm">Send</Button>
                    <Button type="button" size="sm" variant="outline-secondary" onClick={() => fetchPrivateMessages(directMessage.recipientId)}>Load Chat</Button>
                  </Col>
                  <Col md={12}><Form.Control as="textarea" rows={2} placeholder="Message" value={directMessage.body} onChange={(e) => setDirectMessage((p) => ({ ...p, body: e.target.value }))} required /></Col>
                </Row>
              </Form>
              <div className="teacher-scroll-list mb-3">
                {privateChat.map((msg) => (
                  <div key={msg._id} className="border rounded p-2 mb-2">
                    <div className="small"><strong>{msg.senderId?.name || 'User'}</strong>: {msg.subject || 'No subject'}</div>
                    <div>{msg.body}</div>
                    <div className="small text-muted">{new Date(msg.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <Form onSubmit={sendBulk}>
                <h6 className="mb-2">Bulk Message by Course</h6>
                <Row className="g-2">
                  <Col md={4}>
                    <Form.Select value={bulkMessage.courseId} onChange={(e) => setBulkMessage((p) => ({ ...p, courseId: e.target.value }))} required>
                      <option value="">Select Course</option>
                      {dashboard.courses.map((course) => <option key={course._id} value={course._id}>{course.C_title}</option>)}
                    </Form.Select>
                  </Col>
                  <Col md={4}><Form.Control placeholder="Subject" value={bulkMessage.subject} onChange={(e) => setBulkMessage((p) => ({ ...p, subject: e.target.value }))} /></Col>
                  <Col md={4}><Button type="submit" size="sm" variant="outline-primary">Send Bulk</Button></Col>
                  <Col md={12}><Form.Control as="textarea" rows={2} placeholder="Announcement or class message" value={bulkMessage.body} onChange={(e) => setBulkMessage((p) => ({ ...p, body: e.target.value }))} required /></Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      )}

      {activeSection === 'discussion' && (
      <Row className="g-3 mt-1">
        <Col lg={12}>
          <Card className="h-100">
            <Card.Header>Discussion Board</Card.Header>
            <Card.Body>
              <Form.Select className="mb-2" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
                <option value="">Select Course</option>
                {dashboard.courses.map((course) => <option key={course._id} value={course._id}>{course.C_title}</option>)}
              </Form.Select>
              {selectedCourse && <small className="text-muted">Live room: {selectedCourse.C_title}</small>}

              <Form onSubmit={handlePostDiscussion} className="my-2 d-flex gap-2">
                <Form.Control placeholder="Post to discussion" value={discussionText} onChange={(e) => setDiscussionText(e.target.value)} />
                <Button type="submit" size="sm">Post</Button>
              </Form>

              <div className="teacher-scroll-list">
                {discussionFeed.map((item) => (
                  <div key={item._id} className="border rounded p-2 mb-2">
                    <strong>{item.userId?.name || 'User'}</strong>
                    <div>{item.message}</div>
                    <div className="small text-muted">{new Date(item.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      )}

      {activeSection === 'earnings' && (
      <Card className="mt-3">
        <Card.Header>Earnings and Withdrawals</Card.Header>
        <Card.Body>
          <Row className="g-3">
            <Col md={3}><Card body><strong>Rs. {Math.round(earnings.grossRevenue || 0)}</strong><div>Gross</div></Card></Col>
            <Col md={3}><Card body><strong>Rs. {Math.round(earnings.availableBalance || 0)}</strong><div>Available</div></Card></Col>
            <Col md={3}><Card body><strong>Rs. {Math.round(earnings.pendingAmount || 0)}</strong><div>Pending</div></Card></Col>
            <Col md={3}><Card body><strong>Rs. {Math.round(earnings.totalWithdrawn || 0)}</strong><div>Withdrawn</div></Card></Col>
          </Row>

          <Form onSubmit={createWithdrawal} className="mt-3">
            <Row className="g-2 align-items-end">
              <Col md={4}><Form.Control type="number" placeholder="Withdrawal amount" value={withdrawForm.amount} onChange={(e) => setWithdrawForm((p) => ({ ...p, amount: e.target.value }))} required /></Col>
              <Col md={4}><Form.Select value={withdrawForm.method} onChange={(e) => setWithdrawForm((p) => ({ ...p, method: e.target.value }))}><option value="bank-transfer">Bank Transfer</option><option value="upi">UPI</option></Form.Select></Col>
              <Col md={4}><Button type="submit" size="sm">Request Withdrawal</Button></Col>
            </Row>
          </Form>

          <Table responsive bordered hover size="sm" className="mt-3 mb-0">
            <thead><tr><th>Course</th><th>Enrollments</th><th>Avg Completion</th><th>Status</th></tr></thead>
            <tbody>
              {(performance.courseStats || []).map((row) => (
                <tr key={row.courseId}><td>{row.title}</td><td>{row.enrollments}</td><td>{row.avgCompletion}%</td><td>{row.status}</td></tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
      )}
    </div>
  );
};

export default TeacherAdvancedCenter;
