import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createFakeEmailTokens } from '../../../test/fakes/fake-email-tokens.js';
import { FakeMailService } from '../../../test/fakes/fake-mail.js';
import type { Env } from '../../config/env.js';
import { EmailTokenType } from '../../generated/prisma/enums.js';
import type { MailService } from '../../infra/mail/mail.service.js';
import type { PrismaService } from '../../infra/prisma/prisma.service.js';
import { EmailTokenService } from './email-token.service.js';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const user = { id: 1n, userName: 'apu_emdad', email: 'apu@example.com' };
const MINUTE = 60 * 1000;

describe('EmailTokenService', () => {
  let emailTokens: ReturnType<typeof createFakeEmailTokens>;
  let mail: FakeMailService;
  let service: EmailTokenService;

  beforeEach(() => {
    emailTokens = createFakeEmailTokens();
    mail = new FakeMailService();
    const config = {
      get: () => 'http://localhost:5173/',
    } as unknown as ConfigService<Env, true>;
    service = new EmailTokenService(
      { emailToken: emailTokens } as unknown as PrismaService,
      mail as unknown as MailService,
      config,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a 64-character hex token and stores only its SHA-256 hash', async () => {
    const token = await service.create(user.id, EmailTokenType.VERIFY_EMAIL);

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(emailTokens.rows).toHaveLength(1);
    expect(emailTokens.rows[0].tokenHash).toBe(sha256(token));
    expect(Object.values(emailTokens.rows[0])).not.toContain(token);
  });

  it('a verify link lasts 24 hours and a reset link 30 minutes', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-31T10:00:00Z') });

    await service.create(user.id, EmailTokenType.VERIFY_EMAIL);
    await service.create(user.id, EmailTokenType.RESET_PASSWORD);

    expect(emailTokens.rows[0].expiresAt).toEqual(
      new Date('2026-11-01T10:00:00Z'),
    );
    expect(emailTokens.rows[1].expiresAt).toEqual(
      new Date('2026-10-31T10:30:00Z'),
    );
  });

  it('a new token deletes the older unused ones of the same type only', async () => {
    const old = await service.create(user.id, EmailTokenType.VERIFY_EMAIL);
    await service.create(user.id, EmailTokenType.RESET_PASSWORD);
    const latest = await service.create(user.id, EmailTokenType.VERIFY_EMAIL);

    expect(emailTokens.rows.map((row) => row.type)).toEqual([
      EmailTokenType.RESET_PASSWORD,
      EmailTokenType.VERIFY_EMAIL,
    ]);
    await expect(
      service.consume(old, EmailTokenType.VERIFY_EMAIL),
    ).rejects.toThrow(BadRequestException);
    expect(await service.consume(latest, EmailTokenType.VERIFY_EMAIL)).toBe(
      user.id,
    );
  });

  it('consume returns the user id and works only once', async () => {
    const token = await service.create(user.id, EmailTokenType.RESET_PASSWORD);

    expect(await service.consume(token, EmailTokenType.RESET_PASSWORD)).toBe(
      user.id,
    );
    expect(emailTokens.rows[0].usedAt).toEqual(expect.any(Date));
    await expect(
      service.consume(token, EmailTokenType.RESET_PASSWORD),
    ).rejects.toThrow(
      new BadRequestException('This reset link is invalid or has expired'),
    );
  });

  it('rejects an expired token', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-31T10:00:00Z') });
    const token = await service.create(user.id, EmailTokenType.RESET_PASSWORD);

    vi.setSystemTime(Date.now() + 31 * MINUTE);

    await expect(
      service.consume(token, EmailTokenType.RESET_PASSWORD),
    ).rejects.toThrow(BadRequestException);
    expect(emailTokens.rows[0].usedAt).toBeNull();
  });

  it('rejects a token of the other type and an unknown token', async () => {
    const token = await service.create(user.id, EmailTokenType.VERIFY_EMAIL);

    await expect(
      service.consume(token, EmailTokenType.RESET_PASSWORD),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.consume('f'.repeat(64), EmailTokenType.VERIFY_EMAIL),
    ).rejects.toThrow(
      new BadRequestException(
        'This verification link is invalid or has expired',
      ),
    );
  });

  it('emails a link to the web app with the token', async () => {
    await service.sendVerifyEmail(user);
    await service.sendResetPassword(user);

    expect(mail.sent.map((m) => [m.kind, m.to])).toEqual([
      ['verify-email', 'apu@example.com'],
      ['reset-password', 'apu@example.com'],
    ]);
    expect(mail.sent[0].link).toBe(
      `http://localhost:5173/verify-email?token=${mail.lastToken('verify-email')}`,
    );
    expect(mail.sent[1].link).toMatch(
      /^http:\/\/localhost:5173\/reset-password\?token=[a-f0-9]{64}$/,
    );
  });
});
