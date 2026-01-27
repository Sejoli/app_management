
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function clearData() {
    console.log("Clearing Purchase Order Data...");
    // Due to Cascade, deleting from purchase_orders should be enough, 
    // but explicit delete is safer for feedback

    const { error } = await supabase.from('purchase_orders').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
        console.error("Error clearing POs:", error);
    } else {
        console.log("All Purchase Orders deleted successfully.");
    }
}

clearData();
