import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Manually parse .env to avoid dotenv dependency
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
    console.error("Missing credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPOIns() {
    console.log("Checking po_ins table...");
    const { data, error, count } = await supabase.from("po_ins").select("*", { count: 'exact' });

    if (error) {
        console.error("Error fetching po_ins:", error);
    } else {
        console.log(`Success! Found ${count} rows in po_ins.`);
        if (data && data.length > 0) {
            console.log("First row ID:", data[0].id);
            console.log("First row Subject:", data[0].subject);
        }
    }

    console.log("Checking purchase_orders table (should be clean of 'IN' types)...");
    const { data: poData, error: poError, count: poCount } = await supabase.from("purchase_orders").select("*", { count: 'exact' }).eq('type', 'IN');
    if (poError) {
        console.error("Error fetching purchase_orders:", poError);
    } else {
        console.log(`Found ${poCount} rows with type='IN' in purchase_orders (Target: 0).`);
        if (poCount && poCount > 0) {
            console.log("WARNING: Cleanup not complete. 'IN' rows still exist in old table.");
        } else {
            console.log("CLEANUP STATUS: OK (No 'IN' rows in old table).");
        }
    }
}

checkPOIns();
