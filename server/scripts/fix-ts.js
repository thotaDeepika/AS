import fs from 'fs';
import path from 'path';

const routesDir = path.join(process.cwd(), 'src/routes');

// Fix req.query params
const fixQueryParams = (content) => {
  return content.replace(/department_id: department_id,/g, 'department_id: department_id as string,')
                .replace(/department_id \}/g, 'department_id: department_id as string }')
                .replace(/academic_year: academic_year /g, 'academic_year: academic_year as string ')
                .replace(/academic_year: academic_year,/g, 'academic_year: academic_year as string,')
                .replace(/academic_year \}/g, 'academic_year: academic_year as string }')
                .replace(/status: status,/g, 'status: status as string,')
                .replace(/status \}/g, 'status: status as string }')
                .replace(/department_id: req\.query\.department_id/g, 'department_id: req.query.department_id as string')
                .replace(/academic_year: req\.query\.academic_year/g, 'academic_year: req.query.academic_year as string')
                .replace(/where\.department_id = department_id/g, 'where.department_id = department_id as string')
                .replace(/where\.academic_year = academic_year/g, 'where.academic_year = academic_year as string')
                .replace(/where\.status = status/g, 'where.status = status as any');
};

// Fix faculty property access (due to Prisma cache)
const fixFacultyAccess = (content) => {
  return content.replace(/application\.faculty/g, '(application as any).faculty')
                .replace(/where: \{ faculty:/g, 'where: { faculty:') // leave this
                .replace(/include: \{ faculty:/g, 'include: { faculty:') // leave this
                .replace(/applications\.map\(\(app: any\)/g, 'applications.map((app: any)') // leave this
};

// Fix auth.ts
const fixAuth = (content) => {
  return content.replace(/const expiresIn = process\.env\.JWT_EXPIRES_IN \|\| '24h';/g, 'const expiresIn = (process.env.JWT_EXPIRES_IN || "24h") as any;');
};

const fixReviews = (content) => {
  return content.replace(/where: \{ application_id: req\.params\.applicationId,/g, 'where: { application_id: req.params.applicationId as string,');
}

fs.readdirSync(routesDir).forEach(file => {
  if (file.endsWith('.ts')) {
    const p = path.join(routesDir, file);
    let content = fs.readFileSync(p, 'utf8');
    
    content = fixQueryParams(content);
    content = fixFacultyAccess(content);
    if (file === 'auth.ts') content = fixAuth(content);
    if (file === 'reviews.ts') content = fixReviews(content);
    
    fs.writeFileSync(p, content);
  }
});
