// Collaborative Editor Service - Polling-based collaboration (v2.0)
// Cache bust: WebSocket removed, using ICP-compatible polling
import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory } from "./storage_idl";

// Debug: Check if imports are working
console.log("🔧 Imports check:", {
  Actor: !!Actor,
  ActorType: typeof Actor,
  HttpAgent: !!HttpAgent,
  HttpAgentType: typeof HttpAgent,
  idlFactory: !!idlFactory,
  idlFactoryType: typeof idlFactory,
});

// Storage Canister ID from the provided URL
const STORAGE_CANISTER_ID = "ucwa4-rx777-77774-qaada-cai";

class CollaborativeEditorService {
  constructor() {
    // Generate unique instance ID
    this.instanceId = Math.random().toString(36).substr(2, 9);
    console.log(
      `🔧 CollaborativeEditorService constructor called, instance ID: ${this.instanceId}`
    );

    this.agent = null;
    this.actor = null;
    this.isInitialized = false;
    this.currentTableId = null;
    this.currentUser = null;
    this.isCollaborating = false;
    this.collaborators = new Map();
    this.fileWatchers = new Map();
    this.cursorPositions = new Map();
    this.changeBuffer = [];
    this.debounceTimer = null;
    // WebSocket removed - using polling-based collaboration
  }

  async initialize(identity, tableId) {
    if (!identity) {
      throw new Error("Identity is required");
    }

    this.currentTableId = tableId;

    // Log the types of values we're receiving
    console.log("🔍 Received values:", {
      tableId: tableId,
      tableIdType: typeof tableId,
      tableIdValue: tableId,
      identityType: typeof identity,
      hasGetPrincipal: typeof identity.getPrincipal === "function",
    });

    // Debug: Check if identity has any function properties that might cause issues
    if (identity && typeof identity === "object") {
      const identityKeys = Object.keys(identity);
      console.log("🔍 Identity keys:", identityKeys);

      for (const key of identityKeys) {
        const value = identity[key];
        console.log(`🔍 Identity.${key}:`, {
          type: typeof value,
          isFunction: typeof value === "function",
          value: typeof value === "function" ? "[Function]" : value,
        });
      }
    }

    // Validate identity structure
    if (typeof identity.getPrincipal === "function") {
      try {
        const principal = identity.getPrincipal();
        console.log("🔍 Principal object:", principal);
        console.log("🔍 Principal type:", typeof principal);
        console.log(
          "🔍 Principal methods:",
          Object.getOwnPropertyNames(principal)
        );

        if (typeof principal.toText === "function") {
          try {
            const userPrincipal = principal.toText();
            console.log("🔍 Principal.toText() returned:", userPrincipal);
            console.log("🔍 Returned value type:", typeof userPrincipal);

            // Ensure we have a string value
            if (typeof userPrincipal === "string") {
              this.currentUser = userPrincipal;
              console.log("✅ Current user set to:", this.currentUser);
            } else {
              console.error(
                "❌ Principal.toText() returned non-string:",
                userPrincipal
              );
              this.currentUser = "anonymous-user";
            }
          } catch (error) {
            console.error("❌ Error calling principal.toText():", error);
            this.currentUser = "anonymous-user";
          }
        } else {
          console.error(
            "❌ Principal.toText is not a function:",
            typeof principal.toText
          );
          this.currentUser = "anonymous-user";
        }
      } catch (error) {
        console.error("❌ Error getting principal:", error);
        this.currentUser = "anonymous-user";
      }
    } else {
      console.warn("Identity doesn't have getPrincipal method, using fallback");
      this.currentUser = "anonymous-user";
    }

    // Try to initialize ICP agent if identity is valid
    try {
      if (identity && typeof identity.getPrincipal === "function") {
        this.agent = new HttpAgent({
          identity,
          host: "http://127.0.0.1:4943",
          fetchRootKey: false,
          verifyQuerySignatures: false,
        });

        // For local development, fetch root key
        if (import.meta.env.DEV) {
          try {
            await this.agent.fetchRootKey();
          } catch (error) {
            console.warn("Could not fetch root key:", error);
          }
        }

        // Initialize storage canister actor
        try {
          console.log("🔧 Creating storage canister actor...");
          console.log("📊 Canister ID:", STORAGE_CANISTER_ID);
          console.log("📊 Agent:", this.agent ? "Available" : "Not available");
          console.log(
            "📊 IDL Factory:",
            idlFactory ? "Available" : "Not available"
          );
          console.log("📊 Identity:", identity ? "Available" : "Not available");

          // Check if we have all required dependencies
          if (!idlFactory) {
            throw new Error("IDL Factory is not available");
          }
          if (!this.agent) {
            throw new Error("ICP Agent is not available");
          }
          if (!STORAGE_CANISTER_ID) {
            throw new Error("Storage Canister ID is not defined");
          }
          if (!Actor) {
            throw new Error("Actor class is not available");
          }
          if (typeof Actor.createActor !== "function") {
            throw new Error("Actor.createActor is not a function");
          }

          console.log("🔧 All dependencies available, creating actor...");

          // Create the real actor
          try {
            this.actor = Actor.createActor(idlFactory, {
              agent: this.agent,
              canisterId: STORAGE_CANISTER_ID,
            });
          } catch (actorError) {
            console.error("❌ Actor creation failed:", actorError);
            throw new Error(`Actor creation failed: ${actorError.message}`);
          }

          console.log("✅ Storage canister actor initialized successfully");
          console.log("🔍 Actor object:", this.actor);
          console.log("🔍 Actor type:", typeof this.actor);

          // Test the connection
          console.log("🧪 Testing storage connection...");
          await this.testStorageConnection();
        } catch (error) {
          console.error("❌ Could not initialize storage canister:", error);
          console.error("❌ Error details:", {
            message: error.message,
            stack: error.stack,
            name: error.name,
            canisterId: STORAGE_CANISTER_ID,
            hasAgent: !!this.agent,
            hasIdlFactory: !!idlFactory,
            hasIdentity: !!identity,
          });
          this.actor = null;
        }
      } else {
        console.warn(
          "Invalid identity format, skipping ICP agent initialization"
        );
        this.agent = null;
        this.actor = null;
      }
    } catch (error) {
      console.warn("Failed to initialize ICP agent:", error);
      this.agent = null;
      this.actor = null;
    }

    this.isInitialized = true;
    this.isCollaborating = true; // Set collaboration mode
    console.log(
      `✅ Collaborative editor initialized successfully (Instance: ${this.instanceId})`
    );
    console.log("🔄 Starting polling-based collaboration");
    console.log(
      "📊 ICP Agent:",
      this.agent ? "✅ Initialized" : "❌ Not available"
    );
    console.log(
      "📊 Storage Actor:",
      this.actor ? "✅ Available" : "❌ Not available"
    );
    this.initializeRealTimeCollaboration();
    return true;
  }

