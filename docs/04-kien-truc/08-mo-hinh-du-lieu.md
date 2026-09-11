# 08 · Mô hình dữ liệu

ERD mức khái niệm; kiểu chi tiết viết trong `apps/api/prisma/schema.prisma` (Tuần 07). Chuẩn 3NF: mọi thuộc tính phụ thuộc đầy đủ vào khoá; bảng nối cho quan hệ N–N; giá trị tính (mức sử dụng, EAR) không lưu trong bảng gốc mà trong bảng snapshot/metrics có ngày.

## 1. Lõi nghiệp vụ (27 bảng)

```mermaid
erDiagram
  users ||--o{ workspace_members : ""
  workspaces ||--o{ workspace_members : ""
  workspaces ||--o{ invitations : ""
  users ||--o{ refresh_tokens : ""
  workspaces ||--o{ skills : ""
  skills ||--o{ skill_aliases : ""
  users ||--o{ user_skills : ""
  skills ||--o{ user_skills : ""
  workspaces ||--o{ projects : ""
  projects ||--o{ project_members : ""
  users ||--o{ project_members : ""
  projects ||--o{ sprints : ""
  projects ||--o{ board_columns : ""
  projects ||--o{ labels : ""
  projects ||--o{ tasks : ""
  sprints o|--o{ tasks : ""
  board_columns ||--o{ tasks : ""
  tasks o|--o{ tasks : "parent"
  tasks ||--o{ task_assignees : ""
  users ||--o{ task_assignees : ""
  tasks ||--o{ task_skills : ""
  skills ||--o{ task_skills : ""
  tasks ||--o{ task_dependencies : ""
  tasks ||--o{ task_labels : ""
  labels ||--o{ task_labels : ""
  tasks ||--o{ comments : ""
  comments ||--o{ mentions : ""
  tasks ||--o{ attachments : ""
  users ||--o{ notifications : ""
  users ||--o{ push_subscriptions : ""
  projects ||--o{ activity_logs : ""
  users ||--o{ workload_snapshots : ""
  users ||--o{ workload_alerts : ""
  sprints ||--o{ burndown_snapshots : ""
  users { uuid id PK
          citext email UK
          string password_hash
          string full_name
          string short_name
          int weekly_capacity_hours
          string timezone
          json notification_prefs }
  workspaces { uuid id PK
               string slug UK
               uuid owner_id FK
               json settings "ngưỡng, trọng số, workdays, holidays, usd_vnd" }
  workspace_members { uuid workspace_id FK
                      uuid user_id FK
                      enum role "OWNER ADMIN MEMBER VIEWER" }
  skills { uuid id PK
           uuid workspace_id FK
           string name
           string category
           bool is_active }
  skill_aliases { uuid skill_id FK
                  string alias UK }
  user_skills { uuid user_id FK
                uuid skill_id FK
                int level "1..5"
                uuid verified_by FK
                datetime verified_at }
  projects { uuid id PK
             uuid workspace_id FK
             string key UK
             string name
             enum status
             date start_date
             date end_date }
  project_members { uuid project_id FK
                    uuid user_id FK
                    enum role "PM MEMBER" }
  sprints { uuid id PK
            uuid project_id FK
            string name
            date start_date
            date end_date
            enum status "PLANNED ACTIVE CLOSED"
            decimal scope_hours_initial }
  tasks { uuid id PK
          uuid project_id FK
          uuid sprint_id FK
          uuid parent_id FK
          uuid column_id FK
          int number
          string title
          text description
          enum priority "LOW MEDIUM HIGH URGENT"
          bool is_urgent
          int difficulty "1..5"
          enum size "S M L XL"
          date start_date
          date due_date
          decimal estimate_hours
          decimal remaining_hours
          int progress
          float position
          int version
          enum source "MANUAL AI"
          uuid ai_proposal_id FK
          datetime started_at
          datetime completed_at
          datetime deleted_at }
  task_dependencies { uuid task_id FK
                      uuid depends_on_id FK }
  workload_snapshots { uuid user_id FK
                       uuid workspace_id FK
                       date week_start
                       decimal load_hours
                       decimal eff_load_hours
                       decimal capacity_hours
                       decimal eff_capacity_hours
                       decimal utilization
                       enum level
                       int risk_score
                       json risk_breakdown }
  workload_alerts { uuid id PK
                    uuid user_id FK
                    date week_start
                    enum kind "OVERLOAD BURNOUT"
                    datetime notified_at
                    uuid acked_by FK }
  burndown_snapshots { uuid sprint_id FK
                       date date
                       decimal scope_hours
                       decimal remaining_hours
                       decimal completed_hours }
```

