import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listProjectsTool from "./tools/list-projects";
import listWorkstationsTool from "./tools/list-workstations";
import listModulesTool from "./tools/list-modules";

// Build the OAuth issuer from the Supabase project ref so it always points at
// the direct supabase.co host that the discovery document publishes.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "vision-workstation-mcp",
  title: "Vision Workstation MCP",
  version: "0.1.0",
  instructions:
    "Read the signed-in user's vision-workstation data. Use `whoami` to verify connectivity, `list_projects` to enumerate projects, `list_workstations` for a given project, and `list_modules` for a given workstation.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listProjectsTool, listWorkstationsTool, listModulesTool],
});