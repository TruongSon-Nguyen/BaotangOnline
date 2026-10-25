import type { Artifact, ArtifactSummary, Exhibition, ExhibitionSummary } from '@workspace/api-client-react';

const now = new Date().toISOString();

export const samplePeriods = [
  { id: 'period-dong-son', name: 'Thời kỳ Đông Sơn (mẫu)', startYear: -700, endYear: 100, description: 'Văn hóa đồ đồng rực rỡ vùng đồng bằng sông Hồng.' },
  { id: 'period-ly-tran', name: 'Thời Lý–Trần (mẫu)', startYear: 1009, endYear: 1400, description: 'Giai đoạn thịnh vượng của mỹ thuật Phật giáo và nghệ thuật gốm men.' },
  { id: 'period-xviii-xix', name: 'Thế kỷ XVIII–XIX (mẫu)', startYear: 1700, endYear: 1900, description: 'Nghệ thuật chạm khắc gỗ đình làng và sơn thếp truyền thống.' },
];

export const sampleMaterials = [
  { id: 'mat-bronze', name: 'Đồng (mẫu)', description: 'Chất liệu hợp kim đồng truyền thống.' },
  { id: 'mat-ceramic', name: 'Gốm (mẫu)', description: 'Đất nung phủ men ngà, men lam, men ngọc.' },
  { id: 'mat-wood', name: 'Gỗ sơn son (mẫu)', description: 'Gỗ phủ sơn ta thếp vàng thủ công.' },
];

