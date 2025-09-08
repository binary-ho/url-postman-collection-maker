# MockGen AI - `just capture` 사용법 가이드

**작성일**: 2025-09-08  
**기능명**: AI 없는 네트워크 로그 수집 및 문서화  
**명령어**: `just capture`

---

## 📋 개요

`just capture` 기능은 Google Gemini API 키 없이도 웹사이트의 네트워크 로그를 수집하여 구조화된 API 문서를 생성할 수 있는 도구입니다. 이 가이드는 실제 사용 방법과 예시를 제공합니다.

## 🚀 빠른 시작

### 1. 기본 실행
```bash
just capture
```

### 2. 환경변수로 URL 설정 (선택사항)
```bash
# .env 파일에 기본 URL 설정
echo "MOCKGEN_DEFAULT_URL=https://api.example.com" >> .env
just capture
```

## 📝 단계별 사용 가이드

### Step 1: URL 입력
```
📡 MockGen AI - Network Capture & Documentation
   Capture network logs and generate API documentation without AI

📝 Please enter the URL you want to analyze:
```

**옵션 1**: 직접 입력
- 분석할 웹사이트 URL을 입력합니다
- 예: `https://api.example.com`, `https://jsonplaceholder.typicode.com`

**옵션 2**: 환경변수 사용
- `.env` 파일에 `MOCKGEN_DEFAULT_URL` 설정 시 자동으로 사용됩니다

### Step 2: 브라우저 상호작용
```
🌐 Starting browser and network capture...
✅ Browser initialized successfully
✅ Network capture setup complete
🌐 Navigating to: https://api.example.com
✅ Navigation complete
🎬 Network capture started

🎯 Browser is ready for interaction!
📋 Instructions:
   1. Use the browser to navigate and interact with the website
   2. Perform any actions that trigger API calls (login, search, etc.)
   3. When finished, return to this terminal and press Enter

⏳ Press Enter when you have completed all interactions...
```

**수행할 작업**:
- 브라우저에서 웹사이트 탐색
- 로그인, 검색, 데이터 로딩 등 API 호출이 발생하는 작업 수행
- 충분한 API 호출을 수집했다면 터미널로 돌아와서 **Enter 키** 입력

### Step 3: URL 선택
```
📋 Found 5 unique URLs. Please select which ones to process:
🌐 Select All URLs (Process all captured URLs)
1. /api/users (api.example.com)
2. /api/posts (api.example.com)
3. /api/comments (api.example.com)
4. /api/albums (api.example.com)
5. /api/photos (api.example.com)
```

**선택 옵션**:
- **전체 선택**: `🌐 Select All URLs` 선택 시 모든 URL 처리
- **개별 선택**: 특정 URL만 선택하여 처리 (다중 선택 가능)
- **방향키**와 **스페이스바**로 선택, **Enter**로 확인

### Step 4: 문서 형식 선택
```
📋 Please select documentation format:
📝 Markdown (.md) - Human-readable documentation
📊 JSON (.json) - Structured data format
🌐 HTML (.html) - Web-viewable documentation
```

**형식별 특징**:
- **Markdown**: 개발자 친화적, GitHub/GitLab에서 바로 읽기 가능
- **JSON**: 프로그래밍적 처리 가능, API 도구 연동 용이
- **HTML**: 웹 브라우저에서 바로 보기 가능, 시각적으로 우수

### Step 5: 문서 생성 완료
```
✅ API documentation generated successfully
📄 Format: MARKDOWN
📊 Stats: 5 endpoints, 2 BFF APIs

🎉 Network capture and documentation completed successfully!
📋 Your API documentation is ready at: ./api_documentation.md
```

## 📊 생성되는 문서 형식

### Markdown 문서 예시
```markdown
# API Documentation

Generated on: 2025-09-08T10:17:00.000Z
Total Endpoints: 5

## Overview
- **Total Endpoints**: 5
- **BFF Block APIs**: 2
- **Regular APIs**: 3
- **Unique Hosts**: api.example.com
- **HTTP Methods**: GET, POST

## BFF Block APIs

### GET /v1/blocks?keys=home.banner
**Type**: BFF Block API
**Host**: api.example.com

**Query Parameters**:
- `keys`: home.banner

**Response Example**:
{
  "data": {
    "home.banner": {
      "title": "Welcome",
      "image": "banner.jpg"
    }
  }
}

## Regular APIs

### GET Endpoints

#### GET /api/users
**Host**: api.example.com

**Response Example**:
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
]
```

### JSON 문서 구조
```json
{
  "metadata": {
    "generatedAt": "2025-09-08T10:17:00.000Z",
    "totalEndpoints": 5,
    "generator": "MockGen AI Document Generator"
  },
  "statistics": {
    "totalEndpoints": 5,
    "bffApiCount": 2,
    "regularApiCount": 3,
    "uniqueHosts": ["api.example.com"],
    "httpMethods": ["GET", "POST"],
    "documentSize": 1234
  },
  "apis": [
    {
      "method": "GET",
      "url": "https://api.example.com/v1/blocks?keys=home.banner",
      "host": "api.example.com",
      "isBffBlockApi": true,
      "queryParams": {
        "keys": "home.banner"
      },
      "responseBody": "{\"data\":{\"home.banner\":{\"title\":\"Welcome\"}}}"
    }
  ]
}
```

### HTML 문서 특징
- **반응형 디자인**: 모바일/데스크톱 모두 지원
- **HTTP 메서드 색상 구분**:
  - GET: 초록색
  - POST: 파란색
  - PUT: 노란색
  - DELETE: 빨간색
- **BFF API 배지**: 보라색 "BFF" 배지로 식별
- **코드 하이라이팅**: JSON 응답 예시 구문 강조

## 🔧 고급 사용법

