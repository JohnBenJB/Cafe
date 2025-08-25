import { AuthClient } from "@dfinity/auth-client";
import { backendIntegrationService } from "./backendIntegration";
import { authenticationService } from "./authentication";
import {
  getInternetIdentityUrl,
  LOCAL_DEVELOPMENT_INSTRUCTIONS,
} from "../config/internetIdentity";

class InternetIdentityService {
  constructor() {
    this.authClient = null;
    this.identity = null;
    this.isAuthenticated = false;
    this.user = null;
    this.backendAvailable = false;
  }

  // Helpers for principal-scoped caching
  getActivePrincipal() {
    try {
      return localStorage.getItem("cafe_active_principal") || null;
    } catch {
      return null;
    }
  }

  setActivePrincipal(principalText) {
    try {
      if (principalText) {
        localStorage.setItem("cafe_active_principal", principalText);
      }
    } catch {
      // no-op: localStorage might be unavailable
    }
  }

  clearActivePrincipal() {
    try {
      localStorage.removeItem("cafe_active_principal");
    } catch {
      // no-op
    }
  }

  getScopedProfileKey(principalText) {
    return `cafe_user_profile:${principalText}`;
  }

  readCachedProfile(principalText) {
    try {
      const key = this.getScopedProfileKey(principalText);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (p && p.principal === principalText) return p;
      return null;
    } catch {
      return null;
    }
  }

  writeCachedProfile(principalText, profile) {
    try {
      const key = this.getScopedProfileKey(principalText);
      localStorage.setItem(
        key,
        JSON.stringify({ ...profile, principal: principalText })
      );
    } catch {
      // no-op
    }
  }

  migrateLegacyProfileIfAny(principalText) {
    try {
      const legacy = localStorage.getItem("cafe_user_profile");
      if (legacy && principalText) {
        const key = this.getScopedProfileKey(principalText);
        localStorage.setItem(key, legacy);
        localStorage.removeItem("cafe_user_profile");
      }
    } catch {
      // no-op
    }
  }

  // Initialize the service
  async initialize() {
    try {
      try {
        await backendIntegrationService.checkDependencies();
        this.backendAvailable = backendIntegrationService.isBackendAvailable();
        console.log(
          "Backend integration service available:",
          this.backendAvailable
        );
      } catch {
        console.log(
          "Backend integration service not available, using localStorage fallback"
        );
        this.backendAvailable = false;
      }

      this.authClient = await AuthClient.create();
      console.log("Internet Identity service initialized");

      const isAuthenticated = await this.authClient.isAuthenticated();
      if (isAuthenticated) {
        this.identity = this.authClient.getIdentity();
        this.isAuthenticated = true;
        const principalText = this.identity.getPrincipal().toText();
        this.setActivePrincipal(principalText);
        this.migrateLegacyProfileIfAny(principalText);
        await this.loadUserProfile();
      }

      return true;
    } catch (error) {
      console.error("Failed to initialize Internet Identity service:", error);
      throw error;
    }
  }

  async signIn() {
    if (!this.authClient) {
      try {
        await this.initialize();
      } catch (initError) {
        console.error("Failed to initialize before sign-in:", initError);
        throw initError;
      }
    }

    return new Promise((resolve, reject) => {
      if (!this.authClient) {
        reject(new Error("Auth client not initialized"));
        return;
      }

      const iiUrl = getInternetIdentityUrl();
      console.log("Using Internet Identity URL:", iiUrl);

      this.authClient.login({
        identityProvider: iiUrl,
        onSuccess: async () => {
          try {
            this.identity = this.authClient.getIdentity();
            this.isAuthenticated = true;
            const principalText = this.identity.getPrincipal().toText();
            this.setActivePrincipal(principalText);
            this.migrateLegacyProfileIfAny(principalText);
            await this.loadUserProfile();
            resolve(true);
          } catch (error) {
            reject(error);
          }
        },
        onError: (error) => {
          console.error("Internet Identity login error:", error);
          if (error.message && error.message.includes("404")) {
            reject(
              new Error(
                `Internet Identity service not found at ${iiUrl}. ${LOCAL_DEVELOPMENT_INSTRUCTIONS}`
              )
            );
          } else if (
            error.message &&
            error.message.includes("canister not found")
          ) {
            reject(
              new Error(`Canister not found. ${LOCAL_DEVELOPMENT_INSTRUCTIONS}`)
            );
          } else {
            reject(error);
          }
        },
      });
    });
  }

  async signOut() {
    if (this.authClient) {
      await this.authClient.logout();
      this.identity = null;
      this.isAuthenticated = false;
      this.user = null;
      this.clearActivePrincipal();
    }
  }

  getIdentity() {
    return this.identity;
  }

  isUserAuthenticated() {
    return this.isAuthenticated;
  }

  isProfileComplete() {
    if (!this.user) {
      return false;
    }
    return (
      this.user.username &&
      this.user.username.trim() !== "" &&
      this.user.email &&
      this.user.email.trim() !== ""
    );
  }

