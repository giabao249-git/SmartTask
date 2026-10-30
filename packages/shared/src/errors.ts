/**
 * Mã lỗi nghiệp vụ dùng chung API ↔ Web. API trả { code, message, details? };
 * Web tra bảng này để hiển thị tiếng Việt. Thêm mã mới ở đây trước, rồi mới dùng ở service.
 */
export const ERROR_CODES = {
  // Chung
  VALIDATION_FAILED: 'Dữ liệu gửi lên không hợp lệ',
  UNAUTHENTICATED: 'Bạn cần đăng nhập',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này',
  NOT_FOUND: 'Không tìm thấy dữ liệu',
  RATE_LIMITED: 'Bạn thao tác quá nhanh, thử lại sau',
  CONFLICT: 'Dữ liệu đã tồn tại hoặc xung đột',
  INTERNAL: 'Lỗi hệ thống, thử lại sau',
  // Auth & tài khoản
  EMAIL_TAKEN: 'Email đã được sử dụng',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng',
  ACCOUNT_LOCKED: 'Tài khoản đã bị khoá',
  REFRESH_TOKEN_INVALID: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
  SESSION_REVOKED: 'Phiên đăng nhập đã bị thu hồi',
  PASSWORD_MISMATCH: 'Mật khẩu hiện tại không đúng',
  // Workspace & thành viên
  WORKSPACE_SLUG_TAKEN: 'Tên rút gọn workspace đã tồn tại',
  WORKSPACE_READ_ONLY:
    'Workspace đang ở chế độ chỉ đọc, không thực hiện được thay đổi',
  WORKSPACE_SUSPENDED:
    'Workspace đã bị đình chỉ, liên hệ quản trị nền tảng để mở lại',
  MAINTENANCE_MODE: 'Hệ thống đang bảo trì, vui lòng quay lại sau',
  INVITATION_EXPIRED: 'Lời mời đã hết hạn hoặc không tồn tại',
  LAST_OWNER: 'Workspace phải có ít nhất một chủ sở hữu',
  SKILL_MERGE_SAME: 'Không thể gộp kỹ năng vào chính nó',
  // Dự án, sprint, task
  PROJECT_KEY_TAKEN: 'Mã dự án đã tồn tại trong workspace',
  PROJECT_PM_REQUIRED: 'Dự án phải có đúng một quản lý dự án',
  SPRINT_ALREADY_ACTIVE: 'Dự án đã có một sprint đang chạy',
  SPRINT_NOT_ACTIVE: 'Sprint chưa bắt đầu hoặc đã kết thúc',
  TASK_VERSION_CONFLICT: 'Công việc vừa được người khác cập nhật, hãy tải lại',
  WIP_LIMIT_EXCEEDED: 'Cột đã đạt giới hạn số việc đang làm',
  DEPENDENCY_CYCLE: 'Phụ thuộc tạo thành vòng lặp',
  ATTACHMENT_TOO_LARGE: 'Tệp vượt quá 10 MB',
  // AI
  AI_QUOTA_EXCEEDED: 'Bạn đã dùng hết lượt gọi AI hôm nay',
  AI_PROVIDER_UNAVAILABLE: 'Dịch vụ AI tạm thời không sẵn sàng',
  AI_RESPONSE_INVALID: 'AI trả về dữ liệu không đúng cấu trúc',
  PROPOSAL_EXPIRED: 'Đề xuất đã hết hạn',
  PROPOSAL_ALREADY_APPLIED: 'Đề xuất đã được áp dụng',
  ASSIGN_NOT_MEMBER: 'Người được giao không phải thành viên dự án',
  ASSIGN_ON_LEAVE: 'Người được giao nghỉ trọn khoảng thời gian này',
  ASSIGN_SKILL_GAP: 'Người được giao thiếu kỹ năng bắt buộc',
  ASSIGN_CAPACITY_EXCEEDED: 'Không đủ giờ trống trước hạn',
  ASSIGN_OVERLOAD: 'Người được giao sẽ vượt ngưỡng quá tải',
  UNKNOWN_CODE: 'Mã tham chiếu không có trong ngữ cảnh',
  AI_PURPOSE_DISABLED: 'Workspace đã tắt tính năng AI này',
  AI_IN_PROGRESS: 'Đang có một lượt AI cùng loại chưa xong, hãy đợi',
  AI_CONFIG_INVALID: 'Cấu hình AI không hợp lệ',
  AI_KEY_ENCRYPTION_MISSING: 'Máy chủ chưa đặt APP_KEY nên không lưu được khoá API',
  PROPOSAL_NOT_DRAFT: 'Đề xuất không còn ở trạng thái nháp',
  PROPOSAL_VALIDATION_FAILED: 'Đề xuất chưa qua kiểm tra, hãy sửa các dòng lỗi',
  AI_TURN_IN_PROGRESS: 'Phiên này đang có một lượt chưa xong, hãy đợi',
  PROPOSAL_VERSION_CONFLICT: 'Bản nháp đã đổi ở nơi khác, hãy tải lại',
  UNKNOWN_DRAFT_KEY: 'Mã bản nháp không thuộc phiên này',
  DRAFT_ALREADY_APPLIED: 'Mục này đã được duyệt thành công việc thật',
  CALENDAR_SYNC_FAILED: 'Đồng bộ lịch thất bại',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ApiError {
  code: ErrorCode | string;
  message: string;
  details?: unknown;
}
