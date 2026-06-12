import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setup() {
  console.log('Checking for proofs bucket...');
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error('Failed to list buckets. Ensure you have the right permissions:', listError.message);
    console.log('\n⚠️ PLEASE DO THIS MANUALLY:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Go to "Storage"');
    console.log('3. Click "New Bucket" and name it "proofs"');
    console.log('4. Ensure "Public bucket" is toggled ON');
    return;
  }

  const proofsBucket = buckets.find(b => b.name === 'proofs');
  if (proofsBucket) {
    console.log('✅ Bucket "proofs" already exists!');
  } else {
    console.log('Creating bucket "proofs"...');
    const { error: createError } = await supabase.storage.createBucket('proofs', {
      public: true,
      fileSizeLimit: 10485760, // 10MB
    });

    if (createError) {
      console.error('Failed to create bucket:', createError.message);
      console.log('\n⚠️ PLEASE DO THIS MANUALLY:');
      console.log('1. Go to your Supabase Dashboard');
      console.log('2. Go to "Storage"');
      console.log('3. Click "New Bucket" and name it "proofs"');
      console.log('4. Ensure "Public bucket" is toggled ON');
    } else {
      console.log('✅ Bucket "proofs" created successfully!');
    }
  }
}

setup();
