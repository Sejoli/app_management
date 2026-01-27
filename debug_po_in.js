
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://csqreghnffugahsbxnvm.supabase.co"
const supabaseKey = "sb_publishable_5adnPGKXqk_rtL3S1EAl5A_NZaKwYVZ"

const supabase = createClient(supabaseUrl, supabaseKey)

async function testPOInCreation() {
    console.log("Testing PO In Creation...")

    // 1. Get a test quotation that doesn't have a PO In
    const { data: q, error: qErr } = await supabase
        .from('quotations')
        .select('id, quotation_number')
        .not('request_id', 'is', null) // Ensure valid
        .limit(1)
        .single()

    if (qErr || !q) {
        console.error("Failed to get quotation", qErr)
        return
    }

    console.log(`Using Quotation: ${q.quotation_number} (${q.id})`)

    // Check if exists
    const { data: existing } = await supabase.from('po_ins').select('id').eq('quotation_id', q.id)
    if (existing && existing.length > 0) {
        console.log("PO In already exists, deleting for test...")
        await supabase.from('po_ins').delete().eq('quotation_id', q.id)
    }

    // 2. Try Insert with explicit invoice_type
    const payload = {
        quotation_id: q.id,
        subject: "-",
        invoice_type: "FULL",
        vendor_letter_number: null,
        vendor_letter_date: null,
        invoice_number: null,
        invoice_date: null,
        sequence_number: 0
    }

    console.log("Payload:", payload)

    const { data, error } = await supabase.from('po_ins').insert(payload).select().single()

    if (error) {
        console.error("INSERT FAILED:", error)
    } else {
        console.log("INSERT SUCCESS:", data)
        // Cleanup
        await supabase.from('po_ins').delete().eq('id', data.id)
    }

}

testPOInCreation()
