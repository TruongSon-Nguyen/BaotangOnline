# Bảo tàng số

Ứng dụng web giới thiệu và khám phá di sản Việt Nam. Người xem có thể tìm kiếm hiện vật, khám phá các trưng bày và lưu hiện vật yêu thích. Quản trị viên có thể quản lý nội dung bảo tàng thông qua khu vực quản trị.

## Mục lục

- [Thành viên nhóm](#thành-viên-nhóm)
- [Tính năng](#tính-năng)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Mô hình dữ liệu](#mô-hình-dữ-liệu)
- [Cài đặt và chạy](#cài-đặt-và-chạy)
- [Lưu ý vận hành](#lưu-ý-vận-hành)
- [API chính](#api-chính)

## Thành viên nhóm

| Họ và tên | Mã sinh viên | Vai trò |
|---|---:|---|
| Nguyễn Vũ Trường Sơn | 24100468 | Trưởng nhóm |
| Trần Ngọc Minh | 24100190 | Phó nhóm |
| Trịnh Xuân Hồng Phong | 24100279 | Thành viên |

## Tính năng

### Dành cho khách tham quan

- Xem trang chủ, nội dung giới thiệu và các hiện vật nổi bật.
- Duyệt, tìm kiếm và lọc hiện vật theo thời kỳ, chất liệu hoặc trưng bày.
- Xem thông tin, hình ảnh và câu chuyện về từng hiện vật.
- Tương tác với điểm chú giải (hotspot) trên ảnh hiện vật.
- Khám phá danh sách và nội dung chi tiết của các trưng bày.
- Lưu hiện vật yêu thích trên trình duyệt.

### Dành cho quản trị viên

- Xem tổng quan và quản lý hồ sơ hiện vật.
- Thêm, sửa, xóa hình ảnh; chọn ảnh chính và cập nhật chú thích.
- Tạo và chỉnh sửa hotspot trên ảnh.
- Quản lý trưng bày, nội dung giới thiệu bảo tàng và hiện vật nổi bật.
- Quản lý tài khoản quản trị.

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Giao diện | React, TypeScript, Vite |
| Điều hướng | Wouter |
| Quản lý dữ liệu phía giao diện | TanStack Query |
| API server | Node.js, Express |
| Cơ sở dữ liệu | Firebase Cloud Firestore |
| Kết nối server-side | Firebase Admin SDK |
| Định nghĩa API | OpenAPI |
| Kiểm tra dữ liệu | Zod |

## Cấu trúc dự án

```text
Bao-tang-so/
├── artifacts/
│   ├── bao-tang-so/       # Ứng dụng React/Vite
│   └── api-server/        # API server Express
├── lib/
│   ├── api-client-react/  # API client cho giao diện
│   ├── api-spec/          # Đặc tả OpenAPI
│   ├── api-zod/           # Schema và kiểu dữ liệu API
│   └── db/                # Các kiểu dữ liệu dùng chung
└── README.md
```

## Mô hình dữ liệu

Dữ liệu chính được tổ chức thành các nhóm:

- **Hiện vật:** thông tin, trạng thái xuất bản, thời kỳ và chất liệu.
- **Thời kỳ, chất liệu:** dữ liệu phân loại để duyệt và lọc hiện vật.
- **Ảnh hiện vật:** ảnh, chú thích và thứ tự hiển thị.
- **Hotspot:** tọa độ phần trăm cùng tiêu đề và nội dung chú giải; mỗi hotspot thuộc một ảnh.
- **Trưng bày:** thông tin trưng bày và quan hệ nhiều-nhiều với hiện vật thông qua bảng liên kết.
- **Nội dung bảo tàng và tài khoản quản trị.**

API lưu dữ liệu trong các collection Firestore: `artifacts`, `artifactImages`,
`imageHotspots`, `exhibitions`, `historicalPeriods`, `materials`,
`artifactExhibitions`, `museumIntro`, `museumAdmins`, `userAccounts`,
`accountEmailIndex` và `authSessions`.

## Cài đặt và chạy

### 1. Cài công cụ

Cài Node.js 24.x, sau đó cài pnpm:

```bash
npm install -g pnpm@12
```

### 2. Tải mã nguồn và cài thư viện

```bash
git clone https://github.com/TruongSon-Nguyen/BaotangOnline.git
cd BaotangOnline
pnpm install
```

Nếu đã có mã nguồn, mở terminal tại thư mục gốc repository rồi chạy `pnpm install`.

### 3. Cấu hình Firebase

Để chạy đầy đủ chức năng, cần có Firebase project bật Cloud Firestore. Tải
service-account key tại **Firebase Console → Project settings → Service accounts**,
rồi lưu hai file sau trong thư mục `Bao-tang-so/.local/`:

`firebase-service-account.json` là file key vừa tải. Tạo thêm file `api.env`:

```env
PORT=5000
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_APPLICATION_CREDENTIALS=../../.local/firebase-service-account.json
```

Không đưa các file trong `.local/` lên Git. Nếu chỉ muốn xem giao diện, có thể
bỏ qua bước Firebase; các chức năng cần dữ liệu từ API sẽ không hoạt động.

### 4. Chạy ứng dụng

Mở **hai terminal** tại thư mục gốc repository.

**Terminal 1 — API** (cần cấu hình Firebase ở bước 3):

```bash
pnpm --filter @workspace/api-server dev
```

**Terminal 2 — giao diện** (macOS/Linux):

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/bao-tang-so dev
```

Windows PowerShell:

```powershell
$env:PORT = '5173'
$env:BASE_PATH = '/'
pnpm --filter @workspace/bao-tang-so dev
```

Mở **http://localhost:5173** để xem web. Dừng mỗi ứng dụng bằng `Ctrl+C` trong
terminal tương ứng. Nếu API không kết nối được Firestore, kiểm tra project ID,
đường dẫn key và quyền của service account.

## Lưu ý vận hành

- Ảnh upload qua giao diện hiện được gửi đến API và lưu local; mặc định giới hạn kích thước là 10 MB, chỉ hỗ trợ JPEG, PNG và WebP.
- Backend có endpoint tạo Signed URL cho Object Storage, nhưng giao diện hiện chưa sử dụng luồng upload đó.
- Ảnh local cần dùng chung thư mục lưu trữ giữa các lần chạy API; nếu triển khai nhiều instance, cần cấu hình lưu trữ dùng chung hoặc chuyển sang object storage.
- Dữ liệu yêu thích được lưu trong local storage của trình duyệt, không đồng bộ giữa các thiết bị.
- Quyền quản trị được kiểm tra ở các API `/api/admin/*`; chỉ mở quyền quản trị cho tài khoản được tin cậy.

## API chính

API sử dụng tiền tố `/api`. Một số endpoint tiêu biểu:

| Endpoint | Mục đích |
|---|---|
| `GET /api/healthz` | Kiểm tra trạng thái server |
| `GET /api/museum/home` | Lấy nội dung trang chủ |
| `GET /api/artifacts` | Tìm kiếm và lọc hiện vật đã xuất bản |
| `GET /api/artifacts/:id` | Xem chi tiết hiện vật |
| `GET /api/exhibitions` | Danh sách trưng bày |
| `GET /api/exhibitions/:id` | Chi tiết trưng bày |
| `/api/admin/*` | Các chức năng quản trị, yêu cầu quyền quản trị |

Đặc tả API đầy đủ nằm trong `lib/api-spec/openapi.yaml`.