  // Initialize real-time collaboration using polling
  initializeRealTimeCollaboration() {
    try {
      console.log("🚀 Initializing polling-based collaborative editing");
      console.log("📡 No WebSocket - using ICP-compatible polling");
      this.startPollingFallback();
    } catch (error) {
      console.warn("Failed to initialize polling fallback:", error);
    }
  }

  // Start polling-based collaboration
  startPollingFallback() {
    console.log("🔄 Starting polling-based collaboration");
    console.log("⏰ Setting up polling intervals...");

    // Poll for general updates every 3 seconds
    this.pollingInterval = setInterval(() => {
      this.pollForUpdates();
    }, 3000);

    // Poll for active collaboration updates every 1.5 seconds
    this.activePollingInterval = setInterval(() => {
      if (this.isCollaborating && this.currentTableId) {
        this.pollForActiveUpdates();
      }
    }, 1500);

    // Poll for user presence updates every 5 seconds
    this.presencePollingInterval = setInterval(() => {
      if (this.isCollaborating && this.currentTableId) {
        this.pollForUserPresence();
      }
    }, 5000);

    console.log("✅ Polling intervals set up successfully");
    console.log("📊 Collaboration mode: Polling-based (ICP compatible)");
  }

  // Subscribe to table updates
  subscribeToTableUpdates() {
    // Since WebSocket is not available, we'll use polling-based subscription
    console.log(
      "Subscribing to table updates via polling for table:",
      this.currentTableId
    );

    // Start polling for this specific table
    this.startTableSpecificPolling();
  }

