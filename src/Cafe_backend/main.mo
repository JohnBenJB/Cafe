import TrieMap "mo:base/TrieMap";
import Principal "mo:base/Principal";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Hash "mo:base/Hash";
import Nat "mo:base/Nat";
import Option "mo:base/Option";

actor {
  // User record
  public type User = {
    id : Nat;
    username : Text;
    email : Text;
    github : Text;
    slack : Text;
    principal : Principal;
    tablesCreated : [Nat];
    tablesJoined : [Nat];
  };

  public type Table = {
    id : Nat;
    title : Text;
    seats : [Nat]; // List of user ids
  };

  // Helper type for join requests
  public type JoinRequest = {
    userId : Nat;
    tableId : Nat;
  };

  // Return type for user tables
  public type UserTables = {
    created: [Table]; 
    joined: [Table];
  };

  // State variables
  private stable var nextId : Nat = 1;
  private stable var nextTableId : Nat = 1;
  
  // Use stable arrays for upgrade persistence
  private stable var usersEntries : [(Principal, User)] = [];
  private stable var usersByIdEntries : [(Nat, User)] = [];
  private stable var tablesEntries : [(Nat, Table)] = [];
  private stable var pendingRequestsEntries : [((Nat, Nat), Principal)] = [];

  // Initialize TrieMaps
  private let usersByPrincipal = TrieMap.fromEntries<Principal, User>(
    usersEntries.vals(), Principal.equal, Principal.hash
  );
  
  private let usersById = TrieMap.fromEntries<Nat, User>(
    usersByIdEntries.vals(), Nat.equal, Hash.hash
  );
  
  private let tablesById = TrieMap.fromEntries<Nat, Table>(
    tablesEntries.vals(), Nat.equal, Hash.hash
  );
  
  // Custom hash function for tuple keys
  private func hashTuple(t : (Nat, Nat)) : Hash.Hash {
    Hash.hash(t.0) ^ Hash.hash(t.1)
  };
  
  private func equalTuple(a : (Nat, Nat), b : (Nat, Nat)) : Bool {
    a.0 == b.0 and a.1 == b.1
  };
  
  private let pendingJoinRequests = TrieMap.fromEntries<(Nat, Nat), Principal>(
    pendingRequestsEntries.vals(), equalTuple, hashTuple
  );

  // System functions for upgrades
  system func preupgrade() {
    usersEntries := Iter.toArray(usersByPrincipal.entries());
    usersByIdEntries := Iter.toArray(usersById.entries());
    tablesEntries := Iter.toArray(tablesById.entries());
    pendingRequestsEntries := Iter.toArray(pendingJoinRequests.entries());
  };

  system func postupgrade() {
    usersEntries := [];
    usersByIdEntries := [];
    tablesEntries := [];
    pendingRequestsEntries := [];
  };

  // Helper function to check if array contains element
  private func arrayContains<T>(arr : [T], elem : T, equal : (T, T) -> Bool) : Bool {
    switch (Array.find<T>(arr, func(x) = equal(x, elem))) {
      case (?_) true;
      case null false;
    }
  };

  // Register or update user profile with Internet Identity
  public shared(msg) func register_or_update(
    username : Text, 
    email : Text, 
    github : Text, 
    slack : Text
  ) : async Text {
    let caller = msg.caller;
    
    // Validate input
    if (username == "" or email == "") {
      return "Username and email are required.";
    };
    
    let existingUser = usersByPrincipal.get(caller);
    let userId = switch(existingUser) {
      case (?user) user.id;
      case null {
        let id = nextId;
        nextId += 1;
        id
      }
    };
    
    let user : User = {
      id = userId;
      username = username;
      email = email;
      github = github;
      slack = slack;
      principal = caller;
      tablesCreated = switch(existingUser) {
        case (?u) u.tablesCreated;
        case null [];
      };
      tablesJoined = switch(existingUser) {
        case (?u) u.tablesJoined;
        case null [];
      };
    };
    
    usersByPrincipal.put(caller, user);
    usersById.put(userId, user);
    "Profile registered/updated successfully."
  };

  // Get current user profile - FIXED: removed query since we need msg.caller
  public shared(msg) func get_profile() : async ?User {
    usersByPrincipal.get(msg.caller)
  };

  // Get all tables (for discovery) - can remain query since no caller needed
  public query func get_all_tables() : async [Table] {
    Iter.toArray(tablesById.vals())
  };

  // Get table by ID - can remain query since no caller needed
  public query func get_table(tableId : Nat) : async ?Table {
    tablesById.get(tableId)
  };

  // Get user's tables (created and joined) - FIXED: removed query, fixed record syntax
  public shared(msg) func get_user_tables() : async UserTables {
    switch (usersByPrincipal.get(msg.caller)) {
      case null { 
        { created = []; joined = [] }
      };
      case (?user) {
        let created = Array.mapFilter<Nat, Table>(
          user.tablesCreated, 
          func(id) = tablesById.get(id)
        );
        let joined = Array.mapFilter<Nat, Table>(
          user.tablesJoined, 
          func(id) = tablesById.get(id)
        );
        { created = created; joined = joined }
      }
    }
  };

  // Create a new table
  public shared(msg) func create_table(title : Text) : async ?Table {
    let caller = msg.caller;
    
    if (title == "") {
      return null;
    };
    
    switch (usersByPrincipal.get(caller)) {
      case null null;
      case (?user) {
        let tableId = nextTableId;
        nextTableId += 1;
        
        let table : Table = {
          id = tableId;
          title = title;
          seats = [user.id];
        };
        
        tablesById.put(tableId, table);
        
        // Update user's tablesCreated
        let updatedUser : User = {
          id = user.id;
          username = user.username;
          email = user.email;
          github = user.github;
          slack = user.slack;
          principal = user.principal;
          tablesCreated = Array.append(user.tablesCreated, [tableId]);
          tablesJoined = user.tablesJoined;
        };
        
        usersByPrincipal.put(caller, updatedUser);
        usersById.put(user.id, updatedUser);
        ?table
      }
    }
  };

  // Delete a table
  public shared(msg) func delete_table(tableId : Nat) : async Text {
    let caller = msg.caller;
    
    switch (usersByPrincipal.get(caller)) {
      case null "User not found.";
      case (?user) {
        // Check if tableId is in caller's tablesCreated
        if (not arrayContains<Nat>(user.tablesCreated, tableId, Nat.equal)) {
          return "You did not create this table or table does not exist.";
        };
        
        // Remove table from tablesById
        ignore tablesById.remove(tableId);
        
        // Remove tableId from tablesJoined of all users
        for ((principal, u) in usersByPrincipal.entries()) {
          if (arrayContains<Nat>(u.tablesJoined, tableId, Nat.equal)) {
            let updatedUser : User = {
              id = u.id;
              username = u.username;
              email = u.email;
              github = u.github;
              slack = u.slack;
              principal = u.principal;
              tablesCreated = u.tablesCreated;
              tablesJoined = Array.filter<Nat>(u.tablesJoined, func (id) = id != tableId);
            };
            usersByPrincipal.put(u.principal, updatedUser);
            usersById.put(u.id, updatedUser);
          }
        };
        
        // Remove tableId from caller's tablesCreated
        let updatedCaller : User = {
          id = user.id;
          username = user.username;
          email = user.email;
          github = user.github;
          slack = user.slack;
          principal = user.principal;
          tablesCreated = Array.filter<Nat>(user.tablesCreated, func (id) = id != tableId);
          tablesJoined = user.tablesJoined;
        };
        
        usersByPrincipal.put(caller, updatedCaller);
        usersById.put(user.id, updatedCaller);
        
        // Clean up pending requests for this table
        let requestsToRemove = Array.mapFilter<((Nat, Nat), Principal), (Nat, Nat)>(
          Iter.toArray(pendingJoinRequests.entries()),
          func((key, _)) = if (key.1 == tableId) ?key else null
        );
        
        for (key in requestsToRemove.vals()) {
          ignore pendingJoinRequests.remove(key);
        };
        
        "Table deleted successfully."
      }
    }
  };

  // Leave a table
  public shared(msg) func leave_table(tableId : Nat) : async Text {
    let caller = msg.caller;
    
    switch (usersByPrincipal.get(caller)) {
      case null "User not found.";
      case (?user) {
        // Check if tableId is in caller's tablesJoined
        if (not arrayContains<Nat>(user.tablesJoined, tableId, Nat.equal)) {
          return "You have not joined this table.";
        };
        
        // Remove tableId from caller's tablesJoined
        let updatedUser : User = {
          id = user.id;
          username = user.username;
          email = user.email;
          github = user.github;
          slack = user.slack;
          principal = user.principal;
          tablesCreated = user.tablesCreated;
          tablesJoined = Array.filter<Nat>(user.tablesJoined, func (id) = id != tableId);
        };
        
        usersByPrincipal.put(caller, updatedUser);
        usersById.put(user.id, updatedUser);
        
        // Remove caller's userId from the table's seats
        switch (tablesById.get(tableId)) {
          case null "Table not found.";
          case (?table) {
            let updatedTable : Table = {
              id = table.id;
              title = table.title;
              seats = Array.filter<Nat>(table.seats, func (uid) = uid != user.id);
            };
            tablesById.put(tableId, updatedTable);
            "Left the table successfully."
          }
        }
      }
    }
  };

  // Request to add a user to a table
  public shared(msg) func request_join_table(userId : Nat, tableId : Nat) : async Text {
    let caller = msg.caller;
    
    let creatorOpt = usersByPrincipal.get(caller);
    let userOpt = usersById.get(userId);
    let tableOpt = tablesById.get(tableId);
    
    switch (creatorOpt, userOpt, tableOpt) {
      case (null, _, _) "Caller not found.";
      case (_, null, _) "User not found.";
      case (_, _, null) "Table not found.";
      case (?creator, ?user, ?table) {
        if (not arrayContains<Nat>(creator.tablesCreated, tableId, Nat.equal)) {
          return "You did not create this table.";
        };
        
        // Check if user is already in the table
        if (arrayContains<Nat>(table.seats, userId, Nat.equal)) {
          return "User is already in this table.";
        };
        
        // Check if request already exists
        if (Option.isSome(pendingJoinRequests.get((userId, tableId)))) {
          return "Join request already exists.";
        };
        
        // Add pending request
        pendingJoinRequests.put((userId, tableId), caller);
        "Join request sent successfully."
      }
    }
  };

  // Accept a join request to a table
  public shared(msg) func accept_join_table(tableId : Nat) : async Text {
    let caller = msg.caller;
    
    switch (usersByPrincipal.get(caller)) {
      case null "User not found.";
      case (?user) {
        let userId = user.id;
        
        switch (pendingJoinRequests.get((userId, tableId))) {
          case null "No pending request found.";
          case (?inviter) {
            // Add user to table's seats
            switch (tablesById.get(tableId)) {
              case null "Table not found.";
              case (?table) {
                if (arrayContains<Nat>(table.seats, userId, Nat.equal)) {
                  return "Already joined this table.";
                };
                
                let updatedTable : Table = {
                  id = table.id;
                  title = table.title;
                  seats = Array.append(table.seats, [userId]);
                };
                tablesById.put(tableId, updatedTable);
                
                // Add tableId to user's tablesJoined
                let updatedUser : User = {
                  id = user.id;
                  username = user.username;
                  email = user.email;
                  github = user.github;
                  slack = user.slack;
                  principal = user.principal;
                  tablesCreated = user.tablesCreated;
                  tablesJoined = Array.append(user.tablesJoined, [tableId]);
                };
                
                usersByPrincipal.put(caller, updatedUser);
                usersById.put(userId, updatedUser);
                
                // Remove pending request
                ignore pendingJoinRequests.remove((userId, tableId));
                "Joined the table successfully."
              }
            }
          }
        }
      }
    }
  };

  // Reject a join request
  public shared(msg) func reject_join_request(userId : Nat, tableId : Nat) : async Text {
    let caller = msg.caller;
    
    switch (usersByPrincipal.get(caller)) {
      case null "User not found.";
      case (?user) {
        // Check if caller created the table
        if (not arrayContains<Nat>(user.tablesCreated, tableId, Nat.equal)) {
          return "You did not create this table.";
        };
        
        switch (pendingJoinRequests.remove((userId, tableId))) {
          case null "No pending request found.";
          case (?_) "Join request rejected."
        }
      }
    }
  };

  // Get pending join requests for tables created by caller - FIXED: removed query
  public shared(msg) func get_pending_requests() : async [(Nat, Nat, Text)] {
    let caller = msg.caller;
    
    switch (usersByPrincipal.get(caller)) {
      case null [];
      case (?user) {
        let requests = Array.mapFilter<((Nat, Nat), Principal), (Nat, Nat, Text)>(
          Iter.toArray(pendingJoinRequests.entries()),
          func((key, requester)) {
            let (userId, tableId) = key;
            if (arrayContains<Nat>(user.tablesCreated, tableId, Nat.equal)) {
              switch (usersById.get(userId)) {
                case (?requestingUser) ?(userId, tableId, requestingUser.username);
                case null null
              }
            } else null
          }
        );
        requests
      }
    }
  };

  // Additional helper functions for better user experience

  // Get all users (for discovery and invitations)
  public query func get_all_users() : async [User] {
    Iter.toArray(usersById.vals())
  };

  // Get user by ID
  public query func get_user_by_id(userId : Nat) : async ?User {
    usersById.get(userId)
  };

  // Get users in a specific table
  public query func get_table_users(tableId : Nat) : async [User] {
    switch (tablesById.get(tableId)) {
      case null [];
      case (?table) {
        Array.mapFilter<Nat, User>(
          table.seats,
          func(userId) = usersById.get(userId)
        )
      }
    }
  };
}
