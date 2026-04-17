import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const workbookPath = process.argv[2] || '/Users/hh/Downloads/natura2.xlsx';
const defaultPassword = process.argv[3] || 'Geimser2026.';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
}

if (!fs.existsSync(workbookPath)) {
  throw new Error(`No existe el archivo: ${workbookPath}`);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeRut(value) {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^0-9kK]/g, '')
    .toUpperCase();
  if (!cleaned) return null;
  if (cleaned.length < 2) return cleaned;
  return `${cleaned.slice(0, -1)}-${cleaned.slice(-1)}`;
}

function parseMembers(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return normalized.includes('nombre') && (normalized.includes('correo') || normalized.includes('email'));
  });

  if (headerIndex === -1) {
    return [];
  }

  const headers = rows[headerIndex].map(normalizeHeader);
  const nameIndex = headers.findIndex((header) => header === 'nombre');
  const emailIndex = headers.findIndex((header) => header === 'correo' || header === 'email');
  const rutIndex = headers.findIndex((header) => header === 'rut');

  return rows
    .slice(headerIndex + 1)
    .map((row) => ({
      name: String(row[nameIndex] ?? '').trim(),
      email: normalizeEmail(row[emailIndex]),
      rut: rutIndex >= 0 ? normalizeRut(row[rutIndex]) : null,
    }))
    .filter((row) => row.name && row.email);
}

async function listAllUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < 200) break;
    page += 1;
  }

  return users;
}

async function resolveCampaign() {
  const { data: exact, error: exactError } = await supabase
    .from('campaigns_local')
    .select('id,name,crm_campaign_id')
    .ilike('name', 'natura')
    .limit(5);

  if (exactError) throw exactError;

  if (exact && exact.length > 0) {
    return exact[0];
  }

  const crmCampaignId = `local-natura-${Date.now()}`;
  const { data: created, error: createError } = await supabase
    .from('campaigns_local')
    .insert({
      crm_campaign_id: crmCampaignId,
      name: 'Natura',
      status: 'active',
      channel: 'workspace',
      client_name: 'Natura',
      client_contact_name: 'Equipo Natura',
    })
    .select('id,name,crm_campaign_id')
    .single();

  if (createError) throw createError;
  return created;
}

async function main() {
  const members = Array.from(new Map(parseMembers(workbookPath).map((member) => [member.email, member])).values());
  if (members.length === 0) {
    throw new Error('No encontré filas válidas en el Excel.');
  }

  const campaign = await resolveCampaign();
  const users = await listAllUsers();
  const userByEmail = new Map(users.filter((user) => user.email).map((user) => [String(user.email).toLowerCase(), user]));

  const summary = {
    campaignId: campaign.id,
    campaignName: campaign.name,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  const details = [];

  for (const member of members) {
    try {
      const existingUser = userByEmail.get(member.email);
      let authUserId = existingUser?.id ?? null;

      const { data: existingPerson, error: personLookupError } = await supabase
        .from('people')
        .select('id,role,email')
        .eq('email', member.email)
        .maybeSingle();

      if (personLookupError) throw personLookupError;

      if (existingPerson && ['ADMIN', 'SUPERVISOR', 'DT_VIEWER'].includes(existingPerson.role)) {
        summary.skipped += 1;
        details.push({ ...member, status: 'skipped', reason: `correo usado por rol ${existingPerson.role}` });
        continue;
      }

      if (existingUser) {
        const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
          email: member.email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            full_name: member.name,
            rut: member.rut,
          },
          app_metadata: {
            role: 'WORKER',
          },
        });
        if (error) throw error;
        summary.updated += 1;
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: member.email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            full_name: member.name,
            rut: member.rut,
          },
          app_metadata: {
            role: 'WORKER',
          },
        });
        if (error || !data.user) throw error ?? new Error('No fue posible crear el usuario auth');
        authUserId = data.user.id;
        userByEmail.set(member.email, data.user);
        summary.created += 1;
      }

      const personId = authUserId ?? existingPerson?.id;
      if (!personId) {
        throw new Error('No pude resolver el id auth/person.');
      }

      const { error: peopleError } = await supabase
        .from('people')
        .upsert({
          id: personId,
          name: member.name,
          email: member.email,
          rut: member.rut,
          role: 'WORKER',
          campaign_id: campaign.id,
          is_active: true,
        }, { onConflict: 'id' });

      if (peopleError) throw peopleError;

      details.push({ ...member, status: existingUser || existingPerson ? 'updated' : 'created' });
    } catch (error) {
      summary.errors += 1;
      details.push({ ...member, status: 'error', reason: error.message });
    }
  }

  const report = {
    workbook: path.resolve(workbookPath),
    password: defaultPassword,
    summary,
    details,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
