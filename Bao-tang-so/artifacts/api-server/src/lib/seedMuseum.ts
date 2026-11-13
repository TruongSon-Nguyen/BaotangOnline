import { createHash } from "node:crypto";
import type {
  ArtifactImageRow,
  ArtifactRow,
  ExhibitionRow,
  HistoricalPeriodRow,
  ImageHotspotRow,
  MaterialRow,
} from "@workspace/db/schema";
import {
  collections,
  createRecord,
  db,
  findByField,
  getAll,
  getById,
  now,
} from "./firestore";

export const INITIAL_ADMIN_EMAIL = "congiomuathu@gmail.com";

const sampleNotice =
  "Các hồ sơ hiện vật hiển thị trong bản mẫu này là nội dung minh họa, không phải dữ liệu kiểm kê hay kết luận chuyên môn chính thức.";

const sampleArtifacts = [
  {
    name: "Mẫu — Trống đồng nghi lễ",
    slug: "mau-trong-dong-nghi-le",
    summary:
      "Hình ảnh và nội dung minh họa về một trống đồng với hoa văn hình học và chim cách điệu.",
    history:
      "Bản ghi mẫu dùng để minh họa cách trình bày hiện vật, câu chuyện và điểm chú thích trên ảnh. Không đại diện cho một hiện vật cụ thể trong bộ sưu tập.",
    origin: "Mô tả xuất xứ minh họa — cần được thay bằng hồ sơ đã kiểm chứng.",
    dateLabel: "Tham chiếu Đông Sơn (minh họa)",
    dimensions: "Thông số minh họa",
    condition: "Tình trạng chưa được kiểm định",
    periodName: "Thời kỳ Đông Sơn (mẫu)",
    materialName: "Đồng (mẫu)",
    imageUrl: "/images/sample-bronze-drum.jpg",
    caption: "Hình ảnh tạo sinh minh họa, không phải ảnh hiện vật sưu tập.",
    hotspot: {
      x: 50,
      y: 32,
      title: "Họa tiết trung tâm",
      body: "Điểm tương tác mẫu để minh họa cách đọc hoa văn; nội dung này chưa phải diễn giải giám định.",
    },
  },
  {
    name: "Mẫu — Bình gốm men ngà",
    slug: "mau-binh-gom-men-nga",
    summary:
      "Một hình mẫu về đồ gốm, giúp minh họa bộ lọc chất liệu và trang chi tiết hiện vật.",
    history:
      "Bản ghi mẫu phục vụ minh họa giao diện bảo tàng số. Mốc thời gian, xuất xứ và diễn giải cần được thay bằng dữ liệu chính thức.",
    origin: "Mô tả xuất xứ minh họa — cần được thay bằng hồ sơ đã kiểm chứng.",
    dateLabel: "Tham chiếu gốm Việt (minh họa)",
    dimensions: "Thông số minh họa",
    condition: "Tình trạng chưa được kiểm định",
    periodName: "Thời Lý–Trần (mẫu)",
    materialName: "Gốm (mẫu)",
    imageUrl: "/images/sample-ceramic-vase.jpg",
    caption: "Hình ảnh tạo sinh minh họa, không phải ảnh hiện vật sưu tập.",
    hotspot: {
      x: 48,
      y: 50,
      title: "Lớp men",
      body: "Điểm tương tác mẫu. Mô tả kỹ thuật cần được chuyên gia xác nhận trước khi công bố như dữ liệu thật.",
    },
  },
  {
    name: "Mẫu — Mảng chạm sơn son thếp vàng",
    slug: "mau-mang-cham-son-son-thep-vang",
    summary:
      "Hình mẫu về nghệ thuật chạm và sơn phủ, có thể xem cùng các chú giải trên ảnh.",
    history:
      "Bản ghi mẫu minh họa cho nội dung chuyên đề. Không xác định niên đại, nghệ nhân hoặc nơi lưu giữ của một hiện vật thật.",
    origin: "Mô tả xuất xứ minh họa — cần được thay bằng hồ sơ đã kiểm chứng.",
    dateLabel: "Tham chiếu thế kỷ XVIII–XIX (minh họa)",
    dimensions: "Thông số minh họa",
    condition: "Tình trạng chưa được kiểm định",
    periodName: "Thế kỷ XVIII–XIX (mẫu)",
    materialName: "Gỗ sơn son (mẫu)",
    imageUrl: "/images/sample-lacquer-panel.jpg",
    caption: "Hình ảnh tạo sinh minh họa, không phải ảnh hiện vật sưu tập.",
    hotspot: {
      x: 62,
      y: 40,
      title: "Chi tiết chạm nổi",
      body: "Điểm tương tác mẫu để minh họa vị trí chú thích trên ảnh.",
    },
  },
];

