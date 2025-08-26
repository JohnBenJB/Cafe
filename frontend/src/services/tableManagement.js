import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory } from "./table_management_idl";
import internetIdentityService from "./internetIdentity";

// Table Management Canister ID
const TABLE_MANAGEMENT_CANISTER_ID =
  import.meta.env.VITE_TABLE_MANAGEMENT_CANISTER_ID ||
  "umunu-kh777-77774-qaaca-cai";

class TableManagementService {
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
      canisterId: TABLE_MANAGEMENT_CANISTER_ID,
    });
  }

  async createTable(title, description) {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      const sessionId = internetIdentityService.getSessionId();
      const result = await this.actor.create_table(
        sessionId,
        title,
        description
      );

      if ("ok" in result) {
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error creating table:", error);
      throw error;
    }
  }

  async getUserTables() {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      const sessionId = internetIdentityService.getSessionId();
      const result = await this.actor.get_user_tables(sessionId);

      if ("ok" in result) {
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error getting user tables:", error);
      throw error;
    }
  }

  async getTable(tableId) {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      const result = await this.actor.get_table(tableId);
      return result;
    } catch (error) {
      console.error("Error getting table:", error);
      throw error;
    }
  }

  async requestJoinTable(userPrincipal, tableId) {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      console.log("requestJoinTable called with:", {
        userPrincipal,
        tableId,
        type: typeof userPrincipal,
      });

      // Convert string principal to Principal object if needed
      let principalObj;
      if (typeof userPrincipal === "string") {
        try {
          principalObj = Principal.fromText(userPrincipal);
          console.log(
            "Converted string principal to Principal object:",
            principalObj
          );
        } catch (conversionError) {
          console.error(
            "Failed to convert principal string to Principal object:",
            conversionError
          );
          throw new Error(`Invalid principal format: ${userPrincipal}`);
        }
      } else if (
        userPrincipal &&
        typeof userPrincipal.toString === "function"
      ) {
        // If it's an object with toString method, try to convert it
        try {
          principalObj = Principal.fromText(userPrincipal.toString());
          console.log(
            "Converted object principal to Principal object:",
            principalObj
          );
        } catch (conversionError) {
          console.error(
            "Failed to convert object principal to Principal object:",
            conversionError
          );
          throw new Error(`Invalid principal object: ${userPrincipal}`);
        }
      } else {
        principalObj = userPrincipal;
        console.log("Using principal as-is:", principalObj);
      }

      const sessionId = internetIdentityService.getSessionId();
      const result = await this.actor.request_join_table(
        sessionId,
        principalObj,
        tableId
      );

      if ("ok" in result) {
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error requesting to join table:", error);
      throw error;
    }
  }

  async acceptJoinTable(tableId) {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      const sessionId = internetIdentityService.getSessionId();
      const result = await this.actor.accept_join_table(sessionId, tableId);

      if ("ok" in result) {
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error accepting join table:", error);
      throw error;
    }
  }

  async rejectJoinTable(tableId) {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      const sessionId = internetIdentityService.getSessionId();
      const result = await this.actor.reject_join_request(sessionId, tableId);

      if ("ok" in result) {
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error rejecting join table:", error);
      throw error;
    }
  }

  async cancelJoinRequest(userPrincipal, tableId) {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      let principalObj;
      if (typeof userPrincipal === "string") {
        principalObj = Principal.fromText(userPrincipal);
      } else {
        principalObj = userPrincipal;
      }

      const sessionId = internetIdentityService.getSessionId();
      const result = await this.actor.cancel_join_request(
        sessionId,
        principalObj,
        tableId
      );

      if ("ok" in result) {
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error canceling join request:", error);
      throw error;
    }
  }

  async leaveTable(tableId) {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      const sessionId = internetIdentityService.getSessionId();
      const result = await this.actor.leave_table(sessionId, tableId);

      if ("ok" in result) {
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error leaving table:", error);
      throw error;
    }
  }

  async deleteTable(tableId) {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      const sessionId = internetIdentityService.getSessionId();
      const result = await this.actor.delete_table(sessionId, tableId);

      if ("ok" in result) {
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error deleting table:", error);
      throw error;
    }
  }

  async getTableCollaborators(tableId) {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      const result = await this.actor.get_table_collaborators(tableId);

      if ("ok" in result) {
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error getting table collaborators:", error);
      throw error;
    }
  }

  async getPendingSentRequests(tableId) {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      const sessionId = internetIdentityService.getSessionId();
      const result = await this.actor.get_pending_sent_requests(
        sessionId,
        tableId
      );

      if ("ok" in result) {
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error getting pending sent requests:", error);
      throw error;
    }
  }

  async getPendingReceivedRequests() {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      const sessionId = internetIdentityService.getSessionId();
      const result = await this.actor.get_pending_recieved_requests(sessionId);

      if ("ok" in result) {
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error getting pending received requests:", error);
      throw error;
    }
  }

  async getAllTables() {
    if (!this.actor) {
      throw new Error("Table management service not initialized");
    }

    try {
      const result = await this.actor.get_all_tables();

      if ("ok" in result) {
        return result.ok;
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error getting all tables:", error);
      throw error;
    }
  }
}

export const tableManagementService = new TableManagementService();
