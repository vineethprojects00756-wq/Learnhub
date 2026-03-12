import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { Accordion, Alert, Card, Form, Modal } from 'react-bootstrap';
import axiosInstance from '../../common/AxiosInstance';
import ReactPlayer from 'react-player';
import { UserContext } from '../../../App';
import NavBar from '../../common/NavBar';
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Button } from '@mui/material';
import { motion } from 'framer-motion';
import { getRealtimeSocket } from '../../../utils/realtimeSocket';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const CourseContent = () => {
  const user = useContext(UserContext);
  const { courseId, courseTitle } = useParams();
  const [courseContent, setCourseContent] = useState([]);
  const [courseMeta, setCourseMeta] = useState({ downloadableFiles: [], liveSessions: [], quizzes: [], discussionEnabled: true });
  const [assignments, setAssignments] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [playingSectionIndex, setPlayingSectionIndex] = useState(-1);
  const [completedSections, setCompletedSections] = useState([]);
  const [completedModule, setCompletedModule] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [certificate, setCertificate] = useState(null);
  const [info, setInfo] = useState('');
  const [discussionFeed, setDiscussionFeed] = useState([]);
  const [discussionText, setDiscussionText] = useState('');
  const [assignmentAnswers, setAssignmentAnswers] = useState({});
  const [quizAnswers, setQuizAnswers] = useState({});
  const [assignmentGrades, setAssignmentGrades] = useState([]);
  const [quizScores, setQuizScores] = useState([]);
  const [quizFeedback, setQuizFeedback] = useState({});
  const [teacherId, setTeacherId] = useState('');
  const [teacherMessage, setTeacherMessage] = useState('');
  const [chatFeed, setChatFeed] = useState([]);

  const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
  const completedModuleIds = completedModule.map((item) => item.sectionId);

  const showInfo = (text) => {
    setInfo(text);
    setTimeout(() => setInfo(''), 2500);
  };

  const downloadPdfDocument = (rootElementId) => {
    const input = document.getElementById(rootElementId);
    if (!input) return;
    html2canvas(input).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      pdf.addImage(imgData, 'JPEG', -35, 10);
      pdf.save('download-certificate.pdf');
    });
  };

  const getCourseContent = async () => {
    try {
      const res = await axiosInstance.get(`/api/user/coursecontent/${courseId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.data.success) {
        setCourseContent(res.data.courseContent || []);
        setCourseMeta(res.data.courseMeta || { downloadableFiles: [], liveSessions: [], quizzes: [], discussionEnabled: true });
        setAssignments(res.data.assignments || []);
        setCompletedModule(res.data.completeModule || []);
        setCertificate(res.data.certficateData?.certificateDate || res.data.certficateData?.updatedAt || null);
        setAssignmentGrades(res.data.assignmentGrades || []);
        setQuizScores(res.data.quizScores || []);
        setPlayingSectionIndex(Number(res.data?.continueFrom?.sectionId || -1));
      }
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to load course content');
    }
  };

  const getCourseById = async () => {
    try {
      const res = await axiosInstance.get(`/api/user/getcourse/${courseId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res?.data?.success) setTeacherId(res.data.data?.userId || '');
    } catch (error) {
      // no-op
    }
  };

  const getDiscussions = async () => {
    try {
      const res = await axiosInstance.get(`/api/user/courses/${courseId}/discussions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.data.success) setDiscussionFeed(res.data.data || []);
    } catch (error) {
      // keep view stable
    }
  };

  useEffect(() => {
    getCourseContent();
    getDiscussions();
    getCourseById();

    const socket = getRealtimeSocket();
    socket.emit('join-course', { courseId });
    const refresh = () => {
      getCourseContent();
      getDiscussions();
    };
    socket.on('discussion:new', getDiscussions);
    socket.on('course:updated', refresh);
    socket.on('student:progress-updated', refresh);
    socket.on('assignment:graded', refresh);
    socket.on('student:assignment-submitted', refresh);
    socket.on('student:quiz-attempted', refresh);
    return () => {
      socket.emit('leave-course', { courseId });
      socket.off('discussion:new', getDiscussions);
      socket.off('course:updated', refresh);
      socket.off('student:progress-updated', refresh);
      socket.off('assignment:graded', refresh);
      socket.off('student:assignment-submitted', refresh);
      socket.off('student:quiz-attempted', refresh);
    };
  }, [courseId]);

  const playVideo = (videoPath, index) => {
    setCurrentVideo(videoPath);
    setPlayingSectionIndex(index);
    axiosInstance.patch(`/api/user/student/courses/${courseId}/continue`, { sectionId: index }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).catch(() => {});
  };

  const completeModule = async (sectionId) => {
    if (completedModule.length < courseContent.length) {
      if (playingSectionIndex !== -1 && !completedSections.includes(playingSectionIndex)) {
        setCompletedSections([...completedSections, playingSectionIndex]);
        try {
          const res = await axiosInstance.post(`/api/user/completemodule`, { courseId, sectionId }, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          if (res.data.success) {
            if (res.data.alreadyCompleted) showInfo('Section already completed');
            else showInfo('Section marked as completed');
            getCourseContent();
          }
        } catch (error) {
          showInfo(error?.response?.data?.message || 'Failed to mark section completed');
        }
      }
    } else {
      setShowModal(true);
    }
  };

  const submitAssignment = async (assignmentId) => {
    try {
      const answerText = assignmentAnswers[assignmentId] || '';
      if (!answerText.trim()) return showInfo('Enter assignment answer before submit');
      await axiosInstance.post(`/api/user/student/assignments/${assignmentId}/submit`, {
        answers: { text: answerText },
        attachments: [],
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      showInfo('Assignment submitted successfully');
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to submit assignment');
    }
  };

  const submitQuiz = async (quizIndex) => {
    const value = quizAnswers[quizIndex];
    if (!value) return showInfo('Select answers for quiz questions');
    try {
      const res = await axiosInstance.post(`/api/user/student/courses/${courseId}/quizzes/${quizIndex}/attempt`, {
        answers: value,
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res?.data?.success) {
        const result = res.data.data || {};
        setQuizFeedback((prev) => ({ ...prev, [quizIndex]: result }));
        showInfo(`Quiz submitted: ${result.score}/${result.total} (${result.percentage}%)`);
        getCourseContent();
      } else {
        showInfo(res?.data?.message || 'Quiz submission failed');
      }
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Quiz submission failed');
    }
  };

  const postDiscussion = async (e) => {
    e.preventDefault();
    if (!discussionText.trim()) return;
    try {
      await axiosInstance.post(`/api/user/courses/${courseId}/discussions`, { message: discussionText }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setDiscussionText('');
      getDiscussions();
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to post discussion');
    }
  };

  const sendTeacherMessage = async (e) => {
    e.preventDefault();
    if (!teacherId || !teacherMessage.trim()) return;
    try {
      await axiosInstance.post(`/api/user/student/messages/${teacherId}`, {
        subject: `Question about ${courseTitle}`,
        body: teacherMessage,
        courseId,
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setTeacherMessage('');
      showInfo('Message sent to teacher');
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Failed to send message');
    }
  };

  const loadChatThread = async () => {
    if (!teacherId) return;
    try {
      const res = await axiosInstance.get(`/api/user/student/messages/${teacherId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res?.data?.success) setChatFeed(res.data.data || []);
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Unable to load chat');
    }
  };

  const reportContent = async (sectionId) => {
    try {
      await axiosInstance.post('/api/user/student/report-content', {
        courseId,
        sectionId,
        reason: 'Inappropriate or incorrect content',
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      showInfo('Content reported');
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Unable to report content');
    }
  };

  const fetchCertificate = async () => {
    try {
      const res = await axiosInstance.get(`/api/user/student/courses/${courseId}/certificate`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res?.data?.success) {
        setCertificate(res.data.data.completedOn);
        setShowModal(true);
      } else {
        showInfo(res?.data?.message || 'Certificate unavailable');
      }
    } catch (error) {
      showInfo(error?.response?.data?.message || 'Certificate unavailable');
    }
  };

  const renderSectionTitle = (section, index) => section.S_title || section.lessonTitle || `Lesson ${index + 1}`;
  const renderSectionDescription = (section) => section.S_description || section.lessonDescription || '';
  const getSectionVideoPath = (section) => section?.S_content?.path || section?.video?.path || null;

  return (
    <>
      <NavBar />
      <motion.h1
        className='my-3 text-center'
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.6 }}
      >
        Welcome to the course: {courseTitle}
      </motion.h1>

      {info && <Alert variant="info" className="mx-3">{info}</Alert>}

      <div className='course-content d-flex flex-wrap gap-4 justify-content-center'>
        <motion.div
          className="course-section"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.8 }}
        >
          <Accordion defaultActiveKey="0" flush>
            {courseContent.map((section, index) => {
              const sectionId = index;
              const isSectionCompleted = completedModuleIds.includes(sectionId);
              const videoPath = getSectionVideoPath(section);

              return (
                <motion.div
                  key={index}
                  variants={fadeIn}
                  initial="hidden"
                  animate="visible"
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                >
                  <Accordion.Item eventKey={index.toString()}>
                    <Accordion.Header>{renderSectionTitle(section, index)}</Accordion.Header>
                    <Accordion.Body>
                      <p className="mb-2">{renderSectionDescription(section)}</p>
                      {videoPath && (
                        <>
                          <Button color='success' className='mx-2' variant="text" size="small"
                            onClick={() => playVideo(`${baseUrl}${videoPath}`, index)}
                          >
                            Play Video
                          </Button>
                          {!isSectionCompleted && !completedSections.includes(index) && (
                            <Button
                              variant='contained'
                              color='success'
                              size='small'
                              onClick={() => completeModule(sectionId)}
                              disabled={playingSectionIndex !== index}
                            >
                              Mark as Completed
                            </Button>
                          )}
                          <Button variant="text" size="small" color="error" onClick={() => reportContent(sectionId)}>
                            Report
                          </Button>
                        </>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                </motion.div>
              );
            })}

            {completedModule.length === courseContent.length && courseContent.length > 0 && (
              <motion.div variants={fadeIn} initial="hidden" animate="visible" transition={{ duration: 0.5 }}>
              <Button className='my-2' variant='outlined' onClick={fetchCertificate}>
                Download Certificate
              </Button>
            </motion.div>
            )}
          </Accordion>

          {courseMeta.downloadableFiles?.length > 0 && (
            <Card className="mt-3">
              <Card.Body>
                <h6>Downloadable Resources</h6>
                {courseMeta.downloadableFiles.map((file, idx) => (
                  <div key={idx} className="small mb-2">
                    <a href={`${baseUrl}${file.fileUrl || ''}`} target="_blank" rel="noreferrer">{file.title || `File ${idx + 1}`}</a>
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}

          {courseMeta.liveSessions?.length > 0 && (
            <Card className="mt-3">
              <Card.Body>
                <h6>Live Sessions</h6>
                {courseMeta.liveSessions.map((session, idx) => (
                  <div key={idx} className="small mb-2">
                    <div><strong>{session.title || `Session ${idx + 1}`}</strong></div>
                    <div>{session.agenda || ''}</div>
                    <div>{session.startTime ? new Date(session.startTime).toLocaleString() : '-'}</div>
                    {session.meetingLink && <a href={session.meetingLink} target="_blank" rel="noreferrer">Join Link</a>}
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}

          {courseMeta.quizzes?.length > 0 && (
            <Card className="mt-3">
              <Card.Body>
                <h6>Quizzes</h6>
                {courseMeta.quizzes.map((quiz, qIdx) => (
                  <div key={qIdx} className="mb-3 border rounded p-2">
                    <strong>{quiz.title || `Quiz ${qIdx + 1}`}</strong>
                    {(quiz.questions || []).map((question, idx) => (
                      <Form.Group key={idx} className="mt-2">
                        <Form.Label className="small">{question.question}</Form.Label>
                        {(question.options || []).map((option, optIdx) => (
                          <Form.Check
                            key={optIdx}
                            type="radio"
                            name={`quiz-${qIdx}-q-${idx}`}
                            label={option}
                            onChange={() => setQuizAnswers((prev) => ({
                              ...prev,
                              [qIdx]: {
                                ...(prev[qIdx] || {}),
                                [idx]: optIdx,
                              },
                            }))}
                          />
                        ))}
                      </Form.Group>
                    ))}
                    <Button variant="outlined" size="small" onClick={() => submitQuiz(qIdx)}>
                      Submit Quiz
                    </Button>
                    {quizFeedback[qIdx] && (
                      <div className="small mt-2">
                        Score: {quizFeedback[qIdx].score}/{quizFeedback[qIdx].total} ({quizFeedback[qIdx].percentage}%)
                        <br />
                        Retry: {quizFeedback[qIdx].canRetry ? 'Allowed' : 'Limit reached'}
                        {Array.isArray(quizFeedback[qIdx].correctAnswers) && (
                          <>
                            <br />
                            Correct answers: {quizFeedback[qIdx].correctAnswers.map((idx) => Number(idx) + 1).join(', ')}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}

          {quizScores?.length > 0 && (
            <Card className="mt-3">
              <Card.Body>
                <h6>Quiz Score History</h6>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {quizScores.map((attempt) => (
                    <div key={attempt._id} className="border rounded p-2 mb-2 small">
                      <strong>Quiz {Number(attempt.quizIndex) + 1}</strong> - Attempt {attempt.attemptNumber}
                      <div>Score: {attempt.score}/{attempt.total} ({attempt.percentage}%)</div>
                      <div className="text-muted">{new Date(attempt.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}

          {assignments?.length > 0 && (
            <Card className="mt-3">
              <Card.Body>
                <h6>Assignments</h6>
                {assignments.map((assignment) => (
                  <div key={assignment._id} className="mb-3 border rounded p-2">
                    <div><strong>{assignment.title}</strong></div>
                    <div className="small text-muted">Deadline: {assignment.deadline ? new Date(assignment.deadline).toLocaleString() : '-'}</div>
                    <p className="small mb-2">{assignment.description}</p>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      placeholder="Write your answer"
                      value={assignmentAnswers[assignment._id] || ''}
                      onChange={(e) => setAssignmentAnswers((prev) => ({ ...prev, [assignment._id]: e.target.value }))}
                    />
                    <Button className="mt-2" variant="contained" size="small" onClick={() => submitAssignment(assignment._id)}>
                      Submit Assignment
                    </Button>
                    {assignmentGrades.find((g) => String(g.assignmentId) === String(assignment._id)) && (
                      <div className="small mt-2 text-muted">
                        Grade: {assignmentGrades.find((g) => String(g.assignmentId) === String(assignment._id))?.marksAwarded ?? 0}
                      </div>
                    )}
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}

          {courseMeta.discussionEnabled && (
            <Card className="mt-3">
              <Card.Body>
                <h6>Discussion Thread</h6>
                <Form onSubmit={postDiscussion} className="mb-2 d-flex gap-2">
                  <Form.Control value={discussionText} onChange={(e) => setDiscussionText(e.target.value)} placeholder="Ask or share something..." />
                  <Button type="submit" variant="contained" size="small">Post</Button>
                </Form>
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {discussionFeed.map((item) => (
                    <div key={item._id} className="border rounded p-2 mb-2">
                      <div className="small"><strong>{item.userId?.name || 'User'}</strong></div>
                      <div>{item.message}</div>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}

          <Card className="mt-3">
            <Card.Body>
              <h6>Chat with Teacher</h6>
              <Form onSubmit={sendTeacherMessage} className="mb-2 d-flex gap-2">
                <Form.Control value={teacherMessage} onChange={(e) => setTeacherMessage(e.target.value)} placeholder="Type your question..." />
                <Button type="submit" variant="contained" size="small">Send</Button>
                <Button type="button" variant="outlined" size="small" onClick={loadChatThread}>Load Chat</Button>
              </Form>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {chatFeed.map((item) => (
                  <div key={item._id} className="border rounded p-2 mb-2">
                    <div className="small"><strong>{item.senderId?.name || 'User'}</strong></div>
                    <div>{item.body}</div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </motion.div>

        <motion.div
          className="course-video w-50"
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          transition={{ duration: 1 }}
        >
          {currentVideo && (
            <ReactPlayer
              url={currentVideo}
              width='100%'
              height='100%'
              controls
            />
          )}
        </motion.div>
      </div>

      <Modal size="lg" show={showModal} onHide={() => setShowModal(false)} dialogClassName="modal-90w">
        <Modal.Header closeButton>
          <Modal.Title>Completion Certificate</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <motion.div
            id='certificate-download'
            className="certificate text-center"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.6 }}
          >
            <h1>Certificate of Completion</h1>
            <div className="content">
              <p>This is to certify that</p>
              <h2>{user.userData?.name}</h2>
              <p>has successfully completed the course</p>
              <h3>{courseTitle}</h3>
              <p>on</p>
              <p className="date">{certificate ? new Date(certificate).toLocaleDateString() : '-'}</p>
            </div>
          </motion.div>
          <Button onClick={() => downloadPdfDocument('certificate-download')} style={{ float: 'right', marginTop: 3 }}>
            Download Certificate
          </Button>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default CourseContent;
