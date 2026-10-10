# Integrations Skills and MCP EN/VI (SP42 / M3 U10)

The `/integrations/skills` catalogue and `/integrations/mcp` registry render owned labels, hints, actions, empty/error states and mutation notices in the browser-selected EN/VI locale. The eight skill IDs, endpoint paths and raw GitHub URLs remain literal; copying a URL does not fetch it. Server names, URLs, scopes (`user`/`project`), transport IDs, API codes, permitted diagnostics and copied JSON remain literal. The marketplace retains the existing bounded server fetch and cached query lifecycle.

Changing locale while a view is mounted does not refetch, submit or alter a form draft, selected tab, pending mutation, saved entry or JSON snippet. A failed registry/marketplace read shows its stable code, permitted diagnostic and Retry. A failed mutation leaves the draft or confirmation available. While a mutation is pending its modal cannot close or submit twice. Enabled means included in the exported client snippet; AIGate does not connect to an MCP server or write client configuration. The server continues to own URL validation, storage and marketplace deadline/size limits.

Acceptance uses only synthetic same-origin responses in an isolated browser. No remote skill, marketplace, MCP server, credential or user-owned configuration is accessed.
