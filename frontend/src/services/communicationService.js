import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../.dfx/local/canisters/communication/service.did.js";

class CommunicationService {
  constructor() {
    this.agent = null;
    this.actor = null;
    this.isInitialized = false;
    this.canisterId = "u6s2n-gx777-77774-qaaba-cai"; // Local communication canister ID
    this.activeChats = new Map(); // Track active chats by tableId
  }

  async initialize(identity) {
    try {
      console.log("🔧 Initializing Communication Service...");

      if (!identity) {
        throw new Error(
          "Identity is required for communication service initialization"
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

      // Test connection by getting all chats
      await this.actor.get_all_chats();
      console.log("✅ Communication canister connection successful");

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize communication service:", error);
      this.isInitialized = false;
      return false;
    }
  }

  // Chat Management Methods
  async createChat(tableId) {
    this._ensureInitialized();

    try {
      console.log("🔧 Creating chat for table:", tableId);
      console.log("🔧 Calling canister create_chat with tableId:", tableId);

      const result = await this.actor.create_chat(tableId);
      console.log("🔧 Raw result from create_chat:", result);
      console.log("🔧 Result type:", typeof result);
      console.log("🔧 Result keys:", Object.keys(result || {}));

      if (!result) {
        throw new Error("Canister returned null/undefined from create_chat");
      }

      if (result.Err) {
        throw new Error(`Failed to create chat: ${JSON.stringify(result.Err)}`);
      }

      if (!result.Ok) {
        throw new Error(
          `Canister returned result without Ok field: ${JSON.stringify(result)}`
        );
      }

      const chatId = result.Ok;
      console.log("✅ Chat created successfully with ID:", chatId);

      // Store chat info locally
      this.activeChats.set(tableId, chatId);
      console.log("✅ Chat ID cached for table:", tableId);

      return chatId;
    } catch (error) {
      console.error("❌ Failed to create chat:", error);
      console.error("❌ Create chat error details:", {
        tableId: tableId,
        errorType: error.constructor.name,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      throw error;
    }
  }

  async getChatByTable(tableId) {
    this._ensureInitialized();

    try {
      console.log("🔧 getChatByTable called with tableId:", tableId);
      console.log("🔧 Active chats cache:", this.activeChats);

      // Check if we have a cached chat ID
      if (this.activeChats.has(tableId)) {
        const cachedChatId = this.activeChats.get(tableId);
        console.log("✅ Returning cached chat ID:", cachedChatId);
        return cachedChatId;
      }

      // Use the new atomic get_or_create_chat function
      console.log(
        "🔧 Calling canister get_or_create_chat with tableId:",
        tableId
      );

      // Check if the function exists on the actor
      if (typeof this.actor.get_or_create_chat !== "function") {
        console.error("❌ get_or_create_chat function not found on actor!");
        console.log(
          "🔍 Available actor methods:",
          Object.getOwnPropertyNames(this.actor)
        );
        throw new Error(
          "get_or_create_chat function not available on canister"
        );
      }

      const result = await this.actor.get_or_create_chat(tableId);
      console.log("🔧 Raw result from canister:", result);
      console.log("🔧 Result type:", typeof result);
      console.log("🔧 Result keys:", Object.keys(result || {}));

      if (!result) {
        throw new Error(
          "Canister returned null/undefined from get_or_create_chat"
        );
      }

      if (result.Err) {
        throw new Error(
          `Failed to get or create chat: ${JSON.stringify(result.Err)}`
        );
      }

      if (result.Ok === undefined) {
        throw new Error(
          `Canister returned result without Ok field: ${JSON.stringify(result)}`
        );
      }

      const chatId = result.Ok;
      console.log("✅ Got or created chat ID:", chatId);
      this.activeChats.set(tableId, chatId);
      return chatId;
    } catch (error) {
      console.error("❌ Failed to get or create chat:", error);
      console.error("❌ Error details:", {
        tableId: tableId,
        errorType: error.constructor.name,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      throw error;
    }
  }

  async getChatInfo(chatId) {
    this._ensureInitialized();

    try {
      const result = await this.actor.get_chat_info(chatId);

      if (result.Err) {
        throw new Error(
          `Failed to get chat info: ${JSON.stringify(result.Err)}`
        );
      }

      return result.Ok;
    } catch (error) {
      console.error("❌ Failed to get chat info:", error);
      throw error;
    }
  }

  // Message Methods
  async sendMessage(chatId, content, messageType = "Text") {
    this._ensureInitialized();

    try {
      console.log("🔧 Sending message:", {
        chatId,
        content,
        type: messageType,
      });

      // Create message content based on type
      const messageContent =
        messageType === "System" ? { System: content } : { Text: content };

      const result = await this.actor.send_message(chatId, messageContent);

      if (result.Err) {
        throw new Error(
          `Failed to send message: ${JSON.stringify(result.Err)}`
        );
      }

      console.log("✅ Message sent successfully with ID:", result.Ok);
      return result.Ok;
    } catch (error) {
      console.error("❌ Failed to send message:", error);
      throw error;
    }
  }

  async getMessages(chatId, offset = 0, limit = 50) {
    this._ensureInitialized();

    try {
      const result = await this.actor.get_messages(chatId, offset, limit);

      if (result.Err) {
        throw new Error(
          `Failed to get messages: ${JSON.stringify(result.Err)}`
        );
      }

      return result.Ok;
    } catch (error) {
      console.error("❌ Failed to get messages:", error);
      throw error;
    }
  }

  async editMessage(chatId, messageId, newContent) {
    this._ensureInitialized();

    try {
      console.log("🔧 Editing message:", { chatId, messageId, newContent });

      const messageContent = { Text: newContent };
      const result = await this.actor.edit_message(
        chatId,
        messageId,
        messageContent
      );

      if (result.Err) {
        throw new Error(
          `Failed to edit message: ${JSON.stringify(result.Err)}`
        );
      }

      console.log("✅ Message edited successfully");
      return true;
    } catch (error) {
      console.error("❌ Failed to edit message:", error);
      throw error;
    }
  }

  async deleteMessage(chatId, messageId) {
    this._ensureInitialized();

    try {
      console.log("🔧 Deleting message:", { chatId, messageId });

      const result = await this.actor.delete_message(chatId, messageId);

      if (result.Err) {
        throw new Error(
          `Failed to delete message: ${JSON.stringify(result.Err)}`
        );
      }

      console.log("✅ Message deleted successfully");
      return true;
    } catch (error) {
      console.error("❌ Failed to delete message:", error);
      throw error;
    }
  }

  // Typing Indicators
  async setTypingStatus(chatId, isTyping) {
    this._ensureInitialized();

    try {
      const result = await this.actor.set_typing_status(chatId, isTyping);

      if (result.Err) {
        console.warn("⚠️ Failed to set typing status:", result.Err);
        return false;
      }

      return true;
    } catch (error) {
      console.warn("⚠️ Failed to set typing status:", error);
      return false;
    }
  }

  async getTypingUsers(chatId) {
    this._ensureInitialized();

    try {
      const result = await this.actor.get_typing_users(chatId);

      if (result.Err) {
        throw new Error(
          `Failed to get typing users: ${JSON.stringify(result.Err)}`
        );
      }

      return result.Ok;
    } catch (error) {
      console.error("❌ Failed to get typing users:", error);
      return [];
    }
  }

  // Chat Statistics
  async getChatStats(chatId) {
    this._ensureInitialized();

    try {
      const result = await this.actor.get_chat_stats(chatId);

      if (result.Err) {
        throw new Error(
          `Failed to get chat stats: ${JSON.stringify(result.Err)}`
        );
      }

      return result.Ok;
    } catch (error) {
      console.error("❌ Failed to get chat stats:", error);
      throw error;
    }
  }

  // Utility Methods
  _ensureInitialized() {
    if (!this.isInitialized || !this.actor) {
      throw new Error(
        "Communication service not initialized. Call initialize() first."
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

  // Get active chat ID for a table
  getActiveChatId(tableId) {
    return this.activeChats.get(tableId);
  }

  // Clear chat cache
  clearChatCache() {
    this.activeChats.clear();
  }
}

// Export singleton instance
export const communicationService = new CommunicationService();
