
import { supabase } from "./src/integrations/supabase/client";

async function checkColumns() {
    const { data, error } = await (supabase as any).from("purchase_orders").select("*").limit(1);
    if (error) {
        console.error("Error fetching PO:", error);
        return;
    }
    if (data && data.length > 0) {
        console.log("Columns:", Object.keys(data[0]));
    } else {
        // If no data, try to insert a dummy one to see error? No, too risky.
        // Just assume we might need to add them or if they exist.
        console.log("No POs found to inspect.");
    }
}

checkColumns();
