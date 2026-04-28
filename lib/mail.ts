import nodemailer from 'nodemailer'

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendResetPasswordEmail(to: string, name: string, resetUrl: string) {
  const from = process.env.SMTP_FROM ?? 'Mutiara Investasi <no-reply@mutiarainvestasi.com>'
  const transport = createTransport()

  await transport.sendMail({
    from,
    to,
    subject: 'Reset Password — Mutiara Investasi',
    html: `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;padding:28px 40px;text-align:center">
            <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:.5px">
              📈 Mutiara Investasi
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <h2 style="margin:0 0 16px;color:#111827;font-size:20px">Halo, ${name || 'Pengguna'}!</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">
              Kami menerima permintaan reset password untuk akun Mutiara Investasi
              yang terdaftar dengan email ini.
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.6">
              Klik tombol di bawah untuk membuat password baru:
            </p>

            <!-- Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px">
              <tr>
                <td align="center" style="background:#4f46e5;border-radius:8px">
                  <a href="${resetUrl}"
                     style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:.3px">
                    Reset Password
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#6b7280;font-size:13px">
              Atau salin link berikut ke browser Anda:
            </p>
            <p style="margin:0 0 24px;word-break:break-all">
              <a href="${resetUrl}" style="color:#4f46e5;font-size:13px">${resetUrl}</a>
            </p>

            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin-bottom:24px">
              <p style="margin:0;color:#92400e;font-size:13px">
                ⏱ Link ini berlaku selama <strong>1 jam</strong> dan hanya dapat digunakan <strong>sekali</strong>.
              </p>
            </div>

            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6">
              Jika Anda tidak meminta reset password, abaikan email ini.
              Password Anda tidak akan berubah.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb">
            <p style="margin:0;color:#9ca3af;font-size:12px">
              © ${new Date().getFullYear()} Mutiara Investasi · no-reply@mutiarainvestasi.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}