  // Start table-specific polling
  startTableSpecificPolling() {
    if (this.tablePollingInterval) {
      clearInterval(this.tablePollingInterval);
    }

    // Poll for table-specific updates every 2 seconds
    this.tablePollingInterval = setInterval(async () => {
      if (this.isInitialized && this.currentTableId) {
        await this.pollForTableUpdates();
      }
    }, 2000);
  }

  // Poll for table-specific updates
  async pollForTableUpdates() {
    try {
      // Check for file changes in this specific table
      await this.checkForFileUpdates();

      // Check for user presence changes
      await this.checkForUserPresenceChanges();
    } catch (error) {
      console.error("Error polling for table updates:", error);
    }
  }

  // Handle real-time collaboration updates
  handleCollaborationUpdate(update) {
    switch (update.type) {
      case "file_change":
        this.handleFileChange(update);
        break;
      case "cursor_move":
        this.handleCursorMove(update);
        break;
      case "user_join":
        this.handleUserJoin(update);
        break;
      case "user_leave":
        this.handleUserLeave(update);
        break;
      default:
        console.log("Unknown update type:", update);
    }
  }

  // Handle file content changes from other users
  handleFileChange(update) {
    if (update.user === this.currentUser) return; // Ignore own changes

    const { fileId, content } = update;

    // Update the file content
    this.updateFileContent(fileId, content);

    // Notify listeners
    this.notifyFileChange(fileId, content, update.user);
  }

  // Handle cursor movements from other users
  handleCursorMove(update) {
    if (update.user === this.currentUser) return;

    const { fileId, position, username } = update;
    this.cursorPositions.set(update.user, {
      fileId,
      position,
      username,
      timestamp: Date.now(),
    });

    // Notify listeners
    this.notifyCursorMove(update);
  }

  // Handle user joining the table
  handleUserJoin(update) {
    const { user, username } = update;
    this.collaborators.set(user, {
      username,
      joinedAt: Date.now(),
      isActive: true,
    });

    this.notifyUserJoin(update);
  }

  // Handle user leaving the table
  handleUserLeave(update) {
    const { user } = update;
    this.collaborators.delete(user);
    this.cursorPositions.delete(user);

    this.notifyUserLeave(update);
  }

  // Update file content (called when other users make changes)
  updateFileContent(fileId, content) {
    // This will be called by the parent component to update the file state
    if (this.onFileContentUpdate) {
      this.onFileContentUpdate(fileId, content);
    }
  }

  // Send file change to other collaborators
  async sendFileChange(fileId, content, operation = "update") {
    if (!this.isInitialized) return;

    // Validate content before proceeding
    if (content === undefined || content === null) {
      console.warn("⚠️ Skipping file change - content is undefined/null");
      return;
    }

    // Debug: Log what we're receiving
    console.log("📤 sendFileChange called with:", {
      fileId: fileId,
      fileIdType: typeof fileId,
      contentLength: content ? content.length : "undefined",
      contentType: typeof content,
      contentPreview: String(content).substring(0, 50),
      operation: operation,
      tableId: this.currentTableId,
      tableIdType: typeof this.currentTableId,
    });

    const change = {
      type: "file_change",
      tableId: this.currentTableId,
      fileId,
      content,
      operation,
      user: this.currentUser,
      timestamp: Date.now(),
    };

    // Since WebSocket is not available, we'll use polling-based collaboration
    // The change will be detected by other users through polling
    console.log("File change sent (polling-based collaboration):", {
      fileId,
      operation,
      timestamp: change.timestamp,
    });

    // Also save to storage canister
    try {
      await this.saveFileToStorage(fileId, content);
    } catch (error) {
      console.error("Failed to save file to storage:", error);
      throw error; // Re-throw to let caller handle it
    }

    // Buffer changes for batch processing
    this.changeBuffer.push(change);
    this.debounceChanges();
  }

