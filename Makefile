.PHONY: dev build run clean kill restart

# Development - build frontend, backend and run
dev: kill build run

# Build frontend and backend
build:
	@echo "🔨 Building frontend..."
	cd web && npm run build
	@echo "📦 Copying dist to server..."
	rm -rf cmd/server/web/dist
	cp -r web/dist cmd/server/web/
	@echo "🔧 Building backend..."
	go build -o tickfy-validator-setup ./cmd/server
	@echo "✅ Build complete!"

# Run the server
run:
	@echo "🚀 Starting Tickfy Validator Setup..."
	./tickfy-validator-setup

# Kill running instance
kill:
	@echo "🔪 Killing existing process..."
	-pkill -f tickfy-validator-setup || true

# Restart (kill + build + run)
restart: kill build run

# Clean build artifacts
clean:
	rm -rf tickfy-validator-setup
	rm -rf web/dist
	rm -rf cmd/server/web/dist

# Frontend only dev server
frontend:
	cd web && npm run dev

# Watch frontend and rebuild on changes (requires entr)
watch:
	@echo "👀 Watching for changes..."
	find web/src -name '*.jsx' -o -name '*.js' -o -name '*.css' | entr -r make restart
