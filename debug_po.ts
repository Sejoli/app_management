
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPO() {
    const { data, error } = await supabase.from("purchase_orders")
        .select(`
            id,
            po_number,
            quotations:purchase_order_quotations(
                quotation_id,
                quotation:quotations(
                    id, 
                    quotation_number
                )
            )
        `)
        .limit(1);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Data:", JSON.stringify(data, null, 2));
    }
}

checkPO();
