// Polyfills for Internet Computer SDK
// These are needed because the IC SDK expects Node.js globals that aren't available in browsers

// Global polyfill - this is the main issue causing "global is not defined"
if (typeof global === "undefined") {
  window.global = window;
}

// Process polyfill
if (typeof process === "undefined") {
  window.process = {
    env: {},
    browser: true,
    version: "",
    versions: {},
  };
}

console.log("Polyfills loaded for Internet Computer SDK");
