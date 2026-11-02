Cloudflare Worker that receives ClinicPilot-YMDC cloud backups (admin only) into the R2 bucket clinicpilot-ymdc-backups.
Endpoints: POST /upload (write-once) and GET /list. No delete, overwrite or download. No secrets; deploy with `npx wrangler deploy`.
The admin check is the database's own current_role_name(), called with the caller's Supabase token.
