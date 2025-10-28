import nodemailer from 'nodemailer';

const sendEmail = async (options) => {

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });

 const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || options.message
  };

  const info = await transporter.sendMail(mailOptions);

  console.log('Message sent: %s', info.messageId);
  return info;
};

export default sendEmail;