# Lệnh tắt cho môi trường phát triển. Chạy `make` để xem danh sách.
COMPOSE := docker compose -f infra/docker-compose.yml

.PHONY: help db-up db-down db-reset db-psql db-ui db-logs env search-up search-down

help: ## Liệt kê lệnh
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

env: ## Tạo .env từ .env.example nếu chưa có
	@test -f .env || cp .env.example .env && echo "Đã có .env"

db-up: env ## Khởi động PostgreSQL cục bộ
	$(COMPOSE) up -d postgres

db-down: ## Dừng PostgreSQL
	$(COMPOSE) down

db-reset: ## Xoá dữ liệu và tạo lại CSDL trống
	$(COMPOSE) down -v && $(COMPOSE) up -d postgres

db-psql: ## Mở psql vào CSDL
	$(COMPOSE) exec postgres psql -U $${POSTGRES_USER:-smarttask} -d $${POSTGRES_DB:-smarttask}

db-ui: ## Bật Adminer tại http://localhost:8080
	$(COMPOSE) --profile ui up -d

db-logs: ## Xem log PostgreSQL
	$(COMPOSE) logs -f postgres

search-up: env ## Bật Elasticsearch (cổng 9200) cho gợi ý @mention; đặt ELASTICSEARCH_URL=http://localhost:9200 trong .env
	$(COMPOSE) --profile search up -d elasticsearch

search-down: ## Tắt Elasticsearch
	$(COMPOSE) --profile search stop elasticsearch
