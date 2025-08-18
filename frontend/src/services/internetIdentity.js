import { AuthClient } from "@dfinity/auth-client";
import { backendIntegrationService } from "./backendIntegration";
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

  // Initialize the service
  async initialize() {
    try {
      // Try to initialize backend integration service
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

      // Initialize auth client
      this.authClient = await AuthClient.create();
      console.log("Internet Identity service initialized");

      // Check if user is already authenticated
      const isAuthenticated = await this.authClient.isAuthenticated();
      if (isAuthenticated) {
        this.identity = this.authClient.getIdentity();
        this.isAuthenticated = true;
        await this.loadUserProfile();
      }

      return true;
    } catch (error) {
      console.error("Failed to initialize Internet Identity service:", error);
      throw error;
    }
  }

  // Sign in with Internet Identity
  async signIn() {
    // Ensure client is initialized to avoid race conditions
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

  // Sign out
  async signOut() {
    if (this.authClient) {
      await this.authClient.logout();
      this.identity = null;
      this.isAuthenticated = false;
      this.user = null;
    }
  }

  // Get current identity
  getIdentity() {
    return this.identity;
  }

  // Check if user is authenticated
  isUserAuthenticated() {
    return this.isAuthenticated;
  }

  // Check if user profile is complete
  isProfileComplete() {
    if (!this.user) {
      return false;
    }

    // Profile is complete if username and email are set
    return (
      this.user.username &&
      this.user.username.trim() !== "" &&
      this.user.email &&
      this.user.email.trim() !== ""
    );
  }

  // Check if user has ever completed profile setup (persistent check)
  async hasCompletedProfileSetup() {
    if (!this.user) {
      return false;
    }

    const principal = this.user.principal;
    if (!principal) {
      return false;
    }

    try {
      // Try to use backend integration service first
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

      // Fallback to localStorage
      const completedProfiles = this.getCompletedProfiles();
      return completedProfiles.has(principal);
    } catch (error) {
      console.error("Error checking profile completion status:", error);
      // Fallback to localStorage
      const completedProfiles = this.getCompletedProfiles();
      return completedProfiles.has(principal);
    }
  }

  // Get list of principals who have completed profile setup
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

  // Mark user as having completed profile setup
  async markProfileAsCompleted() {
    if (!this.user || !this.user.principal) {
      return;
    }

    try {
      // Try to use backend integration service first
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

      // Fallback to localStorage
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
      // Fallback to localStorage
      const completedProfiles = this.getCompletedProfiles();
      completedProfiles.add(this.user.principal);

      const profilesArray = Array.from(completedProfiles);
      localStorage.setItem(
        "cafe_completed_profiles",
        JSON.stringify(profilesArray)
      );
    }
  }

  // Get current user
  getCurrentUser() {
    return this.user;
  }

  // Load user profile from the authentication canister
  async loadUserProfile() {
    if (!this.identity) {
      throw new Error("User not authenticated");
    }

    try {
      const principal = this.identity.getPrincipal();
      const principalText = principal.toText();

      console.log("Loading user profile for principal:", principalText);

      // Try to use backend integration service first
      let existingProfile = null;

      if (
        this.backendAvailable &&
        backendIntegrationService.isBackendAvailable()
      ) {
        try {
          await backendIntegrationService.initialize(this.identity);
          existingProfile = await backendIntegrationService.getUserProfile(
            principalText
          );
          if (existingProfile) {
            console.log(
              "Profile loaded from backend:",
              existingProfile.username
            );
          }
        } catch (backendError) {
          console.warn(
            "Backend integration failed, falling back to mock data:",
            backendError
          );
          this.backendAvailable = false;
        }
      }

      // Mock implementation - replace with actual canister call
      if (!existingProfile) {
        // Simulate the absence of a profile; the UI will direct to profile setup
        existingProfile = null;
      }

      console.log(
        "Checking for existing profile for principal:",
        principalText
      );
      console.log("Found existing profile:", existingProfile ? "Yes" : "No");

      // Check if user has previously completed profile setup (persistent check)
      const hasCompletedSetup = await this.hasCompletedProfileSetup();
      console.log(
        "User has previously completed profile setup:",
        hasCompletedSetup
      );

      if (existingProfile) {
        // User already has a profile - use it
        this.user = {
          ...existingProfile,
          principal: principalText,
        };
        console.log(
          "Loaded existing user profile from backend:",
          this.user.username
        );
        console.log("Profile is complete:", this.isProfileComplete());

        // Mark as completed if they have a complete profile
        if (this.isProfileComplete()) {
          await this.markProfileAsCompleted();
        }
      } else if (hasCompletedSetup) {
        // User doesn't have a backend profile but has completed setup before
        // Create a minimal profile to get them to dashboard
        this.user = {
          principal: principalText,
          username: "Returning User",
          email: "user@example.com",
          github: "",
          slack: "",
          tablesCreated: [],
          tablesJoined: [],
          identityProvider: "internet_identity",
          lastLogin: Date.now(),
          isVerified: true,
        };
        console.log(
          "Created profile for returning user who completed setup:",
          principalText
        );
        console.log("Profile is complete:", this.isProfileComplete());
      } else {
        // User doesn't have a profile yet - create empty one
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
        console.log("Created new user profile for principal:", principalText);
        console.log("Profile is complete:", this.isProfileComplete());
      }

      // Ensure the profile is fully set before returning
      await new Promise((resolve) => {
        // Small delay to ensure profile is properly set
        setTimeout(resolve, 50);
      });

      console.log("Profile loading completed for:", principalText);
    } catch (error) {
      console.error("Failed to load user profile:", error);
      throw error;
    }
  }

  // Register or update user profile
  async registerOrUpdateProfile(profileData) {
    if (!this.identity) {
      throw new Error("User not authenticated");
    }

    try {
      const principalText = this.identity.getPrincipal().toText();

      // Try backend first if available
      if (
        this.backendAvailable &&
        backendIntegrationService.isBackendAvailable()
      ) {
        try {
          await backendIntegrationService.initialize(this.identity);
          const updated =
            await backendIntegrationService.registerOrUpdateProfile(
              principalText,
              profileData
            );
          this.user = { ...updated, principal: principalText };
          console.log("Profile updated in backend:", this.user);
          return this.user;
        } catch (backendError) {
          console.warn(
            "Backend update failed, falling back to local update:",
            backendError
          );
          this.backendAvailable = false;
        }
      }

      // Local update fallback
      this.user = {
        ...this.user,
        ...profileData,
        lastLogin: Date.now(),
      };

      console.log("Profile updated locally:", this.user);

      return this.user;
    } catch (error) {
      console.error("Failed to update profile:", error);
      throw error;
    }
  }

  // Get user profile
  async getUserProfile() {
    if (!this.identity) {
      throw new Error("User not authenticated");
    }

    return this.user;
  }

  // Check if user exists
  async userExists() {
    if (!this.identity) {
      throw new Error("User not authenticated");
    }

    // This would call the authentication canister's user_exists function
    // For now, return true if we have a user
    return !!this.user;
  }

  // Get all users (admin function)
  async getAllUsers() {
    if (!this.identity) {
      throw new Error("User not authenticated");
    }

    try {
      // Try backend if available
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

      // Mock response for demonstration
      return [
        {
          username: "demo_user1",
          email: "user1@example.com",
          github: "github1",
          slack: "slack1",
          principal: "demo_principal_1",
          tablesCreated: [1, 2],
          tablesJoined: [3, 4],
          identityProvider: "internet_identity",
          lastLogin: Date.now() - 86400000, // 1 day ago
          isVerified: true,
        },
      ];
    } catch (error) {
      console.error("Failed to get all users:", error);
      throw error;
    }
  }

  // Get user by principal
  async getUserByPrincipal() {
    if (!this.identity) {
      throw new Error("User not authenticated");
    }

    // This would call the authentication canister's get_user_by_principal function
    // For now, return null
    return null;
  }

  // Update user tables
  async updateUserTables(tableId, tableType, action) {
    if (!this.identity) {
      throw new Error("User not authenticated");
    }

    try {
      if (action === "add") {
        if (tableType === "tablesCreated") {
          this.user.tablesCreated.push(tableId);
        } else if (tableType === "tablesJoined") {
          this.user.tablesJoined.push(tableId);
        }
      } else if (action === "remove") {
        if (tableType === "tablesCreated") {
          this.user.tablesCreated = this.user.tablesCreated.filter(
            (id) => id !== tableId
          );
        } else if (tableType === "tablesJoined") {
          this.user.tablesJoined = this.user.tablesJoined.filter(
            (id) => id !== tableId
          );
        }
      }

      // TODO: This would call the authentication canister to update user tables
      // When backend is ready, uncomment this:
      // const canister = await getAuthenticationCanister();
      // await canister.update_user_add_table(principal, tableId, tableType);
      // or
      // await canister.update_user_remove_table(principal, tableId, tableType);

      return { success: true, message: "User tables updated successfully" };
    } catch (error) {
      console.error("Failed to update user tables:", error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const internetIdentityService = new InternetIdentityService();
export default internetIdentityService;