### 환경변수 설정
```bash
# .env 파일 생성
cat > .env << EOF
# 기본 URL 설정 (URL 입력 단계 건너뛰기)
MOCKGEN_DEFAULT_URL=https://api.example.com

# 허용된 호스트 설정 (네트워크 필터링)
MOCKGEN_ALLOWED_HOSTS=api.example.com,staging-api.example.com

# API 키 (capture 기능에서는 불필요)
AI_API_KEY=not-required-for-capture
EOF
```

### 특정 API 패턴 캡처
**BFF 블록 API 캡처**:
- URL 패턴: `/blocks?keys=...`
- 자동으로 BFF API로 분류됨
- 문서에서 별도 섹션으로 구분

**일반 REST API 캡처**:
- 모든 HTTP 메서드 지원 (GET, POST, PUT, DELETE, PATCH)
- HTTP 메서드별로 그룹화되어 문서화

### 대용량 사이트 처리
```bash
# 허용된 호스트만 캡처하여 성능 최적화
export MOCKGEN_ALLOWED_HOSTS="api.mysite.com"
just capture
```

## 🛠️ 문제 해결

### 일반적인 문제

#### 1. gum 명령어를 찾을 수 없음
```
Error: gum command not found
```
**해결책**:
```bash
# macOS
brew install gum

# Linux (Ubuntu/Debian)
sudo apt update && sudo apt install gum
```

#### 2. 브라우저 실행 실패
```
Error: Browser launch failed
```
**해결책**:
```bash
# Playwright 브라우저 재설치
npx playwright install chromium
```

#### 3. 네트워크 요청이 캡처되지 않음
**원인**: 허용된 호스트 설정 문제
**해결책**:
```bash
# config.yaml에서 allowed_hosts 확인
cat config.yaml | grep -A 5 allowed_hosts

# 또는 환경변수로 설정
export MOCKGEN_ALLOWED_HOSTS="your-api-host.com"
```

#### 4. 문서가 생성되지 않음
**원인**: 캡처된 API 요청이 없음
**해결책**:
- 브라우저에서 실제로 API 호출이 발생하는 작업 수행
- 개발자 도구 Network 탭에서 API 호출 확인
- HTTPS 사이트인지 확인

#### 5. TypeScript 컴파일 오류
```bash
# 컴파일 오류 확인
npx tsc --noEmit

# 의존성 재설치
npm install
```

### 디버깅 팁

#### 1. 상세 로그 확인
터미널 출력을 주의 깊게 확인하여 어느 단계에서 문제가 발생했는지 파악하세요.

#### 2. 브라우저 개발자 도구 활용
- F12로 개발자 도구 열기
- Network 탭에서 실제 API 호출 확인
- Console 탭에서 JavaScript 오류 확인

#### 3. 단순한 사이트부터 테스트
```bash
# JSONPlaceholder로 테스트
export MOCKGEN_DEFAULT_URL="https://jsonplaceholder.typicode.com"
just capture
```

## 💡 사용 팁

### 1. 효율적인 API 수집
- **로그인 후 사용**: 인증이 필요한 API도 캡처 가능
- **다양한 기능 사용**: 검색, 필터링, 페이징 등 다양한 API 호출
- **충분한 시간 확보**: 모든 API 호출이 완료될 때까지 대기

### 2. 문서 형식 선택 가이드
- **개발 문서**: Markdown 선택
- **API 도구 연동**: JSON 선택
- **프레젠테이션**: HTML 선택

### 3. 팀 협업
```bash
# 팀 공유용 설정
cat > .env << EOF
MOCKGEN_DEFAULT_URL=https://staging-api.company.com
MOCKGEN_ALLOWED_HOSTS=staging-api.company.com,api.company.com
EOF

# 문서 생성 후 공유
just capture
# 생성된 api_documentation.md를 Git에 커밋
```

## 📚 활용 사례

### 1. API 문서화
- 기존 API의 실제 동작 문서화
- 새로운 팀원 온보딩용 자료
- API 변경사항 추적

### 2. 테스트 데이터 생성
- 실제 API 응답을 기반으로 한 테스트 데이터
- Mock 서버 설정용 데이터
- API 스키마 검증

### 3. 시스템 분석
- 레거시 시스템의 API 구조 파악
- 마이크로서비스 간 통신 분석
- 성능 최적화를 위한 API 호출 패턴 분석

## 🎯 모범 사례

### 1. 체계적인 캡처
```bash
# 1. 환경 설정
export MOCKGEN_DEFAULT_URL="https://api.example.com"
export MOCKGEN_ALLOWED_HOSTS="api.example.com"

# 2. 기능별 캡처
# 사용자 관련 API
just capture  # 로그인, 프로필 조회 등

# 상품 관련 API  
just capture  # 상품 목록, 검색, 상세 등

# 주문 관련 API
just capture  # 장바구니, 주문, 결제 등
```

### 2. 문서 관리
```bash
# 날짜별 문서 보관
mkdir -p docs/api/$(date +%Y-%m-%d)
just capture
mv api_documentation.* docs/api/$(date +%Y-%m-%d)/
```

### 3. 지속적인 문서화
```bash
# 정기적인 API 문서 업데이트
# cron job 또는 CI/CD 파이프라인에 통합
0 2 * * 1 cd /path/to/project && just capture
```

---

## 📞 지원

문제가 발생하거나 질문이 있으시면:

1. [Issues](../../issues)에서 기존 문제를 검색해보세요
2. 새로운 이슈를 생성하여 문제를 보고하세요
3. 가능한 한 상세한 정보를 제공해주세요:
   - 운영체제 및 버전
   - Node.js 버전
   - 오류 메시지 전문
   - 재현 단계

---

**작성일**: 2025-09-08  
**최종 업데이트**: 2025-09-08