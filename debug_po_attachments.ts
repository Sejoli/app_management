
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://csqreghnffugahsbxnvm.supabase.co";
const supabaseKey = "sb_publishable_5adnPGKXqk_rtL3S1EAl5A_NZaKwYVZ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAttachments() {
    console.log("Fetching PO attachments...");
    const { data, error } = await supabase
        .from("purchase_order_attachments")
        .select("id, file_name, file_path")
        .limit(5);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Attachments:", JSON.stringify(data, null, 2));
    }
}

checkAttachments();
