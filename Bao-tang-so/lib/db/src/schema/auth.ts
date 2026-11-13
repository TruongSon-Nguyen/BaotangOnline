export type UserAccountRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: Date;
};

export type AuthSessionRow = {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
};
