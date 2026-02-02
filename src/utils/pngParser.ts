/**
 * PNG 파일의 텍스트 청크(tEXt, iTXt, zTXt)를 직접 파싱합니다.
 * ExifTool에서 보이는 PNG:Comment 등의 메타데이터를 읽을 수 있습니다.
 */

interface PngTextChunk {
  keyword: string;
  text: string;
  type: 'tEXt' | 'iTXt' | 'zTXt';
}

// PNG 시그니처: 89 50 4E 47 0D 0A 1A 0A
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPNG(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer, 0, 8);
  return PNG_SIGNATURE.every((byte, i) => view[i] === byte);
}

function readUint32(data: Uint8Array, offset: number): number {
  return (
    (data[offset] << 24) |
    (data[offset + 1] << 16) |
    (data[offset + 2] << 8) |
    data[offset + 3]
  );
}

function decodeText(data: Uint8Array): string {
  try {
    // UTF-8로 먼저 시도
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(data);
  } catch {
    // Latin-1 폴백
    return Array.from(data)
      .map((b) => String.fromCharCode(b))
      .join('');
  }
}

function findNullTerminator(data: Uint8Array, start: number): number {
  for (let i = start; i < data.length; i++) {
    if (data[i] === 0) return i;
  }
  return data.length;
}

// zlib으로 압축된 데이터 해제 (브라우저 DecompressionStream 사용)
async function inflateData(compressed: Uint8Array): Promise<string> {
  try {
    // DecompressionStream이 지원되는 경우
    if ('DecompressionStream' in window) {
      // 새 ArrayBuffer로 복사
      const buffer = new ArrayBuffer(compressed.length);
      const view = new Uint8Array(buffer);
      view.set(compressed);
      
      const ds = new DecompressionStream('deflate');
      const writer = ds.writable.getWriter();
      writer.write(buffer);
      writer.close();
      
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return decodeText(result);
    }
  } catch (e) {
    console.warn('zTXt 압축 해제 실패:', e);
  }
  
  return '[압축된 텍스트 - 해제 불가]';
}

export async function parsePngTextChunks(buffer: ArrayBuffer): Promise<Record<string, string>> {
  if (!isPNG(buffer)) {
    return {};
  }

  const data = new Uint8Array(buffer);
  const result: Record<string, string> = {};
  const chunks: PngTextChunk[] = [];

  // PNG 시그니처 이후부터 청크 파싱
  let offset = 8;

  while (offset < data.length - 12) {
    const length = readUint32(data, offset);
    const typeBytes = data.slice(offset + 4, offset + 8);
    const type = decodeText(typeBytes);
    const chunkData = data.slice(offset + 8, offset + 8 + length);

    // tEXt 청크: keyword + null + text
    if (type === 'tEXt') {
      const nullPos = findNullTerminator(chunkData, 0);
      const keyword = decodeText(chunkData.slice(0, nullPos));
      const text = decodeText(chunkData.slice(nullPos + 1));
      chunks.push({ keyword, text, type: 'tEXt' });
      result[`PNG:${keyword}`] = text;
    }
    // iTXt 청크: keyword + null + compression flag + compression method + language tag + null + translated keyword + null + text
    else if (type === 'iTXt') {
      const nullPos1 = findNullTerminator(chunkData, 0);
      const keyword = decodeText(chunkData.slice(0, nullPos1));
      
      const compressionFlag = chunkData[nullPos1 + 1];
      // const compressionMethod = chunkData[nullPos1 + 2];
      
      const nullPos2 = findNullTerminator(chunkData, nullPos1 + 3); // language tag
      const nullPos3 = findNullTerminator(chunkData, nullPos2 + 1); // translated keyword
      
      let text: string;
      if (compressionFlag === 0) {
        text = decodeText(chunkData.slice(nullPos3 + 1));
      } else {
        text = await inflateData(chunkData.slice(nullPos3 + 1));
      }
      
      chunks.push({ keyword, text, type: 'iTXt' });
      result[`PNG:${keyword}`] = text;
    }
    // zTXt 청크: keyword + null + compression method + compressed text
    else if (type === 'zTXt') {
      const nullPos = findNullTerminator(chunkData, 0);
      const keyword = decodeText(chunkData.slice(0, nullPos));
      // compression method is at nullPos + 1 (should be 0 for deflate)
      const compressedData = chunkData.slice(nullPos + 2);
      const text = await inflateData(compressedData);
      
      chunks.push({ keyword, text, type: 'zTXt' });
      result[`PNG:${keyword}`] = text;
    }
    // IEND 청크면 종료
    else if (type === 'IEND') {
      break;
    }

    // 다음 청크로 이동 (length + type(4) + data(length) + CRC(4))
    offset += 12 + length;
  }

  return result;
}