Các bảng còn lại của lõi có thuộc tính hiển nhiên: `invitations(email, token, role, expires_at, status)`, `refresh_tokens(user_id, token_hash, expires_at, revoked_at)`, `board_columns(name, status_key, position, wip_limit)`, `labels(name, color)`, `task_assignees`, `task_skills(min_level)`, `task_labels`, `comments(body, parent_id, edited_at)`, `mentions`, `attachments(file_name, mime, size_bytes, storage_path)`, `notifications(type, title, link, is_read)`, `push_subscriptions(endpoint UK, p256dh, auth, user_agent)`, `activity_logs(project_id, task_id, actor_id, action, diff json, source)`.

## 2. AI, chat, lịch, lịch sử (21 bảng)

```mermaid
erDiagram
  workspaces ||--o{ ai_configs : ""
  ai_model_catalog ||--o{ ai_configs : ""
  workspaces ||--o{ ai_prompt_configs : ""
  users ||--o| ai_personal_prompts : ""
  users ||--o{ ai_memories : ""
  users ||--o{ ai_habits : ""
  users ||--o{ chat_sessions : ""
  chat_sessions ||--o{ chat_messages : ""
  chat_messages o|--o{ ai_proposals : ""
  ai_proposals ||--o{ ai_feedback : ""
  ai_configs ||--o{ ai_token_logs : ""
  users ||--o{ calendar_connections : ""
  calendar_connections ||--o{ calendar_events : ""
  users ||--o{ user_time_off : ""
  tasks ||--o{ time_entries : ""
  tasks ||--o| task_reviews : ""
  users ||--o{ user_metrics_weekly : ""
  users ||--o{ weekly_checkins : ""
  ai_model_catalog { uuid id PK
                     string provider
                     string model
                     string label
                     float input_price
                     float output_price
                     float cached_input_price
                     int context_window
                     bool supports_structured_output
                     bool supports_temperature
                     bool is_reasoning
                     string cache_mode "NONE GEMINI_CACHED_CONTENTS OPENAI_BREAKPOINT"
                     date price_effective_from }
  ai_configs { uuid id PK
               uuid workspace_id FK "null = mặc định hệ thống"
               string provider
               string model
               string api_key_encrypted
               string base_url
               enum purpose "DECOMPOSE ASSIGN EXPLAIN CHAT"
               json advanced_params "temperature, maxTokens, promptCache, trace, dataSources"
               int timeout_ms
               bool is_default
               bool is_active }
  ai_prompt_configs { uuid id PK
                      uuid workspace_id FK
                      enum type "MASTER WORKSPACE"
                      int version
                      text content
                      uuid updated_by FK
                      bool is_active }
  ai_personal_prompts { uuid user_id PK
                        text content }
  ai_memories { uuid id PK
                uuid user_id FK
                uuid workspace_id FK
                enum kind "PERSONAL SCHEDULE ASSIGNMENT CAPACITY PROJECT"
                text content
                enum status "PROPOSED CONFIRMED DISABLED STRUCTURED"
                json suggested_structured
                uuid source_message_id FK
                date valid_until }
  ai_habits { uuid id PK
              uuid user_id FK
              enum type "ASSIGN_PATTERN TIME_PATTERN ESTIMATE_PATTERN SKILL_GROWTH SCOPE_PATTERN"
              string key
              json value
              int times_observed
              float confidence
              bool is_visible
              datetime last_observed_at }
  chat_sessions { uuid id PK
                  uuid user_id FK
                  uuid workspace_id FK
                  uuid project_id FK
                  string title }
  chat_messages { uuid id PK
                  uuid session_id FK
                  enum role "USER ASSISTANT SYSTEM"
                  text text
                  json structured_data
                  int schema_version
                  bool parse_failed }
  ai_proposals { uuid id PK
                 uuid message_id FK
                 uuid project_id FK
                 enum kind "DECOMPOSE ASSIGN RESCHEDULE REBALANCE TASK_DRAFT"
                 json payload
                 json code_map "u1→uuid, t1→uuid"
                 json validation_result
                 enum status "DRAFT APPLIED REJECTED EXPIRED"
                 uuid applied_by FK
                 datetime applied_at }
  ai_feedback { uuid id PK
                uuid proposal_id FK
                uuid task_id FK
                json proposed
                json final
                enum edit_kind "ACCEPTED CHANGED_USER CHANGED_TIME CHANGED_HOURS REJECTED"
                decimal spread_before
                decimal spread_after }
  ai_token_logs { uuid id PK
                  uuid config_id FK
                  uuid workspace_id FK
                  uuid user_id FK
                  uuid message_id FK
                  string endpoint
                  string provider
                  string model
                  int input_tokens
                  int cached_input_tokens
                  int output_tokens
                  int duration_ms
                  string status
                  string error_message
                  int prompt_chars
                  string prompt_hash
                  int master_prompt_version
                  int workspace_prompt_version
                  text user_message
                  text prompt_text
                  text raw_response
                  decimal cost_usd }
  calendar_connections { uuid id PK
                         uuid user_id FK
                         enum source "TABLE_CALENDAR ICS MANUAL"
                         string external_ref_encrypted
                         datetime last_synced_at
                         string last_error
                         bool is_active }
  calendar_events { uuid id PK
                    uuid connection_id FK
                    uuid user_id FK
                    string external_id
                    datetime start_at
                    datetime end_at
                    bool is_busy }
  user_time_off { uuid id PK
                  uuid user_id FK
                  date from_date
                  date to_date
                  enum kind "LEAVE HOLIDAY PARTIAL RECURRING"
                  float hours_per_day
                  string recurrence_rule }
  time_entries { uuid id PK
                 uuid task_id FK
                 uuid user_id FK
                 date work_date
                 float hours
                 enum source "MANUAL CYCLE_TIME" }
  task_reviews { uuid task_id PK
                 uuid reviewer_id FK
                 int rating "1..5"
                 int difficulty_actual "1..5"
                 float actual_hours_confirmed
                 text comment }
  user_metrics_weekly { uuid user_id FK
                        date week_start
                        string skill_category
                        float ear
                        float velocity_hours
                        float on_time_rate
                        float avg_rating
                        float median_cycle_days
                        int reopen_count
                        int sample_size }
  weekly_checkins { uuid id PK
                    uuid user_id FK
                    date week_start
                    int score "1..5" }
```

