import fs from 'fs';
import path from 'path';

const routesDir = path.join(process.cwd(), 'src/routes');

fs.readdirSync(routesDir).forEach(file => {
  if (file.endsWith('.ts')) {
    const p = path.join(routesDir, file);
    let content = fs.readFileSync(p, 'utf8');
    
    // Fix req.params.xxx
    content = content.replace(/req\.params\.id(?! as string)/g, 'req.params.id as string');
    content = content.replace(/req\.params\.applicationId(?! as string)/g, 'req.params.applicationId as string');
    content = content.replace(/req\.params\.categoryId(?! as string)/g, 'req.params.categoryId as string');
    content = content.replace(/req\.params\.departmentId(?! as string)/g, 'req.params.departmentId as string');

    // Add import sendEmail if missing in applications.ts
    if (file === 'applications.ts' && !content.includes('sendEmail')) {
      content = content.replace("import upload from '../lib/upload.js';", "import upload from '../lib/upload.js';\nimport { sendEmail } from '../lib/email.js';");
    }

    fs.writeFileSync(p, content);
  }
});
