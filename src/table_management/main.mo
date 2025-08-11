import Types "./types";
import TrieMap "mo:base/TrieMap";
import Nat "mo:base/Nat";
import Hash "mo:base/Hash";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Principal "mo:base/Principal";
import Auth "canister:authentication";

actor TableManagement {
  type Table = Types.Table;
  type UserTables = Types.UserTables;
  type User = Auth.User;

  stable var tablesEntries : [(Nat, Table)] = [];
  stable var pendingRequestsEntries : [((Principal, Nat), Principal)] = [];
  stable var nextTableId : Nat = 1;

  // Helper function to check if array contains element
  func arrayContains<T>(arr : [T], elem : T, equal : (T, T) -> Bool) : Bool {
    switch (Array.find<T>(arr, func(x) = equal(x, elem))) {
      case (?_) true;
      case null false;
    }
  };
   // Initialize TrieMaps
  func hashTuple(t : (Principal, Nat)) : Hash.Hash {
    Principal.hash(t.0) ^ Hash.hash(t.1)
  };
  func equalTuple(a : (Principal, Nat), b : (Principal, Nat)) : Bool {
    a.0 == b.0 and a.1 == b.1
  };
  let tablesById = TrieMap.fromEntries<Nat, Table>(
    tablesEntries.vals(), Nat.equal, Hash.hash);
  let pendingJoinRequests = TrieMap.fromEntries<(Principal, Nat), Principal>(
    pendingRequestsEntries.vals(), equalTuple, hashTuple
  );

  // System functions for upgrades
  system func preupgrade() {
    tablesEntries := Iter.toArray(tablesById.entries());
    // pendingRequestsEntries := Iter.toArray(pendingJoinRequests.entries());
  };
  system func postupgrade() {
    tablesEntries := [];
    // pendingRequestsEntries := [];
  };

   // Create a new table
  public shared(msg) func create_table(title : Text, description : Text) : async ?Table {
    let caller = msg.caller;
    if (title == "") {
      return null;
    };
    switch (await Auth.get_user_by_principal(caller)) {
      case null null;
      case (?user) {
        let tableId = nextTableId;
        nextTableId += 1;
        let table : Table = {
          id = tableId;
          title = title;
          description = description;
          creator = caller;
          tableCollaborators = [caller];
        };
        tablesById.put(tableId, table);
        // Update user's tablesCreated
        ignore await Auth.update_user_add_table(caller, tableId, "tablesCreated");
        ?table
      }
    }
  };

  // Delete a table
  public shared(msg) func delete_table(tableId : Nat) : async Text {
    let caller = msg.caller;
    switch (await Auth.get_user_by_principal(caller)) {
      case null "User not found.";
      case (?user) {
        // Check if tableId is in caller's tablesCreated
        if (not arrayContains<Nat>(user.tablesCreated, tableId, Nat.equal)) {
          return "You did not create this table or table does not exist.";
        };
        let table = tablesById.get(tableId);
        switch (table) {
          case null "Table not found";
          case (?table) {
          // Remove tableId from tablesJoined of all users
            for (principal in table.tableCollaborators.vals()) {
              ignore await Auth.update_user_remove_table(principal, tableId, "tablesJoined");
            };
            // Remove tableId from caller's tablesCreated
            ignore await Auth.update_user_remove_table(caller, tableId, "tablesCreated");
            ignore tablesById.remove(tableId);

            // Clean up pending requests for this table
            let requestsToRemove = Array.mapFilter<((Principal, Nat), Principal), (Principal, Nat)>(
              Iter.toArray(pendingJoinRequests.entries()),
              func((key, _)) = if (key.1 == tableId) ?key else null
            );
            for (key in requestsToRemove.vals()) {
              ignore pendingJoinRequests.remove(key);
            };
            "Table deleted successfully."
          }
        }
      }
    }
  };

  public query func get_table(tableId : Nat) : async ?Table {
    tablesById.get(tableId)
  };

  // Get user's tables (created and joined) - FIXED: removed query, fixed record syntax
  public shared(msg) func get_user_tables() : async UserTables {
    switch (await Auth.get_user_by_principal(msg.caller)) {
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

  // Leave a table
  public shared(msg) func leave_table(tableId : Nat) : async Text {
    let caller = msg.caller;
    switch (await Auth.get_user_by_principal(caller)) {
      case null "User not found.";
      case (?user) {
        if (arrayContains<Nat>(user.tablesCreated, tableId, Nat.equal)) {
          return "You cannot leave a table you created.";
        };
        // Check if tableId is in caller's tablesJoined
        if (not arrayContains<Nat>(user.tablesJoined, tableId, Nat.equal)) {
          return "You have not joined this table.";
        };
        
        // Remove tableId from caller's tablesJoined
        ignore await Auth.update_user_remove_table(caller, tableId, "tablesJoined");

        // Remove caller's userId from the table's tableCollaborators
        switch (tablesById.get(tableId)) {
          case null "Table not found.";
          case (?table) {
            let updatedTable : Table = {
              id = table.id;
              title = table.title;
              creator = table.creator;
              description = table.description;
              tableCollaborators = Array.filter<Principal>(table.tableCollaborators, func (upcl) = upcl != user.principal);
            };
            tablesById.put(tableId, updatedTable);
            "Left the table successfully."
          }
        }
      }
    }
  };

  // Get users in a specific table
  public shared func get_table_users(tableId : Nat) : async [User] {
    switch (tablesById.get(tableId)) {
      case null [];
      case (?table) {
        var users: [User] = [];
        for (p in table.tableCollaborators.vals()) {
          let uOpt = await Auth.get_user_by_principal(p);
          switch (uOpt) {
            case (?u) { users := Array.append(users, [u]); };
            case null {};
          };
        };
        users
      }
    }
  };

   // Request to add a user to a table
  public shared(msg) func request_join_table(userPrincipal : Principal, tableId : Nat) : async Text {
    let caller = msg.caller;
    let creatorOpt = await Auth.get_user_by_principal(caller);
    let userOpt = await Auth.get_user_by_principal(userPrincipal);
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
        if (arrayContains<Principal>(table.tableCollaborators, userPrincipal, Principal.equal)) {
          return "User is already in this table.";
        };
        // Check if request already exists
        switch(pendingJoinRequests.get((userPrincipal, tableId))) {
          case null {
            pendingJoinRequests.put((userPrincipal, tableId), caller);
            "Join request sent successfully."
          };
          case (?requests) "Join request already exists.";
        };
        // Add pending request

      }
    }
  };

   // Accept a join request to a table
  public shared(msg) func accept_join_table(tableId : Nat) : async Text {
    let caller = msg.caller;

    switch (await Auth.get_user_by_principal(caller)) {
      case null "User not found.";
      case (?user) {
        let userPrincipal = user.principal;

        switch (pendingJoinRequests.get((userPrincipal, tableId))) {
          case null "No pending request found.";
          case (?inviter) {
            // Add user to table's tableCollaborators
            switch (tablesById.get(tableId)) {
              case null "Table not found.";
              case (?table) {
                if (arrayContains<Principal>(table.tableCollaborators, userPrincipal, Principal.equal)) {
                  return "Already joined this table.";
                };
                let updatedTable : Table = {
                  id = table.id;
                  title = table.title;
                  creator = table.creator;
                  description = table.description;
                  tableCollaborators = Array.append(table.tableCollaborators, [userPrincipal]);
                };
                tablesById.put(tableId, updatedTable);

                // Add tableId to user's tablesJoined
                ignore await Auth.update_user_add_table(caller, tableId, "tablesJoined");
                // Remove pending request
                ignore pendingJoinRequests.remove((userPrincipal, tableId));
                "Joined the table successfully."
              }
            }
          }
        }
      }
    }
  };

  // Cancel a join request
  public shared(msg) func cancel_join_request(userPrincipal : Principal, tableId : Nat) : async Text {
    let caller = msg.caller;
    switch (await Auth.get_user_by_principal(caller)) {
      case null "User not found.";
      case (?user) {
        // Check if caller created the table
        if (not arrayContains<Nat>(user.tablesCreated, tableId, Nat.equal)) {
          return "You did not create this table.";
        };
        switch (pendingJoinRequests.remove((userPrincipal, tableId))) {
          case null "No pending request found.";
          case (?_) "Join request cancelled."
        }
      }
    }
  };

  //Reject a join request
  public shared(msg) func reject_join_request(tableId : Nat) : async Text {
    let caller = msg.caller;
    switch (await Auth.get_user_by_principal(caller)) {
      case null "User not found";
      case (?user) {
        switch (pendingJoinRequests.remove((caller, tableId))) {
          case null "No pending request found.";
          case (?_) "Join request rejected."
        }
      }
    }
  };

  // Get pending sent requests for table created by caller
  public shared(msg) func get_pending_sent_requests(tableId : Nat) : async
  [Text] {
    let caller = msg.caller;
    switch (await Auth.get_user_by_principal(caller)) {
      case null [];
      case (?user) {
        //Check if caller created table
        if (arrayContains<Nat>(user.tablesCreated, tableId, Nat.equal)) {
          var requests : [Text] = [];
          let pendingRequests = Iter.toArray(pendingJoinRequests.entries());
          for (request in pendingRequests.vals()) {
            let ((recipient, tableIdAssociated), sender) = request;
            if (tableIdAssociated == tableId ) {
              switch (await Auth.get_user_by_principal(recipient)) {
                case (?recipUser) {
                  requests := Array.append(requests, [recipUser.username]);
                };
                case null {};
              };
            }
          };
          requests
        } else []
      }
    }
  };
  // Get all pending requests recieved by caller
  public shared(msg) func get_pending_recieved_requests() : async [Text] {
    let caller = msg.caller;
    switch (await Auth.get_user_by_principal(caller)) {
      case null [];
      case (?user) {
        var out: [Text] = [];
        let entries = Iter.toArray(pendingJoinRequests.entries()); // [((Principal,Nat), Principal)]
        for (((recipient, tableIdAssociated), sender) in entries.vals()) {
          if (recipient == caller) {
            switch (tablesById.get(tableIdAssociated)) {
              case null { };
              case (?table) { out := Array.append(out, [table.title]); };
            };
          };
        };
        out;
      }
    }
  };
  // Get all tables (for discovery) - can remain query since no caller needed
  public query func get_all_tables() : async [Table] {
    Iter.toArray(tablesById.vals())
  };
}
