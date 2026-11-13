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

### Cài đặt lần đầu

Cần Node.js 24.x và pnpm 12. Mở terminal tại thư mục gốc repository rồi chạy:

```bash
cd Bao-tang-so
pnpm install
```

### Chạy ứng dụng trong VS Code

Mở **hai terminal** trong VS Code. Trước khi chạy lệnh, kiểm tra terminal đang
ở thư mục `Bao-tang-so` (đường dẫn kết thúc bằng `/BaotangOnline/Bao-tang-so`).
Nếu terminal đang ở thư mục repository bên ngoài `BaotangOnline`, chạy
`cd Bao-tang-so` một lần. Nếu đã ở `Bao-tang-so` thì **không chạy `cd` lại**.

**Terminal 1 — API** (chờ đến khi thấy `Server listening`, cổng `5000`):

```bash
pnpm --filter @workspace/api-server dev
```

**Terminal 2 — giao diện (Linux/macOS)** (chờ đến khi Vite báo `http://localhost:5173/`):

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/bao-tang-so dev
```

Với Windows PowerShell, dùng các lệnh sau ở Terminal 2:

```powershell
$env:PORT = '5173'
$env:BASE_PATH = '/'
pnpm --filter @workspace/bao-tang-so dev
```

Mở **http://localhost:5173** để sử dụng. Để dừng mỗi tiến trình, nhấn `Ctrl+C`
trong terminal tương ứng. Nếu frontend báo cổng `5173` đang được sử dụng, frontend
đã chạy ở terminal khác; mở trang hiện có hoặc dừng tiến trình đó bằng `Ctrl+C`
trước khi chạy lại. Nếu API không khởi động, kiểm tra file service account,
Project ID và quyền truy cập Firestore.

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
