export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// One plain layout for every email: a short message, a button and the link as text.
const layout = (input: {
  heading: string;
  intro: string;
  buttonText: string;
  link: string;
  footer: string;
}) => {
  const link = escapeHtml(input.link);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f7;font-family:Arial,sans-serif;color:#14152b;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(input.heading)}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${escapeHtml(input.intro)}</p>
      <a href="${link}" style="display:inline-block;padding:12px 20px;background:#5b4df0;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;">${escapeHtml(input.buttonText)}</a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#5a5f80;">If the button doesn't work, open this link:<br /><a href="${link}" style="color:#5b4df0;word-break:break-all;">${link}</a></p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#5a5f80;">${escapeHtml(input.footer)}</p>
    </div>
  </body>
</html>`;
};

export const verifyEmailTemplate = (
  userName: string,
  link: string,
): MailContent => ({
  subject: 'Verify your email',
  html: layout({
    heading: `Hi ${userName}, verify your email`,
    intro: 'Confirm this is your email address by opening the link below.',
    buttonText: 'Verify email',
    link,
    footer:
      "The link works once and expires in 24 hours. If you didn't create an account, ignore this email.",
  }),
  text: `Hi ${userName},\n\nVerify your email by opening this link:\n${link}\n\nThe link works once and expires in 24 hours. If you didn't create an account, ignore this email.`,
});

export const resetPasswordTemplate = (
  userName: string,
  link: string,
): MailContent => ({
  subject: 'Reset your password',
  html: layout({
    heading: `Hi ${userName}, reset your password`,
    intro:
      'Someone asked to reset the password for your account. Open the link below to set a new one.',
    buttonText: 'Reset password',
    link,
    footer:
      "The link works once and expires in 30 minutes. If you didn't ask for this, ignore this email; your password stays the same.",
  }),
  text: `Hi ${userName},\n\nReset your password by opening this link:\n${link}\n\nThe link works once and expires in 30 minutes. If you didn't ask for this, ignore this email; your password stays the same.`,
});
