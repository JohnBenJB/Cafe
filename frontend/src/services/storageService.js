import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../.dfx/local/canisters/storage/service.did.js";
import internetIdentityService from "./internetIdentity";

class StorageService {
  constructor() {
    this.agent = null;
    this.actor = null;
    this.isInitialized = false;
    this.canisterId = "ulvla-h7777-77774-qaacq-cai"; // Local storage canister ID
  }

  async initialize(identity) {
    try {
      console.log("🔧 Initializing Storage Service...");

      if (!identity) {
        throw new Error(
          "Identity is required for storage service initialization"
        );
      }

      // Create HTTP agent with identity
      this.agent = new HttpAgent({
        identity,
        host: import.meta.env.PROD
          ? "https://ic0.app"
          : "http://127.0.0.1:4943",
        // Disable certificate verification for local development
        fetchRootKey: false,
        verifyQuerySignatures: false,
      });

      // For local development, we need to fetch the root key
      if (!import.meta.env.PROD) {
        try {
          await this.agent.fetchRootKey();
        } catch (error) {
          console.warn("Could not fetch root key:", error);
        }
      }

      // Create actor instance
      this.actor = Actor.createActor(idlFactory, {
        agent: this.agent,
        canisterId: this.canisterId,
      });

      // Test connection with a simple query method
      try {
        // Try to get global autosave stats as a test (this is a query method)
        await this.actor.getGlobalAutosaveStats();
        console.log("✅ Storage canister connection successful");
      } catch (statsError) {
        console.warn("⚠️ Stats query failed, but continuing:", statsError);
        console.log(
          "✅ Storage canister connection established (stats query failed)"
        );
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize storage service:", error);
      this.isInitialized = false;
      return false;
    }
  }

  // File Management Methods
  async createFile(tableId, name, mime, initialContent = "") {
    this._ensureInitialized();

    try {
      console.log("🔧 Creating file:", {
        tableId,
        name,
        mime,
        contentLength: initialContent.length,
      });

      // Get session ID for authentication
      const sessionId = internetIdentityService.getSessionId();
      if (!sessionId) {
        throw new Error("No session ID available. Please authenticate first.");
      }

      // Convert string content to bytes
      const contentBytes = this._stringToBytes(initialContent);

      // Create file using the canister's create_file method
      const result = await this.actor.create_file(
        sessionId,
        name,
        tableId,
        mime,
        contentBytes.length > 0 ? [contentBytes] : [] // Wrap in opt blob
      );

      if (result.err) {
        throw new Error(`File creation failed: ${JSON.stringify(result.err)}`);
      }

      console.log("✅ File created successfully with ID:", result.ok);
      return result.ok;
    } catch (error) {
      console.error("❌ Failed to create file:", error);
      throw error;
    }
  }

  async getFileContent(fileId) {
    this._ensureInitialized();

    try {
      const result = await this.actor.getFileContent(fileId);

      if (result.err) {
        throw new Error(
          `Failed to get file content: ${JSON.stringify(result.err)}`
        );
      }

      // Convert bytes back to string
      return this._bytesToString(result.ok);
    } catch (error) {
      console.error("❌ Failed to get file content:", error);
      throw error;
    }
  }

  // Check if table exists in storage, create if it doesn't
  async ensureTableExists(tableId) {
    this._ensureInitialized();

    try {
      console.log("🔍 Checking if table exists in storage:", tableId);

      // Try to list files to see if table exists
      const result = await this.actor.listFiles(Number(tableId));

      if (result && result.err && result.err.NotFound) {
        console.log(
          "ℹ️ Table not found in storage, this is normal for new tables"
        );
        return false; // Table doesn't exist yet
      }

      if (result && result.ok) {
        console.log("✅ Table exists in storage");
        return true;
      }

      console.log(
        "⚠️ Unexpected result when checking table existence:",
        result
      );
      return false;
    } catch (error) {
      console.warn("⚠️ Error checking table existence:", error);
      return false;
    }
  }

  async listFiles(tableId) {
    this._ensureInitialized();

    try {
      console.log(
        "🔍 StorageService.listFiles called with tableId:",
        tableId,
        "Type:",
        typeof tableId
      );

      // Ensure tableId is a number
      const numericTableId = Number(tableId);
      if (isNaN(numericTableId)) {
        throw new Error(`Invalid table ID: ${tableId} (must be a number)`);
      }

      console.log("🔍 Calling canister with numeric tableId:", numericTableId);

      const result = await this.actor.listFiles(numericTableId);
      console.log("🔍 Raw result from listFiles:", result);
      console.log("🔍 Result type:", typeof result);
      console.log("🔍 Result keys:", Object.keys(result || {}));
      console.log("🔍 Has err property:", result && "err" in result);
      console.log("🔍 Has ok property:", result && "ok" in result);

      // Check if the result has an error
      if (result && result.err) {
        console.log("🔍 Error in result:", result.err);
        console.log("🔍 Error type:", typeof result.err);
        console.log("🔍 Error keys:", Object.keys(result.err || {}));

        // Check for specific error types
        if (result.err.NotFound !== undefined) {
          console.log("ℹ️ No files found for table (table may not exist yet)");
          return []; // Return empty array for new tables
        }

        // For other errors, throw with details
        throw new Error(`Failed to list files: ${JSON.stringify(result.err)}`);
      }

      // Check if we have a valid result
      if (result && result.ok) {
        console.log("✅ Files listed successfully:", result.ok);
        return result.ok;
      }

      // If we get here, something unexpected happened
      console.warn("⚠️ Unexpected result structure:", result);
      return [];
    } catch (error) {
      console.error("❌ Failed to list files:", error);
      throw error;
    }
  }

  async updateFileContent(fileId, newContent) {
    this._ensureInitialized();

    try {
      console.log("🔧 Updating file content:", {
        fileId,
        contentLength: newContent.length,
      });

      // Get session ID for authentication
      const sessionId = internetIdentityService.getSessionId();
      if (!sessionId) {
        throw new Error("No session ID available. Please authenticate first.");
      }

      // Convert string to bytes
      const contentBytes = this._stringToBytes(newContent);

      // Create content chunks
      const chunks = [
        {
          index: 0,
          data: contentBytes,
          size: contentBytes.length,
        },
      ];

      // Replace file content
      const result = await this.actor.replace_file_content(
        sessionId,
        fileId,
        chunks
      );

      if (result.err) {
        throw new Error(
          `Failed to update file content: ${JSON.stringify(result.err)}`
        );
      }

      console.log(
        "✅ File content updated successfully, new version:",
        result.ok
      );
      return result.ok;
    } catch (error) {
      console.error("❌ Failed to update file content:", error);
      throw error;
    }
  }

  async deleteFile(fileId) {
    this._ensureInitialized();

    try {
      // Get session ID for authentication
      const sessionId = internetIdentityService.getSessionId();
      if (!sessionId) {
        throw new Error("No session ID available. Please authenticate first.");
      }

      const result = await this.actor.delete_file(sessionId, fileId);

      if (result.err) {
        throw new Error(`Failed to delete file: ${JSON.stringify(result.err)}`);
      }

      console.log("✅ File deleted successfully");
      return true;
    } catch (error) {
      console.error("❌ Failed to delete file:", error);
      throw error;
    }
  }

  async createSnapshot(fileId, message = "") {
    this._ensureInitialized();

    try {
      // Get session ID for authentication
      const sessionId = internetIdentityService.getSessionId();
      if (!sessionId) {
        throw new Error("No session ID available. Please authenticate first.");
      }

      const result = await this.actor.create_snapshot(
        sessionId,
        fileId,
        message ? [message] : []
      );

      if (result.err) {
        throw new Error(
          `Failed to create snapshot: ${JSON.stringify(result.err)}`
        );
      }

      console.log("✅ Snapshot created successfully, version:", result.ok);
      return result.ok;
    } catch (error) {
      console.error("❌ Failed to create snapshot:", error);
      throw error;
    }
  }

  // Note: getFileMeta method removed as it doesn't exist in the canister
  // We can only get file content and IDs, not metadata like name, mime type, etc.

  // Utility Methods
  _stringToBytes(str) {
    const encoder = new TextEncoder();
    return Array.from(encoder.encode(str));
  }

  _bytesToString(bytes) {
    const decoder = new TextDecoder();
    return decoder.decode(new Uint8Array(bytes));
  }

  _ensureInitialized() {
    if (!this.isInitialized || !this.actor) {
      throw new Error(
        "Storage service not initialized. Call initialize() first."
      );
    }
  }

  // Status methods
  isReady() {
    return this.isInitialized && this.actor !== null;
  }

  getActor() {
    return this.actor;
  }
}

// Export singleton instance
export const storageService = new StorageService();
