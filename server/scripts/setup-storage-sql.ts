import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupStorage() {
  try {
    console.log('Connecting to database...');
    
    // 1. Create the bucket if it doesn't exist
    console.log('Creating proofs bucket...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('proofs', 'proofs', true, 10485760, null)
      ON CONFLICT (id) DO UPDATE SET public = true;
    `);

    // 2. Create policy to allow ANYONE to insert files (since the backend does the validation)
    console.log('Applying RLS policies...');
    const statements = [
      'DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;',
      'DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;',
      'DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;',
      `CREATE POLICY "Allow public uploads" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'proofs');`,
      `CREATE POLICY "Allow public reads" ON storage.objects FOR SELECT TO public USING (bucket_id = 'proofs');`,
      `CREATE POLICY "Allow public deletes" ON storage.objects FOR DELETE TO public USING (bucket_id = 'proofs');`
    ];

    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt);
    }

    console.log('✅ Supabase Storage successfully configured!');
  } catch (error) {
    console.error('Failed to setup storage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupStorage();
