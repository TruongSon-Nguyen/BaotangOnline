export type ExhibitionRow = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  story: string;
  coverImage: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertExhibition = Omit<
  ExhibitionRow,
  "id" | "createdAt" | "updatedAt"
>;
