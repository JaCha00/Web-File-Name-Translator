# Web File Name Converter

Batch rename image files based on metadata keywords.

A web/desktop application that extracts metadata from AI-generated images (Stable Diffusion, etc.) and automatically renames files based on keyword matching rules.

[한국어 문서](README.kr.md)

## Features

- **Metadata Extraction**: Supports PNG text chunks, EXIF, XMP, and IPTC metadata
- **Keyword Matching**: Search metadata for keywords and rename files automatically
- **Partial Matching**: Token-based partial matching with configurable match ratio
- **Large Scale Processing**: Handle up to 3,000 images, 6GB total
- **Batch Download**: Generate ZIP files in batches of 100
- **Desktop App**: Native Windows/Mac/Linux app with Tauri
- **Offline Use**: Run locally - no server required

## Installation

### Option 1: Desktop App (Recommended)

Download the installer from [Releases](https://github.com/JaCha00/Web-File-Name-Converter/releases):

| Platform | File |
|----------|------|
| Windows | `File-Name-Converter_x.x.x_x64-setup.exe` |
| macOS | `File-Name-Converter_x.x.x_x64.dmg` |
| Linux | `File-Name-Converter_x.x.x_amd64.AppImage` |

### Option 2: Web Version (Browser)

```bash
# Clone repository
git clone https://github.com/JaCha00/Web-File-Name-Converter.git
cd Web-File-Name-Converter

# Install dependencies
npm install

# Build for web
npm run build
```

Open `dist/index.html` in your browser. No server needed.

### Option 3: Build Desktop App from Source

#### Requirements

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (for Tauri)
- Windows: Visual Studio Build Tools

#### Build

```bash
git clone https://github.com/JaCha00/Web-File-Name-Converter.git
cd Web-File-Name-Converter

npm install
npm run tauri:build
```

Installer will be generated in `src-tauri/target/release/bundle/`.

## Usage

### 1. Create Rules

1. Enter a **keyword** and **new filename** in the left panel
2. Click `Add Rule`
3. Or import rules from a TXT file (`#filename` + newline + `keyword` format)

### 2. Upload Images

1. Drag and drop images onto the drop zone
2. Or click to select files

### 3. Match and Download

1. Click `Apply Rules` to run keyword matching
2. Review matched images (green: exact match, orange: partial match)
3. Click `Download Matched Images` to download as ZIP

## Partial Matching

Keywords are split by comma and checked for partial matches.

```
Keyword: "white background, standing, full body, 1girl"
         ↓ Split by comma
["white background", "standing", "full body", "1girl"]
         ↓
Search each token in metadata
         ↓
3/4 tokens matched → 75% match ratio
         ↓
If ≥ minimum ratio (default 70%), match succeeds
```

### Settings

- **Global Partial Matching**: Enable/disable for all rules
- **Minimum Match Ratio**: 10% ~ 99% (default 70%)
- **Per-Rule Toggle**: Enable/disable partial matching per rule

## Development

```bash
# Web dev server
npm run dev

# Desktop dev mode
npm run tauri:dev

# Build web only
npm run build

# Build desktop app
npm run tauri:build
```

## Tech Stack

- React 19 + TypeScript
- Vite + Tailwind CSS
- Tauri v2 (Desktop)
- exifr (metadata parsing)
- JSZip (ZIP generation)

## Limitations

| Item | Limit |
|------|-------|
| Max images | 3,000 |
| Max file size | 10MB |
| Total size | 6GB |
| ZIP batch size | 100 |

## License

MIT License