## 3. Ràng buộc phải viết bằng SQL tay

Prisma không diễn tả được; đặt trong `prisma/sql/_sau-moi-db-push.sql` và `npm run db:push` tự áp lại, `npm run db:check` kiểm (quy trình `~/Table_Calendar/CLAUDE.md` mục 2.1 — `prisma migrate diff` báo 0 DROP mà push xong vẫn mất ràng buộc).

| Ràng buộc | SQL | Bảo vệ |
|---|---|---|
| Một sprint ACTIVE mỗi dự án | `CREATE UNIQUE INDEX sprints_one_active ON sprints(project_id) WHERE status = 'ACTIVE';` | UC-09 |
| Một PM mỗi dự án | `CREATE UNIQUE INDEX project_members_one_pm ON project_members(project_id) WHERE role = 'PM';` | UC-08 |
| Một cấu hình AI mặc định mỗi mục đích mỗi workspace | `CREATE UNIQUE INDEX ai_configs_one_default ON ai_configs(workspace_id, purpose) WHERE is_default;` | UC-40 |
| Một prompt active mỗi loại mỗi workspace | `CREATE UNIQUE INDEX ai_prompt_one_active ON ai_prompt_configs(workspace_id, type) WHERE is_active;` | UC-40 |
| Khoảng giá trị | `CHECK (estimate_hours BETWEEN 0 AND 400)`, `CHECK (level BETWEEN 1 AND 5)`, `CHECK (difficulty BETWEEN 1 AND 5)`, `CHECK (start_date <= due_date)`, `CHECK (rating BETWEEN 1 AND 5)` | dữ liệu sạch cho công thức |
| Không phụ thuộc tự thân | `CHECK (task_id <> depends_on_id)` (vòng dài hơn kiểm ở service) | UC-11 |
| Không nghỉ chồng nhau | `EXCLUDE USING gist (user_id WITH =, daterange(from_date, to_date, '[]') WITH &&)` (cần `btree_gist`) | UC-07 |
| Email không phân biệt hoa thường | kiểu `citext` (extension đã bật) | UC-01 |
| Tìm mờ tiêu đề / tên kỹ năng | `CREATE INDEX tasks_title_trgm ON tasks USING gin (title gin_trgm_ops);` | UC-15, alias kỹ năng |

## 4. Chỉ mục quan trọng

`tasks(project_id, sprint_id, column_id, position)`, `tasks(due_date) WHERE completed_at IS NULL`, `task_assignees(user_id)`, `calendar_events(user_id, start_at)`, `workload_snapshots(user_id, week_start)`, `ai_token_logs(workspace_id, created_at)`, `chat_messages(session_id, created_at)`, `activity_logs(project_id, created_at)`.

## 5. Dữ liệu mẫu (seed) cho demo

2 dự án · 6 người · 80 task · 3 tuần lịch sử: 1 người Quá tải (EAR 1,4, 3 dự án, 11 h họp/tuần), 1 sprint trễ (vận tốc thấp), 1 sprint scope creep; 12 `calendar_events` từ ICS mẫu; 30 `time_entries`; 25 `task_reviews`; 5 memory đã xác nhận, 3 thói quen; 6 lượt chat có `structured_data` để mở lại thấy thẻ. Script `apps/api/prisma/seed.ts` tái tạo được (`make db-reset && npm run db:seed`).
