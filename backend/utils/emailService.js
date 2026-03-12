const nodemailer = require('nodemailer');

// Create a transporter using Gmail or other email service
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const sendEmail = async ({ to, subject, text, html }) => {
  if (!to || !subject) return { sent: false, reason: "missing-fields" };
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return { sent: false, reason: "email-not-configured" };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      text,
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    return { sent: false, reason: error.message };
  }
};

module.exports = {
  sendEmail,
};
