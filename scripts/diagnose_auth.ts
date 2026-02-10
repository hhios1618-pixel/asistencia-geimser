
import { readFileSync } from 'fs';
import { Pool } from 'pg';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env.local');
console.log(`Loading env from ${envPath}`);

const envConfig = readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }
        env[match[1].trim()] = value;
    }
});

const connectionString = env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL;

if (!connectionString) {
    console.error('No POSTGRES_URL found');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log('--- PEOPLE ---');
        const people = await pool.query('SELECT id, name, email, role, is_active FROM public.people');
        console.table(people.rows);

        console.log('\n--- AUTH USERS (Metadata) ---');
        try {
            const users = await pool.query(`
        SELECT id, email, raw_user_meta_data, raw_app_meta_data, role, created_at 
        FROM auth.users
        `);
            console.table(users.rows.map((u: any) => ({
                id: u.id,
                email: u.email,
                auth_role: u.role, // supabase auth role (authenticated/anon/service_role)
                app_meta_role: u.raw_app_meta_data?.role,
                user_meta_role: u.raw_user_meta_data?.role,
            })));
        } catch (e) {
            console.error('Could not query auth.users:', (e as Error).message);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
