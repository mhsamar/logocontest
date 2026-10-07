/**
 * Seeds the settings table with every default from the registry (existing
 * values are left alone) and creates the first admin account.
 *
 *   npm run seed
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { authEmailForPhone } from "../src/lib/auth/identity";
import { normalizeBdMobile } from "../src/lib/phone";
import { SETTINGS } from "../src/lib/settings/registry";

config({ path: ".env.local" });

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in .env.local`);
    process.exit(1);
  }
  return value;
}

const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function seedSettings() {
  const rows = Object.entries(SETTINGS).map(([key, def]) => ({
    key,
    value: def.default,
    type: def.type,
    group: def.group,
    description: def.description,
  }));
  const { error } = await db.from("settings").upsert(rows, { onConflict: "key", ignoreDuplicates: true });
  if (error) throw new Error(`settings: ${error.message}`);
  console.log(`✓ settings: ${rows.length} keys present`);
}

async function seedAdmin() {
  const phone = normalizeBdMobile(env("ADMIN_PHONE"));
  if (!phone) throw new Error("ADMIN_PHONE is not a valid Bangladesh mobile number");
  const password = env("ADMIN_PASSWORD");
  const name = process.env.ADMIN_NAME || "Admin";

  const { data: existing } = await db.from("profiles").select("id").eq("mobile", phone).maybeSingle();
  let id = existing?.id as string | undefined;

  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email: authEmailForPhone(phone),
      password,
      email_confirm: true,
      user_metadata: { mobile: phone, name },
    });
    if (error) throw new Error(`admin user: ${error.message}`);
    id = data.user.id;
  }

  const { error } = await db.from("profiles").update({ role: "admin", status: "active" }).eq("id", id);
  if (error) throw new Error(`admin role: ${error.message}`);
  console.log(`✓ admin: ${phone} ${existing ? "(already existed, role ensured)" : "(created)"}`);
}

seedSettings()
  .then(seedAdmin)
  .catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
