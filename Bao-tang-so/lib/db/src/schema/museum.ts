export type MuseumIntroRow = {
  id: string;
  museumName: string;
  tagline: string;
  story: string;
  heroImage: string | null;
  updatedAt: Date;
};

export type MuseumAdminRow = {
  id: string;
  email: string;
  status: string;
  clerkInvitationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertMuseumIntro = Omit<MuseumIntroRow, "id" | "updatedAt">;
export type InsertMuseumAdmin = Omit<
  MuseumAdminRow,
  "id" | "createdAt" | "updatedAt"
>;