export const sampleArtifactsList: Artifact[] = [
  {
    id: 'art-1',
    name: 'Mẫu — Trống đồng nghi lễ',
    slug: 'mau-trong-dong-nghi-le',
    summary: 'Hình ảnh và nội dung minh họa về một trống đồng với hoa văn hình học và chim cách điệu.',
    history: 'Bản ghi mẫu dùng để minh họa cách trình bày hiện vật, câu chuyện và điểm chú thích trên ảnh. Mang nét đặc trưng của kỹ nghệ đúc đồng cổ đại với các vành hoa văn hình học, ngôi sao nhiều cánh ở tâm và đàn chim Lạc bay ngược chiều kim đồng hồ.',
    origin: 'Đồng bằng sông Hồng, Việt Nam (minh họa).',
    periodId: 'period-dong-son',
    periodName: 'Thời kỳ Đông Sơn (mẫu)',
    materialId: 'mat-bronze',
    materialName: 'Đồng (mẫu)',
    imageUrl: '/images/sample-bronze-drum.jpg',
    dateLabel: 'Khoảng thế kỷ V – II TCN',
    dimensions: 'Đường kính 64 cm, Cao 52 cm',
    condition: 'Bảo quản tốt, có lớp gỉ đồng tự nhiên',
    isFeatured: true,
    isSample: true,
    status: 'published',
    exhibitionIds: ['ex-1'],
    createdAt: now,
    updatedAt: now,
    images: [
      {
        id: 'img-1',
        imageUrl: '/images/sample-bronze-drum.jpg',
        alt: 'Trống đồng nghi lễ',
        caption: 'Mặt trống đồng với họa tiết mặt trời và đàn chim Lạc',
        isPrimary: true,
        sortOrder: 0,
        hotspots: [
          {
            id: 'spot-1',
            x: 50,
            y: 32,
            title: 'Họa tiết mặt trời trung tâm',
            body: 'Ngôi sao 14 cánh tượng trưng cho mặt trời và nguồn năng lượng vũ trụ trong tín ngưỡng cư dân nông nghiệp lúa nước.',
          },
          {
            id: 'spot-2',
            x: 42,
            y: 48,
            title: 'Vành hoa văn chim Lạc',
            body: 'Đàn chim mỏ dài, đuôi dài bay ngược chiều kim đồng hồ, biểu tượng văn hóa đặc trưng thời kỳ Đông Sơn.',
          },
        ],
      },
    ],
  },
  {
    id: 'art-2',
    name: 'Mẫu — Bình gốm men ngà',
    slug: 'mau-binh-gom-men-nga',
    summary: 'Một hình mẫu về đồ gốm, giúp minh họa bộ lọc chất liệu và trang chi tiết hiện vật.',
    history: 'Gốm men ngà thời Lý–Trần đại diện cho giai đoạn đỉnh cao của mỹ thuật gốm cổ truyền Việt Nam, kết hợp cốt đất thanh nhã và lớp men rạn màu ngà ấm áp.',
    origin: 'Lò gốm Thăng Long cổ (minh họa).',
    periodId: 'period-ly-tran',
    periodName: 'Thời Lý–Trần (mẫu)',
    materialId: 'mat-ceramic',
    materialName: 'Gốm (mẫu)',
    imageUrl: '/images/sample-ceramic-vase.jpg',
    dateLabel: 'Khoảng thế kỷ XII – XIII',
    dimensions: 'Cao 28 cm, Đường kính miệng 12 cm',
    condition: 'Nguyên vẹn, rạn men đều theo thời gian',
    isFeatured: true,
    isSample: true,
    status: 'published',
    exhibitionIds: ['ex-2'],
    createdAt: now,
    updatedAt: now,
    images: [
      {
        id: 'img-2',
        imageUrl: '/images/sample-ceramic-vase.jpg',
        alt: 'Bình gốm men ngà',
        caption: 'Bình gốm dáng búp sen phủ men ngà rạn hạt mè',
        isPrimary: true,
        sortOrder: 0,
        hotspots: [
          {
            id: 'spot-3',
            x: 48,
            y: 50,
            title: 'Kỹ thuật phủ men rạn',
            body: 'Lớp men tro tự nhiên tạo nên hiệu ứng rạn chân chim tinh xảo qua nhiệt độ nung lò nung truyền thống.',
          },
        ],
      },
    ],
  },
  {
    id: 'art-3',
    name: 'Mẫu — Mảng chạm sơn son thếp vàng',
    slug: 'mau-mang-cham-son-son-thep-vang',
    summary: 'Hình mẫu về nghệ thuật chạm và sơn phủ, có thể xem cùng các chú giải trên ảnh.',
    history: 'Nghệ thuật sơn son thếp vàng thế kỷ XVIII–XIX mang đậm chất dân gian và biểu tượng cát tường, phản ánh đời sống tâm linh phong phú của người Việt xưa.',
    origin: 'Vùng châu thổ Bắc Bộ (minh họa).',
    periodId: 'period-xviii-xix',
    periodName: 'Thế kỷ XVIII–XIX (mẫu)',
    materialId: 'mat-wood',
    materialName: 'Gỗ sơn son (mẫu)',
    imageUrl: '/images/sample-lacquer-panel.jpg',
    dateLabel: 'Thế kỷ XVIII',
    dimensions: '120 cm × 60 cm',
    condition: 'Lớp vàng lá và sơn ta được giữ gìn cẩn thận',
    isFeatured: true,
    isSample: true,
    status: 'published',
    exhibitionIds: ['ex-3'],
    createdAt: now,
    updatedAt: now,
    images: [
      {
        id: 'img-3',
        imageUrl: '/images/sample-lacquer-panel.jpg',
        alt: 'Mảng chạm sơn son thếp vàng',
        caption: 'Mảng chạm kênh bong đề tài mây lửa và linh thú',
        isPrimary: true,
        sortOrder: 0,
        hotspots: [
          {
            id: 'spot-4',
            x: 62,
            y: 40,
            title: 'Kỹ thuật chạm lộng kênh bong',
            body: 'Các tầng lớp gỗ được đục chạm sâu nhiều lớp tạo chiều không gian sinh động và chuyển động linh hoạt.',
          },
        ],
      },
    ],
  },
];

