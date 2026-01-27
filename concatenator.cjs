const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const rootDir = __dirname;
const outputFile = path.join(__dirname, 'full_schema.sql');
const poFile = path.join(__dirname, 'db_schema_purchase_orders.sql');

const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => path.join(migrationsDir, f));

// Add the new PO schema at the end
files.push(poFile);

let fullContent = '-- FULL SCHEMA GENERATED AUTOMATICALLY\n\n';

for (const file of files) {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        fullContent += `\n-- START OF FILE: ${path.basename(file)} --\n`;
        fullContent += content;
        fullContent += `\n-- END OF FILE: ${path.basename(file)} --\n`;
    }
}

fs.writeFileSync(outputFile, fullContent);
console.log('Created full_schema.sql');
