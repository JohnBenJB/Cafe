import Time "mo:base/Time";
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import Array "mo:base/Array";
import Int "mo:base/Int";


import Types "./types";

shared actor class Authentication() = {
  // Stable variables for data persistence across upgrades
  stable var usersEntries : [(Text, Types.User)] = [];
  stable var userCount : Nat = 0;
  stable var lastUpgradeTime : Int = 0;
  stable var sessionsEntries : [(Text, Types.Session)] = [];

  // In-memory storage
  private var users = HashMap.HashMap<Text, Types.User>(0, Text.equal, Text.hash);
  private var sessions = HashMap.HashMap<Text, Types.Session>(0, Text.equal, Text.hash);

  // System functions for upgrades
  system func preupgrade() {
    usersEntries := Iter.toArray(users.entries());
    sessionsEntries := Iter.toArray(sessions.entries());
    lastUpgradeTime := Time.now();
    Debug.print("Pre-upgrade: Saved " # Nat.toText(usersEntries.size()) # " users and " # Nat.toText(sessionsEntries.size()) # " sessions");
  };

  system func postupgrade() {
    users := HashMap.HashMap<Text, Types.User>(0, Text.equal, Text.hash);
    for ((principal, user) in usersEntries.vals()) {
      users.put(principal, user);
    };
    sessions := HashMap.HashMap<Text, Types.Session>(0, Text.equal, Text.hash);
    for ((sid, session) in sessionsEntries.vals()) {
      sessions.put(sid, session);
    };
    Debug.print("Post-upgrade: Restored " # Nat.toText(users.size()) # " users and " # Nat.toText(sessions.size()) # " sessions");
  };

  // ===== SESSION MANAGEMENT =====

  // Create a new session for a principal
  public shared func create_session(principal: Text) : async Types.SessionResult {
    let now = Time.now();
    let expires = now + 60 * 60 * 1_000_000_000; // 1 hour in nanoseconds
    let sessionId = Text.concat(principal, Int.toText(now));
    let session: Types.Session = {
      sessionId = sessionId;
      principal = principal;
      createdAt = now;
      expiresAt = expires;
    };
    sessions.put(sessionId, session);
    return {
      success = true;
      message = ?"Session created";
      session = ?session;
    };
  };

  // Validate a session by sessionId
  public shared query func validate_session(sessionId: Text) : async Types.SessionResult {
    switch (sessions.get(sessionId)) {
      case (?session) {
        if (Time.now() < session.expiresAt) {
          return { success = true; message = ?"Valid session"; session = ?session };
        } else {
          sessions.delete(sessionId);
          return { success = false; message = ?"Session expired"; session = null };
        }
      };
      case null {
        return { success = false; message = ?"Session not found"; session = null };
      }
    }
  };

  // Logout (delete session)
  public shared func logout(sessionId: Text) : async Types.SessionResult {
    let existed = sessions.remove(sessionId);
    return {
      success = existed != null;
      message = if (existed != null) ?"Logged out" else ?"Session not found";
      session = null;
    };
  };

  // Get or create user profile
  public shared query func get_profile(principal : Text) : async Types.AuthResult {
    switch (users.get(principal)) {
      case (?user) {
        {
          success = true;
          message = ?"Profile found";
          user = ?user;
        }
      };
      case (null) {
        {
          success = false;
          message = ?"Profile not found";
          user = null;
        }
      };
    }
  };

  // Register or update user profile
  public shared func register_or_update(principal : Text, profileData : Types.ProfileUpdateRequest) : async Types.AuthResult {
    try {
      let existingUser = users.get(principal);
      
      let newUser : Types.User = {
        principal = principal;
        username = profileData.username;
        email = profileData.email;
        github = profileData.github;
        slack = profileData.slack;
        tablesCreated = switch (existingUser) {
          case (?user) { user.tablesCreated };
          case (null) { [] };
        };
        tablesJoined = switch (existingUser) {
          case (?user) { user.tablesJoined };
          case (null) { [] };
        };
        identityProvider = switch (existingUser) {
          case (?user) { user.identityProvider };
          case (null) { "internet_identity" };
        };
        lastLogin = Time.now();
        isVerified = switch (existingUser) {
          case (?user) { user.isVerified };
          case (null) { true };
        };
        hasCompletedSetup = true; // Mark as completed when profile is updated
      };

      users.put(principal, newUser);
      
      // Increment user count only for new users
      if (existingUser == null) {
        userCount += 1;
        Debug.print("New user registered: " # principal # " (Total users: " # Nat.toText(userCount) # ")");
      } else {
        Debug.print("User profile updated: " # principal);
      };

      {
        success = true;
        message = ?"Profile updated successfully";
        user = ?newUser;
      }
    } catch (error) {
      {
        success = false;
        message = ?("Error updating profile: " # Error.message(error));
        user = null;
      }
    }
  };

  // Mark user as having completed profile setup
  public shared func mark_profile_completed(principal : Text) : async Types.AuthResult {
    switch (users.get(principal)) {
      case (?user) {
        let updatedUser : Types.User = {
          principal = user.principal;
          username = user.username;
          email = user.email;
          github = user.github;
          slack = user.slack;
          tablesCreated = user.tablesCreated;
          tablesJoined = user.tablesJoined;
          identityProvider = user.identityProvider;
          lastLogin = Time.now();
          isVerified = user.isVerified;
          hasCompletedSetup = true;
        };
        
        users.put(principal, updatedUser);
        Debug.print("Profile marked as completed for: " # principal);
        
        {
          success = true;
          message = ?"Profile marked as completed";
          user = ?updatedUser;
        }
      };
      case (null) {
        {
          success = false;
          message = ?"User not found";
          user = null;
        }
      };
    }
  };

  // Check if user has completed profile setup
  public shared query func has_completed_setup(principal : Text) : async Bool {
    switch (users.get(principal)) {
      case (?user) { user.hasCompletedSetup };
      case (null) { false };
    }
  };

  // Get all users
  public shared query func get_all_users() : async [Types.User] {
    Iter.toArray(users.vals())
  };

  // Get user by principal
  public shared query func get_user_by_principal(principal : Text) : async Types.AuthResult {
    switch (users.get(principal)) {
      case (?user) {
        {
          success = true;
          message = ?"User found";
          user = ?user;
        }
      };
      case (null) {
        {
          success = false;
          message = ?"User not found";
          user = null;
        }
      };
    }
  };

  // Update user's table access
  public shared func update_user_add_table(principal : Text, tableId : Nat) : async Types.AuthResult {
    switch (users.get(principal)) {
      case (?user) {
        let updatedUser : Types.User = {
          principal = user.principal;
          username = user.username;
          email = user.email;
          github = user.github;
          slack = user.slack;
          tablesCreated = user.tablesCreated;
          tablesJoined = Array.append(user.tablesJoined, [tableId]);
          identityProvider = user.identityProvider;
          lastLogin = Time.now();
          isVerified = user.isVerified;
          hasCompletedSetup = user.hasCompletedSetup;
        };
        
        users.put(principal, updatedUser);
        
        {
          success = true;
          message = ?"Table access added";
          user = ?updatedUser;
        }
      };
      case (null) {
        {
          success = false;
          message = ?"User not found";
          user = null;
        }
      };
    }
  };

  // Remove user's table access
  public shared func update_user_remove_table(principal : Text, tableId : Nat) : async Types.AuthResult {
    switch (users.get(principal)) {
      case (?user) {
        let filteredTables = Array.filter(user.tablesJoined, func(id : Nat) : Bool { id != tableId });
        
        let updatedUser : Types.User = {
          principal = user.principal;
          username = user.username;
          email = user.email;
          github = user.github;
          slack = user.slack;
          tablesCreated = user.tablesCreated;
          tablesJoined = filteredTables;
          identityProvider = user.identityProvider;
          lastLogin = Time.now();
          isVerified = user.isVerified;
          hasCompletedSetup = user.hasCompletedSetup;
        };
        
        users.put(principal, updatedUser);
        
        {
          success = true;
          message = ?"Table access removed";
          user = ?updatedUser;
        }
      };
      case (null) {
        {
          success = false;
          message = ?"User not found";
          user = null;
        }
      };
    }
  };

  // Delete user
  public shared func delete_user(principal : Text) : async Types.AuthResult {
    switch (users.get(principal)) {
      case (?user) {
        users.delete(principal);
        userCount := if (userCount > 0) { userCount - 1 } else { 0 };
        Debug.print("User deleted: " # principal # " (Total users: " # Nat.toText(userCount) # ")");
        
        {
          success = true;
          message = ?"User deleted successfully";
          user = ?user;
        }
      };
      case (null) {
        {
          success = false;
          message = ?"User not found";
          user = null;
        }
      };
    }
  };

  // Get system statistics
  public shared query func get_system_stats() : async {
    totalUsers : Nat;
    lastUpgrade : Int;
  } {
    {
      totalUsers = userCount;
      lastUpgrade = lastUpgradeTime;
    }
  };

  // Bulk operations for admin/backup purposes
  public shared func bulk_update_users(userUpdates : [(Text, Types.User)]) : async Types.AuthResult {
    try {
      for ((principal, user) in userUpdates.vals()) {
        users.put(principal, user);
      };
      
      {
        success = true;
        message = ?("Bulk updated " # Nat.toText(userUpdates.size()) # " users");
        user = null;
      }
    } catch (error) {
      {
        success = false;
        message = ?("Bulk update failed: " # Error.message(error));
        user = null;
      }
    }
  };

  // Export all users for backup
  public shared query func export_all_users() : async [(Text, Types.User)] {
    Iter.toArray(users.entries())
  };

  // Import users from backup
  public shared func import_users(userData : [(Text, Types.User)]) : async Types.AuthResult {
    try {
      for ((principal, user) in userData.vals()) {
        users.put(principal, user);
      };
      
      userCount := users.size();
      
      {
        success = true;
        message = ?("Imported " # Nat.toText(userData.size()) # " users");
        user = null;
      }
    } catch (error) {
      {
        success = false;
        message = ?("Import failed: " # Error.message(error));
        user = null;
      }
    }
  };
};
