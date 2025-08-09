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
  public shared(msg) func create_table(title : Text) : async ?Table {
    let caller = msg.caller;
    if (title == "") {
      return null;
    };
    switch (await Auth.get_profile()) {
      case null null;
      case (?user) {
        let tableId = nextTableId;
        nextTableId += 1;
        let table : Table = {
          id = tableId;
          title = title;
          creator = caller;
          tableCollaborators = [caller];
        };
        tablesById.put(tableId, table);
        // Update user's tablesCreated
        await Auth.update_user_add_table(caller, tableId, "tablesCreated");
        ?table
      }
    }
  };

  // Delete a table
  public shared(msg) func delete_table(tableId : Nat) : async Text {
    let caller = msg.caller;
    switch (await Auth.get_profile()) {
      case null "User not found.";
      case (?user) {
        // Check if tableId is in caller's tablesCreated
        if (not arrayContains<Nat>(user.tablesCreated, tableId, Nat.equal)) {
          return "You did not create this table or table does not exist.";
        };
        let table = tablesById.get(tableId);
        // Remove tableId from tablesJoined of all users
        for (principal in table.tableCollaborators) {
          await Auth.update_user_remove_table(principal, tableId, "tablesJoined");
        };
        // Remove tableId from caller's tablesCreated
        await Auth.update_user_remove_table(caller, tableId, "tablesCreated");
        ignore tablesById.remove(tableId);
        
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

  public query func get_table(tableId : Nat) : async ?Table {
    tablesById.get(tableId)
  };

  // Get user's tables (created and joined) - FIXED: removed query, fixed record syntax
  public shared(msg) func get_user_tables() : async UserTables {
    switch (await Auth.get_profile()) {
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
    switch (await Auth.get_profile()) {
      case null "User not found.";
      case (?user) {
        // Check if tableId is in caller's tablesJoined
        if (not arrayContains<Nat>(user.tablesJoined, tableId, Nat.equal)) {
          return "You have not joined this table.";
        };
        // Remove tableId from caller's tablesJoined
        await Auth.update_user_remove_table(caller, tableId, "tablesjoined");

        // Remove caller's userId from the table's tableCollaborators
        switch (tablesById.get(tableId)) {
          case null "Table not found.";
          case (?table) {
            let updatedTable : Table = {
              id = table.id;
              title = table.title;
              creator = table.creator;
              tableCollaborators = Array.filter<Nat>(table.tableCollaborators, func (uid) = uid != user.id);
            };
            tablesById.put(tableId, updatedTable);
            "Left the table successfully."
          }
        }
      }
    }
  };

  // Get users in a specific table
  public query func get_table_users(tableId : Nat) : async [User] {
    switch (tablesById.get(tableId)) {
      case null [];
      case (?table) {
        Array.mapFilter<Nat, User>(
          table.tableCollaborators,
          func(userPrincipal) = await Auth.get_user_by_principal(userPrincipal)
        )
      }
    }
  };

   // Request to add a user to a table
  public shared(msg) func request_join_table(userPrincipal : Principal, tableId : Nat) : async Text {
    let caller = msg.caller;
    let creatorOpt = await Auth.get_profile();
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
        if (arrayContains<Nat>(table.tableCollaborators, userPrincipal, Nat.equal)) {
          return "User is already in this table.";
        };
        // Check if request already exists
        if (Option.isSome(pendingJoinRequests.get((userPrincipal, tableId)))) {
          return "Join request already exists.";
        };
        // Add pending request
        pendingJoinRequests.put((userPrincipal, tableId), caller);
        "Join request sent successfully."
      }
    }
  };

   // Accept a join request to a table
  public shared(msg) func accept_join_table(tableId : Nat) : async Text {
    let caller = msg.caller;

    switch (await Auth.get_profile()) {
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
                if (arrayContains<Nat>(table.tableCollaborators, userPrincipal, Nat.equal)) {
                  return "Already joined this table.";
                };
                let updatedTable : Table = {
                  id = table.id;
                  title = table.title;
                  creator = table.creator;
                  tableCollaborators = Array.append(table.tableCollaborators, [userPrincipal]);
                };
                tablesById.put(tableId, updatedTable);

                // Add tableId to user's tablesJoined
                await Auth.update_user_add_table(caller, tableId, "tablesJoined");
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
  public shared(msg) func cancel_join_request(userPrincipal : Nat, tableId : Nat) : async Text {
    let caller = msg.caller;
    switch (await Auth.get_profile()) {
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
  public shared(msg) func reject_join_request(tableId : Nat) {
    let caller = msg.caller;
    switch (await Auth.get_profile()) {
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
  public shared(msg) func get_pending_sent_requests(tableId : Nat) : async [(Nat, Nat, Text)] {
    let caller = msg.caller;
    switch (await Auth.get_profile()) {
      case null [];
      case (?user) {
        //Check if caller created table
        if (arrayContains<Nat>(user.tablesCreated, tableId, Nat.equal)) {
          let requests = Array.mapFilter<((Principal, Nat), Principal), Text>(
            Iter.toArray(pendingJoinRequests.entries()),
            func(((recipient, tableIdAssociated), sender)) {
              if (tableIdAssociated == tableId ) {
                //Check is recipient user exists...may be unnecessary since cleanup is done after user deleted
                switch (usersByPrincipal.get(recipient)) {
                  case (?recipient_user) ?recipient_user.username;
                  case null null;
                }
              }
              else null
            }
          )
        } else []
        requests
      }
    }
  };
  // Get all pending requests recieved by caller
  public shared(msg) func get_pending_recieved_requests() : async [(Nat, Nat, Text)] {
    let caller = msg.caller;
    switch (await Auth.get_profile()) {
      case null [];
      case (?user) {
        let requests = Array.mapFilter<((Principal, Nat), Principal), Text>(
          Iter.toArray(pendingJoinRequests.entries()),
          func(((recipient, tableIdAssociated), sender)) {
            if (recipient == caller) {
              let table = tablesById.get(tableIdAssociated);
              table.title
            }
            else null
          }
        );
        requests
      }
    }
  };
  // Get all tables (for discovery) - can remain query since no caller needed
  public query func get_all_tables() : async [Table] {
    Iter.toArray(tablesById.vals())
  };
}
