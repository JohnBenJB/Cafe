import TrieMap "mo:base/TrieMap";
import Principal "mo:base/Principal";
import Iter "mo:base/Iter";

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

  let usersByPrincipal = TrieMap.TrieMap<Principal, User>(Principal.equal, Principal.hash);
  let usersById = TrieMap.TrieMap<Nat, User>(func (a, b) = a == b, func x = x);
  var nextId : Nat = 1;
  let tablesById = TrieMap.TrieMap<Nat, Table>(func (a, b) = a == b, func x = x);
  var nextTableId : Nat = 1;
  let pendingJoinRequests = TrieMap.TrieMap<(Nat, Nat), Principal>(func (a, b) = a == b, func x = x.0 ^ x.1);

  // Register or update user profile with Internet Identity
  public func register_or_update(username : Text, email : Text, github : Text, slack : Text) : async Text {
    let caller = msg.caller;
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
      tablesCreated = [];
      tablesJoined = [];
    };
    usersByPrincipal.put(caller, user);
    usersById.put(userId, user);
    return "Profile registered/updated.";
  };

  // Get current user profile
  public query func get_profile() : async ?User {
    usersByPrincipal.get(msg.caller)
  };

  // Create a new table
  public func create_table(title : Text) : async ?Table {
    let caller = msg.caller;
    let userOpt = usersByPrincipal.get(caller);
    switch (userOpt) {
      case null return null;
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
        return ?table;
      }
    }
  }

  // Delete a table
  public func delete_table(tableId : Nat) : async Text {
    let caller = msg.caller;
    let userOpt = usersByPrincipal.get(caller);
    switch (userOpt) {
      case null return "User not found.";
      case (?user) {
        // Check if tableId is in caller's tablesCreated
        if (!Array.find<Nat>(user.tablesCreated, func (id) = id == tableId)) {
          return "You did not create this table or table does not exist.";
        };
        // Remove table from tablesById
        ignore tablesById.remove(tableId);
        // Remove tableId from tablesJoined of all users
        for ((_, u) in usersByPrincipal.entries()) {
          if (Array.find<Nat>(u.tablesJoined, func (id) = id == tableId)) {
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
        return "Table deleted.";
      }
    }
  }

  // Leave a table
  public func leave_table(tableId : Nat) : async Text {
    let caller = msg.caller;
    let userOpt = usersByPrincipal.get(caller);
    switch (userOpt) {
      case null return "User not found.";
      case (?user) {
        // Check if tableId is in caller's tablesJoined
        if (!Array.find<Nat>(user.tablesJoined, func (id) = id == tableId)) {
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
        let tableOpt = tablesById.get(tableId);
        switch (tableOpt) {
          case null return "Table not found.";
          case (?table) {
            let updatedTable : Table = {
              id = table.id;
              title = table.title;
              seats = Array.filter<Nat>(table.seats, func (uid) = uid != user.id);
            };
            tablesById.put(tableId, updatedTable);
            return "Left the table.";
          }
        }
      }
    }
  }

  // Request to add a user to a table
  public func request_join_table(userId : Nat, tableId : Nat) : async Text {
    let caller = msg.caller;
    let creatorOpt = usersByPrincipal.get(caller);
    let userOpt = usersById.get(userId);
    let tableOpt = tablesById.get(tableId);
    switch (creatorOpt, userOpt, tableOpt) {
      case (null, _, _) return "Caller not found.";
      case (_, null, _) return "User not found.";
      case (_, _, null) return "Table not found.";
      case (?creator, ?user, ?table) {
        if (!Array.find<Nat>(creator.tablesCreated, func (id) = id == tableId)) {
          return "You did not create this table.";
        };
        // Add pending request
        pendingJoinRequests.put((userId, tableId), caller);
        return "Join request sent.";
      }
    }
  }

  // Accept a join request to a table
  public func accept_join_table(tableId : Nat) : async Text {
    let caller = msg.caller;
    let userOpt = usersByPrincipal.get(caller);
    switch (userOpt) {
      case null return "User not found.";
      case (?user) {
        let userId = user.id;
        let pendingOpt = pendingJoinRequests.get((userId, tableId));
        switch (pendingOpt) {
          case null return "No pending request found.";
          case (?inviter) {
            // Add user to table's seats
            let tableOpt = tablesById.get(tableId);
            switch (tableOpt) {
              case null return "Table not found.";
              case (?table) {
                if (Array.find<Nat>(table.seats, func (id) = id == userId)) {
                  return "Already joined.";
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
                return "Joined the table.";
              }
            }
          }
        }
      }
    }
  }
}
