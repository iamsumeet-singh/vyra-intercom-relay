# Your own Vyra intercom relay (free, on Cloudflare)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/iamsumeet-singh/vyra-intercom-relay)

Vyra's ride intercom works **without any internet** while riders are near each other. Phones link
over Bluetooth and Wi-Fi and pass each other's voices along the group.

The **relay** is only for the moment someone rides out of radio range. Their phone and the group
keep talking over mobile data, through a small server that you run yourself on a free Cloudflare
account.

- **Only one rider in a group needs to do this.** Everyone else uses the same address. It comes
  with the group invite when you share your group code from the app.
- **It costs nothing.** Cloudflare's free plan covers a riding group easily.
- **It's private.** Your voices only pass through your own relay. They're encrypted with your
  group code before they leave the phone, so even the relay can't hear them, and it never sees
  the code.

It takes about 10 minutes, once.

---

## Step 1: Make a free Cloudflare account

Go to <https://dash.cloudflare.com/sign-up>, sign up with your email, and confirm the email.
No card is needed.

## Step 2: Put the relay on Cloudflare

Pick **one** of these.

### Option A: One tap (works on a phone)

In the Vyra app, go to **Intercom > Out of range > Set up your own relay** and tap
**Deploy to Cloudflare**. The button at the top of this guide does the same thing.

1. Log in to Cloudflare if it asks.
2. Connect a **GitHub** account when it asks. It's free, so make one if you need to.
   Cloudflare copies the relay into it and builds it from there.
3. Leave the names as they are and tap **Create and deploy**.
4. Wait about a minute until it says it's deployed, then open the project. Its address looks like
   `https://vyra-intercom-relay.<your-name>.workers.dev`.

### Option B: From a computer (Windows, Mac or Linux)

1. Install **Node.js** (the "LTS" version) from <https://nodejs.org>.
2. Get the relay files. In the Vyra app, tap **Save relay files** on the setup page and copy the
   `.zip` to your computer, then unzip it. You'll have a folder called `vyra-intercom-relay`.
3. Open a terminal in that folder:
   - **Windows:** open the folder, click the address bar, type `cmd` and press Enter.
   - **Mac:** right-click the folder, then choose **New Terminal at Folder**.
4. Run these three commands one at a time:

   ```sh
   npm install
   npx wrangler login
   npx wrangler deploy
   ```

   - `npx wrangler login` opens your browser. Log in to Cloudflare and click **Allow**.
   - The first deploy may ask you to pick a free `workers.dev` name. Any name works.
5. When it finishes, it prints your address, like
   `https://vyra-intercom-relay.<your-name>.workers.dev`.

## Step 3: Put the address in the app

In Vyra, go to **Intercom > Out of range > Relay server**, paste your address and tap **Test**.
It should say it works.

The app accepts the address with `https://` or `wss://`, or without either.

## Step 4: Share it with your group

On the Intercom tab, tap **Share** next to your group code. The message carries the group code
**and** your relay address. Riders tap **Join**, paste the whole message, and they're set up too.

---

## Good to know

- **When the relay is used:** only while someone in the group is out of radio range. Riders who
  are together talk phone to phone and use no data.
- **Data:** about 11 MB per hour of talking, only for riders using the relay.
- **Group size:** up to 20 phones in one group.
- **Your dashboard:** usage is at <https://dash.cloudflare.com>, under
  **Workers & Pages > vyra-intercom-relay**.
- **Removing it:** in the dashboard, open the relay, go to **Settings** and choose
  **Delete**.

## If something goes wrong

| What you see | What to do |
|---|---|
| The app's **Test** says it can't find the address | Check the spelling. Copy the address from the Cloudflare dashboard (Workers & Pages > vyra-intercom-relay). |
| The address opens in a browser but **Test** fails | Make sure the address is the relay's own, ending in `.workers.dev`, and not a dashboard link. |
| Deploy says something about **Durable Objects** | Deploy again with the files exactly as provided. `wrangler.toml` already uses the kind the free plan includes. |
| `npm` or `npx` is "not recognized" | Node.js isn't installed, or the terminal was opened before installing it. Install it and open a new terminal. |
| Deploy asks for a **workers.dev subdomain** | Pick any name. It becomes part of your address. |

## No Cloudflare? Run it on your own computer or server

`dev-server.mjs` is the same relay in plain Node.js, with nothing to install:

```sh
node dev-server.mjs        # listens on port 8787 (set PORT to change it)
```

- At home, on the same Wi-Fi, use `ws://<your computer's IP>:8787` in the app.
- Riders on mobile data need a server with a public address. Put it behind HTTPS (for example
  with Caddy or nginx) and use `wss://`.

## What's in this folder

| File | What it is |
|---|---|
| `src/index.ts` | The relay. It passes each packet to the other phones in the same group. |
| `wrangler.toml` | Tells Cloudflare how to run it. |
| `package.json` | Lists the Cloudflare tool (`wrangler`) used to deploy. |
| `dev-server.mjs` | The same relay for any computer with Node.js. |
| `README.md` | This guide. |
