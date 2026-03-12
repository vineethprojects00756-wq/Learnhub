const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const userSchema = require("../schemas/userModel");
const courseSchema = require("../schemas/courseModel");
const enrolledCourseSchema = require("../schemas/enrolledCourseModel");
const coursePaymentSchema = require("../schemas/coursePaymentModel");
const reviewSchema = require("../schemas/reviewModel");
const notificationSchema = require("../schemas/notificationModel");
const adminSettingSchema = require("../schemas/adminSettingModel");
const assignmentSchema = require("../schemas/assignmentModel");
const assignmentSubmissionSchema = require("../schemas/assignmentSubmissionModel");
const quizAttemptSchema = require("../schemas/quizAttemptModel");
const wishlistSchema = require("../schemas/wishlistModel");
const { sendEmail } = require("../utils/emailService");
const { emitToUser } = require("../utils/realtime");
const { awardLearningActivity } = require("../utils/gamification");
// sendPasswordResetEmail import removed

const getSettingValue = async (key, fallback = null) => {
  const setting = await adminSettingSchema.findOne({ key });
  return setting?.value ?? fallback;
};

const parsePriceValue = (value) => {
  if (value === "free" || value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const buildAuthToken = (user) =>
  jwt.sign({ id: user._id, role: (user.type || "").toLowerCase() }, process.env.JWT_KEY, {
    expiresIn: "1d",
  });

const buildTwoFactorCodeHash = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");

const dispatchTwoFactorCode = async (user) => {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  user.twoFactorCodeHash = buildTwoFactorCodeHash(code);
  user.twoFactorCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  const emailResult = await sendEmail({
    to: user.email,
    subject: "LearnHub verification code",
    text: `Your LearnHub verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your LearnHub verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
  });
  return {
    code,
    sent: !!emailResult?.sent,
    reason: emailResult?.reason || null,
  };
};
//////////for registering/////////////////////////////
const registerController = async (req, res) => {
  try {
    const existsUser = await userSchema.findOne({ email: req.body.email });
    if (existsUser) {
      return res
        .status(200)
        .send({ message: "User already exists", success: false });
    }
    const password = req.body.password;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    req.body.password = hashedPassword;

    const teacherApprovalRequired = String(process.env.TEACHER_APPROVAL_REQUIRED || "false").toLowerCase() === "true";
    const payload = { ...req.body };
    if ((payload.type || "").toLowerCase() === "teacher") {
      payload.teacherApprovalRequired = teacherApprovalRequired;
      payload.teacherApprovalStatus = teacherApprovalRequired ? "pending" : "approved";
    }

    const newUser = new userSchema(payload);
    await newUser.save();

    return res.status(201).send({
      message: teacherApprovalRequired && (payload.type || "").toLowerCase() === "teacher"
        ? "Register success. Teacher account is pending approval."
        : "Register Success",
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .send({ success: false, message: `${error.message}` });
  }
};

////for the login
const loginController = async (req, res) => {
  try {
    const user = await userSchema.findOne({ email: req.body.email });
    if (!user) {
      return res
        .status(200)
        .send({ message: "User not found", success: false });
    }
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      return res
        .status(200)
        .send({ message: "Invalid email or password", success: false });
    }
    if ((user.type || "").toLowerCase() === "teacher" && user.teacherApprovalRequired && user.teacherApprovalStatus !== "approved") {
      return res.status(403).send({
        success: false,
        message: "Teacher account is pending approval",
      });
    }

    if (user.twoFactorEnabled) {
      const dispatchInfo = await dispatchTwoFactorCode(user);
      const twoFactorToken = jwt.sign(
        { id: user._id, role: (user.type || "").toLowerCase(), flow: "2fa-login" },
        process.env.JWT_KEY,
        { expiresIn: "10m" }
      );
      return res.status(200).send({
        success: true,
        requiresTwoFactor: true,
        twoFactorToken,
        message: dispatchInfo.sent
          ? "Verification code sent to your email."
          : "Verification code generated. Email delivery unavailable in this environment.",
      });
    }

    const token = buildAuthToken(user);
    user.password = undefined;
    return res.status(200).send({
      message: "Login success successfully",
      success: true,
      token,
      userData: user,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .send({ success: false, message: `${error.message}` });
  }
};

const verifyTwoFactorLoginController = async (req, res) => {
  try {
    const { twoFactorToken, code } = req.body;
    if (!twoFactorToken || !code) {
      return res.status(400).send({ success: false, message: "twoFactorToken and code are required" });
    }

    const decoded = jwt.verify(twoFactorToken, process.env.JWT_KEY);
    if (decoded.flow !== "2fa-login") {
      return res.status(400).send({ success: false, message: "Invalid 2FA flow token" });
    }

    const user = await userSchema.findById(decoded.id);
    if (!user || !user.twoFactorEnabled) {
      return res.status(400).send({ success: false, message: "2FA is not enabled for this account" });
    }
    if (!user.twoFactorCodeHash || !user.twoFactorCodeExpiry || new Date(user.twoFactorCodeExpiry) < new Date()) {
      return res.status(400).send({ success: false, message: "Verification code expired" });
    }

    const incomingHash = buildTwoFactorCodeHash(code);
    if (incomingHash !== user.twoFactorCodeHash) {
      return res.status(400).send({ success: false, message: "Invalid verification code" });
    }

    user.twoFactorCodeHash = null;
    user.twoFactorCodeExpiry = null;
    await user.save();

    const token = buildAuthToken(user);
    user.password = undefined;
    return res.status(200).send({
      success: true,
      token,
      userData: user,
      message: "2FA verification successful",
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const requestTwoFactorSetupController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const user = await userSchema.findById(userId);
    if (!user) return res.status(404).send({ success: false, message: "User not found" });

    const dispatchInfo = await dispatchTwoFactorCode(user);
    return res.status(200).send({
      success: true,
      message: dispatchInfo.sent
        ? "Setup code sent to your email"
        : "Setup code generated. Email delivery unavailable in this environment.",
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const confirmTwoFactorSetupController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { code } = req.body;
    if (!code) return res.status(400).send({ success: false, message: "code is required" });

    const user = await userSchema.findById(userId);
    if (!user) return res.status(404).send({ success: false, message: "User not found" });
    if (!user.twoFactorCodeHash || !user.twoFactorCodeExpiry || new Date(user.twoFactorCodeExpiry) < new Date()) {
      return res.status(400).send({ success: false, message: "Verification code expired" });
    }
    if (buildTwoFactorCodeHash(code) !== user.twoFactorCodeHash) {
      return res.status(400).send({ success: false, message: "Invalid verification code" });
    }

    user.twoFactorEnabled = true;
    user.twoFactorCodeHash = null;
    user.twoFactorCodeExpiry = null;
    await user.save();
    emitToUser(String(userId), "student:security-updated", { twoFactorEnabled: true });

    return res.status(200).send({ success: true, message: "Two-factor authentication enabled" });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const disableTwoFactorController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { password } = req.body;
    if (!password) return res.status(400).send({ success: false, message: "password is required" });

    const user = await userSchema.findById(userId);
    if (!user) return res.status(404).send({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send({ success: false, message: "Invalid password" });

    user.twoFactorEnabled = false;
    user.twoFactorCodeHash = null;
    user.twoFactorCodeExpiry = null;
    await user.save();
    emitToUser(String(userId), "student:security-updated", { twoFactorEnabled: false });

    return res.status(200).send({ success: true, message: "Two-factor authentication disabled" });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

//get all courses
const getAllCoursesController = async (req, res) => {
  try {
    const maintenanceMode = await getSettingValue("maintenanceMode", false);
    if (maintenanceMode) {
      return res.status(503).send({
        success: false,
        message: "Platform is in maintenance mode. Please try again later.",
      });
    }

    const allCourses = await courseSchema
      .find({
        $or: [{ approved: true }, { approved: { $exists: false } }],
        archived: { $ne: true },
      })
      .sort({ featured: -1, createdAt: -1 });
    if (!allCourses) {
      return res.status(404).send("No Courses Found");
    }

    const coursesWithPricing = allCourses.map((course) => {
      const rawPrice = parsePriceValue(course.C_price);
      const discount = Number(course.discount || 0);
      const discountedPrice = rawPrice > 0 ? Math.max(rawPrice - (rawPrice * discount) / 100, 0) : 0;

      return {
        ...course.toObject(),
        rawPrice,
        finalPrice: discountedPrice,
        isFree: rawPrice === 0 || discountedPrice === 0,
      };
    });

    return res.status(200).send({
      success: true,
      data: coursesWithPricing,
    });
  } catch (error) {
    console.error("Error in deleting course:", error);
    res
      .status(500)
      .send({ success: false, message: "Failed to delete course" });
  }
};

////////posting course////////////
const postCourseController = async (req, res) => {
  try {
    let price;
    // Extract data from the request body and files
    const {
      userId,
      C_educator,
      C_title,
      C_categories,
      C_price,
      C_description,
      S_title,
      S_description,
    } = req.body; 
    const S_content = req.files.map((file) => file.filename); // Assuming you want to store the filenames in S_content
    // Create an array of sections
    const sections = [];
    if (S_content.length > 1){
      for (let i = 0; i < S_content.length; i++) {
        sections.push({
          S_title: S_title[i],
          S_content: {
            filename: S_content[i],
            path: `/uploads/${S_content[i]}`,
          },
          S_description: S_description[i],
        });
      }
    } else{
      sections.push({
        S_title: S_title,
        S_content: {
          filename: S_content[0],
          path: `/uploads/${S_content[0]}`,
        },
        S_description: S_description,
      });
    }
    
    if (C_price == 0) {
      price = "free";
    } else {
      price = C_price;
    }
    // Create an instance of the course schema
    const course = new courseSchema({
      userId,
      C_educator,
      C_title,
      C_categories,
      C_price: price,
      C_description,
      sections,
      approved: false,
      archived: false,
      featured: false,
    });
    // Save the course instance to the database
    await course.save();
    res
      .status(201)
      .send({ success: true, message: "Course created successfully" });
  } catch (error) {
    console.error("Error creating course:", error);
    res
      .status(500)
      .send({ success: false, message: "Failed to create course" });
  }
};

// get single course by id (for editing)
const getCourseById = async (req, res) => {
  const { courseid } = req.params;
  try {
    const course = await courseSchema.findById(courseid);
    if (!course) {
      return res.status(404).send({ success: false, message: 'Course not found' });
    }
    return res.status(200).send({ success: true, data: course });
  } catch (error) {
    console.error('Error fetching course:', error);
    return res.status(500).send({ success: false, message: 'Failed to fetch course' });
  }
};

// update course by teacher
const updateCourseController = async (req, res) => {
  const { courseid } = req.params;
  try {
    const course = await courseSchema.findById(courseid);
    if (!course) return res.status(404).send({ success: false, message: 'Course not found' });

    // ensure the requester is the owner (teacher)
    if (course.userId !== req.body.userId) {
      return res.status(403).send({ success: false, message: 'Not authorized to update this course' });
    }

    // Update basic fields
    const { C_educator, C_title, C_categories, C_price, C_description } = req.body;
    if (C_educator) course.C_educator = C_educator;
    if (C_title) course.C_title = C_title;
    if (C_categories) course.C_categories = C_categories;
    if (C_price !== undefined) course.C_price = C_price == 0 ? 'free' : C_price;
    if (C_description) course.C_description = C_description;
    // Any teacher edit requires admin re-approval to keep moderation/admin flow consistent.
    course.approved = false;

    // If files were uploaded, rebuild sections from incoming fields/files
    if (req.files && req.files.length > 0) {
      const S_content = req.files.map((file) => file.filename);
      const S_title = req.body.S_title;
      const S_description = req.body.S_description;
      const sections = [];

      if (Array.isArray(S_content) && S_content.length > 1) {
        for (let i = 0; i < S_content.length; i++) {
          sections.push({
            S_title: Array.isArray(S_title) ? S_title[i] : S_title,
            S_content: {
              filename: S_content[i],
              path: `/uploads/${S_content[i]}`,
            },
            S_description: Array.isArray(S_description) ? S_description[i] : S_description,
          });
        }
      } else {
        sections.push({
          S_title: Array.isArray(S_title) ? S_title[0] : S_title,
          S_content: {
            filename: S_content[0],
            path: `/uploads/${S_content[0]}`,
          },
          S_description: Array.isArray(S_description) ? S_description[0] : S_description,
        });
      }

      course.sections = sections;
    }

    await course.save();
    return res.status(200).send({ success: true, message: 'Course updated successfully', data: course });
  } catch (error) {
    console.error('Error updating course:', error);
    return res.status(500).send({ success: false, message: 'Failed to update course' });
  }
};

///all courses for the teacher
const getAllCoursesUserController = async (req, res) => {
  try {
    const allCourses = await courseSchema.find({ userId: req.body.userId });
    if (!allCourses) {
      res.send({
        success: false,
        message: "No Courses Found",
      });
    } else {
      res.send({
        success: true,
        message: "All Courses Fetched Successfully",
        data: allCourses,
      });
    }
  } catch (error) {
    console.error("Error in fetching courses:", error);
    res
      .status(500)
      .send({ success: false, message: "Failed to fetch courses" });
  }
};

///delete courses by the teacher
const deleteCourseController = async (req, res) => {
  const { courseid } = req.params; // Use the correct parameter name
  try {
    const course = await courseSchema.findById(courseid);
    if (!course) {
      return res.status(404).send({ success: false, message: "Course not found" });
    }

    if (String(course.userId) !== String(req.body.userId)) {
      return res.status(403).send({ success: false, message: "Not authorized to delete this course" });
    }

    await courseSchema.findByIdAndDelete({ _id: courseid });

    // Check if the course was found and deleted successfully
    res
      .status(200)
      .send({ success: true, message: "Course deleted successfully" });
  } catch (error) {
    console.error("Error in deleting course:", error);
    res
      .status(500)
      .send({ success: false, message: "Failed to delete course" });
  }
};

////enrolled course by the student

const enrolledCourseController = async (req, res) => {
  const { courseid } = req.params;
  const { userId } = req.body;
  try {
    const course = await courseSchema.findById(courseid);

    if (!course) {
      return res
        .status(404)
        .send({ success: false, message: "Course Not Found!" });
    }

    if (!course.approved || course.archived) {
      return res.status(400).send({
        success: false,
        message: "This course is currently unavailable for enrollment.",
      });
    }

    let course_Length = course.sections.length;

    // Check if the user is already enrolled in the course
    const enrolledCourse = await enrolledCourseSchema.findOne({
      courseId: courseid,
      userId: userId,
      course_Length: course_Length,
    });

    if (!enrolledCourse) {
      const enrolledCourseInstance = new enrolledCourseSchema({
        courseId: courseid,
        userId: userId,
        course_Length: course_Length,
      });

      const coursePayment = new coursePaymentSchema({
        userId: req.body.userId,
        courseId: courseid,
        ...req.body,
      });

      await coursePayment.save();
      await enrolledCourseInstance.save();
      await awardLearningActivity({
        userId,
        points: 20,
        reason: "Course enrollment",
        courseId: courseid,
      });

      // Increment the 'enrolled' count of the course by +1
      course.enrolled += 1;
      await course.save();
      emitToUser(String(userId), "student:enrolled-course", {
        courseId: course._id,
        title: course.C_title,
      });

      res.status(200).send({
        success: true,
        message: "Enroll Successfully",
        course: { id: course._id, Title: course.C_title },
      });
    } else {
      res.status(200).send({
        success: false,
        message: "You are already enrolled in this Course!",
        course: { id: course._id, Title: course.C_title },
      });
    }
  } catch (error) {
    console.error("Error in enrolling course:", error);
    res
      .status(500)
      .send({ success: false, message: "Failed to enroll in the course" });
  }
};

/////sending the course content for learning to student
const sendCourseContentController = async (req, res) => {
  const { courseid } = req.params;

  try {
    const [course, assignments] = await Promise.all([
      courseSchema.findById({ _id: courseid }),
      assignmentSchema.find({ courseId: courseid, published: true }).sort({ createdAt: -1 }),
    ]);
    if (!course)
      return res.status(404).send({
        success: false,
        message: "No such course found",
      });

    const user = await enrolledCourseSchema.findOne({
      userId: req.body.userId,
      courseId: courseid, // Add the condition to match the courseId
    });

    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    } else {
      const [assignmentGrades, quizScores] = await Promise.all([
        assignmentSubmissionSchema.find({ courseId: courseid, studentId: req.body.userId }).sort({ updatedAt: -1 }),
        quizAttemptSchema.find({ courseId: courseid, studentId: req.body.userId }).sort({ createdAt: -1 }),
      ]);

      return res.status(200).send({
        success: true,
        courseContent: course.sections,
        courseMeta: {
          downloadableFiles: course.downloadableFiles || [],
          liveSessions: course.liveSessions || [],
          quizzes: course.quizzes || [],
          discussionEnabled: course.discussionEnabled !== false,
        },
        assignments,
        completeModule: user.progress,
        certficateData: user,
        continueFrom: {
          sectionId: Number(user.lastAccessedSection || 0),
          lastAccessedAt: user.lastAccessedAt || null,
        },
        assignmentGrades,
        quizScores,
      });
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
};

//////////////completing module////////
const completeSectionController = async (req, res) => {
  const { courseId, sectionId } = req.body; // Assuming you send courseId and sectionId in the request body

  // console.log(courseId, sectionId)
  try {
    // Check if the user is enrolled in the course
    const enrolledCourseContent = await enrolledCourseSchema.findOne({
      courseId: courseId,
      userId: req.body.userId, // Assuming you have user information in req.user
    });

    if (!enrolledCourseContent) {
      return res
        .status(400)
        .send({ message: "User is not enrolled in the course" });
    }

    // Update the progress for the section
    const updatedProgress = enrolledCourseContent.progress || [];
    const alreadyCompleted = updatedProgress.some(
      (item) => Number(item?.sectionId) === Number(sectionId)
    );

    if (!alreadyCompleted) {
      updatedProgress.push({ sectionId: sectionId });
    }

    enrolledCourseContent.progress = updatedProgress;
    enrolledCourseContent.lastAccessedSection = Number(sectionId || 0);
    enrolledCourseContent.lastAccessedAt = new Date();
    if (updatedProgress.length >= Number(enrolledCourseContent.course_Length || 0) && !enrolledCourseContent.certificateDate) {
      enrolledCourseContent.certificateDate = new Date();
    }
    await enrolledCourseContent.save();

    if (!alreadyCompleted) {
      await awardLearningActivity({
        userId: req.body.userId,
        points: 10,
        reason: "Lesson completed",
        courseId,
      });
    }

    const progressPercent =
      Number(enrolledCourseContent.course_Length || 0) > 0
        ? Math.min(Math.round((updatedProgress.length / Number(enrolledCourseContent.course_Length || 0)) * 100), 100)
        : 0;
    emitToUser(String(req.body.userId), "student:progress-updated", {
      courseId,
      completedSections: updatedProgress.length,
      totalSections: Number(enrolledCourseContent.course_Length || 0),
      progressPercent,
      lastAccessedSection: Number(sectionId || 0),
      certificateUnlocked: progressPercent === 100,
    });

    res.status(200).send({
      success: true,
      message: "Section completed successfully",
      alreadyCompleted,
      progressPercent,
      certificateUnlocked: progressPercent === 100,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Internal server error" });
  }
};

////////////get all courses for paricular user
const sendAllCoursesUserController = async (req, res) => {
  const { userId } = req.body;
  try {
    // First, fetch the enrolled courses for the user
    const enrolledCourses = await enrolledCourseSchema.find({ userId });

    // Now, let's retrieve course details for each enrolled course
    const coursesDetails = await Promise.all(
      enrolledCourses.map(async (enrolledCourse) => {
        // Find the corresponding course details using courseId
        const courseDetails = await courseSchema.findOne({
          _id: enrolledCourse.courseId,
        });
        if (!courseDetails) return null;

        const completedSections = Array.isArray(enrolledCourse.progress)
          ? enrolledCourse.progress
              .map((entry) => entry?.sectionId)
              .filter((sectionId) => sectionId !== undefined && sectionId !== null)
          : [];

        return {
          ...courseDetails.toObject(),
          completedSections,
          progressCount: completedSections.length,
          enrolledAt: enrolledCourse.createdAt,
          lastAccessedSection: Number(enrolledCourse.lastAccessedSection || 0),
          lastAccessedAt: enrolledCourse.lastAccessedAt || null,
          nextSection: Math.min(completedSections.length, (courseDetails.sections || []).length - 1),
          progressPercent:
            (courseDetails.sections || []).length > 0
              ? Math.min(Math.round((completedSections.length / (courseDetails.sections || []).length) * 100), 100)
              : 0,
        };
      })
    );

    return res.status(200).send({
      success: true,
      data: coursesDetails.filter(Boolean),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred" });
  }
};

// Get User Profile Controller
const getUserProfileController = async (req, res) => {
  try {
    const userId = req.body.userId || req.params.userId;

    if (!userId) {
      return res.status(400).send({
        success: false,
        message: "User ID is required",
      });
    }

    // Find user by ID
    const user = await userSchema.findById(userId).select("-password");
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).send({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get Profile Error:", error);
    return res.status(500).send({
      success: false,
      message: "An error occurred while fetching profile",
    });
  }
};

// Update User Profile Controller
const updateUserProfileController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { name, email, phone, bio, location, reminderEnabled, reminderTime } = req.body;

    if (!userId) {
      return res.status(400).send({
        success: false,
        message: "User ID is required",
      });
    }

    // Find user
    const user = await userSchema.findById(userId);
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // Check if email already exists (if trying to update email)
    if (email && email !== user.email) {
      const existingEmail = await userSchema.findOne({ email: email });
      if (existingEmail) {
        return res.status(400).send({
          success: false,
          message: "Email already in use",
        });
      }
    }

    // Update allowed fields
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (reminderEnabled !== undefined) updateData.reminderEnabled = !!reminderEnabled;
    if (reminderTime !== undefined) updateData.reminderTime = String(reminderTime || "19:00");
    if (req.file) updateData.profilePicture = `/uploads/${req.file.filename}`;

    // Update user
    const updatedUser = await userSchema.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select("-password");

    return res.status(200).send({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
      userData: updatedUser,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(500).send({
      success: false,
      message: "An error occurred while updating profile",
    });
  }
};

// Change Password Controller
const changePasswordController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!userId || !currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).send({
        success: false,
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).send({
        success: false,
        message: "New passwords do not match",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).send({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Find user
    const user = await userSchema.findById(userId);
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordMatch) {
      return res.status(400).send({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await userSchema.findByIdAndUpdate(userId, {
      password: hashedPassword,
    });
    emitToUser(String(userId), "student:security-updated", { passwordChangedAt: new Date() });

    return res.status(200).send({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change Password Error:", error);
    return res.status(500).send({
      success: false,
      message: "An error occurred while changing password",
    });
  }
};

// Search and Filter Courses Controller
const searchFilterCoursesController = async (req, res) => {
  try {
    const { search, category, priceType, sortBy, limit = 12, page = 1 } = req.query;

    let query = {};

    // Search by title or description
    if (search) {
      query.$or = [
        { C_title: { $regex: search, $options: 'i' } },
        { C_description: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by category
    if (category && category !== 'All') {
      query.C_categories = category;
    }

    // Filter by price
    if (priceType === 'free') {
      query.C_price = 'free';
    } else if (priceType === 'paid') {
      query.C_price = { $ne: 'free' };
    }

    // Sorting options
    let sortOption = { createdAt: -1 }; // Default: newest first
    if (sortBy === 'popular') {
      sortOption = { enrollmentCount: -1 };
    } else if (sortBy === 'price-low') {
      sortOption = { C_price: 1 };
    } else if (sortBy === 'price-high') {
      sortOption = { C_price: -1 };
    } else if (sortBy === 'title') {
      sortOption = { C_title: 1 };
    }

    // Calculate pagination
    const skipCount = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const totalCourses = await courseSchema.countDocuments(query);

    // Get courses with filtering, sorting, and pagination
    const courses = await courseSchema
      .find(query)
      .sort(sortOption)
      .skip(skipCount)
      .limit(parseInt(limit));

    // Get unique categories for filter options
    const categories = await courseSchema.distinct('C_categories');

    return res.status(200).send({
      success: true,
      data: courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCourses / parseInt(limit)),
        totalCourses,
        coursesPerPage: parseInt(limit),
      },
      filters: {
        categories: categories.filter(cat => cat && cat.trim() !== ''),
      },
    });
  } catch (error) {
    console.error("Search Filter Error:", error);
    return res.status(500).send({
      success: false,
      message: "An error occurred while searching courses",
    });
  }
};

// Add Review Controller
const addReviewController = async (req, res) => {
  try {
    const { courseId, userId, userName, rating, title, comment } = req.body;

    // Validate inputs
    if (!courseId || !userId || !rating || !title || !comment) {
      return res.status(400).send({
        success: false,
        message: "All fields are required",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).send({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Check if course exists
    const course = await courseSchema.findById(courseId);
    if (!course) {
      return res.status(404).send({
        success: false,
        message: "Course not found",
      });
    }

    // Check if user already reviewed this course
    const existingReview = await reviewSchema.findOne({ courseId, userId });
    if (existingReview) {
      return res.status(400).send({
        success: false,
        message: "You have already reviewed this course",
      });
    }

    // Create new review
    const newReview = new reviewSchema({
      courseId,
      userId,
      userName,
      rating,
      title,
      comment,
    });

    await newReview.save();

    return res.status(201).send({
      success: true,
      message: "Review added successfully",
      data: newReview,
    });
  } catch (error) {
    console.error("Add Review Error:", error);
    return res.status(500).send({
      success: false,
      message: "An error occurred while adding review",
    });
  }
};

// Get Course Reviews Controller
const getReviewsController = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { limit = 10, page = 1 } = req.query;

    if (!courseId) {
      return res.status(400).send({
        success: false,
        message: "Course ID is required",
      });
    }

    // Calculate pagination
    const skipCount = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const totalReviews = await reviewSchema.countDocuments({ courseId });

    // Get reviews
    const reviews = await reviewSchema
      .find({ courseId })
      .sort({ createdAt: -1 })
      .skip(skipCount)
      .limit(parseInt(limit));

    // Calculate average rating
    const ratingStats = await reviewSchema.aggregate([
      { $match: { courseId: require("mongoose").Types.ObjectId(courseId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: "$rating",
          },
        },
      },
    ]);

    const stats = ratingStats.length > 0 ? ratingStats[0] : {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: [],
    };

    // Count distribution
    const distribution = {
      5: (stats.ratingDistribution || []).filter(r => r === 5).length,
      4: (stats.ratingDistribution || []).filter(r => r === 4).length,
      3: (stats.ratingDistribution || []).filter(r => r === 3).length,
      2: (stats.ratingDistribution || []).filter(r => r === 2).length,
      1: (stats.ratingDistribution || []).filter(r => r === 1).length,
    };

    return res.status(200).send({
      success: true,
      data: reviews,
      stats: {
        averageRating: parseFloat((stats.averageRating || 0).toFixed(1)),
        totalReviews,
        ratingDistribution: distribution,
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReviews / parseInt(limit)),
        totalReviews,
      },
    });
  } catch (error) {
    console.error("Get Reviews Error:", error);
    return res.status(500).send({
      success: false,
      message: "An error occurred while fetching reviews",
    });
  }
};

// Update Review Controller
const updateReviewController = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { userId, rating, title, comment } = req.body;

    if (!reviewId) {
      return res.status(400).send({
        success: false,
        message: "Review ID is required",
      });
    }

    // Find review
    const review = await reviewSchema.findById(reviewId);
    if (!review) {
      return res.status(404).send({
        success: false,
        message: "Review not found",
      });
    }

    // Check if user owns the review
    if (review.userId.toString() !== userId) {
      return res.status(403).send({
        success: false,
        message: "You can only edit your own review",
      });
    }

    // Update review
    if (rating) review.rating = rating;
    if (title) review.title = title;
    if (comment) review.comment = comment;

    await review.save();

    return res.status(200).send({
      success: true,
      message: "Review updated successfully",
      data: review,
    });
  } catch (error) {
    console.error("Update Review Error:", error);
    return res.status(500).send({
      success: false,
      message: "An error occurred while updating review",
    });
  }
};

// Delete Review Controller
const deleteReviewController = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { userId } = req.body;

    if (!reviewId) {
      return res.status(400).send({
        success: false,
        message: "Review ID is required",
      });
    }

    // Find review
    const review = await reviewSchema.findById(reviewId);
    if (!review) {
      return res.status(404).send({
        success: false,
        message: "Review not found",
      });
    }

    // Check if user owns the review
    if (review.userId.toString() !== userId) {
      return res.status(403).send({
        success: false,
        message: "You can only delete your own review",
      });
    }

    // Delete review
    await reviewSchema.findByIdAndDelete(reviewId);

    return res.status(200).send({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete Review Error:", error);
    return res.status(500).send({
      success: false,
      message: "An error occurred while deleting review",
    });
  }
};

const getUserNotificationsController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const [notifications, unreadCount] = await Promise.all([
      notificationSchema.find({ userId }).sort({ createdAt: -1 }).limit(50),
      notificationSchema.countDocuments({ userId, isRead: false }),
    ]);

    return res.status(200).send({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const markNotificationReadController = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.body.userId;

    const notification = await notificationSchema.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).send({ success: false, message: "Notification not found" });
    }

    return res.status(200).send({ success: true, data: notification, message: "Notification marked as read" });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const markAllNotificationsReadController = async (req, res) => {
  try {
    const userId = req.body.userId;
    await notificationSchema.updateMany({ userId, isRead: false }, { isRead: true });
    return res.status(200).send({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const teacherDashboardController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const [courses, unreadCount] = await Promise.all([
      courseSchema.find({ userId }),
      notificationSchema.countDocuments({ userId, isRead: false }),
    ]);

    const totalCourses = courses.length;
    const approvedCourses = courses.filter((course) => course.approved && !course.archived).length;
    const pendingCourses = courses.filter((course) => !course.approved && !course.archived).length;
    const archivedCourses = courses.filter((course) => course.archived).length;
    const totalEnrollments = courses.reduce((sum, course) => sum + Number(course.enrolled || 0), 0);

    return res.status(200).send({
      success: true,
      data: {
        totalCourses,
        approvedCourses,
        pendingCourses,
        archivedCourses,
        totalEnrollments,
        unreadCount,
      },
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

const studentDashboardController = async (req, res) => {
  try {
    const userId = req.body.userId;
    const [enrollments, unreadCount, user, wishlistCount] = await Promise.all([
      enrolledCourseSchema.find({ userId }),
      notificationSchema.countDocuments({ userId, isRead: false }),
      userSchema.findById(userId).select("points badges streakDays reminderEnabled reminderTime lastReminderSentOn"),
      wishlistSchema.countDocuments({ studentId: userId }),
    ]);

    const courseIds = enrollments.map((item) => item.courseId);
    const courses = await courseSchema.find({ _id: { $in: courseIds } });
    const courseMap = new Map(courses.map((course) => [String(course._id), course]));

    const enrolledCourses = enrollments.length;
    let completedCourses = 0;
    let totalProgressPercent = 0;

    enrollments.forEach((item) => {
      const totalSections = Number(item.course_Length || 0);
      const completed = Array.isArray(item.progress) ? item.progress.length : 0;
      if (totalSections > 0 && completed >= totalSections) {
        completedCourses += 1;
      }
      if (totalSections > 0) {
        totalProgressPercent += Math.min((completed / totalSections) * 100, 100);
      }
    });

    const averageProgress = enrolledCourses > 0 ? Math.round(totalProgressPercent / enrolledCourses) : 0;
    const availableCourses = await courseSchema.countDocuments({
      $or: [{ approved: true }, { approved: { $exists: false } }],
      archived: { $ne: true },
    });

    const now = new Date();
    if (user?.reminderEnabled) {
      const [hours, minutes] = String(user.reminderTime || "19:00")
        .split(":")
        .map((item) => Number(item || 0));
      const dueToday = now.getHours() > hours || (now.getHours() === hours && now.getMinutes() >= minutes);
      const lastReminder = user.lastReminderSentOn ? new Date(user.lastReminderSentOn) : null;
      const alreadySentToday =
        lastReminder &&
        lastReminder.getFullYear() === now.getFullYear() &&
        lastReminder.getMonth() === now.getMonth() &&
        lastReminder.getDate() === now.getDate();

      if (dueToday && !alreadySentToday) {
        const reminder = await notificationSchema.create({
          userId,
          type: "reminder",
          title: "Daily learning reminder",
          message: "Keep your streak alive. Continue a lesson today.",
          meta: { kind: "daily-reminder" },
        });
        user.lastReminderSentOn = now;
        await user.save();
        emitToUser(String(userId), "notification:new", reminder);
      }
    }

    return res.status(200).send({
      success: true,
      data: {
        enrolledCourses,
        completedCourses,
        averageProgress,
        availableCourses,
        unreadCount,
        wishlistCount,
        points: Number(user?.points || 0),
        badges: user?.badges || [],
        streakDays: Number(user?.streakDays || 0),
        reminderEnabled: !!user?.reminderEnabled,
        reminderTime: user?.reminderTime || "19:00",
        latestEnrolled: enrollments
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5)
          .map((item) => {
            const course = courseMap.get(String(item.courseId));
            return {
              courseId: item.courseId,
              title: course?.C_title || "Untitled Course",
              educator: course?.C_educator || "-",
              enrolledAt: item.createdAt,
            };
          }),
      },
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

module.exports = {
  registerController,
  loginController,
  verifyTwoFactorLoginController,
  requestTwoFactorSetupController,
  confirmTwoFactorSetupController,
  disableTwoFactorController,
  getAllCoursesController,
  postCourseController,
  getAllCoursesUserController,
  deleteCourseController,
  enrolledCourseController,
  sendCourseContentController,
  completeSectionController,
  sendAllCoursesUserController,
  getCourseById,
  updateCourseController,
  getUserProfileController,
  updateUserProfileController,
  changePasswordController,
  searchFilterCoursesController,
  addReviewController,
  getReviewsController,
  updateReviewController,
  deleteReviewController,
  getUserNotificationsController,
  markNotificationReadController,
  markAllNotificationsReadController,
  teacherDashboardController,
  studentDashboardController,
};
