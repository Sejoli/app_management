
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPOs() {
    const { count, error } = await supabase
        .from("purchase_orders")
        .select("*", { count: "exact", head: true });

    if (error) {
        console.error("Error counting POs:", error);
    } else {
        console.log("Total Purchase Orders in DB:", count);
    }

    // Also check if any exist with type OUT
    const { count: countOut, error: errorOut } = await supabase
        .from("purchase_orders")
        .select("*", { count: "exact", head: true })
        .eq("type", "OUT");

    if (errorOut) {
        console.error("Error counting PO OUT:", errorOut);
    } else {
        console.log("Total PO OUT:", countOut);
    }
}

checkPOs();
