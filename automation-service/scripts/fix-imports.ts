import fs from 'fs';
import path from 'path';

const servicesDir = path.join(__dirname, '../src/services');

function fixImports(dir: string) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixImports(fullPath);
      continue;
    }

    if (!file.endsWith('.ts')) continue;

    let content = fs.readFileSync(fullPath, 'utf8');

    // Fix models
    content = content.replace(/from "@\/lib\/models[^"]*"/g, 'from "../models"');
    content = content.replace(/from "\.\.\/models\/[^"]*"/g, 'from "../models"'); // Flatten sub-dirs
    
    // Fix services (external services)
    content = content.replace(/from "@\/lib\/services\/messaging\/[^"]*"/g, 'from "../lib/internal-client"');
    content = content.replace(/from "@\/lib\/services\/commerce\/[^"]*"/g, 'from "../lib/internal-client"');
    content = content.replace(/from "@\/lib\/services\/automation\/safety-guards"/g, 'from "./safety-guards"');
    
    // Fix dbConnect
    content = content.replace(/import dbConnect from ['"]@\/lib\/db-connect['"];/g, '// import dbConnect from "../lib/db-connect";');
    content = content.replace(/await dbConnect\(\);/g, '// db connection is handled in index.ts');

    // Fix ioredis
    content = content.replace(/from ['"]@\/lib\/ioredis['"]/g, 'from "../lib/ioredis"');

    fs.writeFileSync(fullPath, content);
    console.log(`Fixed imports in ${file}`);
  }
}

fixImports(servicesDir);
