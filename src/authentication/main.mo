import Types "./types";
import TrieMap "mo:base/TrieMap";
import Iter "mo:base/Iter";
import Principal "mo:base/Principal";

actor Authentication {
  type User = Types.User;
  //the following variables are of necessity, stable
  stable var usersEntries : [(Principal, User)] = [];
  // private stable var usersByIdEntries : [(Nat, User)] = [];
  // private stable var nextId : Nat = 1;

  // Initialize TrieMaps
  let usersByPrincipal = TrieMap.fromEntries<Principal, User>(
    usersEntries.vals(), Principal.equal, Principal.hash
  );
  // private transient let usersById = TrieMap.fromEntries<Nat, User>(
  //   usersByIdEntries.vals(), Nat.equal, Hash.hash
  // );

  // System functions for upgrades
  system func preupgrade() {
    usersEntries := Iter.toArray(usersByPrincipal.entries());
    // usersByIdEntries := Iter.toArray(usersById.entries());
  };

  system func postupgrade() {
    usersEntries := [];
    // usersByIdEntries := [];
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
    // let userId = switch(existingUser) {
    //   case (?user) user.id;
    //   case null {
    //     let id = nextId;
    //     nextId += 1;
    //     id
    //   }
    // };

    let user : User = {
      // id = userId;
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
    // usersById.put(userId, user);
    "Profile registered/updated successfully."
  };

  // Get current user profile - FIXED: removed query since we need msg.caller
  //Functions for getting user profile(s)
  public shared(msg) func get_profile() : async ?User {
    usersByPrincipal.get(msg.caller)
  };
  //Get all users
   public query func get_all_users() : async [User] {
    Iter.toArray(usersByPrincipal.vals())
  };
  // Get user by Principal
  public query func get_user_by_principal(userPrincipal : Principal) : async ?User {
    usersByPrincipal.get(userPrincipal)
  };
}
