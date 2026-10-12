# Setup

The server is an **stdio** MCP server: an MCP client (e.g. Claude Desktop) launches it as a child
process. You don't run it yourself day-to-day — "setup" means installing it and pointing a client at it.

## Prerequisites

- **Node.js ≥ 18** (LTS recommended). Verify in a fresh terminal: `node --version`.
- An MCP client. These docs assume **Claude Desktop**.
- A Duffel **test token** (`duffel_test_...`) from the dashboard → Developers → Access Tokens.

## Install

```bash
npm install
cp .env.example .env     # paste your duffel_test_ token
```

## Point a client at it

Add to `claude_desktop_config.json` (see the client's config location below), using an **absolute**
path to `src/index.js`:

```json
{
  "mcpServers": {
    "duffel": {
      "command": "node",
      "args": ["/absolute/path/to/duffel-mcp-server/src/index.js"],
      "env": { "DUFFEL_ACCESS_TOKEN": "duffel_test_xxxx" }
    }
  }
}
```

Fully quit and reopen the client. Tools appear under **"+" → Connectors**; **Settings → Developer**
shows connection status and a link to logs.

---

## Platform notes & gotchas

Most setup friction is environmental, not the server. The ones worth knowing:

### Windows — PowerShell blocks `npm`
`npm` on Windows is a PowerShell script, and the default execution policy blocks scripts, so
`npm install` fails with `npm.ps1 cannot be loaded`. (`node.exe` is a real binary and runs fine.)

- **Quick fix:** use `npm.cmd install` (or run from Command Prompt instead of PowerShell).
- **Permanent:** `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

Also on Windows: use `curl.exe` (not the `curl` alias) if you test endpoints by hand.

### Windows — the MSIX config-file trap
If Claude Desktop was installed from the Microsoft Store / WinGet (MSIX build), the documented
`%APPDATA%\Claude\claude_desktop_config.json` — and sometimes the in-app "Edit Config" button —
is **not** the file the app reads. Symptom: valid config, but nothing loads and no error appears.
Edit the virtualized file instead:

```
%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json
```

Logs are in the sibling `...\LocalCache\Roaming\Claude\logs\` folder (look for `mcp-server-duffel.log`).

### Corporate networks — TLS inspection (e.g. Zscaler)
On a network that intercepts HTTPS with a corporate root CA, Node rejects the connection
(`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`) even though `curl` and browsers work — Node doesn't use the OS
certificate store. Point Node at the corporate root CA via `NODE_EXTRA_CA_CERTS` in the server's `env` block:

```json
"env": {
  "DUFFEL_ACCESS_TOKEN": "duffel_test_xxxx",
  "NODE_EXTRA_CA_CERTS": "C:\\path\\to\\corp-root-ca.cer"
}
```

Export the root CA from `certmgr.msc` → Trusted Root Certification Authorities as **Base-64 X.509
(.CER)** (not DER). Verify before wiring it in:

```powershell
$env:NODE_EXTRA_CA_CERTS="C:\path\to\corp-root-ca.cer"
node -e "fetch('https://api.duffel.com/air/airports?limit=1',{headers:{'Duffel-Version':'v2'}}).then(r=>console.log('OK',r.status)).catch(e=>console.log('ERR',e.cause?.code||e.code))"
```
`OK 401` means Node trusts the chain. On a home / non-inspected network, skip this entirely.

### Config file locations (non-MSIX)
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows (non-MSIX):** `%APPDATA%\Claude\claude_desktop_config.json`

---

## Verifying

```bash
npm run test:smoke            # flights: search → book → cancel against the live sandbox
node test/stays-smoke-test.js # stays: same loop (requires Stays access enabled on the account)
```

A healthy run prints each step and exits cleanly. The smoke tests need real network access to
`api.duffel.com` — run them from your own machine, not an offline/sandboxed environment.
