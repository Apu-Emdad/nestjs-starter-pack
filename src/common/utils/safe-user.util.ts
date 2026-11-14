import type { Prisma } from '../../generated/prisma/client.js';

export type UserWithRole = Prisma.UserGetPayload<{
  include: { roleInfo: true };
}>;

// Only safe fields leave the API: no password hash and no internal id.
export const toSafeUser = (user: UserWithRole) => ({
  uid: user.uid,
  userName: user.userName,
  email: user.email,
  role: user.roleInfo.name,
  emailVerified: !!user.emailVerifiedAt,
  createdAt: user.createdAt,
});
