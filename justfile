# MockGen AI Command Runner

# Install project dependencies and setup development environment
setup:
    npm install
    npx playwright install chromium
    @echo "✅ Setup complete! Dependencies installed and Playwright browsers ready."
    @echo "💡 Make sure 'gum' is installed for CLI interactions:"
    @echo "   - macOS: brew install gum"
    @echo "   - Linux: See https://github.com/charmbracelet/gum#installation"

# Run MockGen AI to generate Postman Collection (main user command)
mock:
    @echo "🚀 Starting MockGen AI..."
    npx ts-node -r tsconfig-paths/register src/cli.ts

# Capture network logs and generate API documentation without AI
capture:
    @echo "📡 Starting Network Capture & Documentation..."
    npx ts-node -r tsconfig-paths/register src/captureCommand.ts

# Run all tests
test:
    @echo "🧪 Running tests..."
    npm test

# Run tests in watch mode
test-watch:
    @echo "🧪 Running tests in watch mode..."
    npm run test:watch

# Build the project
build:
    @echo "🔨 Building project..."
    npm run build

# Lint the code
lint:
    @echo "🔍 Linting code..."
    npm run lint

# Format the code
format:
    @echo "✨ Formatting code..."
    npm run format

# Clean build artifacts
clean:
    @echo "🧹 Cleaning build artifacts..."
    rm -rf dist/
    rm -rf node_modules/.cache/

# Show project status and verify installation
status:
    @echo "📊 MockGen AI Project Status:"
    @echo "Node.js version: $(node --version)"
    @echo "npm version: $(npm --version)"
    @echo "TypeScript version: $(npx tsc --version)"
    @echo ""
    @echo "📁 Project structure:"
    @find . -type d -name "node_modules" -prune -o -type d -print | head -10
    @echo ""
    @echo "🔧 Available commands:"
    @just --list