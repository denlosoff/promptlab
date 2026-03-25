# Cloudflare Tunnel + Domain

This is the cheapest "normal-looking" setup for this project:

- the site runs on your PC
- visitors open a normal domain name
- no scary localtunnel warning page
- no paid VPS is required

## What you need

1. A domain name you control.
2. A Cloudflare account.
3. The domain added to Cloudflare.
4. The domain nameservers changed to Cloudflare.
5. `cloudflared` installed on your PC.

## Recommended DNS layout

Use one hostname for the site:

- `app.yourdomain.com`

## Cloudflare steps

1. Add your domain to Cloudflare.
2. Change your domain nameservers at your registrar to the Cloudflare nameservers shown in the setup flow.
3. Wait until Cloudflare shows the zone as active.
4. In Cloudflare Zero Trust, go to Networks > Tunnels.
5. Create a tunnel named `promptlab`.
6. During tunnel setup, add a public hostname:
   - Subdomain: `app`
   - Domain: your domain
   - Service type: `HTTP`
   - URL: `localhost:3010`
7. Copy the tunnel token from Cloudflare.

## Local PC steps

Run this command in PowerShell on your PC:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\ADMIN\Toggle\promptlab-v1.8.1\start-cloudflare-domain.ps1" -TunnelToken "PASTE_TOKEN_HERE"
```

This will:

- build the frontend
- start the local Promptlab server on `localhost:3010`
- start `cloudflared` using your tunnel token

Keep the PowerShell window open while the site should stay online.

## Result

Visitors will open:

- `https://app.yourdomain.com`

## Notes

- Your PC must stay on and connected to the Internet.
- If you want the tunnel to survive reboots automatically, the next step is turning `cloudflared` into a Windows service.
- If you want a root domain instead of a subdomain, use `yourdomain.com` as the public hostname target in Cloudflare.