export const sampleExhibitions: Exhibition[] = [
  {
    id: 'ex-1',
    title: 'Dấu ấn Thời gian: Tiếng đồng Đông Sơn',
    slug: 'dau-an-thoi-gian-tieng-dong-dong-son',
    summary: 'Khám phá thế giới hoa văn và đời sống tinh thần của cư dân Việt cổ qua các nhạc khí và vật phẩm đồ đồng.',
    story: 'Trống đồng không chỉ là một nhạc cụ trong nghi lễ, mà là biểu tượng quyền uy, một cuốn biên niên sử ghi lại nếp sống, tín ngưỡng mùa màng và tâm thức vũ trụ của người Việt cổ đại.',
    coverImage: '/images/sample-bronze-drum.jpg',
    artifactCount: 1,
    startDate: 'Thường trực',
    endDate: null,
    status: 'published',
    artifacts: [sampleArtifactsList[0]],
  },
  {
    id: 'ex-2',
    title: 'Sắc men & Hồn đất: Mỹ thuật Gốm Việt',
    slug: 'sac-men-hon-dat-my-thuat-gom-viet',
    summary: 'Hành trình qua các triều đại Lý, Trần, Lê qua từng dáng gốm thanh thoát và men ngọc thuần khiết.',
    story: 'Từ bùn đất qua bàn tay tài hoa của nghệ nhân và ngọn lửa lò nung, gốm Việt thể hiện tinh thần phóng khoáng, sự gắn kết mật thiết với thiên nhiên và mỹ cảm Phật giáo thanh cao.',
    coverImage: '/images/sample-ceramic-vase.jpg',
    artifactCount: 1,
    startDate: 'Thường trực',
    endDate: null,
    status: 'published',
    artifacts: [sampleArtifactsList[1]],
  },
  {
    id: 'ex-3',
    title: 'Ánh vàng Ký ức: Nghệ thuật Sơn son thếp vàng',
    slug: 'anh-vang-ky-uc-nghe-thuat-son-son-thep-vang',
    summary: 'Chiêm ngưỡng sắc đỏ son ta và ánh vàng lá qua các mảng chạm khắc đình chùa truyền thống.',
    story: 'Sơn son thếp vàng là tinh hoa kết hợp giữa cây sơn ta bản địa và kỹ nghệ dát vàng tinh vi, tạo nên vẻ đẹp trang trọng, trường tồn trước thời gian và khí hậu nhiệt đới gió mùa.',
    coverImage: '/images/sample-lacquer-panel.jpg',
    artifactCount: 1,
    startDate: 'Thường trực',
    endDate: null,
    status: 'published',
    artifacts: [sampleArtifactsList[2]],
  },
];

export const sampleIntro = {
  museumName: 'Bảo tàng số',
  tagline: 'Di sản Việt Nam, gần hơn một chạm.',
  story: 'Một không gian số để khám phá hiện vật, câu chuyện và chất liệu tạo nên ký ức Việt. Các hồ sơ hiện vật hiển thị trong bản mẫu này là nội dung minh họa, không phải dữ liệu kiểm kê hay kết luận chuyên môn chính thức.',
  heroImage: '/images/museum-hero.jpg',
};

export const sampleMuseumHome = {
  intro: sampleIntro,
  featuredArtifacts: sampleArtifactsList as ArtifactSummary[],
  exhibitions: sampleExhibitions.map((e) => ({
    id: e.id,
    title: e.title,
    slug: e.slug,
    summary: e.summary,
    coverImage: e.coverImage,
    artifactCount: e.artifactCount,
    startDate: e.startDate,
    endDate: e.endDate,
  })) as ExhibitionSummary[],
  collectionCount: sampleArtifactsList.length,
};

export const sampleAdminOverview = {
  artifactCount: sampleArtifactsList.length,
  publishedCount: sampleArtifactsList.filter((a) => a.status === 'published').length,
  draftCount: sampleArtifactsList.filter((a) => a.status === 'draft').length,
  exhibitionCount: sampleExhibitions.length,
  imageCount: sampleArtifactsList.reduce((acc, a) => acc + (a.images?.length || 1), 0),
  recentArtifacts: sampleArtifactsList as ArtifactSummary[],
};

export const sampleAdminAccounts = [
  {
    id: 'admin-seed-1',
    email: 'congiomuathu@gmail.com',
    status: 'active',
    createdAt: new Date().toISOString(),
  },
];
