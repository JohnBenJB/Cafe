import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "./authentication_idl";

// Authentication Canister ID
const AUTHENTICATION_CANISTER_ID =
  import.meta.env.VITE_AUTHENTICATION_CANISTER_ID ||
  "uxrrr-q7777-77774-qaaaq-cai";

class AuthenticationService {
  constructor() {
    this.agent = null;
    this.actor = null;
  }

  async initialize(identity) {
    if (!identity) {
      throw new Error("Identity is required");
    }

    this.agent = new HttpAgent({
      identity,
      host: "http://127.0.0.1:4943",
      // Disable certificate verification for local development
      fetchRootKey: false,
      verifyQuerySignatures: false,
    });

    // For local development, we need to fetch the root key
    if (import.meta.env.DEV) {
      try {
        await this.agent.fetchRootKey();
      } catch (error) {
        console.warn("Could not fetch root key:", error);
      }
    }

    this.actor = Actor.createActor(idlFactory, {
      agent: this.agent,
      canisterId: AUTHENTICATION_CANISTER_ID,
    });
  }

  // Helper to unwrap candid Opt(User) to plain object or null
  unwrapOptionalUser(optUser) {
    if (Array.isArray(optUser)) {
      return optUser.length > 0 ? optUser[0] : null;
    }
    return optUser || null;
  }

  async getAllUsers() {
    if (!this.actor) {
      throw new Error("Authentication service not initialized");
    }

    try {
      const users = await this.actor.get_all_users();
      return users;
    } catch (error) {
      console.error("Error getting all users:", error);
      throw error;
    }
  }

  async getUserByPrincipal(principal) {
    if (!this.actor) {
      throw new Error("Authentication service not initialized");
    }

    try {
      const result = await this.actor.get_user_by_principal(principal);
      return { ...result, user: this.unwrapOptionalUser(result?.user) };
    } catch (error) {
      console.error("Error getting user by principal:", error);
      throw error;
    }
  }

  async registerOrUpdate(principal, username, email, github = "", slack = "") {
    if (!this.actor) {
      throw new Error("Authentication service not initialized");
    }

    try {
      const profileData = {
        username,
        email,
        github,
        slack,
      };

      const result = await this.actor.register_or_update(
        principal,
        profileData
      );
      return { ...result, user: this.unwrapOptionalUser(result?.user) };
    } catch (error) {
      console.error("Error registering/updating user:", error);
      throw error;
    }
  }

  // Helper method to ensure current user is registered without overwriting existing real data
  async ensureUserRegistered(principal, username, email) {
    try {
      console.log("Ensuring user is registered:", principal);
      // First, check if user already exists
      const existing = await this.getUserByPrincipal(principal);
      if (existing?.success && existing.user) {
        return existing.user;
      }
      // Only register when missing. Avoid placeholder defaults.
      const safeUsername = username && username !== "User" ? username : "";
      const safeEmail = email && email !== "user@example.com" ? email : "";
      const registerResult = await this.registerOrUpdate(
        principal,
        safeUsername,
        safeEmail
      );
      if (!registerResult.success) {
        throw new Error(registerResult.message || "Failed to register user");
      }
      return registerResult.user;
    } catch (error) {
      console.error("Error ensuring user is registered:", error);
      throw error;
    }
  }

  // ===== Session management (frontend wrappers) =====
  async createSession(principal) {
    if (!this.actor) {
      throw new Error("Authentication service not initialized");
    }
    const res = await this.actor.create_session(principal);
    return res;
  }

  async validateSession(sessionId) {
    if (!this.actor) {
      throw new Error("Authentication service not initialized");
    }
    return await this.actor.validate_session(sessionId);
  }

  async logout(sessionId) {
    if (!this.actor) {
      throw new Error("Authentication service not initialized");
    }
    return await this.actor.logout(sessionId);
  }

  async getProfile(principal) {
    if (!this.actor) {
      throw new Error("Authentication service not initialized");
    }
    const res = await this.actor.get_profile(principal);
    return { ...res, user: this.unwrapOptionalUser(res?.user) };
  }
}

export const authenticationService = new AuthenticationService();
