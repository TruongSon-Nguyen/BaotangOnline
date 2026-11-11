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
- [Khởi tạo cơ sở dữ liệu](#khởi-tạo-cơ-sở-dữ-liệu)
- [Kiểm tra và build](#kiểm-tra-và-build)
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
| Cơ sở dữ liệu | PostgreSQL |
| Truy vấn và schema cơ sở dữ liệu | Drizzle ORM |
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
│   └── db/                # Kết nối và schema Drizzle
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

Schema được định nghĩa bằng Drizzle trong `lib/db/src/schema/`. Cơ sở dữ liệu sử dụng PostgreSQL.

## Cài đặt và chạy

Cần cài Node.js, pnpm và PostgreSQL. Chạy các lệnh từ thư mục gốc dự án:

```bash
pnpm install
```

Tạo file môi trường cho API tại `.local/api.env` (được script khởi chạy API nạp tự động), hoặc cung cấp các biến môi trường tương ứng trong shell.

Sau khi cấu hình database, khởi tạo schema theo hướng dẫn ở mục [Khởi tạo cơ sở dữ liệu](#khởi-tạo-cơ-sở-dữ-liệu).

Khởi động giao diện:

```bash
pnpm --filter @workspace/bao-tang-so dev
```

Khởi động API server:

```bash
pnpm --filter @workspace/api-server dev
```

Giao diện và API cần được chạy đồng thời để các tính năng lấy dữ liệu và quản trị hoạt động đầy đủ. Khi API khởi động, nội dung bảo tàng mẫu được khởi tạo nếu database chưa có dữ liệu.

## Cấu hình môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URL` | Có | Chuỗi kết nối PostgreSQL; dùng bởi API và Drizzle Kit. |
| `PORT` | Có khi chạy API | Cổng mà API server lắng nghe. |
| `AUTH_JWT_SECRET` | Production | Bí mật ký phiên đăng nhập; tối thiểu 32 bytes. Trong development nếu không đặt, phiên đăng nhập sẽ mất hiệu lực khi API khởi động lại. |
| `BAOTANG_UPLOAD_DIR` | Không | Thư mục lưu ảnh upload local; mặc định là `.local/uploads` trong working directory của API. |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Tùy chọn | Khi cung cấp cặp khóa hợp lệ, server bật Clerk middleware. |
| `PRIVATE_OBJECT_DIR` | Chỉ khi dùng Object Storage | Đường dẫn bucket riêng dùng bởi luồng tạo Signed URL. |

Không đưa giá trị bí mật thật vào Git. File `.local/api.env` là cấu hình local và không nên chia sẻ công khai.

## Khởi tạo cơ sở dữ liệu

Đặt `DATABASE_URL` trỏ đến database PostgreSQL cần dùng, sau đó đồng bộ schema Drizzle:

```bash
pnpm --filter @workspace/db push
```

Lệnh `push` cập nhật schema database theo định nghĩa trong `lib/db/src/schema/`. Chỉ dùng `push-force` khi hiểu rõ tác động lên dữ liệu hiện có; lệnh này có thể áp dụng thay đổi phá hủy dữ liệu.

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