export async function seedMuseumContent(): Promise<void> {
  const adminEmail = INITIAL_ADMIN_EMAIL.toLowerCase();
  const adminId = createHash("sha256").update(adminEmail).digest("hex");
  const adminRef = db.collection(collections.museumAdmins).doc(adminId);
  const adminSnapshot = await adminRef.get();
  if (!adminSnapshot.exists) {
    await adminRef.create({
      id: adminId,
      email: adminEmail,
      status: "active",
      createdAt: now(),
      updatedAt: now(),
    });
  }

  const intro = await getById<Record<string, unknown> & { id: string }>(
    collections.museumIntro,
    "intro",
  );
  if (!intro) {
    await db.collection(collections.museumIntro).doc("intro").create({
      id: "intro",
      museumName: "Bảo tàng số",
      tagline: "Di sản Việt Nam, gần hơn một chạm.",
      story: `Một không gian số để khám phá hiện vật, câu chuyện và chất liệu tạo nên ký ức Việt. ${sampleNotice}`,
      heroImage: "/images/museum-hero.jpg",
      updatedAt: now(),
    });
  }

  const periods = [
    { name: "Thời kỳ Đông Sơn (mẫu)", startYear: -700, endYear: 100 },
    { name: "Thời Lý–Trần (mẫu)", startYear: 1009, endYear: 1400 },
    { name: "Thế kỷ XVIII–XIX (mẫu)", startYear: 1700, endYear: 1900 },
  ];
  for (const period of periods) {
    if (!(await findByField<HistoricalPeriodRow>(
      collections.historicalPeriods,
      "name",
      period.name,
    ))) {
      await createRecord(collections.historicalPeriods, {
        ...period,
        description: "Mốc phân loại minh họa, cần hiệu chỉnh theo dữ liệu chính thức.",
      });
    }
  }

  const materials = [
    { name: "Đồng (mẫu)", description: "Chất liệu phân loại minh họa." },
    { name: "Gốm (mẫu)", description: "Chất liệu phân loại minh họa." },
    { name: "Gỗ sơn son (mẫu)", description: "Chất liệu phân loại minh họa." },
  ];
  for (const material of materials) {
    if (!(await findByField<MaterialRow>(
      collections.materials,
      "name",
      material.name,
    ))) {
      await createRecord(collections.materials, material);
    }
  }

  const [periodRows, materialRows] = await Promise.all([
    getAll<HistoricalPeriodRow>(collections.historicalPeriods),
    getAll<MaterialRow>(collections.materials),
  ]);
  const periodIds = new Map(periodRows.map((row) => [row.name, row.id]));
  const materialIds = new Map(materialRows.map((row) => [row.name, row.id]));

  for (let index = 0; index < sampleArtifacts.length; index += 1) {
    const sample = sampleArtifacts[index];
    const periodId = periodIds.get(sample.periodName);
    const materialId = materialIds.get(sample.materialName);
    if (!periodId || !materialId) {
      throw new Error(`Missing sample taxonomy for ${sample.slug}`);
    }

    let artifact = await findByField<ArtifactRow>(
      collections.artifacts,
      "slug",
      sample.slug,
    );
    if (!artifact) {
      artifact = await createRecord(collections.artifacts, {
        name: sample.name,
        slug: sample.slug,
        summary: sample.summary,
        history: sample.history,
        origin: sample.origin,
        dateLabel: sample.dateLabel,
        dimensions: sample.dimensions,
        condition: sample.condition,
        periodId,
        materialId,
        status: "published",
        isSample: true,
        isFeatured: true,
        featuredOrder: index + 1,
        createdAt: now(),
        updatedAt: now(),
      });
    }

    const existingImage = await findByField<ArtifactImageRow>(
      collections.artifactImages,
      "artifactId",
      artifact.id,
    );
    let imageId = existingImage?.id;
    if (!existingImage) {
      const image = await createRecord(collections.artifactImages, {
          artifactId: artifact.id,
          imageUrl: sample.imageUrl,
          alt: `${sample.name} — hình ảnh mẫu minh họa`,
          caption: sample.caption,
          isPrimary: true,
          sortOrder: 0,
          createdAt: now(),
        });
      imageId = image.id;
    }

    if (imageId) {
      const existingHotspot = await findByField<ImageHotspotRow>(
        collections.imageHotspots,
        "imageId",
        imageId,
      );
      if (!existingHotspot) {
        await createRecord(collections.imageHotspots, {
          imageId,
          ...sample.hotspot,
        });
      }
    }
  }

  const exhibitionSeeds = [
    {
      title: "Dấu ấn kim khí — chuyên đề mẫu",
      slug: "dau-an-kim-khi-mau",
      summary: "Chuyên đề minh họa về chất liệu đồng và họa tiết.",
      story:
        "Nội dung chuyên đề mẫu, chưa đại diện cho triển lãm hoặc sưu tập chính thức.",
      coverImage: "/images/sample-bronze-drum.jpg",
      artifactSlug: "mau-trong-dong-nghi-le",
    },
    {
      title: "Đất và lửa — chuyên đề mẫu",
      slug: "dat-va-lua-mau",
      summary: "Chuyên đề minh họa về hình dáng và lớp men gốm.",
      story:
        "Nội dung chuyên đề mẫu, chưa đại diện cho triển lãm hoặc sưu tập chính thức.",
      coverImage: "/images/sample-ceramic-vase.jpg",
      artifactSlug: "mau-binh-gom-men-nga",
    },
  ];

  for (const sample of exhibitionSeeds) {
    let exhibition = await findByField<ExhibitionRow>(
      collections.exhibitions,
      "slug",
      sample.slug,
    );
    if (!exhibition) {
      exhibition = await createRecord(collections.exhibitions, {
        title: sample.title,
        slug: sample.slug,
        summary: sample.summary,
        story: sample.story,
        coverImage: sample.coverImage,
        startDate: null,
        endDate: null,
        status: "published",
        createdAt: now(),
        updatedAt: now(),
      });
    }
    const artifact = await findByField<ArtifactRow>(
      collections.artifacts,
      "slug",
      sample.artifactSlug,
    );
    if (exhibition && artifact) {
      const links = await getAll<{
        id: string;
        exhibitionId: string;
        artifactId: string;
      }>(collections.artifactExhibitions);
      if (!links.some(
        (link) =>
          link.exhibitionId === exhibition.id && link.artifactId === artifact.id,
      )) {
        await createRecord(collections.artifactExhibitions, {
          exhibitionId: exhibition.id,
          artifactId: artifact.id,
        });
      }
    }
  }
}
