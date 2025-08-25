// Internet Identity Configuration
export const INTERNET_IDENTITY_CONFIG = {
  development: {
    // Recommended local II origin (not candid UI)
    local: "http://uzt4z-lp777-77774-qaabq-cai.localhost:4943",
    mainnet: "https://identity.ic0.app",
  },
  production: {
    mainnet: "https://identity.ic0.app",
  },
};

export const getInternetIdentityUrl = () => {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) {
    return INTERNET_IDENTITY_CONFIG.development.local;
  }
  return INTERNET_IDENTITY_CONFIG.production.mainnet;
};

export const LOCAL_DEVELOPMENT_INSTRUCTIONS = `
Local Internet Identity is configured to use the canister origin (not the candid UI):

URL: http://uzt4z-lp777-77774-qaabq-cai.localhost:4943

If you encounter issues:
1. Start replica: dfx start --clean
2. Deploy II: dfx deploy internet_identity
3. Confirm the canister ID matches the URL above
4. Retry the sign-in
`;
