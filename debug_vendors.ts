
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://csqreghnffugahsbxnvm.supabase.co";
const supabaseKey = "sb_publishable_5adnPGKXqk_rtL3S1EAl5A_NZaKwYVZ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVendorSchema() {
    const { data, error } = await supabase.from("vendors").select("*").limit(1);
    if (error) {
        console.error(error);
    } else {
        if (data && data.length > 0) {
            console.log("Vendor Keys:", Object.keys(data[0]));
        } else {
            console.log("No vendors found to check keys.");
        }
    }
}

checkVendorSchema();
