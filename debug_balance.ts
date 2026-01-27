
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://csqreghnffugahsbxnvm.supabase.co";
const supabaseKey = "sb_publishable_5adnPGKXqk_rtL3S1EAl5A_NZaKwYVZ"; // copied from .env

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBalance() {
    const { data: balance } = await supabase.from("balances").select("id").limit(1).single();
    if (balance) {
        const { data, error } = await supabase.from("balance_items")
            .select("*")
            .eq("balance_id", balance.id);

        if (error) {
            console.error(error);
        } else {
            console.log("Balance Items:", JSON.stringify(data, null, 2));
        }
    }
}

checkBalance();
