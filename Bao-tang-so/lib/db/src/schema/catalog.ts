export type HistoricalPeriodRow = {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  description: string | null;
};

export type MaterialRow = {
  id: string;
  name: string;
  description: string | null;
};

export type ArtifactRow = {
  id: string;
  name: string;
  slug: string;
  summary: string;
  history: string;
  origin: string;
  dateLabel: string;
  dimensions: string | null;
  condition: string | null;
  periodId: string;
  materialId: string;
  status: string;
  isSample: boolean;
  isFeatured: boolean;
  featuredOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ArtifactImageRow = {
  id: string;
  artifactId: string;
  imageUrl: string;
  alt: string;
  caption: string;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: Date;
};

export type ImageHotspotRow = {
  id: string;
  imageId: string;
  x: number;
  y: number;
  title: string;
  body: string;
};

export type InsertArtifact = Omit<
  ArtifactRow,
  "id" | "createdAt" | "updatedAt"
>;
