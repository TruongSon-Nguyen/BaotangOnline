# Bảo tàng số

Ứng dụng web giới thiệu và khám phá di sản Việt Nam. Người xem có thể tìm kiếm hiện vật, khám phá các trưng bày và lưu hiện vật yêu thích. Quản trị viên có thể quản lý nội dung bảo tàng thông qua khu vực quản trị.

## Mục lục

- [Thành viên nhóm](#thành-viên-nhóm)
- [Tính năng](#tính-năng)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Mô hình dữ liệu](#mô-hình-dữ-liệu)
- [Cài đặt và chạy](#cài-đặt-và-chạy)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Chạy ứng dụng](#chạy-ứng-dụng)
- [Kiểm tra và build](#kiểm-tra-và-build)
- [Dừng ứng dụng và xử lý lỗi thường gặp](#dừng-ứng-dụng-và-xử-lý-lỗi-thường-gặp)
- [Lưu ý vận hành](#lưu-ý-vận-hành)
- [API chính](#api-chính)

## Thành viên nhóm

| Họ và tên | Mã sinh viên | Vai trò |
|---|---:|---|
| Nguyễn Vũ Trường Sơn | 24100468 | Trưởng nhóm |
| Trần Ngọc Minh | 24100190 | Phó nhóm |
| Trịnh Xuân Hồng Phong | Chưa cung cấp | Thành viên |

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

### Yêu cầu

- Git
- Node.js 24.x
- pnpm 12.x
- Firebase project có Cloud Firestore ở Native mode.
- Firebase service-account credentials để API truy cập Firestore.

Cài pnpm 12 nếu máy chưa có:

```bash
npm install --global pnpm@12
```

Các lệnh dưới đây chạy từ thư mục workspace (thư mục chứa `pnpm-workspace.yaml`).

### Lấy mã nguồn và cài dependencies

```bash
git clone https://github.com/TruongSon-Nguyen/BaotangOnline.git
cd BaotangOnline/Bao-tang-so
pnpm install
```

Nếu mã nguồn đã có trên máy, chỉ cần mở terminal ở thư mục gốc và chạy `pnpm install`.

### Cấu hình API

Tải service-account key từ Firebase Console → Project settings → Service accounts
và lưu riêng tại `.local/firebase-service-account.json`. Không commit hoặc gửi
file này qua chat. Thư mục `.local/` đã được Git ignore.

Tạo file `.local/api.env` ở thư mục workspace:

```env
PORT=5000
FIREBASE_PROJECT_ID=baotangonline12345
GOOGLE_APPLICATION_CREDENTIALS=../../.local/firebase-service-account.json
```

Đường dẫn credential ở trên được tính từ thư mục package API khi chạy lệnh
workspace. Không commit file `.local/api.env`.

## Cấu hình môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Có | Firebase project ID. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Có khi chạy local | Đường dẫn service-account JSON; khi triển khai, ưu tiên Application Default Credentials của môi trường. |
| `PORT` | Có khi chạy API | Cổng mà API server lắng nghe. |
| `AUTH_JWT_SECRET` | Production | Bí mật ký phiên đăng nhập; tối thiểu 32 bytes. Trong development nếu không đặt, phiên đăng nhập sẽ mất hiệu lực khi API khởi động lại. |
| `BAOTANG_UPLOAD_DIR` | Không | Thư mục lưu ảnh upload local; mặc định là `.local/uploads` trong working directory của API. |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Tùy chọn | Khi cung cấp cặp khóa hợp lệ, server bật Clerk middleware. |
| `PRIVATE_OBJECT_DIR` | Chỉ khi dùng Object Storage | Đường dẫn bucket riêng dùng bởi luồng tạo Signed URL. |

`pnpm --filter @workspace/api-server start` tự đọc `.local/api.env`. Khi khởi
động, API tạo các collection và nội dung mẫu nếu dữ liệu chưa tồn tại.

## Chạy ứng dụng

Mở **hai terminal** tại thư mục gốc repository. API mặc định chạy ở cổng `5000`; giao diện dùng cổng `5173` và proxy request `/api` đến API.

**Terminal 1 — API server** (chạy được trên Windows, macOS và Linux):

```bash
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/api-server start
```

API đọc cấu hình Firebase và `PORT` từ `.local/api.env`. Khi khởi động, server
sẽ thêm nội dung mẫu nếu database chưa có dữ liệu.

**Terminal 2 — giao diện:**

macOS/Linux (Bash):

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/bao-tang-so dev
```

Windows (PowerShell):

```powershell
$env:PORT = '5173'
$env:BASE_PATH = '/'
pnpm --filter @workspace/bao-tang-so dev
```

Mở **http://localhost:5173** trên trình duyệt. Nếu muốn dùng cổng API khác `5000`, đặt thêm biến `API_URL` cho Vite để proxy trỏ đến API, ví dụ `http://127.0.0.1:5001`.

Nếu cổng `5000` hoặc `5173` đã được chương trình khác sử dụng, hãy chọn cổng khác và cập nhật đồng bộ cấu hình API/frontend.

## Kiểm tra và build

Kiểm tra kiểu TypeScript:

```bash
pnpm typecheck
```

Build workspace:

```bash
pnpm build
```

Hiện workspace chưa khai báo script chạy test tự động.

## Dừng ứng dụng và xử lý lỗi thường gặp

- Dừng API và Vite bằng `Ctrl+C` trong terminal tương ứng.
- Nếu API không kết nối được Firestore, kiểm tra `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, quyền của service account và việc Firestore đã được tạo trong Firebase Console.
- Nếu Vite báo thiếu `PORT` hoặc `BASE_PATH`, đặt cả hai biến theo lệnh dành cho hệ điều hành ở trên. Nếu cổng giao diện đã dùng, đổi `5173` thành cổng khác.

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
