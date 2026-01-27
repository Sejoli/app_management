import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Manually parse .env
const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};

envContent.split("\n").forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        env[match[1].trim()] = value;
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPOOut() {
    console.log("Checking purchase_orders for OUT type...");
    const { data, error, count } = await supabase.from("purchase_orders")
        .select("*", { count: 'exact' })
        .eq('type', 'OUT');

    if (error) {
        console.error("Error fetching PO Out:", error);
    } else {
        console.log(`Found ${count} rows with type='OUT'.`);
        if (data && data.length > 0) {
            console.log("First PO Out ID:", data[0].id);
            console.log("Subject:", data[0].subject);
        } else {
            console.log("NO PO Out found. This helps explain why the text 'Belum ada data' shows.");

            // Allow checking for 'null' type just in case
            const { count: nullCount } = await supabase.from("purchase_orders").select("*", { count: 'exact' }).is('type', null);
            console.log(`Found ${nullCount} rows with type=NULL.`);
        }
    }
}

checkPOOut();
