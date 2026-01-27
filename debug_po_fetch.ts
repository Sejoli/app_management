
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://csqreghnffugahsbxnvm.supabase.co";
const supabaseKey = "sb_publishable_5adnPGKXqk_rtL3S1EAl5A_NZaKwYVZ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPOFetch() {
    console.log("Fetching POs...");
    const { data, error } = await supabase.from("purchase_orders")
        .select(`
        *,
        vendor:vendors(company_name, office_address, id),
        vendor_pic:vendor_pics(name),
        attachments:purchase_order_attachments(file_name, file_path),
        quotations:purchase_order_quotations(
            quotation:quotations(
                id, 
                quotation_number,
                request:requests(
                    request_code, 
                    letter_number,
                    created_at,
                    customer:customers(company_name),
                    customer_pic:customer_pics(name),
                    customer_attachments:request_attachments(file_name, file_path)
                ),
                balance_link:quotation_balances(
                    balance:balances(
                        balance_entries
                    )
                )
            )
        )
    `)
        .eq('type', 'OUT')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error("Error fetching POs:");
        console.error(JSON.stringify(error, null, 2));
    } else {
        console.log("Success!");
        console.log(JSON.stringify(data, null, 2));
    }
}

checkPOFetch();
