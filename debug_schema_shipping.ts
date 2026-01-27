
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking shipping_vendor_mpa columns...");
    const { data, error } = await supabase.from('shipping_vendor_mpa').select('*').limit(1);

    if (error) {
        console.error("Error:", error);
    } else {
        if (data && data.length > 0) {
            console.log("Columns:", Object.keys(data[0]));
        } else {
            console.log("Table exists but empty. Cannot infer columns easily via select. Trying to insert dummy to check error?");
            // Actually, usually I can just trust the error if I try to select a non-existent column, 
            // but here I just want to see what's there.
        }
    }
}

checkSchema();
