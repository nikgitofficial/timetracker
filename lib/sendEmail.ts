// lib/sendEmail.ts
import { Resend } from "resend";

export default async function sendEmail(to: string, subject: string, otp: string) {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
      <h2 style="color: #2e7d32;">🔐 NikNotes Password Reset</h2>
      <p>Hello,</p>
      <p>You requested to reset your password. Please use the OTP below:</p>
      <div style="margin: 20px 0; text-align: center;">
        <span style="font-size: 24px; font-weight: bold; color: #1a237e; letter-spacing: 4px;">${otp}</span>
      </div>
      <p>This OTP expires in 10 minutes. If you didn't request it, ignore this email.</p>
      <br>
      <p style="font-size: 14px; color: #555;">— Nikko MP</p>
    </div>
  `;

  try {
    // Always log OTP in dev for testing
    if (process.env.NODE_ENV === "development") {
      console.log("📝 OTP for testing:", otp);
      console.log(`Simulated sending to: ${to}`);
    }

    // ✅ Initialize Resend inside the function so it only runs at request time, not build time
    if (process.env.NODE_ENV === "production") {
      const resend = new Resend(process.env.RESEND_API_KEY!);
      await resend.emails.send({
        from: process.env.FROM_EMAIL!, // must be verified
        to,
        subject,
        html: htmlContent,
      });
      console.log("✅ OTP email sent to:", to);
    }
  } catch (err) {
    console.error("❌ Failed to send email:", err);
    throw new Error("Email sending failed");
  }
}