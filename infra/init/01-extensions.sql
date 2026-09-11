-- Chạy một lần khi khởi tạo volume. Tiện ích cần cho schema ở Tuần 06–07.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- email không phân biệt hoa thường
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- tìm kiếm mờ tiêu đề task, khớp tên kỹ năng
