
import { createClient } from "@supabase/supabase-js";

// Credentials from .env
const supabaseUrl = "https://csqreghnffugahsbxnvm.supabase.co";
// Note: In real production, never hardcode keys. This is a local debug file.
const supabaseKey = "sb_publishable_5adnPGKXqk_rtL3S1EAl5A_NZaKwYVZ";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || supabaseKey;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLinks() {
    console.log("Checking DB Content...");

    const { count: poCount, error: poError } = await supabase
        .from("purchase_orders")
        .select("*", { count: "exact", head: true });

    if (poError) console.error("PO Count Error:", poError);
    else console.log("Total POs:", poCount);

    const { count: linkCount, error: linkError } = await supabase
        .from("purchase_order_quotations")
        .select("*", { count: "exact", head: true });

    if (linkError) console.error("Link Count Error:", linkError);
    else console.log("Total POLinks:", linkCount);

    // Check if recent POs exist
    const { data: recentPOs } = await supabase
        .from("purchase_orders")
        .select("id, po_number, created_at, vendor_id")
        .order("created_at", { ascending: false })
        .limit(5);

    console.log("Recent POs:", recentPOs);
}

checkLinks();
