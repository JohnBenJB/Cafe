import Types "./types";
import TrieMap "mo:base/TrieMap";
import Iter "mo:base/Iter";
import Array "mo:base/Array";
import Hash "mo:base/Hash";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";

persistent actor Authentication {
  type User = Types.User;
  //the following variables are of necessity, stable
  private var usersEntries : [(Principal, User)] = [];
  private var usersByIdEntries : [(Nat, User)] = [];
  private var nextId : Nat = 1;

  // Initialize TrieMaps
  private transient let usersByPrincipal = TrieMap.fromEntries<Principal, User>(
    usersEntries.vals(), Principal.equal, Principal.hash
  );
  
  private transient let usersById = TrieMap.fromEntries<Nat, User>(
    usersByIdEntries.vals(), Nat.equal, Hash.hash
  );

  // System functions for upgrades
  system func preupgrade() {
    usersEntries := Iter.toArray(usersByPrincipal.entries());
    usersByIdEntries := Iter.toArray(usersById.entries());
  };

  system func postupgrade() {
    usersEntries := [];
    usersByIdEntries := [];
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

   public query func get_all_users() : async [User] {
    Iter.toArray(usersById.vals())
  };

  // Get user by ID
  public query func get_user_by_id(userId : Nat) : async ?User {
    usersById.get(userId)
  };
}