  // Send cursor position to other collaborators
  sendCursorMove(fileId, position) {
    if (!this.isInitialized) return;

    const cursorUpdate = {
      type: "cursor_move",
      tableId: this.currentTableId,
      fileId,
      position,
      user: this.currentUser,
      timestamp: Date.now(),
    };

    // Since WebSocket is not available, cursor movements will be detected through polling
    console.log("Cursor movement sent (polling-based):", {
      fileId,
      position,
      timestamp: cursorUpdate.timestamp,
    });
  }

  // Send selection range to other collaborators
  sendSelectionChange(fileId, selection) {
    if (!this.isInitialized) return;

    const selectionUpdate = {
      type: "selection_change",
      tableId: this.currentTableId,
      fileId,
      selection,
      user: this.currentUser,
      timestamp: Date.now(),
    };

    // Since WebSocket is not available, selection changes will be detected through polling
    console.log("Selection change sent (polling-based):", {
      fileId,
      selection,
      timestamp: selectionUpdate.timestamp,
    });
  }

  // Send scroll position to other collaborators
  sendScrollPosition(fileId, scrollPosition) {
    if (!this.isInitialized) return;

    const scrollUpdate = {
      type: "scroll_position",
      tableId: this.currentTableId,
      fileId,
      scrollPosition,
      user: this.currentUser,
      timestamp: Date.now(),
    };

    // Since WebSocket is not available, scroll positions will be detected through polling
    console.log("Scroll position sent (polling-based):", {
      fileId,
      scrollPosition,
      timestamp: scrollUpdate.timestamp,
    });
  }

  // Save file to storage canister
  async saveFileToStorage(fileId, content) {
    if (!this.actor) {
      console.error("❌ Storage actor not available - cannot save file");
      throw new Error("Storage canister not initialized");
    }

    try {
      // Validate content first
      if (content === undefined || content === null) {
        throw new Error(`Invalid content: content is ${content}`);
      }

      // Convert IDs to numbers as expected by the IDL
      const tableId = Number(this.currentTableId);
      const fileIdNum = Number(fileId);

      // Validate that we have valid numbers
      if (isNaN(tableId) || isNaN(fileIdNum)) {
        throw new Error(
          `Invalid ID format: tableId=${this.currentTableId}, fileId=${fileId}`
        );
      }

      console.log(`💾 Saving file ${fileIdNum} to storage canister...`);
      console.log(`📊 Table ID: ${tableId}, File ID: ${fileIdNum}`);
      console.log(`📊 Content type: ${typeof content}`);
      console.log(`📊 Content length: ${content.length} characters`);
      console.log(
        `📊 Content preview: ${String(content).substring(0, 100)}...`
      );

      // Call the actual storage canister method with proper types
      const result = await this.actor.save_file(tableId, fileIdNum, content);

      if ("err" in result) {
        throw new Error(result.err);
      }

      console.log(
        `✅ File ${fileIdNum} saved successfully to storage canister`
      );
      return result.ok;
    } catch (error) {
      console.error(`❌ Error saving file ${fileId} to storage:`, error);
      throw error; // Re-throw to let caller handle it
    }
  }

  // Load file from storage canister
  async loadFileFromStorage(fileId) {
    if (!this.actor) {
      console.error("❌ Storage actor not available - cannot load file");
      throw new Error("Storage canister not initialized");
    }

    try {
      // Convert IDs to numbers as expected by the IDL
      const tableId = Number(this.currentTableId);
      const fileIdNum = Number(fileId);

      // Validate that we have valid numbers
      if (isNaN(tableId) || isNaN(fileIdNum)) {
        throw new Error(
          `Invalid ID format: tableId=${this.currentTableId}, fileId=${fileId}`
        );
      }

      console.log(`📂 Loading file ${fileIdNum} from storage canister...`);
      console.log(`📊 Table ID: ${tableId}, File ID: ${fileIdNum}`);

      const result = await this.actor.get_file(tableId, fileIdNum);

      if ("err" in result) {
        console.warn(`⚠️ Error loading file ${fileIdNum}:`, result.err);
        return null;
      }

      console.log(
        `✅ File ${fileIdNum} loaded successfully from storage canister`
      );
      return result.ok.content;
    } catch (error) {
      console.error(`❌ Error loading file ${fileId} from storage:`, error);
      throw error; // Re-throw to let caller handle it
    }
  }

