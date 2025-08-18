// Backend Integration Service for Internet Computer Canisters
// This service handles communication with the Motoko backend canisters
//
// IMPORTANT: This service is currently disabled because the authentication canister
// has not been deployed yet. To enable it:
//
// 1. Deploy the authentication canister:
//    cd /home/j3ech/Downloads/Cafe
//    dfx start --clean
//    dfx deploy authentication
//
// 2. After deployment, uncomment the following lines in the checkDependencies method:
//    - Remove the console.log messages about the DID file not being available
//    - Add the DID file import: import('../../declarations/authentication/authentication.did.js')
//    - Set this.backendAvailable = true when successful
//
// 3. Restart the frontend development server
//
// Until then, the service will gracefully fall back to localStorage for profile persistence.

class BackendIntegrationService {
  constructor() {
    this.agent = null;
    this.authenticationCanister = null;
    this.isInitialized = false;
    this.backendAvailable = false;
    this.dependenciesLoaded = false;
    this.authenticationIdlFactory = null;
    this.authenticationCanisterId = null;
  }

  // Check if backend dependencies are available
  async checkDependencies() {
    if (this.dependenciesLoaded) {
      return true;
    }

    try {
      console.log("Checking backend dependencies...");

      const { Actor, HttpAgent } = await import("@dfinity/agent");
      this.Actor = Actor;
      this.HttpAgent = HttpAgent;

      // Load local IDL factory bundled with the frontend
      try {
        const idl = await import("./authentication_idl.js");
        this.authenticationIdlFactory = idl.idlFactory;
      } catch (e) {
        console.error(
          "Failed to load local authentication IDL:",
          e?.message || e
        );
        this.dependenciesLoaded = true;
        this.backendAvailable = false;
        return false;
      }

      // Read canister id from env injected by dfx/vite
      const envCanisterId =
        (typeof import.meta !== "undefined" &&
          import.meta.env &&
          (import.meta.env.VITE_AUTHENTICATION_CANISTER_ID ||
            import.meta.env.CANISTER_ID_authentication ||
            import.meta.env.CANISTER_ID_AUTHENTICATION)) ||
        "";
      this.authenticationCanisterId = envCanisterId;
      if (!this.authenticationCanisterId) {
        console.warn("Authentication canister ID not provided in env");
        this.dependenciesLoaded = true;
        this.backendAvailable = false;
        return false;
      }

      this.backendAvailable = true;
      this.dependenciesLoaded = true;
      return true;
    } catch (error) {
      console.log(
        "Backend dependencies not available, backend integration will be disabled:",
        error.message
      );
      console.log(
        "Make sure @dfinity/agent is installed: npm install @dfinity/agent"
      );
      return false;
    }
  }

  // Initialize the backend integration
  async initialize(identity) {
    if (this.isInitialized && this.agent) {
      return;
    }

    // Check if dependencies are available
    const depsAvailable = await this.checkDependencies();
    if (!depsAvailable || !this.authenticationIdlFactory) {
      this.backendAvailable = false;
      throw new Error("Backend dependencies not available");
    }

    try {
      // Create HTTP agent
      this.agent = new this.HttpAgent({
        identity: identity,
        host:
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"
            ? "http://127.0.0.1:4943"
            : "https://ic0.app",
      });

      // Detect canister id: from declarations import or Vite env override
      const canisterId = this.authenticationCanisterId;
      if (!canisterId) {
        throw new Error("Authentication canister ID is not available");
      }

      // Create actor for authentication canister
      this.authenticationCanister = this.Actor.createActor(
        this.authenticationIdlFactory,
        {
          agent: this.agent,
          canisterId: canisterId,
        }
      );

      this.isInitialized = true;
      this.backendAvailable = true;
      console.log(
        "Backend integration initialized successfully with canister:",
        canisterId
      );
    } catch (error) {
      console.error("Failed to initialize backend integration:", error);
      this.backendAvailable = false;
      throw error;
    }
  }

  // Check if backend is available
  isBackendAvailable() {
    return this.backendAvailable && this.isInitialized;
  }

  // Get the authentication canister actor
  async getAuthenticationCanister() {
    if (!this.isInitialized) {
      throw new Error(
        "Backend integration not initialized. Call initialize() first."
      );
    }
    if (!this.backendAvailable) {
      throw new Error(
        "Backend is not available. Check dependencies and initialization."
      );
    }
    return this.authenticationCanister;
  }

  // Check if user has completed profile setup
  async hasCompletedSetup(principal) {
    try {
      const canister = await this.getAuthenticationCanister();
      return await canister.has_completed_setup(principal);
    } catch (error) {
      console.error("Error checking profile completion status:", error);
      throw error;
    }
  }

  // Mark user profile as completed
  async markProfileAsCompleted(principal) {
    try {
      const canister = await this.getAuthenticationCanister();
      const result = await canister.mark_profile_completed(principal);

      if (result.success) {
        console.log("Profile marked as completed in backend");
        return true;
      } else {
        console.error("Failed to mark profile as completed:", result.message);
        return false;
      }
    } catch (error) {
      console.error("Error marking profile as completed:", error);
      throw error;
    }
  }

  // Get user profile from backend
  async getUserProfile(principal) {
    try {
      const canister = await this.getAuthenticationCanister();
      const result = await canister.get_profile(principal);

      if (result.success && result.user) {
        return result.user;
      } else {
        console.log("No profile found for principal:", principal);
        return null;
      }
    } catch (error) {
      console.error("Error getting user profile:", error);
      throw error;
    }
  }

  // Register or update user profile
  async registerOrUpdateProfile(principal, profileData) {
    try {
      const canister = await this.getAuthenticationCanister();
      const result = await canister.register_or_update(principal, profileData);

      if (result.success && result.user) {
        console.log("Profile updated in backend");
        return result.user;
      } else {
        console.error("Failed to update profile:", result.message);
        throw new Error(result.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  }

  // Get all users (admin function)
  async getAllUsers() {
    try {
      const canister = await this.getAuthenticationCanister();
      return await canister.get_all_users();
    } catch (error) {
      console.error("Error getting all users:", error);
      throw error;
    }
  }

  // Get user by principal
  async getUserByPrincipal(principal) {
    try {
      const canister = await this.getAuthenticationCanister();
      const result = await canister.get_user_by_principal(principal);

      if (result.success && result.user) {
        return result.user;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error getting user by principal:", error);
      throw error;
    }
  }

  // Update user table access
  async updateUserAddTable(principal, tableId) {
    try {
      const canister = await this.getAuthenticationCanister();
      const result = await canister.update_user_add_table(principal, tableId);

      if (result.success) {
        console.log("Table access added for user");
        return result.user;
      } else {
        throw new Error(result.message || "Failed to add table access");
      }
    } catch (error) {
      console.error("Error adding table access:", error);
      throw error;
    }
  }

  // Remove user table access
  async updateUserRemoveTable(principal, tableId) {
    try {
      const canister = await this.getAuthenticationCanister();
      const result = await canister.update_user_remove_table(
        principal,
        tableId
      );

      if (result.success) {
        console.log("Table access removed for user");
        return result.user;
      } else {
        throw new Error(result.message || "Failed to remove table access");
      }
    } catch (error) {
      console.error("Error removing table access:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const backendIntegrationService = new BackendIntegrationService();
