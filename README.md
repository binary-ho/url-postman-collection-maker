# MockGen AI 🤖

**AI-powered tool to generate Postman Collections from browser network logs**

MockGen AI는 웹사이트의 네트워크 로그를 분석하여 자동으로 Postman Collection을 생성하는 TypeScript 기반 CLI 도구입니다. BFF(Backend for Frontend) 아키텍처에 특화되어 있으며, Google Gemini AI를 활용하여 고품질의 API 모킹 컬렉션을 생성합니다.

## ✨ 주요 기능

- 🌐 **브라우저 자동화**: Playwright를 사용한 실시간 네트워크 캡처
- 🤖 **AI 기반 생성**: Google Gemini AI로 지능적인 Postman Collection 생성
- 🎯 **BFF 특화**: 블록 API 패턴 자동 인식 및 우선 처리
- 🔧 **사용자 친화적**: 대화형 CLI 인터페이스 (gum 통합)
- ⚙️ **유연한 설정**: YAML 기반 설정 파일
- 📊 **완전한 응답 예시**: 200, 204, 400 응답 자동 생성
- 🔒 **보안 고려**: 환경 변수 기반 API 키 관리

## 🚀 빠른 시작

### 1. 사전 요구사항

- **Node.js** 18.0.0 이상
- **npm** 또는 **yarn**
- **Just** 명령어 도구 ([설치 가이드](https://github.com/casey/just#installation))
- **gum** CLI 도구 ([설치 가이드](https://github.com/charmbracelet/gum#installation))
- **Google Gemini API 키** ([발급 받기](https://makersuite.google.com/app/apikey))

#### gum 설치

```bash
# macOS
brew install gum

# Linux (Ubuntu/Debian)
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
sudo apt update && sudo apt install gum

# 기타 설치 방법은 https://github.com/charmbracelet/gum#installation 참조
```

### 2. 프로젝트 설치

```bash
# 저장소 클론
git clone <repository-url>
cd url-postman-collection-maker

# 의존성 설치 및 환경 설정
just setup
```

### 3. API 키, 허용 호스트 설정
- .env 파일 사용 (권장)
- .env.example을 참고해 AI API KEY와 허용 호스트 설정

```bash
# .env.example 파일을 복사하여 .env 파일 생성
cp .env.example .env

# .env 파일을 편집하여 실제 API 키 입력
# AI_API_KEY=your-actual-api-key-here
# MOCKGEN_ALLOWED_HOSTS=api.my.site.com,staging-api.my.site.com
```

**우선순위**: .env 파일 또는 환경 변수 > config.yaml 파일

### 4. 설정 파일 구성
`config.yaml` 파일을 편집하여 분석할 API 호스트를 설정합니다:

```yaml
filter:
  allowed_hosts:
    - "api.your-domain.com"
    - "staging-api.your-domain.com"
    # 필요한 호스트 추가
```

### 5. 실행

```bash
just mock
```

## 📖 상세 사용법

### 단계별 워크플로우

MockGen AI는 다음 7단계로 작동합니다:

#### 1️⃣ URL 입력
```
🚀 Starting MockGen AI...
? 분석할 웹사이트 URL을 입력하세요: https://example.com
```

#### 2️⃣ 브라우저 자동 실행
- Chromium 브라우저가 자동으로 열립니다
- 입력한 URL로 자동 이동합니다
- 네트워크 요청 캡처가 시작됩니다

#### 3️⃣ 사용자 상호작용
```
🌐 브라우저에서 필요한 작업을 수행하세요.
📝 완료 후 이 터미널로 돌아와서 Enter를 누르세요...
```

브라우저에서 다음과 같은 작업을 수행하세요:
- 로그인
- 페이지 탐색
- API 호출이 발생하는 기능 사용
- 데이터 로딩 등

#### 4️⃣ URL 선택
```
📋 캡처된 API 엔드포인트를 선택하세요:
> GET /v1/blocks?keys=home.banner
  POST /v1/users/profile
  GET /v1/products/list
```

#### 5️⃣ 데이터 처리
```
🔄 네트워크 데이터를 처리 중...
✅ BFF 블록 API 2개 식별됨
```

#### 6️⃣ AI 생성
```
🤖 AI가 Postman Collection을 생성 중...
✨ Gemini AI 처리 완료
```

#### 7️⃣ 파일 저장
```
💾 Postman Collection 저장 완료!
📁 파일 위치: ./postman_collection.json
🎉 MockGen AI 실행 완료!
```

## 🔧 환경 변수 설정

MockGen AI는 민감한 정보만 환경 변수로 관리합니다. 다음 환경 변수들은 config.yaml 설정을 덮어씁니다:

### 지원되는 환경 변수 (민감한 정보만)

| 환경 변수 | 설명 | 예시 |
|-----------|------|------|
| `AI_API_KEY` | Google Gemini API 키 (필수) | `your-api-key-here` |
| `MOCKGEN_ALLOWED_HOSTS` | 허용된 호스트 (쉼표로 구분) | `api.example.com,staging.example.com` |

**참고**: 다른 설정들(모델명, 프롬프트 경로, 출력 파일명)은 config.yaml에서만 관리됩니다.

### .env 파일 사용법

1. **템플릿 복사**:
   ```bash
   cp .env.example .env
   ```

2. **.env 파일 편집** (민감한 정보만):
   ```bash
   # 필수: API 키 설정
   AI_API_KEY=your-actual-api-key-here
   
   # 선택사항: 허용된 호스트 설정
   MOCKGEN_ALLOWED_HOSTS=api.mysite.com,staging-api.mysite.com
   ```

3. **우선순위**: 환경 변수 (API 키, allowed_hosts만) > config.yaml 파일

## ⚙️ 설정 파일 (config.yaml)

### AI 설정
```yaml
ai:
  # Google Gemini API 키 (환경 변수 사용 권장)
  api_key: "YOUR_GEMINI_API_KEY"
  
  # 사용할 Gemini 모델
  model_name: "gemini-1.5-pro-latest"  # 권장
  # model_name: "gemini-1.5-flash-latest"  # 빠르고 저렴
  
  # AI 프롬프트 템플릿 경로
  prompt_template_path: "./prompts/collection_generator.txt"
```

### 출력 설정
```yaml
output:
  # 생성될 파일명
  default_filename: "postman_collection.json"
  # 경로 포함 가능: "collections/my_api.json"
```

### 네트워크 필터링
```yaml
filter:
  # 캡처할 호스트 목록 (중요!)
  allowed_hosts:
    - "api.global.oliveyoung.com"
    - "stg-api.global.oliveyoung.com"
    - "localhost:3000"  # 개발 환경
```

**⚠️ 중요**: `allowed_hosts`를 반드시 설정하세요. 빈 목록일 경우 모든 호스트의 요청이 캡처되어 성능 저하가 발생할 수 있습니다.

## 🛠️ 사용 가능한 명령어

```bash
# 메인 실행 명령어
just mock

# 프로젝트 설정 및 의존성 설치
just setup

# 테스트 실행
just test

# 테스트 (watch 모드)
just test-watch

# 프로젝트 빌드
just build

# 코드 린팅
just lint

# 코드 포맷팅
just format

# 빌드 아티팩트 정리
just clean

# 프로젝트 상태 확인
just status

# 사용 가능한 명령어 목록
just --list
```

## 📋 생성되는 Postman Collection 구조

MockGen AI는 다음과 같은 구조의 Postman Collection을 생성합니다:

```json
{
  "info": {
    "name": "Generated BFF Mock API",
    "_postman_id": "uuid-here",
    "description": "Object-driven BFF Mock API generated by MockGen AI",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "GET /v1/blocks?keys=home.banner",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/v1/blocks?keys=home.banner",
          "host": ["{{base_url}}"],
          "path": ["v1", "blocks"],
          "query": [{"key": "keys", "value": "home.banner"}]
        }
      },
      "response": [
        {
          "name": "200 - Success",
          "status": "OK",
          "code": 200,
          "body": "{\"data\": {\"home.banner\": {\"title\": \"Welcome\", \"image\": \"banner.jpg\"}}}"
        },
        {
          "name": "204 - No Content",
          "status": "No Content", 
          "code": 204,
          "body": ""
        },
        {
          "name": "400 - Bad Request",
          "status": "Bad Request",
          "code": 400,
          "body": "{\"type\": \"https://api.example.com/errors/invalid-keys\", \"title\": \"Invalid block keys\", \"status\": 400}"
        }
      ]
    }
  ],
  "variable": [
    { "key": "base_url", "value": "https://api.example.com" }
  ]
}
```

### 특징
- **BFF 블록 API 우선 처리**: `/blocks` 엔드포인트가 최우선으로 배치
- **3가지 응답 예시**: 각 엔드포인트마다 성공, 빈 응답, 오류 응답 제공
- **변수 활용**: `{{base_url}}` 변수로 환경별 URL 관리 용이
- **RFC 7807 준수**: 오류 응답은 Problem Details 표준 형식 사용

## 🔧 문제 해결

### 일반적인 문제

#### 1. gum 명령어를 찾을 수 없음
```bash
Error: gum command not found
```
**해결책**: gum을 설치하세요
```bash
# macOS
brew install gum

# Linux
# 위의 설치 가이드 참조
```

#### 2. Gemini API 오류
```bash
Error: Invalid API key or quota exceeded
```
**해결책**: 
- API 키가 올바른지 확인
- Google AI Studio에서 할당량 확인
- 환경 변수가 제대로 설정되었는지 확인

#### 3. 브라우저 실행 실패
```bash
Error: Browser launch failed
```
**해결책**: Playwright 브라우저를 재설치하세요
```bash
npx playwright install chromium
```

#### 4. 네트워크 요청이 캡처되지 않음
**해결책**: 
- `config.yaml`의 `allowed_hosts` 설정 확인
- 대상 웹사이트가 HTTPS를 사용하는지 확인
- 브라우저에서 실제로 API 호출이 발생하는 작업을 수행했는지 확인

#### 5. TypeScript 컴파일 오류
```bash
just build
```
빌드 명령어로 TypeScript 오류를 확인하고 수정하세요.

### 디버깅 팁

1. **상세 로그 확인**: 터미널 출력을 주의 깊게 확인하세요
2. **설정 파일 검증**: `config.yaml` 문법이 올바른지 확인하세요
3. **네트워크 탭 확인**: 브라우저 개발자 도구에서 실제 API 호출 확인
4. **권한 확인**: 파일 쓰기 권한이 있는지 확인하세요

## 🏗️ 프로젝트 구조

```
mockgen-ai/
├── src/
│   ├── modules/
│   │   ├── browserController.ts    # Playwright 브라우저 제어
│   │   ├── dataProcessor.ts        # 네트워크 데이터 처리
│   │   └── aiGenerator.ts          # AI 기반 컬렉션 생성
│   ├── config/
│   │   └── index.ts                # 설정 파일 로더
│   ├── types/
│   │   └── index.ts                # TypeScript 타입 정의
│   └── cli.ts                      # CLI 메인 핸들러
├── tests/                          # 테스트 파일들
├── prompts/
│   └── collection_generator.txt    # AI 프롬프트 템플릿
├── config.yaml                     # 사용자 설정 파일
├── justfile                        # Just 명령어 정의
└── package.json                    # 프로젝트 메타데이터
```

## 🧪 테스트

```bash
# 모든 테스트 실행
just test

# 테스트 watch 모드
just test-watch

# 특정 테스트 파일 실행
npm test -- tests/modules/dataProcessor.test.ts
```

## 🤝 기여하기

1. 이 저장소를 포크하세요
2. 기능 브랜치를 생성하세요 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋하세요 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시하세요 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성하세요

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🙏 감사의 말

- [Playwright](https://playwright.dev/) - 브라우저 자동화
- [Google Gemini AI](https://ai.google.dev/) - AI 기반 컬렉션 생성
- [gum](https://github.com/charmbracelet/gum) - 아름다운 CLI 인터페이스
- [Just](https://github.com/casey/just) - 명령어 실행 도구

## 📞 지원

문제가 발생하거나 질문이 있으시면:

1. [Issues](../../issues)에서 기존 문제를 검색해보세요
2. 새로운 이슈를 생성하여 문제를 보고하세요
3. 가능한 한 상세한 정보를 제공해주세요 (오류 메시지, 환경 정보 등)

---

**MockGen AI로 API 모킹을 더 쉽고 빠르게! 🚀**