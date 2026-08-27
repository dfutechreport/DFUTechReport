import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Yedekleme dışı bırakılacak ağır klasörler
const EXCLUDE_DIRS = ['.next', 'node_modules', '.git', '.vercel', 'public'];
const INCLUDE_EXTS = ['.ts', '.tsx', '.css', '.json', '.js'];

function getFilesRecursively(dir: string): string {
  let content = "";
  if (!fs.existsSync(dir)) return "";
  
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(file)) {
        content += getFilesRecursively(filePath);
      }
    } else {
      if (INCLUDE_EXTS.includes(path.extname(file))) {
        const relativePath = path.relative(process.cwd(), filePath);
        const fileData = fs.readFileSync(filePath, 'utf8');
        content += `\n==================== DOSYA: ${relativePath} ====================\n${fileData}\n\n`;
      }
    }
  });
  return content;
}

export async function GET() {
  try {
    const allCode = getFilesRecursively(process.cwd());
    return NextResponse.json({ codeDump: allCode });
  } catch (error) {
    return NextResponse.json({ error: "DNA dökümü başarısız" }, { status: 500 });
  }
}