  async hasCompletedProfileSetup() {
    if (!this.user) {
      return false;
    }

    const principal = this.user.principal;
    if (!principal) {
      return false;
    }

    try {
      if (
        this.backendAvailable &&
        backendIntegrationService.isBackendAvailable()
      ) {
        try {
          await backendIntegrationService.initialize(this.identity);
          return await backendIntegrationService.hasCompletedSetup(principal);
        } catch (backendError) {
          console.warn(
            "Backend integration failed, falling back to localStorage:",
            backendError
          );
          this.backendAvailable = false;
        }
      }

      const completedProfiles = this.getCompletedProfiles();
      return completedProfiles.has(principal);
    } catch (error) {
      console.error("Error checking profile completion status:", error);
      const completedProfiles = this.getCompletedProfiles();
      return completedProfiles.has(principal);
    }
  }

  getCompletedProfiles() {
    try {
      const stored = localStorage.getItem("cafe_completed_profiles");
      if (stored) {
        const profiles = JSON.parse(stored);
        return new Set(profiles);
      }
    } catch (error) {
      console.error("Error reading completed profiles:", error);
    }
    return new Set();
  }

  async markProfileAsCompleted() {
    if (!this.user || !this.user.principal) {
      return;
    }

    try {
      if (
        this.backendAvailable &&
        backendIntegrationService.isBackendAvailable()
      ) {
        try {
          await backendIntegrationService.initialize(this.identity);
          const success =
            await backendIntegrationService.markProfileAsCompleted(
              this.user.principal
            );
          if (success) {
            console.log("Profile marked as completed in backend");
            return;
          }
        } catch (backendError) {
          console.warn(
            "Backend integration failed, falling back to localStorage:",
            backendError
          );
          this.backendAvailable = false;
        }
      }

      const completedProfiles = this.getCompletedProfiles();
      completedProfiles.add(this.user.principal);

      const profilesArray = Array.from(completedProfiles);
      localStorage.setItem(
        "cafe_completed_profiles",
        JSON.stringify(profilesArray)
      );

      console.log(
        "Marked profile as completed for principal:",
        this.user.principal
      );
    } catch (error) {
      console.error("Error saving completed profile status:", error);
      const completedProfiles = this.getCompletedProfiles();
      completedProfiles.add(this.user.principal);

      const profilesArray = Array.from(completedProfiles);
      localStorage.setItem(
        "cafe_completed_profiles",
        JSON.stringify(profilesArray)
      );
    }
  }

  getCurrentUser() {
    const active = this.getActivePrincipal();
    if (this.user && this.user.principal === active) return this.user;
    if (active) {
      const cached = this.readCachedProfile(active);
      if (cached) return cached;
    }
    return this.user;
  }

  // Load user profile from authentication canister
  async loadUserProfile() {
    if (!this.identity) {
      throw new Error("User not authenticated");
    }

    const principalText = this.identity.getPrincipal().toText();
    try {
      // Initialize and fetch via authentication canister
      await authenticationService.initialize(this.identity);
      const res = await authenticationService.getUserByPrincipal(principalText);

      if (res?.success && res.user) {
        this.user = { ...res.user, principal: principalText };
      } else {
        // No backend profile yet; keep minimal placeholder
        this.user = {
          principal: principalText,
          username: "",
          email: "",
          github: "",
          slack: "",
          tablesCreated: [],
          tablesJoined: [],
          identityProvider: "internet_identity",
          lastLogin: Date.now(),
          isVerified: true,
        };
      }

      // Cache profile scoped by principal
      this.writeCachedProfile(principalText, this.user);
      await new Promise((r) => setTimeout(r, 20));
      console.log("Profile loading completed for:", principalText);
    } catch (error) {
      console.error("Failed to load user profile:", error);
      throw error;
    }
  }

  // Register or update user profile via authentication canister
  async registerOrUpdateProfile(profileData) {
    if (!this.identity) {
      throw new Error("User not authenticated");
    }

    try {
      const principalText = this.identity.getPrincipal().toText();
      await authenticationService.initialize(this.identity);

      const result = await authenticationService.registerOrUpdate(
        principalText,
        profileData.username,
        profileData.email,
        profileData.github || "",
        profileData.slack || ""
      );

      if (result?.success) {
        const updated = result.user || {
          principal: principalText,
          ...profileData,
          identityProvider: "internet_identity",
          lastLogin: Date.now(),
          isVerified: true,
          tablesCreated: [],
          tablesJoined: [],
        };
        this.user = { ...updated, principal: principalText };
        this.writeCachedProfile(principalText, this.user);
        return this.user;
      }

      throw new Error(result?.message || "Profile update failed");
    } catch (error) {
      console.error("Failed to update profile:", error);
      throw error;
    }
  }

  async getUserProfile() {
    if (!this.identity) {
      throw new Error("User not authenticated");
    }
    return this.user;
  }

  async userExists() {
    if (!this.identity) {
      throw new Error("User not authenticated");
    }
    return !!this.user;
  }

  async getAllUsers() {
    if (!this.identity) {
      throw new Error("User not authenticated");
    }

    try {
      if (
        this.backendAvailable &&
        backendIntegrationService.isBackendAvailable()
      ) {
        try {
          await backendIntegrationService.initialize(this.identity);
          const users = await backendIntegrationService.getAllUsers();
          return users;
        } catch (backendError) {
          console.warn("Backend getAllUsers failed, using mock:", backendError);
          this.backendAvailable = false;
        }
      }
      // Fallback if backendIntegration disabled: ask authentication service directly
      await authenticationService.initialize(this.identity);
      return await authenticationService.getAllUsers();
    } catch (error) {
      console.error("Failed to get all users:", error);
      throw error;
    }
  }
}

const internetIdentityService = new InternetIdentityService();
export default internetIdentityService;
