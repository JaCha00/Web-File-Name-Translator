# Web File Name Converter

이미지 메타데이터 기반 파일명 일괄 변환기

AI 생성 이미지(Stable Diffusion 등)의 메타데이터에서 키워드를 추출하여 파일명을 자동으로 변경하고 ZIP으로 다운로드할 수 있는 웹/데스크톱 애플리케이션입니다.

## 주요 기능

- **메타데이터 추출**: PNG 텍스트 청크, EXIF, XMP, IPTC 메타데이터 지원
- **키워드 매칭**: 메타데이터에서 키워드를 검색하여 파일명 자동 변경
- **부분 매칭**: 쉼표로 구분된 토큰 기반 부분 일치 지원 (일치율 설정 가능)
- **대용량 처리**: 최대 3,000개 이미지, 6GB까지 처리 가능
- **일괄 다운로드**: 100개 단위로 ZIP 파일 생성
- **데스크톱 앱**: Tauri 기반 Windows/Mac/Linux 네이티브 앱
- **오프라인 사용**: 서버 없이 로컬에서 실행 가능

## 설치 방법

### 방법 1: 데스크톱 앱 (권장)

[Releases](https://github.com/JaCha00/Web-File-Name-Converter/releases) 페이지에서 설치 파일 다운로드:

| 플랫폼 | 파일 |
|--------|------|
| Windows | `File-Name-Converter_x.x.x_x64-setup.exe` |
| macOS | `File-Name-Converter_x.x.x_x64.dmg` |
| Linux | `File-Name-Converter_x.x.x_amd64.AppImage` |

### 방법 2: 웹 버전 (브라우저)

```bash
# 저장소 클론
git clone https://github.com/JaCha00/Web-File-Name-Converter.git
cd Web-File-Name-Converter

# 의존성 설치
npm install

# 웹 빌드
npm run build
```

`dist/index.html` 파일을 브라우저에서 직접 열면 됩니다. 서버 불필요.

### 방법 3: 데스크톱 앱 직접 빌드

#### 요구 사항

- [Node.js](https://nodejs.org/) 18 이상
- [Rust](https://rustup.rs/) (Tauri용)
- Windows: Visual Studio Build Tools

#### 빌드

```bash
git clone https://github.com/JaCha00/Web-File-Name-Converter.git
cd Web-File-Name-Converter

npm install
npm run tauri:build
```

설치 파일이 `src-tauri/target/release/bundle/`에 생성됩니다.

## 사용 방법

### 1. 규칙 생성

1. 왼쪽 패널에서 **키워드**와 **새 파일명**을 입력
2. `규칙 추가` 버튼 클릭
3. 또는 TXT 파일로 규칙 일괄 가져오기 (`#파일명` + 줄바꿈 + `키워드` 형식)

### 2. 이미지 업로드

1. 오른쪽 패널의 드롭존에 이미지 드래그 앤 드롭
2. 또는 클릭하여 파일 선택

### 3. 매칭 및 다운로드

1. `규칙 적용` 버튼으로 키워드 매칭 실행
2. 매칭된 이미지 확인 (녹색: 완전 일치, 주황색: 부분 일치)
3. `매칭된 이미지 다운로드` 버튼으로 ZIP 다운로드

## 부분 매칭 기능

키워드를 쉼표로 구분하여 부분 일치를 검사합니다.

```
키워드: "white background, standing, full body, 1girl"
         ↓ 쉼표로 분리
["white background", "standing", "full body", "1girl"]
         ↓
메타데이터에서 각 토큰 검색
         ↓
3/4 토큰 일치 → 75% 일치율
         ↓
최소 일치율(기본 70%) 이상이면 매칭 성공
```

### 설정

- **전역 부분 매칭 ON/OFF**: 모든 규칙에 부분 매칭 적용
- **최소 일치율**: 10% ~ 99% (기본 70%)
- **개별 규칙 토글**: 규칙별로 부분 매칭 활성화/비활성화

## 개발

```bash
# 웹 개발 서버
npm run dev

# 데스크톱 개발 모드
npm run tauri:dev

# 웹만 빌드
npm run build

# 데스크톱 앱 빌드
npm run tauri:build
```

## 기술 스택

- React 19 + TypeScript
- Vite + Tailwind CSS
- Tauri v2 (데스크톱)
- exifr (메타데이터 파싱)
- JSZip (ZIP 생성)

## 제한 사항

| 항목 | 제한 |
|------|------|
| 최대 이미지 수 | 3,000개 |
| 개별 파일 크기 | 10MB |
| 총 용량 | 6GB |
| ZIP 배치 크기 | 100개 |

## 라이선스

MIT License