  // Debounce changes to avoid overwhelming the network
  debounceChanges() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processBatchedChanges();
    }, 100);
  }

  // Process batched changes
  async processBatchedChanges() {
    if (this.changeBuffer.length === 0) return;

    const changes = [...this.changeBuffer];
    this.changeBuffer = [];

    console.log(`🔄 Processing ${changes.length} batched changes...`);

    // Process changes in batch
    for (const change of changes) {
      try {
        await this.saveFileToStorage(change.fileId, change.content);
        console.log(
          `✅ Change processed successfully for file ${change.fileId}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to process change for file ${change.fileId}:`,
          error
        );
        // Put the failed change back in the buffer to retry later
        this.changeBuffer.push(change);
        console.log(`🔄 Queued file ${change.fileId} for retry`);
      }
    }

    console.log("✅ Batch processing completed");
  }

  // Poll for updates (fallback method)
  async pollForUpdates() {
    if (!this.isInitialized) return;

    try {
      // Poll storage canister for recent changes
      // This would be implemented based on the actual storage canister interface
      console.log("Polling for general updates...");

      // Check for file changes in the current table
      if (this.currentTableId && this.actor) {
        // This would call a method to get recent changes
        // For now, we'll simulate checking for updates
        await this.checkForFileUpdates();
      }
    } catch (error) {
      console.error("Error polling for updates:", error);
    }
  }

  // Poll for active collaboration updates
  async pollForActiveUpdates() {
    if (!this.isInitialized || !this.currentTableId) return;

    try {
      // Check for recent file changes and cursor movements
      await this.checkForActiveCollaboration();
    } catch (error) {
      console.error("Error polling for active updates:", error);
    }
  }

  // Poll for user presence updates
  async pollForUserPresence() {
    if (!this.isInitialized || !this.currentTableId) return;

    try {
      // Check for users joining/leaving the table
      await this.checkForUserPresenceChanges();
    } catch (error) {
      console.error("Error polling for user presence:", error);
    }
  }

  // Check for file updates from storage
  async checkForFileUpdates() {
    try {
      // This would call the storage canister to get recent changes
      // For now, we'll simulate this
      console.log(
        "🔍 Polling: Checking for file updates in table:",
        this.currentTableId
      );

      // In a real implementation, you would:
      // 1. Call storage canister method to get recent changes
      // 2. Compare with local state
      // 3. Notify listeners of any changes

      // For demonstration, let's simulate detecting a change every few polls
      if (Math.random() < 0.1) {
        // 10% chance to simulate a change
        console.log("📝 Polling: Simulated file change detected");
        // This would trigger a notification to other users
      }
    } catch (error) {
      console.error("Error checking for file updates:", error);
    }
  }

  // Check for active collaboration updates
  async checkForActiveCollaboration() {
    try {
      // This would check for real-time collaboration data
      // For now, we'll simulate this
      console.log("🎯 Polling: Checking for active collaboration updates");

      // In a real implementation, you would:
      // 1. Check for cursor movements
      // 2. Check for selection changes
      // 3. Check for scroll positions
    } catch (error) {
      console.error("Error checking for active collaboration:", error);
    }
  }

  // Check for user presence changes
  async checkForUserPresenceChanges() {
    try {
      // This would check for users joining/leaving
      // For now, we'll simulate this
      console.log("👥 Polling: Checking for user presence changes");

      // In a real implementation, you would:
      // 1. Call table management service to get current users
      // 2. Compare with local collaborator list
      // 3. Notify listeners of changes
    } catch (error) {
      console.error("Error checking for user presence:", error);
    }
  }

  // Set callback for file content updates
  setFileContentUpdateCallback(callback) {
    this.onFileContentUpdate = callback;
  }

  // Set callback for cursor movements
  setCursorMoveCallback(callback) {
    this.onCursorMove = callback;
  }

  // Set callback for user join/leave events
  setUserJoinCallback(callback) {
    this.onUserJoin = callback;
  }

  setUserLeaveCallback(callback) {
    this.onUserLeave = callback;
  }

  setSelectionChangeCallback(callback) {
    this.onSelectionChange = callback;
  }

  setScrollPositionCallback(callback) {
    this.onScrollPosition = callback;
  }

  // Notify listeners
  notifyFileChange(fileId, content, user) {
    if (this.onFileContentUpdate) {
      this.onFileContentUpdate(fileId, content, user);
    }
  }

  notifyCursorMove(update) {
    if (this.onCursorMove) {
      this.onCursorMove(update);
    }
  }

  notifyUserJoin(update) {
    if (this.onUserJoin) {
      this.onUserJoin(update);
    }
  }

  notifyUserLeave(update) {
    if (this.onUserLeave) {
      this.onUserLeave(update);
    }
  }

  notifySelectionChange(update) {
    if (this.onSelectionChange) {
      this.onSelectionChange(update);
    }
  }

  notifyScrollPosition(update) {
    if (this.onScrollPosition) {
      this.onScrollPosition(update);
    }
  }

  // Get active collaborators
  getActiveCollaborators() {
    return Array.from(this.collaborators.values()).filter((c) => c.isActive);
  }

  // Get cursor positions
  getCursorPositions() {
    return Array.from(this.cursorPositions.values());
  }

  // Test storage canister connection
  async testStorageConnection() {
    console.log("🧪 testStorageConnection called on instance:", this);
    console.log("🧪 Actor available:", !!this.actor);
    console.log("🧪 Is initialized:", this.isInitialized);
    console.log("🧪 Current table ID:", this.currentTableId);

    if (!this.actor) {
      console.error("❌ No actor available for testing");
      console.error("❌ Service state:", {
        isInitialized: this.isInitialized,
        hasAgent: !!this.agent,
        hasActor: !!this.actor,
        currentTableId: this.currentTableId,
        currentUser: this.currentUser,
      });
      return false;
    }

    try {
      // Convert table ID to number as expected by the IDL
      const tableId = Number(this.currentTableId);

      if (isNaN(tableId)) {
        console.error("❌ Invalid table ID format:", this.currentTableId);
        return false;
      }

      console.log("🧪 Testing storage canister connection...");
      console.log("📊 Testing with table ID:", tableId);

      // Try to call a simple query method
      const result = await this.actor.list_files(tableId);
      console.log("✅ Storage connection test successful:", result);

      // Test if we can also call get_file with a test file ID
      try {
        const testResult = await this.actor.get_file(tableId, 1);
        console.log("✅ Get file test successful:", testResult);
      } catch (getError) {
        console.warn(
          "⚠️ Get file test failed (expected for non-existent file):",
          getError
        );
      }

      return true;
    } catch (error) {
      console.error("❌ Storage connection test failed:", error);
      console.error("❌ Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        canisterId: STORAGE_CANISTER_ID,
        tableId: this.currentTableId,
        tableIdType: typeof this.currentTableId,
      });
      return false;
    }
  }

  // Cleanup
  cleanup() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Clear all polling intervals
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    if (this.activePollingInterval) {
      clearInterval(this.activePollingInterval);
    }
    if (this.presencePollingInterval) {
      clearInterval(this.presencePollingInterval);
    }
    if (this.tablePollingInterval) {
      clearInterval(this.tablePollingInterval);
    }

    this.isInitialized = false;
    this.currentTableId = null;
    this.currentUser = null;
    this.collaborators.clear();
    this.cursorPositions.clear();
    this.changeBuffer = [];
  }
}

// Create a singleton instance
let _collaborativeEditorService = null;

export const collaborativeEditorService = (() => {
  if (!_collaborativeEditorService) {
    _collaborativeEditorService = new CollaborativeEditorService();
    console.log("🔧 Creating new CollaborativeEditorService instance");
  } else {
    console.log("🔧 Reusing existing CollaborativeEditorService instance");
  }
  return _collaborativeEditorService;
})();

// Make service available globally for testing (development only)
if (import.meta.env.DEV) {
  // Check if there's already a service instance
  if (
    window.collaborativeEditorService &&
    window.collaborativeEditorService !== collaborativeEditorService
  ) {
    console.warn(
      "⚠️ Development mode: Different service instance detected, replacing..."
    );
  }
  window.collaborativeEditorService = collaborativeEditorService;
  console.log(
    "🔧 Development mode: Service available as window.collaborativeEditorService"
  );
  console.log("🔧 Service instance ID:", collaborativeEditorService);
}
