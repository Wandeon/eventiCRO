# eventiCRO

Event APP for Croatia

## Project Overview

eventiCRO is an open-source platform for discovering and managing events
throughout Croatia. The project combines a progressive web app frontend with
modular backend services to deliver a modern, community-driven event
experience.

## Installation

Before getting started, make sure you have the following installed:

- Node.js 20 or later
- pnpm

1. **Clone the repository**
   ```sh
   git clone https://github.com/your-org/eventiCRO.git
   cd eventiCRO
   ```
2. **Install dependencies**
   ```sh
   pnpm install
   ```

## Basic Usage

After installing dependencies, start the development server:

```sh
pnpm dev
```

Then open the provided local URL in your browser to view the app.

## Environment Variables

The app and tests read the base API endpoint from the `API_BASE_URL` environment variable. Set it to point to your API server before running commands that interact with the backend:

```sh
export API_BASE_URL=http://localhost:8787
```

If `API_BASE_URL` is not defined, test scripts will abort with an error.

## Testing

Run integration and end-to-end tests:

```sh
pnpm test
```

## Further Documentation

- [Deployment guide](deployment-docs.md) – CI/CD,
  testing, and release process.
- [Frontend PWA specification](frontend-ui-pwa.md) – UI and progressive web app
  details.
