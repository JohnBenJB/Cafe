import Types "./types";
import TrieMap "mo:base/TrieMap";
import Nat "mo:base/Nat";
import Hash "mo:base/Hash";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Principal "mo:base/Principal";
import Auth "canister:authentication";
import Result "mo:base/Result";

actor table_management {
  type Table = Types.Table;
  type UserTables = Types.UserTables;
  type User = Auth.User;
  type Result<T, E> = Result.Result<T, E>;

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
  public shared(msg) func create_table(title : Text, description : Text) : async Result<Table, Text> {
    let caller = msg.caller;
    if (title == "") {
      return #err("Table title required");
    };
    if (description == "") {
      return #err("Table description required");
    };
    // changed: auth uses Text principal and returns AuthResult
    let authRes = await Auth.get_user_by_principal(Principal.toText(caller));
    switch (authRes.user) {
      case null { #err("Principal not a registered user") };
      case (?_user) {
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
        // changed: update auth joined list for creator
        ignore await Auth.update_user_add_table(Principal.toText(caller), tableId);
        #ok(table)
      }
    }
  };

  // Delete a table
  public shared(msg) func delete_table(tableId : Nat) : async Result<Table, Text> {
    let caller = msg.caller;
    // changed: use AuthResult and Text principal
    let authRes = await Auth.get_user_by_principal(Principal.toText(caller));
    switch (authRes.user) {
      case null #err("Principal not a registered user");
      case (?_user) {
        let table = tablesById.get(tableId);
        switch (table) {
          case null #err("Table does not exist");
          case (?table) {
            // changed: only creator can delete
            if (table.creator != caller) {
              return #err("Unauthorized");
            };
            // Remove tableId from tablesJoined of all users
            for (principal in table.tableCollaborators.vals()) {
              ignore await Auth.update_user_remove_table(Principal.toText(principal), tableId);
            };
            // Remove table
            ignore tablesById.remove(tableId);

            // Clean up pending requests for this table
            let requestsToRemove = Array.mapFilter<((Principal, Nat), Principal), (Principal, Nat)>(
              Iter.toArray(pendingJoinRequests.entries()),
              func((key, _)) = if (key.1 == tableId) ?key else null
            );
            for (key in requestsToRemove.vals()) {
              ignore pendingJoinRequests.remove(key);
            };
            #ok(table)
          }
        }
      }
    }
  };

  public query func get_table(tableId : Nat) : async ?Table {
    tablesById.get(tableId)
  };

  // Get user's tables (created and joined) - compute from table data
  public shared(msg) func get_user_tables() : async Result<UserTables, Text> {
    let caller = msg.caller;
    let authRes = await Auth.get_user_by_principal(Principal.toText(caller));
    switch (authRes.user) {
      case null {
        #err("Principal not a registered user")
      };
      case (?_user) {
        let allTables = Iter.toArray(tablesById.vals());
        let created = Array.filter<Table>(allTables, func(t) = t.creator == caller);
        let joined = Array.filter<Table>(allTables, func(t) = arrayContains<Principal>(t.tableCollaborators, caller, Principal.equal));
        #ok({ created = created; joined = joined })
      }
    }
  };

  // Leave a table
  public shared(msg) func leave_table(tableId : Nat) : async Result<[Nat], Text> {
    let caller = msg.caller;
    // changed: use AuthResult and Text principal
    let authRes = await Auth.get_user_by_principal(Principal.toText(caller));
    switch (authRes.user) {
      case null #err("Principal not a registered user");
      case (?user) {
        switch (tablesById.get(tableId)) {
          case null #err("Table does not exist");
          case (?table) {
            // changed: cannot leave if creator
            if (table.creator == caller) {
              return #err("User cannot leave owned table");
            };
            // Check if caller is a collaborator
            if (not arrayContains<Principal>(table.tableCollaborators, caller, Principal.equal)) {
              return #err("User not a table collaborator");
            };

            // Remove caller from the table's collaborators (Principal vs Text fixed)
            let updatedTable : Table = {
              id = table.id;
              title = table.title;
              creator = table.creator;
              description = table.description;
              tableCollaborators = Array.filter<Principal>(table.tableCollaborators, func (p) = p != caller);
            };
            tablesById.put(tableId, updatedTable);
            // changed: update auth profile joined list
            ignore await Auth.update_user_remove_table(Principal.toText(caller), tableId);
            #ok(user.tablesJoined)
          }
        }
      }
    }
  };

  // Get collaborators in a specific table
  public shared func get_table_collaborators(tableId : Nat) : async Result<[User], Text> {
    switch (tablesById.get(tableId)) {
      case null #err("Table does not exist");
      case (?table) {
        var collaborators: [User] = [];
        for (p in table.tableCollaborators.vals()) {
          // changed: Auth expects Text and returns AuthResult
          let uRes = await Auth.get_user_by_principal(Principal.toText(p));
          switch (uRes.user) {
            case (?u) { collaborators := Array.append(collaborators, [u]); };
            case null {};
          };
        };
        #ok(collaborators)
      }
    }
  };

   // Request to add a user to a table
  public shared(msg) func request_join_table(userPrincipal : Principal, tableId : Nat) : async Result<Text, Text> {
    let caller = msg.caller;
    // changed: validate both users exist via AuthResult
    let creatorRes = await Auth.get_user_by_principal(Principal.toText(caller));
    if (creatorRes.user == null) { return #err("Principal not a registered user"); };

    let userRes = await Auth.get_user_by_principal(Principal.toText(userPrincipal));
    if (userRes.user == null) { return #err("Recipient not a registered user"); };

    let tableOpt = tablesById.get(tableId);
    switch (tableOpt) {
      case null { #err("Table does not exist") };
      case (?table) {
        // changed: only creator can invite
        if (table.creator != caller) {
          return #err("Unauthorized");
        };
        // Check if user is already in the table
        if (arrayContains<Principal>(table.tableCollaborators, userPrincipal, Principal.equal)) {
          return #err("Recipient already a collaborator");
        };
        // Check if request already exists
        switch(pendingJoinRequests.get((userPrincipal, tableId))) {
          case null {
            pendingJoinRequests.put((userPrincipal, tableId), caller);
            #ok("Join request sent successfully.")
          };
          case (?_) #err("Join request already exists.");
        };
      }
    }
  };

   // Accept a join request to a table
  public shared(msg) func accept_join_table(tableId : Nat) : async Result<[Nat], Text> {
    let caller = msg.caller;

    // changed: use AuthResult
    let authRes = await Auth.get_user_by_principal(Principal.toText(caller));
    switch (authRes.user) {
      case null #err("Principal not a registered user");
      case (?user) {
        let userPrincipal = caller;
        switch (pendingJoinRequests.get((userPrincipal, tableId))) {
          case null #err("No request to accept");
          case (?_inviter) {
            // Add user to table's tableCollaborators
            switch (tablesById.get(tableId)) {
              case null #err("Table does not exist.");
              case (?table) {
                if (arrayContains<Principal>(table.tableCollaborators, userPrincipal, Principal.equal)) {
                  return #err("User already a collaborator");
                };
                let updatedTable : Table = {
                  id = table.id;
                  title = table.title;
                  creator = table.creator;
                  description = table.description;
                  tableCollaborators = Array.append(table.tableCollaborators, [userPrincipal]);
                };
                tablesById.put(tableId, updatedTable);

                // changed: update auth joined list
                ignore await Auth.update_user_add_table(Principal.toText(caller), tableId);
                // Remove pending request
                ignore pendingJoinRequests.remove((userPrincipal, tableId));
                #ok(user.tablesJoined)
              }
            }
          }
        }
      }
    }
  };

  // Cancel a join request (by table creator)
  public shared(msg) func cancel_join_request(userPrincipal : Principal, tableId : Nat) : async Result<Text, Text> {
    let caller = msg.caller;
    switch (tablesById.get(tableId)) {
      case null #err("Table does not exist.");
      case (?table) {
        if (table.creator != caller) {
          return #err("Unauthorized");
        };
        switch (pendingJoinRequests.remove((userPrincipal, tableId))) {
          case null #err("Pending request does not exist.");
          case (?_) #ok("Join request cancelled.")
        }
      }
    }
  };

  //Reject a join request (by recipient)
  public shared(msg) func reject_join_request(tableId : Nat) : async Result<Text, Text> {
    let caller = msg.caller;
    switch (pendingJoinRequests.remove((caller, tableId))) {
      case null #err("Pending request does not exist.");
      case (?_) #ok("Join request rejected.")
    }
  };

  // Get pending sent requests for table created by caller
  public shared(msg) func get_pending_sent_requests(tableId : Nat) : async Result<[Text], Text> {
    let caller = msg.caller;
    switch (tablesById.get(tableId)) {
      case null #err("Table does not exist");
      case (?table) {
        if (table.creator != caller) {
          return #err("Unauthorized");
        };
        var requests : [Text] = [];
        let pendingRequests = Iter.toArray(pendingJoinRequests.entries());
        for (request in pendingRequests.vals()) {
          let ((recipient, tableIdAssociated), _sender) = request;
          if (tableIdAssociated == tableId ) {
            let recipRes = await Auth.get_user_by_principal(Principal.toText(recipient));
            switch (recipRes.user) {
              case (?recipUser) {
                requests := Array.append(requests, [recipUser.username]);
              };
              case null {};
            };
          }
        };
        #ok(requests)
      }
    }
  };
  // Get all pending requests recieved by caller
  public shared(msg) func get_pending_recieved_requests() : async Result<[Nat], Text> {
    let caller = msg.caller;
    // changed: use AuthResult
    let authRes = await Auth.get_user_by_principal(Principal.toText(caller));
    switch (authRes.user) {
      case null #err("Principal not a registered user");
      case (?_user) {
        var out: [Nat] = [];
        let entries = Iter.toArray(pendingJoinRequests.entries()); // [((Principal,Nat), Principal)]
        for (((recipient, tableIdAssociated), _sender) in entries.vals()) {
          if (recipient == caller) {
            switch (tablesById.get(tableIdAssociated)) {
              case null { };
              case (?table) { out := Array.append(out, [table.id]); };
            };
          };
        };
        #ok(out);
      }
    }
  };
  // Get all tables (for discovery) - can remain query since no caller needed
  public query func get_all_tables() : async Result<[Table], Text> {
    let allTables = Iter.toArray(tablesById.vals());

    if (allTables.size() == 0) {
      return #err("No tables found.");
    };

    // Return success with the array of tables
    return #ok(allTables);
  };
}
