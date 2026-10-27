export const publicUserSelect = {
  id: true,
  username: true,
  role: true,
  status: true,
  createdAt: true,
  profile: {
    select: {
      displayName: true,
      avatarUrl: true,
      bio: true,
    },
  },
};

export const currentUserSelect = {
  ...publicUserSelect,
  email: true,
  emailVerifiedAt: true,
};

export function toUserDto(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    profile: user.profile,
  };
}
