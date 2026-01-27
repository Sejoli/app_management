
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://csqreghnffugahsbxnvm.supabase.co";
const supabaseKey = "sb_publishable_5adnPGKXqk_rtL3S1EAl5A_NZaKwYVZ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBalanceSchema() {
    console.log("Checking balance_items schema...");
    const { data, error } = await supabase.from("balance_items").select("*").limit(1);

    if (error) {
        console.error("Error fetching balance_items:", error);
        return;
    }

    if (data && data.length > 0) {
        const keys = Object.keys(data[0]);
        console.log("Columns found:", keys);
        if (!keys.includes("offering_date")) console.error("MISSING: offering_date");
        if (!keys.includes("offering_letter_number")) console.error("MISSING: offering_letter_number");
    } else {
        console.log("No items found, cannot infer schema from data. However, the error 'Could not find column' confirms it.");
    }
}

checkBalanceSchema();
